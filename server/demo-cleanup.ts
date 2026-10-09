import type {Store} from './store.js';
import {exportData} from './data-backup.js';
export function cleanupDemo(db:Store,backupPath:string){
 if(db.prepare("SELECT id FROM tasks WHERE state IN ('queued','running') LIMIT 1").get()||db.prepare("SELECT id FROM chat_requests WHERE state IN ('queued','running') LIMIT 1").get())throw Error('Pause active work before cleanup.');
 exportData(db,backupPath);
 // Conservative identity: exact seed marker + synthetic notes + reserved example domain.
 const seeded="source='Guided setup sample (do not send)' AND notes='Synthetic setup sample; never send' AND email LIKE '%@example.com'";
 const candidates:any[]=db.prepare(`SELECT t.id FROM tasks t WHERE t.mode='demo'
  AND EXISTS(SELECT 1 FROM steps WHERE task_id=t.id)
  AND NOT EXISTS(SELECT 1 FROM steps s JOIN leads l ON l.id=s.lead_id WHERE s.task_id=t.id AND NOT (${seeded}))
  AND NOT EXISTS(SELECT 1 FROM drafts WHERE task_id=t.id AND mode!='demo')
  AND NOT EXISTS(SELECT 1 FROM drafts d JOIN mail_actions a ON a.draft_id=d.id WHERE d.task_id=t.id)`).all();
 let drafts=0;db.exec('BEGIN');try{
  for(const {id} of candidates){drafts+=Number(db.prepare("DELETE FROM drafts WHERE task_id=? AND mode='demo'").run(id).changes);
   for(const table of ['steps','task_plans','task_retry_holds','tool_jobs'])db.prepare(`DELETE FROM ${table} WHERE task_id=?`).run(id);
   db.prepare('DELETE FROM setup_checks WHERE task_id=?').run(id);db.prepare('DELETE FROM events WHERE task_id=?').run(id);
   // Preserve authored chat/history, but detach completed request metadata from deleted demo jobs.
   db.prepare("UPDATE chat_requests SET task_id=NULL,state='completed',reason='Seeded demo job removed after backup' WHERE task_id=?").run(id);
   db.prepare('DELETE FROM tasks WHERE id=?').run(id);
  }
  const leads=Number(db.prepare(`DELETE FROM leads WHERE ${seeded} AND NOT EXISTS(SELECT 1 FROM steps WHERE lead_id=leads.id) AND NOT EXISTS(SELECT 1 FROM drafts WHERE lead_id=leads.id)`).run().changes);
  const messages=Number(db.prepare("DELETE FROM chat WHERE (role='assistant' AND text LIKE '[DEMO] %') OR (role='user' AND text LIKE '[DEMO SETUP SAMPLE] %')").run().changes);
  db.exec('COMMIT');return {removedDemoTasks:candidates.length,removedDemoDrafts:drafts,removedUnusedSeededLeads:leads,removedExplicitDemoMessages:messages};
 }catch(e){db.exec('ROLLBACK');throw e;}
}
