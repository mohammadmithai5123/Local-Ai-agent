import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../server/store.js';
import {Supervisor} from '../server/supervisor.js';
import {ChatEngine} from '../server/chat-engine.js';
import {planSchema,RateLimit} from '../server/provider.js';
import {validateCompanies,searchPublic,explicitContacts,extractCompanies} from '../server/discovery.js';
import {exportCsv,prepareExport,resultSnapshot,addRows,csvCell} from '../server/results.js';
import {cleanupDemo} from '../server/demo-cleanup.js';
import {exportData,restoreData} from '../server/data-backup.js';

const query={country:'UAE',industry:'hardware',limit:10};
const page={url:'https://hardware.example.com/about',title:'Sample Hardware',content:'Sample Hardware supplies hardware in Dubai. Website https://hardware.example.com Email info@hardware.example.com Phone +971 555 12345',retrieved_at:'2026-10-10T00:00:00Z'};
const candidate={name:'Sample Hardware',location:'Dubai',website:'https://hardware.example.com',email:'info@hardware.example.com',phone:'+971 555 12345',nameEvidence:'Sample Hardware',locationEvidence:'in Dubai',categoryEvidence:'supplies hardware',emailEvidence:page.content,phoneEvidence:page.content};
const intent=(kind:string)=>planSchema.parse({...query,city:'',company:'',language:'english',reply:'Useful reply',kind});
test('source validation requires exact company/location/category evidence, blanks invented contacts, deduplicates and safely quotes CSV',()=>{
 const rows=validateCompanies(page,query,{companies:[candidate,{...candidate,name:'Invented',nameEvidence:'Not present'}, {...candidate,nameEvidence:'Sample Hardware',email:'invented@example.com',phone:'123456789'}]});
 assert.equal(rows.length,2);assert.equal(rows[1].email,'');assert.equal(rows[1].phone,'');
 assert.equal(validateCompanies(page,{...query,country:'Pakistan'},{companies:[candidate]}).length,0);
 for(const field of ['locationEvidence','nameEvidence','categoryEvidence'])assert.equal(validateCompanies(page,query,{companies:[candidate,{...candidate,[field]:'   '}]}).length,1,'Incomplete evidence rejects only that candidate, never valid siblings or the whole source');
 const db=openStore(':memory:');try{db.prepare('INSERT INTO result_sets VALUES(?,?,?,?,?,?,?,?)').run('set','request','UAE hardware','public-tavily',10,'partial','Only source evidence retained','2026-10-10');assert.equal(addRows(db,'set',rows,10),1);
  const exported:any=prepareExport(db,'set'),csv=exportCsv(db,String(exported.id));assert.match(csv.content,/Sample Hardware/);assert.match(csv.content,/info@hardware.example.com/);
  const old=csv.content;addRows(db,'set',[{...rows[0],name:'Another'}],10);assert.equal(exportCsv(db,String(exported.id)).content,old,'CSV snapshot cannot grow after resume');
  const updated:any=prepareExport(db,'set');assert.notEqual(updated.id,exported.id);assert.match(updated.filename,/2-results/);assert.equal(resultSnapshot(db)[0].exports.length,2);assert.equal(prepareExport(db,'set').id,updated.id);
  assert.equal(csvCell('=HYPERLINK("bad")'),'"\'=HYPERLINK(""bad"")"');assert.equal(csvCell(' \t+123'),'"\' \t+123"');assert.equal(csvCell('نام,\n"Company"'),'"نام,\n""Company"""');
 }finally{db.close();}
});

test('explicit contacts require same-line company association and leave ambiguous/directory contacts unknown',()=>{
 const row=validateCompanies(page,query,{companies:[{...candidate,email:'',phone:'',website:''}]})[0];
 assert.equal(explicitContacts(page,row).email,'info@hardware.example.com');
 assert.equal(explicitContacts(page,row).phone,'+971 555 12345');
 assert.equal(explicitContacts({...page,content:'Directory operator email operator@example.com\nSample Hardware supplies tools in Dubai'},row).email,'');
 assert.equal(explicitContacts({...page,content:'Sample Hardware email a@example.com or b@example.com'},row).email,'');
});

