import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { Storage } from "@google-cloud/storage";
import { CloudTasksClient } from "@google-cloud/tasks";
import { PubSub } from "@google-cloud/pubsub";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { CloudSchedulerClient } from "@google-cloud/scheduler";

const localRoot = path.resolve(
  process.cwd(),
  process.env.LOCAL_DATA_DIR || ".local",
);
async function localWrite(kind: string, key: string, data: Buffer | string) {
  const f = path.join(localRoot, kind, key);
  await fs.mkdir(path.dirname(f), { recursive: true });
  await fs.writeFile(f, data);
  return f;
}
export class ArtifactStore {
  private storage = new Storage();
  constructor(private bucketName = process.env.ARTIFACT_BUCKET!) {}
  async put(
    key: string,
    data: Buffer | string,
    contentType = "application/octet-stream",
  ) {
    if (process.env.LOCAL_ARTIFACTS === "true")
      return `file://${await localWrite("artifacts", key, data)}`;
    await this.storage
      .bucket(this.bucketName)
      .file(key)
      .save(data, { contentType, resumable: false });
    return `gs://${this.bucketName}/${key}`;
  }
  async get(ref: string) {
    if (ref.startsWith("file://") || process.env.LOCAL_ARTIFACTS === "true") {
      let cleanRef = ref.replace(/^file:\/\/\/?/, "");
      if (cleanRef.includes(".local/artifacts/")) {
        cleanRef = cleanRef.split(".local/artifacts/")[1]!;
      } else if (cleanRef.includes("artifacts/")) {
        cleanRef = cleanRef.split("artifacts/")[1]!;
      }

      const candidates = [
        ref.replace(/^file:\/\/\/?/, ""),
        path.join(process.cwd(), ".local", "artifacts", cleanRef),
        path.join(process.cwd(), "artifacts", cleanRef),
        path.join(process.cwd(), "..", "browser-worker", ".local", "artifacts", cleanRef),
        path.join(process.cwd(), "..", "..", "apps", "browser-worker", ".local", "artifacts", cleanRef),
        path.join(process.cwd(), "..", "..", ".local", "artifacts", cleanRef),
      ];

      for (const p of candidates) {
        if (fsSync.existsSync(p) && !fsSync.statSync(p).isDirectory()) {
          return fs.readFile(p);
        }
      }
    }

    try {
      const key = ref.startsWith("gs://")
        ? ref.split("/").slice(3).join("/")
        : ref;
      const [buf] = await this.storage
        .bucket(this.bucketName)
        .file(key)
        .download();
      return buf;
    } catch (e: any) {
      throw new Error(`Artifact not found for ref '${ref}': ${e.message}`);
    }
  }
  async signedUrl(ref: string, minutes = 15) {
    if (ref.startsWith("file://")) return ref;
    const key = ref.startsWith("gs://")
      ? ref.split("/").slice(3).join("/")
      : ref;
    const [url] = await this.storage
      .bucket(this.bucketName)
      .file(key)
      .getSignedUrl({ action: "read", expires: Date.now() + minutes * 60_000 });
    return url;
  }
}
export class TaskQueue {
  private client = new CloudTasksClient();
  async enqueueRun(runId: string) {
    console.log(`[TASK_QUEUE] Enqueuing runId="${runId}" (LOCAL_TASKS=${process.env.LOCAL_TASKS}, WORKER_URL=${process.env.WORKER_URL})`);
    if (process.env.LOCAL_TASKS === "true") {
      const targetUrl = `${process.env.WORKER_URL}/internal/runs/${runId}/execute`;
      console.log(`[TASK_QUEUE] Sending HTTP POST to worker: ${targetUrl}`);
      const r = await fetch(
        targetUrl,
        {
          method: "POST",
          headers: {
            "x-internal-token": process.env.INTERNAL_WORKER_TOKEN || "",
          },
        },
      );
      if (!r.ok) {
        const errBody = await r.text();
        console.error(`[TASK_QUEUE ERROR] Worker POST to ${targetUrl} returned status ${r.status}: ${errBody}`);
        throw new Error(errBody);
      }
      console.log(`[TASK_QUEUE SUCCESS] Worker POST to ${targetUrl} returned 200 OK`);
      return;
    }
    const project = process.env.GOOGLE_CLOUD_PROJECT!,
      location = process.env.TASK_LOCATION || "us-central1",
      queue = process.env.TASK_QUEUE || "webpilot-runs";
    const parent = this.client.queuePath(project, location, queue);
    const url = `${process.env.WORKER_URL}/internal/runs/${runId}/execute`;
    await this.client.createTask({
      parent,
      task: {
        httpRequest: {
          httpMethod: "POST",
          url,
          oidcToken: {
            serviceAccountEmail: process.env.TASK_INVOKER_SA,
            audience:
              process.env.WORKER_AUDIENCE ||
              new URL(process.env.WORKER_URL!).origin,
          },
          headers: { "Content-Type": "application/json" },
          // Cloud Tasks sends a zero-byte body by default -- Fastify's
          // JSON body parser rejects that outright ("Body cannot be empty
          // when content-type is set to 'application/json'") before the
          // route handler ever runs, so every real (non-LOCAL_TASKS)
          // dispatch 400'd. The handler only needs runId from the URL, so
          // an empty JSON object is enough to satisfy the parser.
          body: Buffer.from(JSON.stringify({})),
        },
      },
    });
  }
}
export class EventBus {
  private pubsub = new PubSub();
  async publish(topic: string, payload: unknown) {
    if (process.env.LOCAL_PUBSUB === "true") return;
    await this.pubsub.topic(topic).publishMessage({ json: payload });
  }
}
export class SecretVault {
  private client = new SecretManagerServiceClient();
  async put(name: string, value: string) {
    if (process.env.LOCAL_SECRETS === "true")
      return `file://${await localWrite("secrets", `${name}.secret`, value)}`;
    const project = process.env.GOOGLE_CLOUD_PROJECT!;
    const parent = `projects/${project}`;
    const secretId = name.replace(/[^a-zA-Z0-9_-]/g, "-");
    const secretName = `${parent}/secrets/${secretId}`;
    try {
      await this.client.getSecret({ name: secretName });
    } catch {
      await this.client.createSecret({
        parent,
        secretId,
        secret: { replication: { automatic: {} } },
      });
    }
    const [v] = await this.client.addSecretVersion({
      parent: secretName,
      payload: { data: Buffer.from(value) },
    });
    return v.name!;
  }
  async get(versionName: string) {
    if (versionName.startsWith("file://"))
      return fs.readFile(versionName.slice(7), "utf8");
    const [v] = await this.client.accessSecretVersion({ name: versionName });
    return v.payload?.data?.toString() || "";
  }
}
export class SchedulerService {
  private client = new CloudSchedulerClient();
  async upsert(id: string, cron: string, timezone: string, targetUrl: string) {
    if (process.env.LOCAL_SCHEDULER === "true") return `local:${id}`;
    const project = process.env.GOOGLE_CLOUD_PROJECT!,
      location = process.env.TASK_LOCATION || "us-central1";
    const parent = this.client.locationPath(project, location);
    const name = `${parent}/jobs/${id}`;
    const job = {
      name,
      schedule: cron,
      timeZone: timezone,
      httpTarget: {
        uri: targetUrl,
        httpMethod: "POST" as const,
        oidcToken: {
          serviceAccountEmail: process.env.SCHEDULER_INVOKER_SA,
          audience: process.env.SCHEDULER_AUDIENCE || new URL(targetUrl).origin,
        },
      },
    };
    try {
      await this.client.getJob({ name });
      await this.client.updateJob({ job });
    } catch {
      await this.client.createJob({ parent, job });
    }
    return name;
  }
  async remove(name: string) {
    if (process.env.LOCAL_SCHEDULER === "true" || name.startsWith("local:"))
      return;
    await this.client.deleteJob({ name }).catch((e: any) => {
      if (e?.code !== 5) throw e;
    });
  }
}
