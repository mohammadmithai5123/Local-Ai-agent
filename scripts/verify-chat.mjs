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
async function settle(id){const deadline=Date.now()+100000;while(Date.now()<deadline){const s=await call('state'),t=s.tasks.find(t=>t.id===id);if(t&&!t.planning)return {s,t};if(t&&['paused','failed','cancelled'].includes(t.state))throw Error(`Chat stage stopped: ${t.state}; inspect safe connection diagnostics`);await new Promise(r=>setTimeout(r,250));}throw Error('Chat response exceeded bounded verification wait');}
try{
 await launch();
 let conversationIds=[];
 for(const [label,text] of [['greeting','Hello!'],['question','What can you help me do in this workbench?'],['unsupported','Search the live web for hardware stores and send emails to them now.']]){
  const request={text,mode:'live',requestId:randomUUID()},submitted=await call('chat',request);
  assert.equal((await call('chat',request)).duplicate,true);
  const {s,t}=await settle(submitted.id);
  assert.equal(t.state,'completed');assert.equal(t.total,0);assert.equal(s.drafts.length,0);
  assert.ok(s.chat.some(m=>m.role==='assistant'&&m.text.trim()));
  assert.match(t.reason,label==='unsupported'?/Unsupported request/:/Conversation reply/);
  assert.equal(s.gmail.sendingEnabled,false);conversationIds.push(submitted.id);
  console.log(JSON.stringify({flow:label,live:true,persistedReply:true,duplicatePrevented:true,leadSteps:0,sending:false}));
 }
 const csv='name,email,company,city,country,industry\nSample Hardware,sample-hardware@example.com,Sample Hardware Store,Dubai,UAE,hardware\nSample Other,sample-other@example.com,Sample Clothing Store,Dubai,UAE,clothing';
 const preview=await call('import/preview',{name:'chat-sample.csv',content:Buffer.from(csv).toString('base64')});
 await call('import/commit',{id:preview.id,mapping:{name:0,email:1,company:2,city:3,country:4,industry:5}});
 const submitted=await call('chat',{text:'UAE ke hardware stores select karo aur meri e-commerce website development service ke personalized drafts banao.',mode:'live',requestId:randomUUID()});
 const {t}=await settle(submitted.id);assert.equal(t.total,1);assert.equal(t.state,'paused');
 await call(`tasks/${t.id}/start`,{});
 const deadline=Date.now()+100000;let saved;
 while(Date.now()<deadline){const s=await call('state'),task=s.tasks.find(x=>x.id===t.id);if(task.state==='completed'){saved=s;break;}if(['failed','paused','needs_user'].includes(task.state))throw Error(`Draft stage stopped: ${task.state}`);await new Promise(r=>setTimeout(r,300));}
 assert.ok(saved,'Draft timeout');assert.equal(saved.drafts.length,1);assert.equal(saved.drafts[0].mode,'live');assert.match(saved.drafts[0].body,/Sample Hardware|Hardware Store/i);assert.match(saved.drafts[0].body,/e-commerce|ecommerce|website/i);
 const messages=saved.chat.length;await stop();await launch();const reopened=await call('state');assert.equal(reopened.chat.length,messages);assert.equal(reopened.drafts.length,1);assert.ok(conversationIds.every(id=>reopened.tasks.some(t=>t.id===id&&t.state==='completed')));assert.equal(reopened.gmail.sendingEnabled,false);
 console.log(JSON.stringify({flow:'roman-urdu-drafts',selected:1,persistedLiveDrafts:1,personalization:true,restartPersistence:true,sending:false,model:reopened.connection.model}));
}catch(error){console.error(JSON.stringify({passed:false,error:error instanceof Error?error.message:'Verification failed'}));process.exitCode=1;}
finally{await stop();rmSync(dir,{recursive:true,force:true});}
