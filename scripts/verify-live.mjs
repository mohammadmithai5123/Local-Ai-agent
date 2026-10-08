// Explicit opt-in check: real Gemini requests, synthetic imported leads, no Gmail sends.
import { existsSync,mkdtempSync,rmSync,mkdirSync,writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
if(existsSync('.env'))process.loadEnvFile('.env');
const evidence={checked:new Date().toISOString(),status:'blocked',reason:'Private key, unbilled-project confirmation and data consent are required.',fixture:'Synthetic imported prospects; no real email send'};
mkdirSync('test-results',{recursive:true});
if(!process.env.GEMINI_API_KEY||process.env.FREE_TIER_CONFIRMED!=='true'||process.env.AI_DATA_CONSENT!=='true'){writeFileSync('test-results/live-ai-verification.json',JSON.stringify(evidence,null,2));console.log(evidence.reason);process.exitCode=2;}
else {
 let stage='startup';let diagnostics=[];const stages={connectivity:false,planning:false,oneLiveDraft:false,multiLeadCompletion:false};
 const directory=mkdtempSync(join(tmpdir(),'workbench-live-')),port=42000+Math.floor(Math.random()*10000);
 const child=spawn(process.execPath,['--dns-result-order=ipv4first','--experimental-sqlite','.runtime/server/index.js','--production'],{env:{...process.env,PORT:String(port),DB_PATH:join(directory,'fixture.sqlite'),GMAIL_ENABLE_SENDING:'false',GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:''},stdio:['ignore','pipe','pipe']});
 try {
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Local verification server did not start within 60 seconds')),60000);child.stdout.on('data',d=>{if(d.toString().includes('Workbench ready')){clearTimeout(timer);resolve();}});child.on('exit',()=>{clearTimeout(timer);reject(Error('Local verification server exited'));});});
 const call=async(path,data)=>{const response=await fetch(`http://localhost:${port}/api/${path}`,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const json=await response.json();if(!response.ok)throw Error(json.error||'Verification request failed');return json;};
 stage='connectivity';await call('health',{});stages.connectivity=true;
 const upload=await call('import/preview',{name:'live-synthetic-fixture.csv',content:Buffer.from('name,email,company,city\nAyesha Khan,ayesha@example.com,Harbor Design,Karachi\nBilal Ahmed,bilal@example.com,North Studio,Lahore').toString('base64')});
 await call('import/commit',{id:upload.id,mapping:{name:0,email:1,company:2,city:3}});
 stage='planning';const task=await call('chat',{requestId:randomUUID(),mode:'live',text:'Karachi ke 1 lead ka Roman Urdu website service draft banao.'});
 let state=await call('state');const planningDeadline=Date.now()+100000;while(state.tasks.find(t=>t.id===task.id).state==='needs_user'&&Date.now()<planningDeadline){await new Promise(r=>setTimeout(r,300));state=await call('state');}const planned=state.tasks.find(t=>t.id===task.id);assert.equal(planned.state,'paused',planned.reason||'Live planning did not create a reviewable task');assert.equal(planned.total,1,'Planning selection failed: expected exactly one labeled Karachi sample');const selected=state.steps.find(s=>s.task_id===task.id);assert.equal(state.leads.find(l=>l.id===selected.lead_id).city,'Karachi');
 stages.planning=true;stage='one-lead draft';await call(`tasks/${task.id}/start`,{});
 const deadline=Date.now()+120000;do{await new Promise(r=>setTimeout(r,1000));state=await call('state');}while(['queued','running'].includes(state.tasks.find(t=>t.id===task.id).state)&&Date.now()<deadline);
 assert.equal(state.tasks.find(t=>t.id===task.id).state,'completed',state.tasks.find(t=>t.id===task.id).reason);const draft=state.drafts.find(d=>d.task_id===task.id);assert.ok(draft?.body.includes('Ayesha'));assert.ok(draft.body.includes('Harbor'));if(process.env.OUTREACH_LANGUAGE==='english')assert.match(draft.body,/\b(you|your|the|would)\b/i);else assert.match(draft.body,/\b(aap|ke|liye|hain|salam|Assalam)\b/i);assert.equal(state.mailActions.length,0);
 assert.equal(draft.mode,'live');stages.oneLiveDraft=true;stage='multi-lead workflow';const uae=await call('setup/workflow',{mode:'live',requestId:randomUUID()});assert.equal(uae.drafts,2);state=await call('state');const uaeDrafts=state.drafts.filter(d=>d.task_id===uae.taskId);assert.equal(uaeDrafts.length,2);assert.ok(uaeDrafts.every(d=>d.mode==='live'&&/e.?commerce|e.?kommerce/i.test(d.body)&&/website|web.?site/i.test(d.body)));assert.equal(state.mailActions.length,0);
 stages.multiLeadCompletion=true;stage='complete';evidence.status='passed';evidence.reason='Real Gemini connection, original Roman Urdu city check and UAE hardware-store website-service selection/personalized draft persistence passed against isolated imported samples. No email sent.';
 }catch(error){evidence.status='failed';evidence.reason=error.message;process.exitCode=1;}
 finally{try{const r=await fetch(`http://localhost:${port}/api/state`);diagnostics=(await r.json()).aiRequests||[];}catch{}evidence.stage=stage;evidence.stages=stages;evidence.requests=diagnostics;child.kill();await new Promise(r=>{if(child.exitCode!==null)r();else child.once('exit',r);});rmSync(directory,{recursive:true,force:true});writeFileSync('test-results/live-ai-verification.json',JSON.stringify(evidence,null,2));console.log(evidence.reason);}
}
