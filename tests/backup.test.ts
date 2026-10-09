import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../server/store.js';
import { exportData,restoreData } from '../server/data-backup.js';

test('private export/restore preserves drafts and send ledger, clears authorization and never overwrites',()=>{
 const dir=mkdtempSync(join(tmpdir(),'backup-')),file=join(dir,'backup.json'),target=join(dir,'restored.sqlite');
 const db=openStore(':memory:');
 try {
  db.prepare('INSERT INTO leads VALUES(?,?,?,?,?,?,?,?,?)').run('l','Sample','sample@example.com','','','','sample','','');
  db.prepare('INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?)').run('t','request','draft','live','running',null,null,'now');
  db.prepare('INSERT INTO steps VALUES(?,?,?,?,?)').run('t','l','working',1,null);
  db.prepare('INSERT INTO drafts VALUES(?,?,?,?,?,?,?)').run('d','t','l','Subject','Personalized body','live','now');
  db.prepare('INSERT INTO setup_checks VALUES(?,?,?,?,?,?,?)').run('gmail','verified','private configuration','now','secret-fingerprint',null,null);
  db.prepare('INSERT INTO campaigns VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run('c','campaign','Sample','running',3,999999,'now','private-connection','digest',null,null,'now','sender@example.com');
  const insert=db.prepare('INSERT INTO mail_actions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)');
  insert.run('sent','c','d','sample@example.com','Sample','Subject','Body','fp1','sent','preserved-message-id','rfc1',1,null);
  insert.run('flight','c',null,'other@example.com','Other','Subject','Body','fp2','sending',null,'rfc2',1,null);
  insert.run('queue','c',null,'third@example.com','Third','Subject','Body','fp3','queued',null,'rfc3',0,null);
  exportData(db,file);
  const json=readFileSync(file,'utf8');
  assert.ok(!json.includes('secret-fingerprint'));assert.ok(!json.includes('private-connection'));
  assert.throws(()=>exportData(db,file));
  restoreData(file,target);
  const restored=openStore(target);
  try {
   assert.equal(restored.prepare('SELECT body FROM drafts').get()!.body,'Personalized body');
   assert.equal(restored.prepare('SELECT state FROM tasks').get()!.state,'paused');
   assert.equal(restored.prepare('SELECT state FROM steps').get()!.state,'pending');
   const action=restored.prepare("SELECT * FROM mail_actions WHERE id='sent'").get()!;
   assert.equal(action.message_id,'preserved-message-id');assert.equal(action.attempts,1);assert.equal(action.state,'sent');
   assert.equal(restored.prepare("SELECT state FROM mail_actions WHERE id='flight'").get()!.state,'uncertain');
   assert.equal(restored.prepare("SELECT state FROM mail_actions WHERE id='queue'").get()!.state,'draft');
   assert.equal(restored.prepare('SELECT authorized_at FROM campaigns').get()!.authorized_at,null);
   assert.equal(restored.prepare('SELECT count(*) n FROM setup_checks').get()!.n,0);
  } finally { restored.close(); }
  const before=readFileSync(target);assert.throws(()=>restoreData(file,target));assert.deepEqual(readFileSync(target),before);
  const invalid=JSON.parse(json);invalid.data.leads[0].unexpected='bad';writeFileSync(join(dir,'bad.json'),JSON.stringify(invalid));
  assert.throws(()=>restoreData(join(dir,'bad.json'),join(dir,'bad.sqlite')),/columns/);
  assert.equal(db.prepare('SELECT state FROM tasks').get()!.state,'running');
 } finally { db.close();rmSync(dir,{recursive:true,force:true}); }
});
