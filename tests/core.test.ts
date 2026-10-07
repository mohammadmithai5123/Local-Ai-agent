import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { openStore } from '../server/store.js';
import { readFile, mapRows } from '../server/importer.js';
import { Supervisor } from '../server/supervisor.js';
import { RateLimit, planSchema } from '../server/provider.js';
function fixture(path = ':memory:') { const db = openStore(path); db.prepare('INSERT INTO leads VALUES(?,?,?,?,?,?,?)').run('lead', 'Ayesha', 'a@example.com', 'Studio', 'Karachi', '', 'test'); db.prepare('INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?)').run('task', 'request', 'draft banao', 'demo', 'queued', null, null, new Date().toISOString()); db.prepare('INSERT INTO steps(task_id,lead_id,state) VALUES(?,?,?)').run('task', 'lead', 'pending'); return db; }
test('CSV quoted multiline, mapping errors, formulas, duplicates and email normalization', async () => {
    const file = await readFile('leads.csv', Buffer.from('name,email,notes\nA,a@example.com,"Hello,\nworld"\nB,A@example.com,x\nC,bad,x\n=CMD,c@example.com,x'));
    const result = mapRows(file.rows, { name: 0, email: 1, notes: 2 }, new Set());
    assert.equal(result.valid.length, 1);
    assert.equal(result.valid[0].notes, 'Hello,\nworld');
    assert.deepEqual(result.errors.map(e => e.row), [3, 4, 5]);
    await assert.rejects(() => readFile('file.exe', Buffer.from('x')), /CSV or XLSX/);
    await assert.rejects(() => readFile('big.csv', Buffer.alloc(2000001)), /2 MB/);
    await assert.rejects(() => readFile('bad.csv', Buffer.from('a,b\nx')), /Invalid Record Length/);
});
test('XLSX formula results are not executed or imported', async () => { const b = new ExcelJS.Workbook(); const s = b.addWorksheet('Prospects'); s.addRow(['name', 'email']); s.addRow(['Alice', 'alice@example.com']); s.addRow([{ formula: 'HYPERLINK("https://example.com")', result: 'Secret' }, 'secret@example.com']); const data = await b.xlsx.writeBuffer(); const parsed = await readFile('list.xlsx', Buffer.from(data)); const mapped = mapRows(parsed.rows, { name: 0, email: 1 }, new Set()); assert.equal(mapped.valid.length, 1); assert.match(mapped.errors[0].message, /Formula/); });
test('durable draft and step commit survive reopen; recovery pauses unfinished tasks', async () => { const dir = mkdtempSync(join(tmpdir(), 'workbench-')); const path = join(dir, 'test.sqlite'); let db = fixture(path); const sup = new Supervisor(db, async () => ({ subject: 'Hello', body: 'Draft' })); assert.equal((db.prepare('SELECT state FROM tasks').get() as any).state, 'paused'); sup.control('task', 'resume'); await sup.tick(); assert.equal(db.prepare('SELECT count(*) n FROM drafts').get()!.n, 1); db.close(); db = openStore(path); const restored = new Supervisor(db); assert.equal((db.prepare('SELECT state FROM tasks').get() as any).state, 'paused'); restored.control('task', 'resume'); await restored.tick(); assert.equal((db.prepare('SELECT state FROM tasks').get() as any).state, 'completed'); assert.equal(db.prepare('SELECT count(*) n FROM drafts').get()!.n, 1); db.close(); rmSync(dir, { recursive: true, force: true }); });
test('rate limit persists next retry and stops automatic retries after three attempts', async () => { const db = fixture(); const sup = new Supervisor(db, async () => { throw new RateLimit(Date.now() + 60000); }); sup.control('task', 'resume'); await sup.tick(); let task: any = db.prepare('SELECT * FROM tasks').get(); assert.equal(task.state, 'paused'); assert.ok(task.next_retry > Date.now()); assert.throws(() => sup.control('task', 'resume'), /retry time/); for (let i = 0; i < 2; i++) {
    db.prepare('UPDATE tasks SET next_retry=?').run(Date.now() - 1);
    await sup.tick();
} task = db.prepare('SELECT * FROM tasks').get(); assert.equal(task.state, 'needs_user'); assert.equal(task.next_retry, null); await sup.tick(); assert.equal((db.prepare('SELECT attempts FROM steps').get() as any).attempts, 3); db.close(); });
test('pause or cancellation during an in-flight call prevents draft commit', async () => { for (const action of ['pause', 'cancel']) {
    const db = fixture();
    let release: any;
    const sup = new Supervisor(db, () => new Promise(r => { release = r; }));
    sup.control('task', 'resume');
    const pending = sup.tick();
    sup.control('task', action);
    release({ subject: 'Hello', body: 'Draft' });
    await pending;
    assert.equal(db.prepare('SELECT count(*) n FROM drafts').get()!.n, 0);
    assert.equal((db.prepare('SELECT state FROM tasks').get() as any).state, action === 'pause' ? 'paused' : 'cancelled');
    db.close();
} });
test('invalid structured plans are rejected and request identity is unique', () => { assert.equal(planSchema.safeParse({ city: '', company: '', limit: 999, language: 'english', reply: 'ok' }).success, false); const db = fixture(); assert.throws(() => db.prepare('INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?)').run('other', 'request', 'x', 'demo', 'queued', null, null, 'now'), /UNIQUE/); db.close(); });
