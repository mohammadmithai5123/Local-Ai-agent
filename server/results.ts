import { randomUUID } from 'node:crypto';
import type { Store } from './store.js';
import {parse} from 'csv-parse/sync';
export type CompanyRow={name:string;location:string;website:string;email:string;phone:string;sources:string[];retrieved_at:string;evidence?:string};
export function safePublicUrl(value:string){try{const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||!u.hostname.includes('.')||/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname))return '';return u.href;}catch{return '';}}
export function resultSnapshot(db:Store){return db.prepare('SELECT * FROM result_sets ORDER BY created,rowid').all().map((set:any)=>{const exports=db.prepare('SELECT id,filename,content FROM result_exports WHERE set_id=? ORDER BY created DESC,rowid DESC').all(set.id).map((e:any)=>({id:e.id,filename:e.filename,count:e.content?parse(e.content,{bom:true,columns:true}).length:null}));return {...set,rows:db.prepare('SELECT data FROM result_rows WHERE set_id=? ORDER BY position').all(set.id).map((r:any)=>JSON.parse(r.data)),exports,export:exports[0]||null};});}
export function addRows(db:Store,setId:string,rows:CompanyRow[],limit:number){
 const old=db.prepare('SELECT data FROM result_rows WHERE set_id=? ORDER BY position').all(setId).map((r:any)=>JSON.parse(r.data) as CompanyRow);
 const key=(r:CompanyRow)=>r.name.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');const seen=new Set(old.map(key));let position=old.length;
 for(const row of rows){if(position>=limit)break;if(seen.has(key(row)))continue;seen.add(key(row));db.prepare('INSERT INTO result_rows VALUES(?,?,?,?)').run(randomUUID(),setId,position++,JSON.stringify(row));}return position;
}
export function prepareExport(db:Store,setId:string){const set:any=db.prepare('SELECT * FROM result_sets WHERE id=?').get(setId);if(!set)throw Error('Result set not found.');
 if(!['completed','partial'].includes(set.state))throw Error('Wait for results to finish or pause before exporting.');
 const content=renderCsv(db,setId),prior=db.prepare('SELECT * FROM result_exports WHERE set_id=? AND content=? ORDER BY created DESC LIMIT 1').get(setId,content);if(prior)return prior;
 const count=Number(db.prepare('SELECT count(*) n FROM result_rows WHERE set_id=?').get(setId)?.n),id=randomUUID(),filename=`companies-${setId.slice(0,8)}-${count}-results-${id.slice(0,8)}.csv`;db.prepare('INSERT INTO result_exports(id,set_id,filename,created,content) VALUES(?,?,?,?,?)').run(id,setId,filename,new Date().toISOString(),content);return {id,set_id:setId,filename};
}
export function csvCell(value:string){const guarded=/^[\s\u0000-\u001f]*[=+\-@]/u.test(value)?"'"+value:value;return '"'+guarded.replaceAll('"','""')+'"';}
function renderCsv(db:Store,setId:string){const rows=db.prepare('SELECT data FROM result_rows WHERE set_id=? ORDER BY position').all(setId).map((r:any)=>JSON.parse(r.data) as CompanyRow);
 const headers=['Company','Location','Website','Business email','Business phone','Source URLs','Retrieved at'];
 return '\ufeff'+[headers,...rows.map(r=>[r.name,r.location,r.website,r.email,r.phone,r.sources.join('; '),r.retrieved_at])].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
export function exportCsv(db:Store,exportId:string){const record:any=db.prepare('SELECT * FROM result_exports WHERE id=?').get(exportId);if(!record)throw Error('Export not found.');return {filename:record.filename,content:record.content||renderCsv(db,record.set_id)};}
export function saveResultLeads(db:Store,setId:string){if(!db.prepare('SELECT id FROM result_sets WHERE id=?').get(setId))throw Error('Result set not found.');let saved=0,skipped=0;
 db.exec('BEGIN');try{for(const {data} of db.prepare('SELECT data FROM result_rows WHERE set_id=? ORDER BY position').all(setId)){
  const r=JSON.parse(String(data)) as CompanyRow;if(!r.email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)){skipped++;continue;}
  const result=db.prepare('INSERT OR IGNORE INTO leads(id,name,email,company,city,notes,source,country,industry) VALUES(?,?,?,?,?,?,?,?,?)').run(randomUUID(),r.name,r.email.toLowerCase(),r.name,r.location,`Retrieved ${r.retrieved_at}. ${r.website}`.slice(0,2000),`Public source: ${r.sources[0]||'unknown'}`,'','');if(result.changes)saved++;else skipped++;
 }db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return {saved,skipped};
}
