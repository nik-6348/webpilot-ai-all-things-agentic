import { Storage } from "@google-cloud/storage";
import { CloudTasksClient } from "@google-cloud/tasks";
import { PubSub } from "@google-cloud/pubsub";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { CloudSchedulerClient } from "@google-cloud/scheduler";

export class ArtifactStore {
  private storage = new Storage();
  constructor(private bucketName = process.env.ARTIFACT_BUCKET!) {}
  async put(path:string, data:Buffer|string, contentType="application/octet-stream") { await this.storage.bucket(this.bucketName).file(path).save(data,{contentType,resumable:false}); return `gs://${this.bucketName}/${path}`; }
  async get(path:string) { const [buf] = await this.storage.bucket(this.bucketName).file(path).download(); return buf; }
  async signedUrl(path:string, minutes=15) { const [url] = await this.storage.bucket(this.bucketName).file(path).getSignedUrl({action:"read",expires:Date.now()+minutes*60_000}); return url; }
}
export class TaskQueue {
  private client = new CloudTasksClient();
  async enqueueRun(runId:string) {
    if (process.env.LOCAL_TASKS === "true") { const r=await fetch(`${process.env.WORKER_URL}/internal/runs/${runId}/execute`,{method:"POST",headers:{"x-internal-token":process.env.INTERNAL_WORKER_TOKEN||""}}); if(!r.ok) throw new Error(await r.text()); return; }
    const project=process.env.GOOGLE_CLOUD_PROJECT!, location=process.env.TASK_LOCATION||"us-central1", queue=process.env.TASK_QUEUE||"webpilot-runs";
    const parent=this.client.queuePath(project,location,queue); const url=`${process.env.WORKER_URL}/internal/runs/${runId}/execute`;
    await this.client.createTask({parent,task:{httpRequest:{httpMethod:"POST",url,oidcToken:{serviceAccountEmail:process.env.TASK_INVOKER_SA},headers:{"Content-Type":"application/json"}}}});
  }
}
export class EventBus { private pubsub=new PubSub(); async publish(topic:string,payload:unknown){ if(process.env.LOCAL_PUBSUB==="true") return; await this.pubsub.topic(topic).publishMessage({json:payload}); } }
export class SecretVault {
  private client=new SecretManagerServiceClient();
  async put(name:string,value:string){ const project=process.env.GOOGLE_CLOUD_PROJECT!; const parent=`projects/${project}`; const secretId=name.replace(/[^a-zA-Z0-9_-]/g,"-"); const secretName=`${parent}/secrets/${secretId}`; try{await this.client.getSecret({name:secretName});}catch{await this.client.createSecret({parent,secretId,secret:{replication:{automatic:{}}}});} const [v]=await this.client.addSecretVersion({parent:secretName,payload:{data:Buffer.from(value)}}); return v.name!; }
  async get(versionName:string){ const [v]=await this.client.accessSecretVersion({name:versionName}); return v.payload?.data?.toString()||""; }
}
export class SchedulerService {
  private client=new CloudSchedulerClient();
  async upsert(id:string,cron:string,timezone:string,targetUrl:string){ if(process.env.LOCAL_SCHEDULER==="true") return `local:${id}`; const project=process.env.GOOGLE_CLOUD_PROJECT!,location=process.env.TASK_LOCATION||"us-central1"; const parent=this.client.locationPath(project,location); const name=`${parent}/jobs/${id}`; const job={name,schedule:cron,timeZone:timezone,httpTarget:{uri:targetUrl,httpMethod:"POST" as const,oidcToken:{serviceAccountEmail:process.env.SCHEDULER_INVOKER_SA}}}; try{await this.client.getJob({name}); await this.client.updateJob({job});}catch{await this.client.createJob({parent,job});} return name; }
}
