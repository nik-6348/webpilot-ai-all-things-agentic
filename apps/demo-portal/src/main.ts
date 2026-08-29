import Fastify from "fastify";
const app = Fastify({ logger: false });
let version: "v1" | "v2" = "v1";
let challenge = false;
const orders = [
  {
    id: "PO-8401",
    supplier: "Aster Components",
    status: "Delayed",
    eta: "2026-09-03",
    amount: "$18,400",
  },
  {
    id: "PO-8402",
    supplier: "Nova Industrial",
    status: "On Track",
    eta: "2026-08-31",
    amount: "$9,760",
  },
  {
    id: "PO-8403",
    supplier: "Vertex Parts",
    status: "Delayed",
    eta: "2026-09-05",
    amount: "$27,200",
  },
];
const shell = (body: string) =>
  `<!doctype html><html><head><title>SupplierHub Demo</title><style>body{font-family:Inter,system-ui;background:#0b1020;color:#eef2ff;margin:0}.nav{padding:18px 32px;background:#121a30;display:flex;justify-content:space-between}.wrap{max-width:1000px;margin:40px auto;padding:0 24px}.card{background:#111a2d;border:1px solid #263352;border-radius:16px;padding:22px;margin:14px 0}button,a{background:#7657ff;color:white;border:0;border-radius:10px;padding:11px 16px;text-decoration:none;cursor:pointer}.muted{color:#92a0bf}.row{display:grid;grid-template-columns:1fr 1.6fr 1fr 1fr 1fr;gap:12px}</style></head><body><div class="nav"><b>SupplierHub</b><span class="muted">Authorized demo portal • ${version.toUpperCase()}</span></div><div class="wrap">${body}</div></body></html>`;
app.get("/", async (_, reply) =>
  reply
    .type("text/html")
    .send(
      shell(
        `<h1>Supplier operations portal</h1><p class="muted">Review purchase orders and delivery exceptions.</p>${version === "v1" ? '<a id="view-orders" href="/orders">View Orders</a>' : '<a data-testid="orders-action" aria-label="Open purchase orders" href="/orders">Purchase Orders</a>'}`,
      ),
    ),
);
app.get("/orders", async (_, reply) => {
  if (challenge)
    return reply
      .type("text/html")
      .send(
        shell(
          `<h2>Verify you are human</h2><div class="card">Demo CAPTCHA / human verification required.</div>`,
        ),
      );
  return reply
    .type("text/html")
    .send(
      shell(
        `<h1>${version === "v1" ? "Orders" : "Purchase order center"}</h1><div class="card row"><b>ID</b><b>Supplier</b><b>Status</b><b>ETA</b><b>Amount</b></div>${orders.map((o) => `<div class="card order-row row"><span class="order-id">${o.id}</span><span class="supplier">${o.supplier}</span><span class="status">${o.status}</span><span class="eta">${o.eta}</span><span class="amount">${o.amount}</span></div>`).join("")}`,
      ),
    );
});
app.get("/admin", async (_, reply) =>
  reply
    .type("text/html")
    .send(
      shell(
        `<h1>Demo controls</h1><div class="card">Portal version: <b>${version}</b><br><br><form method="post" action="/admin/toggle"><button>Switch DOM version</button></form></div><div class="card">Challenge: <b>${challenge}</b><br><br><form method="post" action="/admin/challenge"><button>Toggle human verification</button></form></div>`,
      ),
    ),
);
app.post("/admin/toggle", async (_, reply) => {
  version = version === "v1" ? "v2" : "v1";
  return reply.redirect("/admin");
});
app.post("/admin/challenge", async (_, reply) => {
  challenge = !challenge;
  return reply.redirect("/admin");
});
app.get("/health/live", async () => ({ ok: true, version, challenge }));
await app.listen({ port: Number(process.env.PORT || 4200), host: "0.0.0.0" });
