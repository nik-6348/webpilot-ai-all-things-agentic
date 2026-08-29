import fs from "node:fs";import path from "node:path";
const required=["apps/web/src/app/page.tsx","apps/api/src/main.ts","apps/browser-worker/src/engine.ts","apps/notifier/src/main.ts","apps/demo-portal/src/main.ts","packages/database/prisma/schema.prisma","infra/terraform/main.tf","cloudbuild.yaml","docs/VALIDATION.md"];
let bad=false;for(const f of required){if(!fs.existsSync(f)){console.error("MISSING",f);bad=true}}
function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if([".git","node_modules"].includes(e.name))continue;const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(/\.(ts|tsx|js|mjs)$/.test(e.name)){const s=fs.readFileSync(p,"utf8");if(/new\s+Function\s*\(|\beval\s*\(/.test(s)){console.error("UNSAFE_DYNAMIC_CODE",p);bad=true}}}}
walk(".");if(bad)process.exit(1);console.log("preflight: OK");
