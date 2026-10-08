import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { z } from 'zod';
import { openStore, event } from './store.js';
import { readFile, mapRows, leadSchema } from './importer.js';
import { plan, liveEnabled, connectionState, generate, draftJSON, draftSchema, RateLimit, requestMetadata } from './provider.js';
import { Supervisor } from './supervisor.js';
import { Gmail,TokenVault } from './gmail.js';
import { Campaigns } from './campaigns.js';
import { dirname,join } from 'node:path';
import { GuidedSetup } from './setup.js';
import { selectLeads } from './selection.js';
// Load local environment without printing values or exposing them to Vite.
if (existsSync('.env'))
    process.loadEnvFile('.env');
const db = openStore(process.env.DB_PATH || 'data/workbench.sqlite');
const supervisor = new Supervisor(db);
const gmail = new Gmail(new TokenVault(join(dirname(process.env.DB_PATH||'data/workbench.sqlite'),'credentials')));
const campaigns = new Campaigns(db,gmail);
const setup=new GuidedSetup(db,gmail,supervisor);
const uploads = new Map<string, {
    name: string;
    headers: string[];
    rows: string[][];
    expires: number;
}>();
const timer = setInterval(() => {void supervisor.tick().catch(() => console.error('Supervisor database operation failed'));if(process.env.GMAIL_ENABLE_SENDING==='true')void campaigns.tick().catch(()=>console.error('Gmail ledger operation failed; inspect persisted outcomes'));}, 700);
const production = process.argv.includes('--production');
const vite = production ? null : await (await import('vite')).createServer({ server: { middlewareMode: true, host: '127.0.0.1',fs:{deny:['**/.env','**/.env.*','**/.git/**','**/*.{crt,pem}','**/data/**','**/credentials/**','**/uploads/**','**/sessions/**','**/.npm-cache/**','**/*.sqlite*','**/client_secret*.json','**/*token*.json']} }, appType: 'spa' });
function state() { return { leads: db.prepare('SELECT * FROM leads ORDER BY name').all(), chat: db.prepare('SELECT * FROM chat ORDER BY created,rowid').all(), tasks: db.prepare('SELECT t.*,EXISTS(SELECT 1 FROM task_plans p WHERE p.task_id=t.id) planning,(SELECT count(*) FROM steps WHERE task_id=t.id) total,(SELECT count(*) FROM steps WHERE task_id=t.id AND state=\'done\') done FROM tasks t ORDER BY created DESC').all(), steps: db.prepare('SELECT * FROM steps').all(), drafts: db.prepare('SELECT * FROM drafts ORDER BY created DESC').all(), events: db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 30').all(), connection: connectionState(), aiRequests:requestMetadata, integrations: { gmail: gmail.summary().status, whatsapp: 'Not implemented', linkedin: 'Not implemented' }, gmail:{...gmail.summary(),sendingEnabled:process.env.GMAIL_ENABLE_SENDING==='true'},...campaigns.snapshot() }; }
const server = createServer(async (req, res) => {
    res.setHeader('X-Frame-Options','DENY');
    const host = req.headers.host || '';
    if (!/^(localhost|127\.0\.0\.1):\d+$/.test(host)) {
        res.writeHead(403);
        res.end('Local access only');
        return;
    }
    const url = new URL(req.url || '/', `http://${host}`);
    let decodedPath:string;try{decodedPath=decodeURIComponent(url.pathname);}catch{res.writeHead(400);res.end('Invalid URL');return;}
    if(/(?:^|[\/\\])(?:data|credentials|uploads|sessions|\.env[^\/\\]*|\.git|\.npm-cache)(?:[\/\\]|$)/i.test(decodedPath)||/client_secret[^\/\\]*\.json|token[^\/\\]*\.json|\.sqlite/i.test(decodedPath)){res.writeHead(403);res.end('Private local files are not served');return;}
    if (!url.pathname.startsWith('/api/')) {
        if (vite) {
            vite.middlewares(req, res);
            return;
        }
        const p = resolve('dist', '.' + decodedPath);
        const base = resolve('dist');
        const file = p.startsWith(base + '\\') || p.startsWith(base + '/') ? p : resolve('dist/index.html');
        try {
            const target = existsSync(file) && extname(file) ? file : resolve('dist/index.html');
            res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' } as any)[extname(target)] || 'application/octet-stream');
            res.end(readFileSync(target));
        }
        catch {
            res.writeHead(404);
            res.end('Run npm.cmd run build first.');
        }
        return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (obj: any, status = 200) => { res.writeHead(status); res.end(JSON.stringify(obj)); };
    try {
        if (req.headers.origin && req.headers.origin !== `http://${host}`)
            throw Error('Cross-origin access denied.');
        if(req.method==='GET'&&url.pathname==='/api/gmail/callback') {
            res.setHeader('Referrer-Policy','no-referrer');
            const cookie=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('gmail_oauth='))?.slice('gmail_oauth='.length)||'';
            try {if(url.searchParams.has('error'))throw Error('Google consent was declined.');await gmail.complete(url.searchParams.get('state')||'',cookie,url.searchParams.get('code')||'');setup.record('callback','verified','Google authorization code exchange passed using the configured local callback.',setup.gmailContext());campaigns.pauseAll('Gmail connection changed. Existing campaign authorization must be reviewed.');}
            catch {gmail.status='OAuth connection failed or consent declined. Start connection again.';}
            res.setHeader('Set-Cookie','gmail_oauth=; HttpOnly; SameSite=Lax; Path=/api/gmail/callback; Max-Age=0');res.writeHead(303,{Location:'/'});res.end();return;
        }
        if (req.method === 'GET' && url.pathname === '/api/state') {
            send({...state(),setup:setup.summary(url.origin)});
            return;
        }
        if(req.method==='GET'&&url.pathname==='/api/setup'){send(setup.summary(url.origin));return;}
        if (req.method !== 'POST') {
            send({ error: 'Not found' }, 404);
            return;
        }
        if (!req.headers['content-type']?.startsWith('application/json'))
            throw Error('JSON requests required.');
        let size = 0;
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
            size += chunk.length;
            if (size > 3000000)
                throw Error('Request too large.');
            chunks.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if(url.pathname==='/api/setup/workflow'){const data=z.object({mode:z.enum(['demo','live']),requestId:z.string().uuid()}).parse(body);send(await setup.verifyWorkflow(data.mode,data.requestId));return;}
        if(url.pathname==='/api/setup/repository'){send(await setup.repositoryCheck());return;}
        if(url.pathname==='/api/gmail/connect'){if(!host.startsWith('localhost:'))throw Error('Open this app at http://localhost:'+String(process.env.PORT||3000)+' before connecting Gmail.');const auth=gmail.begin();res.setHeader('Set-Cookie',`gmail_oauth=${auth.state}; HttpOnly; SameSite=Lax; Path=/api/gmail/callback; Max-Age=600`);send({url:auth.url});return;}
        if(url.pathname==='/api/gmail/check'){try{const checked=await gmail.check();setup.record('gmail','verified','Actual Google refresh-token exchange passed. Gmail.send only; sending and configured sender identity remain unverified.',setup.gmailContext());send(checked);}catch(e){const detail=e instanceof Error&&e.name==='MailError'?e.message:'Gmail authentication check failed. Reconnect or check network access.';try{setup.record('gmail','attention',detail,setup.gmailContext());}catch{}send({error:detail},400);}return;}
        if(url.pathname==='/api/gmail/disconnect'){campaigns.pauseAll('Gmail disconnected. Sending is paused.');send(await gmail.disconnect());return;}
        if(url.pathname==='/api/campaigns/create'){send(campaigns.create(body));return;}
        if(url.pathname==='/api/campaigns/test'){send(campaigns.createTest(body));return;}
        const campaignAction=url.pathname.match(/^\/api\/campaigns\/([\w-]+)\/(authorize|pause|resume|cancel)$/);
        if(campaignAction){if(campaignAction[2]==='authorize'){if(process.env.GMAIL_ENABLE_SENDING!=='true')throw Error('Real sending is disabled. Set GMAIL_ENABLE_SENDING=true privately and restart only when ready.');campaigns.authorize(campaignAction[1],body);}else campaigns.control(campaignAction[1],campaignAction[2]);send({ok:true});return;}
        const reconciliation=url.pathname.match(/^\/api\/mail-actions\/([\w-]+)\/resolve$/);if(reconciliation){campaigns.resolve(reconciliation[1],body);send({ok:true});return;}
        if (url.pathname === '/api/import/preview') {
            const { name, content } = z.object({ name: z.string().max(200), content: z.string().max(2700000) }).parse(body);
            for (const [id, u] of uploads)
                if (u.expires < Date.now())
                    uploads.delete(id);
            if (uploads.size >= 10)
                throw Error('Too many previews. Wait 15 minutes or restart.');
            const parsed = await readFile(name, Buffer.from(content, 'base64'));
            const id = randomUUID();
            uploads.set(id, { ...parsed, name, expires: Date.now() + 900000 });
            send({ id, ...parsed });
            return;
        }
        if (url.pathname === '/api/import/validate' || url.pathname === '/api/import/commit') {
            const { id, mapping } = z.object({ id: z.string().uuid(), mapping: z.record(z.number().int().min(-1).max(49)) }).parse(body);
            const file = uploads.get(id);
            if (!file || file.expires < Date.now())
                throw Error('Preview expired. Choose your file again.');
            if (mapping.name === undefined || mapping.name < 0 || mapping.email === undefined || mapping.email < 0 || mapping.email === mapping.name)
                throw Error('Map distinct name and email columns.');
            const result = mapRows(file.rows, mapping, new Set(db.prepare('SELECT email FROM leads').all().map((r: any) => r.email)));
            if (url.pathname.endsWith('commit')) {
                db.exec('BEGIN');
                try {
                    for (const lead of result.valid)
                        db.prepare('INSERT INTO leads(id,name,email,company,city,notes,source,country,industry) VALUES(?,?,?,?,?,?,?,?,?)').run(randomUUID(), lead.name, lead.email, lead.company, lead.city, lead.notes, file.name,lead.country,lead.industry);
                    db.exec('COMMIT');
                }
                catch (e) {
                    db.exec('ROLLBACK');
                    throw e;
                }
                event(db, 'import', `Imported ${result.valid.length} leads; skipped ${result.errors.length} rows.`);
            }
            send(result);
            return;
        }
        if (url.pathname === '/api/leads/edit') {
            const { id, ...data } = z.object({ id: z.string().uuid() }).passthrough().parse(body);
            const l = leadSchema.parse(data);
            db.prepare('UPDATE leads SET name=?,email=?,company=?,city=?,notes=?,country=?,industry=? WHERE id=?').run(l.name, l.email, l.company, l.city, l.notes,l.country,l.industry, id);
            send({ ok: true });
            return;
        }
        if (url.pathname === '/api/demo') {
            for (const [name, email, company, city] of [['Ayesha Khan', 'ayesha@example.com', 'Harbor Design', 'Karachi'], ['Bilal Ahmed', 'bilal@example.com', 'North Studio', 'Lahore'], ['Sara Ali', 'sara@example.com', 'Cedar Works', 'Karachi']])
                db.prepare('INSERT OR IGNORE INTO leads(id,name,email,company,city,notes,source) VALUES(?,?,?,?,?,?,?)').run(randomUUID(), name, email, company, city, 'Sample lead — demo only', 'Demo samples');
            send({ ok: true });
            return;
        }
        if (url.pathname === '/api/health') {
            try{draftSchema.parse(await generate('Return a test draft with subject Connection test and body Test only. No personal data.', draftJSON));setup.record('ai','verified','Actual Gemini structured-response check passed. Billing remains user-confirmed, not API-verified.',setup.aiContext());}catch(e){setup.record('ai','attention',connectionState().status,setup.aiContext());throw e;}
            send({ ok: true });
            return;
        }
        if (url.pathname === '/api/chat') {
            const { text, requestId, mode } = z.object({ text: z.string().trim().min(1).max(4000), requestId: z.string().uuid(), mode: z.enum(['demo', 'live']) }).parse(body);
            const prior = db.prepare('SELECT id FROM tasks WHERE request_id=?').get(requestId);
            if (prior) {
                send({ task: prior, duplicate: true });
                return;
            }
            if (mode === 'live' && !liveEnabled())
                throw Error('Live AI is not configured. Use demo or follow Settings.');
            const id = randomUUID(), now = new Date().toISOString();
            db.exec('BEGIN');
            try {
                db.prepare('INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?)').run(id, requestId, text, mode, 'needs_user', 'Planning your request', null, now);
                db.prepare('INSERT INTO chat VALUES(?,?,?,?)').run(requestId, 'user', text, now);
                db.prepare('INSERT INTO task_plans(task_id,scope) VALUES(?,NULL)').run(id);
                db.exec('COMMIT');
            }
            catch (e) {
                db.exec('ROLLBACK');
                throw e;
            }
            void supervisor.planTask(id).catch(()=>console.error('Planning database operation failed; inspect task state.'));
            send({ id });
            return;
        }
        const match = url.pathname.match(/^\/api\/tasks\/([\w-]+)\/(start|pause|resume|cancel)$/);
        if (match) {
            supervisor.control(match[1], match[2]);
            send({ ok: true });
            return;
        }
        send({ error: 'Not found' }, 404);
    }
    catch (e) {
        send({ error: e instanceof z.ZodError ? e.issues.map(i => i.message).join(';') : (e as Error).message.includes('UNIQUE') ? 'That email already exists.' : (e as Error).message }, 400);
    }
});
server.listen(Number(process.env.PORT || 3000), '127.0.0.1', () => {console.log(`Workbench ready: http://localhost:${process.env.PORT || 3000} (${production ? 'production' : 'development'})`);setImmediate(()=>void setup.repositoryCheck().catch(()=>{}));});
for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => { clearInterval(timer); server.close(); void vite?.close(); setTimeout(() => process.exit(), 300).unref(); });
