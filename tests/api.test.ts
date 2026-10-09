import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
for (const production of [true,false]) test(`real ${production?'production':'development'} API: import, duplicate requests, draft workflow, refresh and origin boundary`, { timeout: 45000 }, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'workbench-api-'));
    const port = 32000 + Math.floor(Math.random() * 10000);
    const child = spawn(process.execPath, ['--experimental-sqlite', '.runtime/server/index.js', ...(production?['--production']:[])], { env: { ...process.env, PORT: String(port), DB_PATH: join(dir, 'test.sqlite'), GEMINI_API_KEY: '', FREE_TIER_CONFIRMED: 'false', AI_DATA_CONSENT: 'false', GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'',GMAIL_ENABLE_SENDING:'false' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', d => stderr += d.toString());
    try {
        await new Promise<void>((resolve, reject) => { const timeout = setTimeout(() => reject(Error('Server start timeout ' + stderr)), 20000); child.stdout.on('data', d => { if (d.toString().includes('Workbench ready')) {
            clearTimeout(timeout);
            resolve();
        } }); child.on('exit', () => { clearTimeout(timeout); reject(Error('Server exited ' + stderr)); }); });
        const call = async (path: string, body?: unknown, extra = {}) => { const r = await fetch(`http://localhost:${port}/api/${path}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json() }; };
        const p = await call('import/preview', { name: 'test.csv', content: Buffer.from('name,email,city\nAyesha,ayesha@example.com,Karachi\nBilal,bilal@example.com,Lahore\nDuplicate,AYESHA@example.com,Karachi\nInvalid,bad,Karachi').toString('base64') });
        assert.equal(p.status, 200);
        const mapped = { id: p.data.id, mapping: { name: 0, email: 1, city: 2 } };
        const validate = await call('import/validate', mapped);
        assert.equal(validate.data.valid.length, 2);
        assert.equal(validate.data.errors.length, 2);
        assert.equal((await call('import/commit', mapped)).data.valid.length, 2);
        assert.equal((await call('import/commit', mapped)).data.valid.length, 0);
        assert.equal((await call('chat',{requestId:randomUUID(),text:'   ',mode:'demo'})).status,400);
        const req = { requestId: randomUUID(), text: 'Karachi ke 2 leads ke liye drafts banao', mode: 'demo' };
        const first = await call('chat', req);
        assert.equal(first.status, 200);
        const dupe = await call('chat', req);
        assert.equal(dupe.data.duplicate, true);
        let state = (await call('state')).data;
        assert.equal(state.tasks.length, 1);
        assert.equal(state.chat.length, 2);
        assert.equal(state.tasks[0].total, 1);
        const id = state.tasks[0].id;
        assert.equal((await call(`tasks/${id}/start`, {})).status, 200);
        const deadline = Date.now() + 10000;
        do {
            await new Promise(r => setTimeout(r, 150));
            state = (await call('state')).data;
        } while (state.tasks[0].state !== 'completed' && Date.now() < deadline);
        assert.equal(state.tasks[0].state, 'completed');
        assert.equal(state.drafts.length, 1);
        assert.equal((await call('state')).data.drafts.length, 1);
        assert.equal(state.integrations.gmail, 'Not connected');
        assert.equal(state.gmail.connected,false);
        assert.equal(state.connection.code,'missing_key');
        const setup=(await call('setup')).data;
        assert.equal(setup.steps[0].status,'Not configured');
        assert.equal(setup.steps[1].status,'Not configured');
        assert.equal(setup.callback.matches,true);
        assert.equal(setup.callback.registrationVerified,false);
        assert.equal((await call('setup/workflow',{mode:'live',requestId:randomUUID()})).status,400);
        assert.equal((await call('gmail/connect',{})).status,400);
        assert.equal((await call('campaigns/test',{requestId:randomUUID(),recipient:'qa@workbench.test',subject:'Test only',body:'No actual sending'})).status,200);
        const review=(await call('state')).data.campaigns[0];
        assert.equal((await call(`campaigns/${review.id}/authorize`,{digest:review.digest,limit:1,expires:Date.now()+3600000,confirm:true})).status,400);
        assert.equal((await call('state')).data.mailActions[0].state,'draft');
        assert.equal((await fetch(`http://localhost:${port}/data/credentials/gmail.enc`)).status,403);
        assert.equal((await fetch(`http://localhost:${port}/backups/private.json`)).status,403);
        assert.equal((await fetch(`http://localhost:${port}/.env`)).status,403);
        assert.equal((await fetch(`http://localhost:${port}/%ZZ`)).status,400);
        assert.equal((await call('chat', { ...req, requestId: randomUUID(), mode: 'live' })).status, 400);
        assert.equal((await call('demo', {}, { Origin: 'https://attacker.example' })).status, 400);
    }
    finally {
        child.kill();
        await new Promise<void>(r => { if (child.exitCode !== null)
            r();
        else
            child.once('exit', () => r()); });
        rmSync(dir, { recursive: true, force: true });
    }
});
