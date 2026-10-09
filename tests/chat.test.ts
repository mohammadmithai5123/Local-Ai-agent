import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../server/store.js';
import {Supervisor} from '../server/supervisor.js';
import {plan,planSchema,RateLimit} from '../server/provider.js';
import {enterAction} from '../src/chat-input.js';

test('composer Enter decision preserves newline/IME and ignores held-key repeats',()=>{
 assert.equal(enterAction(false,false,false,13,false),'submit');
 assert.equal(enterAction(true,false,false,13,false),'edit');
 assert.equal(enterAction(false,true,false,13,false),'edit');
 assert.equal(enterAction(false,false,true,13,false),'edit');
 assert.equal(enterAction(false,false,false,229,false),'edit');
 assert.equal(enterAction(false,false,false,13,true),'ignore');
});

for(const kind of ['conversation','unsupported'] as const)test(`${kind} saves a real reply without selecting leads or drafts`,async()=>{
 const db=openStore(':memory:');
 try{
  db.prepare('INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?)').run('t','request','Hello','live','needs_user','Planning your request',null,'now');
  db.prepare('INSERT INTO chat VALUES(?,?,?,?)').run('request','user','Hello','now');
  db.prepare('INSERT INTO task_plans VALUES(?,NULL)').run('t');
  const sup=new Supervisor(db,undefined,async()=>planSchema.parse({kind,city:'',company:'',country:'',industry:'',limit:1,language:'english',reply:'A useful conversational response; no actions performed.'}));
  sup.control('t','start');await sup.tick();
  assert.equal(db.prepare('SELECT state FROM tasks').get()!.state,'completed');
  assert.equal(db.prepare('SELECT count(*) n FROM steps').get()!.n,0);
  assert.equal(db.prepare('SELECT count(*) n FROM drafts').get()!.n,0);
  assert.equal(db.prepare("SELECT count(*) n FROM chat WHERE role='assistant'").get()!.n,1);
  await sup.tick();assert.equal(db.prepare('SELECT count(*) n FROM chat').get()!.n,2);
 }finally{db.close();}
});
test('demo greeting explicitly explains its limitation instead of selecting all leads',async()=>{
 const result=await plan('Hello','demo');assert.equal(result.kind,'unsupported');assert.match(result.reply,/not live conversation/);
});
test('chat quota failure persists a visible reason, retains planning marker, and creates no fake reply',async()=>{
 const db=openStore(':memory:');try{
  db.prepare('INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?)').run('t','request','Hello','live','needs_user','Planning your request',null,'now');
  db.prepare('INSERT INTO task_plans VALUES(?,NULL)').run('t');
  const sup=new Supervisor(db,undefined,async()=>{throw new RateLimit(Date.now()+30000);});sup.control('t','start');await sup.tick();
  assert.match(String(db.prepare('SELECT reason FROM tasks').get()!.reason),/rate limit/i);
  assert.equal(db.prepare('SELECT count(*) n FROM task_plans').get()!.n,1);
  assert.equal(db.prepare('SELECT count(*) n FROM chat').get()!.n,0);
 }finally{db.close();}
});