test('three cached sources use one interpretation call; quota persists progress/count without invented retry timing',async()=>{
 const originalFetch=globalThis.fetch,saved={...process.env};Object.assign(process.env,{GEMINI_API_KEY:'private-test',FREE_TIER_CONFIRMED:'true',AI_DATA_CONSENT:'true',GEMINI_MODEL:'gemini-3.5-flash-lite',TAVILY_API_KEY:'private-search',SEARCH_FREE_TIER_CONFIRMED:'true',SEARCH_DATA_CONSENT:'true'});
 const db=openStore(':memory:');let calls=0,searches=0;const engine=new ChatEngine(db,async()=>intent('discovery'),async()=>{searches++;return [page,page,page];},extractCompanies);const sup=new Supervisor(db);sup.tools=()=>engine.tick();
 try{engine.submit('batch','Find hardware','live');await sup.tick();await sup.tick();globalThis.fetch=async()=>{calls++;return new Response('{}',{status:429});};await sup.tick();assert.equal(calls,1);assert.match(String(db.prepare("SELECT reason FROM tasks WHERE id='batch'").get()!.reason),/0 of 10 verified; paused due to AI quota/);assert.equal(db.prepare('SELECT count(*) n FROM task_retry_holds').get()!.n,0);assert.equal(db.prepare("SELECT cursor FROM tool_jobs WHERE task_id='batch'").get()!.cursor,0);
 globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({pages:[0,1,2].map(index=>({index,companies:[{name:candidate.name,location:candidate.location,nameEvidence:candidate.nameEvidence,locationEvidence:candidate.locationEvidence,categoryEvidence:candidate.categoryEvidence}]}))})}]}}]}));};sup.control('batch','resume');await sup.tick();await sup.tick();assert.equal(searches,1);assert.equal(calls,2);assert.equal(db.prepare("SELECT cursor FROM tool_jobs WHERE task_id='batch'").get()!.cursor,3);assert.equal(resultSnapshot(db)[0].rows.length,1);assert.equal(JSON.parse(String(db.prepare("SELECT args FROM tool_jobs WHERE task_id='batch'").get()!.args)).extractionStats.calls,2);
 }finally{db.close();globalThis.fetch=originalFetch;for(const key of ['GEMINI_API_KEY','FREE_TIER_CONFIRMED','AI_DATA_CONSENT','GEMINI_MODEL','TAVILY_API_KEY','SEARCH_FREE_TIER_CONFIRMED','SEARCH_DATA_CONSENT']){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
});

