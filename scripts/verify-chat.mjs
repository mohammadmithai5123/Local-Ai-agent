// Opt-in real provider check through the exact dashboard HTTP contract; never sends mail.
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
if(!process.argv.includes('--live'))throw Error('Use --live only after private free-tier/data consent setup.');
if(existsSync('.env'))process.loadEnvFile('.env');
if(!process.env.GEMINI_API_KEY||process.env.FREE_TIER_CONFIRMED!=='true'||process.env.AI_DATA_CONSENT!=='true')throw Error('Private live configuration/consent missing.');
const dir=mkdtempSync(join(tmpdir(),'chat-live-')),port=31000+Math.floor(Math.random()*10000);
const env={...process.env,PORT:String(port),DB_PATH:join(dir,'test.sqlite'),GMAIL_ENABLE_SENDING:'false',GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'',GMAIL_SENDER_EMAIL:'',GOOGLE_REDIRECT_URI:''};
let child;
const call=async(path,body)=>{const r=await fetch(`http://localhost:${port}/api/${path}`,body===undefined?{signal:AbortSignal.timeout(10000)}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});assert.equal(r.status,200,`HTTP status for ${path}`);return r.json();};
async function launch(){child=spawn(process.execPath,['--dns-result-order=ipv4first','--experimental-sqlite','.runtime/server/index.js','--production'],{env,stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server start timeout')),20000);child.stdout.on('data',d=>{if(d.toString().includes('Workbench ready')){clearTimeout(timer);resolve();}});child.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited'));});});}
async function stop(){if(!child)return;const current=child;child=null;current.kill();await new Promise(r=>current.exitCode!==null?r():current.once('exit',r));}
async function settle(id,allowPaused=false){const deadline=Date.now()+180000;while(Date.now()<deadline){const s=await call('state'),r=s.chatRequests.find(r=>r.id===id),t=s.tasks.find(t=>t.id===r?.task_id);if(r?.state==='completed'||t?.state==='completed'||allowPaused&&t?.state==='paused')return {s,r,t};if(r?.state==='paused'||t&&['paused','failed','cancelled'].includes(t.state))throw Error(JSON.stringify({stage:t?'tool':'classification',requestState:r?.state,taskState:t?.state,provider:s.connection.code,reason:t?.reason||r?.reason,requests:s.aiRequests?.map(x=>({stage:x.stage,status:x.httpStatus,attempt:x.attempt}))}));await new Promise(r=>setTimeout(r,250));}throw Error('Chat exceeded bounded verification wait');}
try{
 await launch();
 let conversationIds=[];
 for(const [label,text] of [['greeting','Hello!'],['question','What can you help me do in this workbench?'],['unsupported','Delete my Google account now.']]){
  const request={text,mode:'live',requestId:randomUUID()},submitted=await call('chat',request);
  assert.equal((await call('chat',request)).duplicate,true);
  const {s,r}=await settle(submitted.id);
  assert.equal(r.state,'completed');assert.equal(s.tasks.length,0);assert.equal(s.drafts.length,0);
  assert.ok(s.chat.some(m=>m.role==='assistant'&&m.text.trim()));

  assert.equal(s.gmail.sendingEnabled,false);conversationIds.push(submitted.id);
  console.log(JSON.stringify({flow:label,live:true,persistedReply:true,duplicatePrevented:true,leadSteps:0,sending:false}));
 }
 const csv='name,email,company,city,country,industry\nSample Hardware,sample-hardware@example.com,Sample Hardware Store,Dubai,UAE,hardware\nSample Other,sample-other@example.com,Sample Clothing Store,Dubai,UAE,clothing';
 const preview=await call('import/preview',{name:'chat-sample.csv',content:Buffer.from(csv).toString('base64')});
 await call('import/commit',{id:preview.id,mapping:{name:0,email:1,company:2,city:3,country:4,industry:5}});
 const submitted=await call('chat',{text:'UAE ke hardware stores select karo aur meri e-commerce website development service ke personalized drafts banao.',mode:'live',requestId:randomUUID()});
 const {t}=await settle(submitted.id);assert.equal(t.total,1);assert.equal(t.state,'completed');
 const deadline=Date.now()+100000;let saved;
 while(Date.now()<deadline){const s=await call('state'),task=s.tasks.find(x=>x.id===t.id);if(task.state==='completed'){saved=s;break;}if(['failed','paused','needs_user'].includes(task.state))throw Error(`Draft stage stopped: ${task.state}`);await new Promise(r=>setTimeout(r,300));}
 assert.ok(saved,'Draft timeout');assert.equal(saved.drafts.length,1);assert.equal(saved.drafts[0].mode,'live');assert.match(saved.drafts[0].body,/Sample Hardware|Hardware Store/i);assert.match(saved.drafts[0].body,/e-commerce|ecommerce|website/i);
 const set=saved.resultSets[0];const exportRequest=await call('chat',{text:'Inki CSV bana do',mode:'live',requestId:randomUUID()});const exportedState=(await settle(exportRequest.id)).s;const exportId=exportedState.resultSets[0].export.id;const downloaded=await fetch(`http://localhost:${port}/api/exports/${exportId}.csv`);assert.match(downloaded.headers.get('content-type')||'',/text\/csv/);const csvContent=await downloaded.text();assert.match(csvContent,/Sample Hardware/);assert.doesNotMatch(csvContent,/Sample Other/);const messages=exportedState.chat.length;await stop();await launch();const reopened=await call('state');assert.equal(reopened.chat.length,messages);assert.equal(reopened.drafts.length,1);assert.ok(conversationIds.every(id=>reopened.chatRequests.some(r=>r.id===id&&r.state==='completed')));assert.equal(reopened.gmail.sendingEnabled,false);
 assert.equal(await(await fetch(`http://localhost:${port}/api/exports/${exportId}.csv`)).text(),csvContent);
 console.log(JSON.stringify({flow:'selected-csv',downloaded:true,selectedSetOnly:true,restartAccess:true}));
 const discoveryRequest=await call('chat',{text:'UAE mein 10 hardware companies dhoondo',mode:'live',requestId:randomUUID()});const discovery=await settle(discoveryRequest.id,true);const result=discovery.s.resultSets.find(s=>s.request_id===discoveryRequest.id);assert.ok(result);if(!discovery.s.search.configured){assert.equal(discovery.t.state,'paused');assert.equal(result.rows.length,0);assert.match(discovery.t.reason,/not connected/);console.log(JSON.stringify({flow:'public-discovery',liveRetrievalVerified:false,status:'blocked: private free search setup missing',fabricatedResults:0}));}else{assert.ok(result.rows.length>0,'No source-backed results obtained');console.log(JSON.stringify({flow:'public-discovery',liveRetrievalVerified:true,resultCount:result.rows.length,state:result.state}));}
 console.log(JSON.stringify({flow:'roman-urdu-drafts',selected:1,persistedLiveDrafts:1,personalization:true,restartPersistence:true,sending:false,model:reopened.connection.model}));
}catch(error){console.error(JSON.stringify({passed:false,error:error instanceof Error?error.message:'Verification failed'}));process.exitCode=1;}
finally{await stop();rmSync(dir,{recursive:true,force:true});}
