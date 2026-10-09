import {openStore} from '../.runtime/server/store.js';
import {cleanupDemo} from '../.runtime/server/demo-cleanup.js';
import {resolve} from 'node:path';
if(!process.argv.includes('--apply'))throw Error('Explicit cleanup requires --apply. A private backup is created before deletion.');
const db=openStore(process.env.DB_PATH||'data/workbench.sqlite');
try{const backup=resolve('backups',`before-demo-cleanup-${Date.now()}.json`);console.log(JSON.stringify({...cleanupDemo(db,backup),backup}));}finally{db.close();}
