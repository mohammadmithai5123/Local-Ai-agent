import { resolve, join } from 'node:path';
import { openBackupSource, exportData, restoreData } from '../.runtime/server/data-backup.js';
const [action,source,target]=process.argv.slice(2);
try {
  if(action==='export') {
    // DB_PATH may be supplied explicitly for a custom installation. Never load/export .env.
    const db=openBackupSource(process.env.DB_PATH||'data/workbench.sqlite');
    const destination=resolve('backups',`workbench-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
    try { exportData(db,destination); } finally { db.close(); }
    console.log(`Private data backup saved: ${destination}`);
  } else if(action==='restore' && source) {
    const destination=resolve(target||join('data',`restored-${Date.now()}.sqlite`));
    restoreData(resolve(source),destination);
    console.log(`Restored to NEW database: ${destination}. Original database unchanged. Sending authorization cleared; tasks paused. Review before activation.`);
  } else throw Error('Usage: npm run backup:data OR npm run restore:data -- <backup.json> [new-database-path]');
} catch { console.error('Backup/restore failed. Check file paths, backup format, and that the destination is new. No existing database was overwritten.');process.exitCode=1; }
