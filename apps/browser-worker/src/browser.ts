import type { BrowserContext, Page } from "playwright";
import type { ExtractionSchema, Locator, WorkflowStep } from "@webpilot/contracts";
import { assertSafeUrl, redactSecrets } from "@webpilot/security";

export function resolveLocator(page:Page, l?:Locator){
 if(!l) throw new Error("Locator is required");
 switch(l.strategy){
  case "role": return page.getByRole(l.role as any,{name:l.name||l.value});
  case "label": return page.getByLabel(l.value||l.name||"");
  case "placeholder": return page.getByPlaceholder(l.value||"");
  case "testId": return page.getByTestId(l.value||"");
  case "text": return page.getByText(l.value||l.name||"",{exact:false});
  case "css": return page.locator(l.value||"");
 }
}
export async function installNetworkGuard(context:BrowserContext){
 await context.route("**/*",async route=>{try{await assertSafeUrl(route.request().url());await route.continue();}catch{await route.abort("blockedbyclient");}});
}
export async function compactDom(page:Page){
 const html=await page.locator("body").evaluate(el=>{const clone=el.cloneNode(true) as HTMLElement;clone.querySelectorAll("script,style,svg,noscript").forEach(x=>x.remove());return clone.innerText.slice(0,35000)+"\n\nINTERACTIVE:\n"+[...clone.querySelectorAll("a,button,input,select,textarea,[role]")].slice(0,300).map((e:any)=>`${e.tagName} role=${e.getAttribute("role")||""} text=${(e.innerText||e.getAttribute("aria-label")||e.getAttribute("placeholder")||"").slice(0,120)} id=${e.id||""} testid=${e.getAttribute("data-testid")||""}`).join("\n")});
 return redactSecrets(html);
}
export async function detectChallenge(page:Page){const text=(await page.locator("body").innerText().catch(()=>"")).toLowerCase();return /captcha|verify you are human|cloudflare|turnstile|hcaptcha|recaptcha/.test(text);}
export async function extractRecords(page:Page,schema:ExtractionSchema){
 const records:any[]=[]; const containers=schema.recordLocator?resolveLocator(page,schema.recordLocator):page.locator("body"); const count=Math.max(1,await containers.count());
 for(let i=0;i<count;i++){const base=schema.recordLocator?containers.nth(i):page.locator("body");const rec:any={};for(const f of schema.fields){let loc=f.locator?resolveWithin(base,f.locator):base;let raw=f.attribute?await loc.getAttribute(f.attribute):await loc.first().innerText().catch(()=>"");raw=raw??"";rec[f.name]=coerce(raw,f.type);}records.push(rec);}
 return records;
}
function resolveWithin(base:any,l:Locator){switch(l.strategy){case"role":return base.getByRole(l.role,{name:l.name||l.value});case"label":return base.getByLabel(l.value||l.name||"");case"placeholder":return base.getByPlaceholder(l.value||"");case"testId":return base.getByTestId(l.value||"");case"text":return base.getByText(l.value||l.name||"",{exact:false});case"css":return base.locator(l.value||"");}}
function coerce(raw:string,type:string){const x=raw.trim();if(type==="number")return Number(x.replace(/[^0-9.-]/g,""));if(type==="boolean")return /true|yes|available|active/i.test(x);if(type==="array")return x.split(/[,\n]/).map(v=>v.trim()).filter(Boolean);return x;}
export async function executeStep(page:Page,step:WorkflowStep,credentials:Record<string,string>,schema:ExtractionSchema){
 switch(step.type){
  case"NAVIGATE": if(!step.url)throw new Error("NAVIGATE url missing");await page.goto(step.url,{waitUntil:"domcontentloaded",timeout:30000});return;
  case"CLICK": await resolveLocator(page,step.locator).first().click({timeout:12000});return;
  case"TYPE": {const v=step.credentialRef?credentials[step.credentialRef.replace(/^connection\./,"")]:step.value;if(v==null)throw new Error(`Missing value for ${step.id}`);await resolveLocator(page,step.locator).first().fill(v);return;}
  case"SELECT": await resolveLocator(page,step.locator).first().selectOption(step.value||"");return;
  case"CHECK": await resolveLocator(page,step.locator).first().check();return;
  case"UNCHECK": await resolveLocator(page,step.locator).first().uncheck();return;
  case"SCROLL": await page.mouse.wheel(0,Number(step.value||1200));return;
  case"WAIT_FOR": await resolveLocator(page,step.locator).first().waitFor({state:"visible",timeout:Number(step.value||10000)});return;
  case"ASSERT": if(!(await resolveLocator(page,step.locator).first().isVisible()))throw new Error(`Assertion failed: ${step.description}`);return;
  case"SCREENSHOT": return;
  case"DOWNLOAD": {const dl=page.waitForEvent("download");await resolveLocator(page,step.locator).first().click();return (await dl).path();}
  case"UPLOAD": throw new Error("UPLOAD requires an explicit file connection and is disabled by default");
  case"EXTRACT": return extractRecords(page,schema);
  case"DONE": return;
 }
}
