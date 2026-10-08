import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export function openStore(path: string) {
    if (path !== ':memory:')
        mkdirSync(dirname(path), { recursive: true });
    const db = new DatabaseSync(path);
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
  CREATE TABLE IF NOT EXISTS leads(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,company TEXT,city TEXT,notes TEXT,source TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS chat(id TEXT PRIMARY KEY,role TEXT NOT NULL,text TEXT NOT NULL,created TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,request_id TEXT UNIQUE NOT NULL,instruction TEXT NOT NULL,mode TEXT NOT NULL,state TEXT NOT NULL,reason TEXT,next_retry INTEGER,created TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS steps(task_id TEXT NOT NULL REFERENCES tasks(id),lead_id TEXT NOT NULL REFERENCES leads(id),state TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,error TEXT,PRIMARY KEY(task_id,lead_id));
  CREATE TABLE IF NOT EXISTS drafts(id TEXT PRIMARY KEY,task_id TEXT NOT NULL,lead_id TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,mode TEXT NOT NULL,created TEXT NOT NULL,UNIQUE(task_id,lead_id));
  CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,task_id TEXT,text TEXT NOT NULL,created TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS campaigns(id TEXT PRIMARY KEY,request_id TEXT UNIQUE NOT NULL,title TEXT NOT NULL,state TEXT NOT NULL,send_limit INTEGER NOT NULL,expires INTEGER,authorized_at TEXT,connection_id TEXT,digest TEXT NOT NULL,reason TEXT,next_retry INTEGER,created TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS mail_actions(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES campaigns(id),draft_id TEXT UNIQUE,recipient TEXT NOT NULL,name TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,fingerprint TEXT UNIQUE NOT NULL,state TEXT NOT NULL,message_id TEXT,rfc_message_id TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,error TEXT);`);
    db.exec('CREATE TABLE IF NOT EXISTS setup_checks(name TEXT PRIMARY KEY,status TEXT NOT NULL,detail TEXT NOT NULL,checked TEXT NOT NULL,context TEXT NOT NULL,mode TEXT,task_id TEXT)');
    db.exec('CREATE TABLE IF NOT EXISTS task_plans(task_id TEXT PRIMARY KEY REFERENCES tasks(id),scope TEXT)');
    db.exec('CREATE TABLE IF NOT EXISTS task_retry_holds(task_id TEXT PRIMARY KEY REFERENCES tasks(id),not_before INTEGER NOT NULL)');
    const leadColumns=db.prepare('PRAGMA table_info(leads)').all();
    for(const field of ['country','industry'])if(!leadColumns.some((c:any)=>c.name===field))db.exec(`ALTER TABLE leads ADD COLUMN ${field} TEXT NOT NULL DEFAULT ''`);
    if(!db.prepare('PRAGMA table_info(campaigns)').all().some((c:any)=>c.name==='sender')) db.exec("ALTER TABLE campaigns ADD COLUMN sender TEXT NOT NULL DEFAULT ''");
    return db;
}
export type Store = ReturnType<typeof openStore>;
export function event(db: Store, id: string, text: string) { db.prepare('INSERT INTO events(task_id,text,created) VALUES(?,?,?)').run(id, text, new Date().toISOString()); }