test('legacy unique export migration preserves every snapshot and allows new versions after reopen',()=>{
 const dir=mkdtempSync(join(tmpdir(),'export-migration-')),path=join(dir,'store.sqlite');let db=openStore(path);try{db.exec("DROP TABLE result_exports; CREATE TABLE result_exports(id TEXT PRIMARY KEY,set_id TEXT UNIQUE NOT NULL REFERENCES result_sets(id),filename TEXT NOT NULL,created TEXT NOT NULL,content TEXT NOT NULL DEFAULT '')");db.prepare('INSERT INTO result_sets VALUES(?,?,?,?,?,?,?,?)').run('set','r','Results','public-tavily',10,'partial',null,'now');db.prepare('INSERT INTO result_exports VALUES(?,?,?,?,?)').run('old','set','old.csv','now','unchanged');db.close();db=openStore(path);assert.equal(exportCsv(db,'old').content,'unchanged');addRows(db,'set',validateCompanies(page,query,{companies:[candidate]}),10);assert.notEqual(prepareExport(db,'set').id,'old');}finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
test('durable discovery checkpoints, quota/resume, CSV reference, ambiguity and greetings without jobs',async()=>{
 const old={key:process.env.TAVILY_API_KEY,free:process.env.SEARCH_FREE_TIER_CONFIRMED,consent:process.env.SEARCH_DATA_CONSENT};Object.assign(process.env,{TAVILY_API_KEY:'test-only',SEARCH_FREE_TIER_CONFIRMED:'true',SEARCH_DATA_CONSENT:'true'});
 const db=openStore(':memory:');let searches=0,extracts=0;const engine=new ChatEngine(db,async text=>intent(/hello/i.test(text)?'conversation':'discovery'),async()=>{searches++;return [page,page];},async()=>{extracts++;if(extracts===1)throw new RateLimit(Date.now()+30000);return validateCompanies(page,query,{companies:[candidate]});});const sup=new Supervisor(db);sup.tools=()=>engine.tick();
 try{
  engine.submit('greet','Hello','live');await sup.tick();assert.equal(db.prepare('SELECT count(*) n FROM tasks').get()!.n,0);assert.equal(db.prepare("SELECT state FROM chat_requests WHERE id='greet'").get()!.state,'completed');
  engine.submit('search','UAE mein 10 hardware companies dhoondo','live');assert.equal(engine.submit('search','duplicate','live').duplicate,true);await sup.tick();await sup.tick();await sup.tick();
  assert.equal(db.prepare("SELECT state FROM tasks WHERE id='search'").get()!.state,'paused');assert.equal(searches,1);assert.throws(()=>sup.control('search','resume'),/Retry-After/);db.prepare('DELETE FROM task_retry_holds').run();sup.control('search','resume');await sup.tick();await sup.tick();await sup.tick();
  assert.equal(searches,1,'Extraction resume must reuse retrieved sources');assert.equal(resultSnapshot(db)[0].rows.length,1);assert.equal(resultSnapshot(db)[0].state,'partial');
  engine.submit('csv','Inki CSV bana do','live');await sup.tick();await sup.tick();const snapshot:any=resultSnapshot(db)[0];assert.ok(snapshot.export);assert.match(exportCsv(db,String(snapshot.export.id)).content,/Sample Hardware/);
  db.prepare('INSERT INTO result_sets VALUES(?,?,?,?,?,?,?,?)').run('other','other-request','Other companies','imported',1,'completed',null,'now');
  const before=db.prepare('SELECT count(*) n FROM tasks').get()!.n;engine.submit('ambiguous','Inki CSV bana do','live');await sup.tick();assert.equal(db.prepare('SELECT count(*) n FROM tasks').get()!.n,before);assert.match(String(db.prepare("SELECT text FROM chat WHERE role='assistant' ORDER BY rowid DESC LIMIT 1").get()!.text),/Which result set/);
 }finally{db.close();for(const [key,value] of Object.entries({TAVILY_API_KEY:old.key,SEARCH_FREE_TIER_CONFIRMED:old.free,SEARCH_DATA_CONSENT:old.consent})){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
test('search transport uses explicit Basic cost, safe errors and missing-key block without dispatch',async()=>{
 const old={...process.env};try{process.env.TAVILY_API_KEY='test-only';process.env.SEARCH_FREE_TIER_CONFIRMED='true';process.env.SEARCH_DATA_CONSENT='true';let calls=0;
  await assert.rejects(()=>searchPublic(query,{},async(_url,init)=>{calls++;const payload=JSON.parse(String(init?.body));assert.equal(payload.search_depth,'basic');assert.equal(payload.auto_parameters,false);assert.equal(payload.include_answer,false);return new Response('{}',{status:429,headers:{'retry-after':'10'}});}),/quota\/rate limit/);assert.equal(calls,1);
  delete process.env.TAVILY_API_KEY;await assert.rejects(()=>searchPublic(query,{},async()=>{calls++;throw Error();}),/not connected/);assert.equal(calls,1);
 }finally{for(const key of ['TAVILY_API_KEY','SEARCH_FREE_TIER_CONFIRMED','SEARCH_DATA_CONSENT']){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}}
});
test('cancellation during extraction discards the late result and never restarts cancelled discovery',async()=>{
 const old={key:process.env.TAVILY_API_KEY,free:process.env.SEARCH_FREE_TIER_CONFIRMED,consent:process.env.SEARCH_DATA_CONSENT};Object.assign(process.env,{TAVILY_API_KEY:'test-only',SEARCH_FREE_TIER_CONFIRMED:'true',SEARCH_DATA_CONSENT:'true'});
 const db=openStore(':memory:'),sup=new Supervisor(db);const engine=new ChatEngine(db,async()=>intent('discovery'),async()=>[page],async()=>{sup.control('cancel-search','cancel');return validateCompanies(page,query,{companies:[candidate]});});sup.tools=()=>engine.tick();
 try{engine.submit('cancel-search','Find UAE hardware companies','live');await sup.tick();await sup.tick();await sup.tick();assert.equal(db.prepare("SELECT state FROM tasks WHERE id='cancel-search'").get()!.state,'cancelled');assert.equal(db.prepare('SELECT count(*) n FROM result_rows').get()!.n,0);assert.throws(()=>sup.control('cancel-search','resume'),/finished/);}
 finally{db.close();for(const [key,value] of Object.entries({TAVILY_API_KEY:old.key,SEARCH_FREE_TIER_CONFIRMED:old.free,SEARCH_DATA_CONSENT:old.consent})){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
test('backup v2 preserves results/downloads and accepts v1; seeded cleanup backs up and preserves real/live/send data',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tool-backup-')),db=openStore(':memory:');try{
  const seed=(id:string,email:string,source:string,notes:string)=>db.prepare('INSERT INTO leads VALUES(?,?,?,?,?,?,?,?,?)').run(id,id,email,id,'Dubai',notes,source,'UAE','hardware');
  seed('demo','demo@example.com','Guided setup sample (do not send)','Synthetic setup sample; never send');seed('live','live@example.com','Guided setup sample (do not send)','Synthetic setup sample; never send');seed('real','real@business.test','user-import.csv','Private user data');
  for(const [id,mode,lead] of [['demo-job','demo','demo'],['live-job','live','live']]){db.prepare('INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?)').run(id,id,'draft',mode,'completed',null,null,'now');db.prepare('INSERT INTO steps VALUES(?,?,?,?,?)').run(id,lead,'done',1,null);db.prepare('INSERT INTO drafts VALUES(?,?,?,?,?,?,?)').run(id,id,lead,'Subject','Body',mode,'now');}
  db.prepare('INSERT INTO result_sets VALUES(?,?,?,?,?,?,?,?)').run('set','request','Sources','public-tavily',1,'completed',null,'now');addRows(db,'set',validateCompanies(page,query,{companies:[candidate]}),1);const exported:any=prepareExport(db,'set');
  const result=cleanupDemo(db,join(dir,'before.json'));assert.equal(result.removedDemoTasks,1);assert.equal(db.prepare("SELECT count(*) n FROM drafts WHERE mode='live'").get()!.n,1);assert.ok(db.prepare("SELECT id FROM leads WHERE id='real'").get());assert.ok(db.prepare("SELECT id FROM leads WHERE id='live'").get());assert.ok(readFileSync(join(dir,'before.json'),'utf8').includes('demo-job'));
  exportData(db,join(dir,'v2.json'));restoreData(join(dir,'v2.json'),join(dir,'restored.sqlite'));const restored=openStore(join(dir,'restored.sqlite'));try{assert.equal(exportCsv(restored,String(exported.id)).content,exportCsv(db,String(exported.id)).content);}finally{restored.close();}
  const legacy=JSON.parse(readFileSync(join(dir,'v2.json'),'utf8'));legacy.version=1;for(const key of ['chat_requests','tool_jobs','result_sets','result_rows','result_exports','search_usage'])delete legacy.data[key];writeFileSync(join(dir,'v1.json'),JSON.stringify(legacy));restoreData(join(dir,'v1.json'),join(dir,'legacy.sqlite'));const legacyDb=openStore(join(dir,'legacy.sqlite'));try{assert.ok(legacyDb.prepare("SELECT id FROM leads WHERE id='real'").get());}finally{legacyDb.close();}
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
