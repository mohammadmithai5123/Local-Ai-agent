import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdirSync, openSync, closeSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { openStore, type Store } from './store.js';

// Explicit allowlist: OAuth files and configuration-check fingerprints never enter exports.
const tables = ['leads','chat','tasks','steps','drafts','events','campaigns','mail_actions','task_plans','task_retry_holds'] as const;
export function exportData(db: Store, destination: string) {
    db.exec('BEGIN');
    try {
        const data = Object.fromEntries(tables.map(table => [table, db.prepare(`SELECT * FROM ${table}`).all()]));
        // Authorization is deliberately not portable. Keep the durable send ledger.
        for (const row of data.campaigns as any[]) { row.authorized_at=null; row.expires=null; row.connection_id=null; }
        mkdirSync(dirname(destination), { recursive:true });
        writeFileSync(destination, JSON.stringify({version:1,created:new Date().toISOString(),data}), {flag:'wx',mode:0o600});
        db.exec('COMMIT');
    } catch(error) { db.exec('ROLLBACK'); throw error; }
}

export function restoreData(source: string, destination: string) {
    if(statSync(source).size>100*1024*1024)throw Error('Backup exceeds 100 MiB limit.');
    const raw=readFileSync(source);
    const backup=JSON.parse(raw.toString('utf8'));
    if(backup.version!==1 || !backup.data || Object.keys(backup.data).length!==tables.length || tables.some(t=>!Array.isArray(backup.data[t])))throw Error('Unsupported backup format.');
    // Atomically reserve a new file: restoration never overwrites a database.
    mkdirSync(dirname(destination),{recursive:true});
    closeSync(openSync(destination,'wx',0o600));
    const db=openStore(destination);
    try {
        db.exec('BEGIN');
        for(const table of tables) {
            const columns=db.prepare(`PRAGMA table_info(${table})`).all().map(c=>String(c.name));
            const insert=db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`);
            if(backup.data[table].length>100000)throw Error('Backup table exceeds row limit.');
            for(const row of backup.data[table]) {
                if(!row || Array.isArray(row) || Object.keys(row).length!==columns.length || columns.some(c=>!Object.hasOwn(row,c)))throw Error('Invalid backup columns.');
                const values=columns.map(c=>row[c]);
                if(values.some(v=>v!==null && typeof v!=='string' && !(typeof v==='number' && Number.isFinite(v))))throw Error('Invalid backup value.');
                insert.run(...values);
            }
        }
        db.exec(`UPDATE tasks SET state='paused',reason='Restored backup: review before resuming',next_retry=NULL WHERE state NOT IN ('completed','cancelled','failed');
          UPDATE steps SET state='pending' WHERE state='working';
          UPDATE campaigns SET authorized_at=NULL,expires=NULL,connection_id=NULL,next_retry=NULL;
          UPDATE campaigns SET state='paused',reason='Restored backup: sending authorization cleared' WHERE state NOT IN ('completed','cancelled');
          UPDATE mail_actions SET state='draft' WHERE state='queued' AND attempts=0;
          UPDATE mail_actions SET state='uncertain',error='Restored attempted send: reconcile manually; never automatically resend' WHERE state IN ('sending','queued');
          DELETE FROM task_retry_holds;`);
        if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Backup relationships are invalid.');
        db.exec('COMMIT');
    } catch(error) { db.exec('ROLLBACK'); throw error; }
    finally { db.close(); }
}

export function openBackupSource(path:string) { return new DatabaseSync(path,{readOnly:true}); }
