import { randomUUID } from 'node:crypto';
import { event, type Store } from './store.js';
import { draft, plan, RateLimit } from './provider.js';
import { TransientFailure, type RequestControl } from './transient.js';
import { selectLeads } from './selection.js';
export class Supervisor {
    busy = false;
    tools?:()=>Promise<boolean>;
    constructor(public db: Store, public makeDraft = draft,public makePlan=plan) {
        db.prepare("UPDATE tasks SET state='paused',reason='Server restarted. Review and resume to continue.' WHERE state IN ('running','queued')").run();
        db.prepare("UPDATE steps SET state='pending' WHERE state='working'").run();
        db.prepare("UPDATE tasks SET state='paused',reason='Planning interrupted; resume to plan again.',next_retry=NULL WHERE id IN (SELECT task_id FROM task_plans) AND state='needs_user'").run();
        db.prepare("UPDATE tasks SET state='failed',reason='Server restarted while planning. Create a new request.' WHERE state='needs_user' AND reason='Planning your request'").run();
    }
    async planTask(id:string){
        const task:any=this.db.prepare('SELECT * FROM tasks WHERE id=?').get(id);const marker:any=this.db.prepare('SELECT scope FROM task_plans WHERE task_id=?').get(id);if(!task||!marker)return;
        const active=()=>['needs_user','running'].includes(String(this.db.prepare('SELECT state FROM tasks WHERE id=?').get(id)?.state));
        const history=(this.db.prepare('SELECT role,text FROM chat ORDER BY created DESC,rowid DESC LIMIT 8').all() as {role:string;text:string}[]).reverse().filter(m=>m.text!==task.instruction).map(m=>({...m,text:m.text.slice(0,600)}));
        try{const p=await this.makePlan(task.instruction,task.mode,{active,stage:'planning'},history);if(!active())return;
            if(p.kind==='conversation'||p.kind==='unsupported'){
                this.db.exec('BEGIN');try{
                    this.db.prepare("UPDATE tasks SET state='completed',reason=?,next_retry=NULL WHERE id=?").run(p.kind==='conversation'?'Conversation reply saved; no action performed.':'Unsupported request explained; no action performed.',id);
                    this.db.prepare('DELETE FROM task_plans WHERE task_id=?').run(id);
                    this.db.prepare('INSERT INTO chat VALUES(?,?,?,?)').run(randomUUID(),'assistant',`${task.mode==='demo'?'[DEMO] ':''}${p.reply}`,new Date().toISOString());
                    event(this.db,id,'Chat reply saved; no lead action or send performed.');this.db.exec('COMMIT');
                }catch(e){this.db.exec('ROLLBACK');throw e;}return;
            }
            const scope=marker.scope?new Set(JSON.parse(marker.scope)):null;const leads=selectLeads(this.db.prepare('SELECT * FROM leads ORDER BY name').all().filter((l:any)=>!scope||scope.has(l.id)),p);
            this.db.exec('BEGIN');try{for(const l of leads)this.db.prepare("INSERT OR IGNORE INTO steps(task_id,lead_id,state) VALUES(?,?,'pending')").run(id,l.id);
            this.db.prepare("UPDATE tasks SET state='paused',reason=?,next_retry=NULL WHERE id=?").run(leads.length?'Planning succeeded. Review selected recipients, then Start drafts.':'No matching leads; create a new request.',id);this.db.prepare('DELETE FROM task_plans WHERE task_id=?').run(id);
            this.db.prepare('INSERT INTO chat VALUES(?,?,?,?)').run(randomUUID(),'assistant',`${task.mode==='demo'?'[DEMO] ':''}${leads.length} imported lead(s) selected. ${leads.length?'Review the task and Start drafts to generate personalized drafts.':'No matching leads were found.'} No messages sent.`,new Date().toISOString());event(this.db,id,'Planning succeeded; awaiting draft review.');this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}
        }catch(e){if(!active())return;const transient=e instanceof TransientFailure,quota=e instanceof RateLimit;if((transient||quota)&&e.retryAt)this.db.prepare('INSERT OR REPLACE INTO task_retry_holds VALUES(?,?)').run(id,e.retryAt);this.db.prepare('UPDATE tasks SET state=?,reason=?,next_retry=NULL WHERE id=?').run(transient||quota?'paused':'failed',`Planning: ${e instanceof Error?e.message:'failed'}${quota?' Resume manually after '+new Date(e.retryAt).toISOString():''}`,id);event(this.db,id,transient?'Planning retry budget exhausted; manual resume required.':'Planning failed.');}
    }
    control(id: string, action: string) {
        const task: any = this.db.prepare('SELECT * FROM tasks WHERE id=?').get(id);
        if (!task)
            throw Error('Task not found.');
        if (['completed', 'cancelled'].includes(task.state))
            throw Error('This task is already finished.');
        if (action === 'cancel') {
            this.db.prepare("UPDATE tasks SET state='cancelled',reason='Cancelled by you',next_retry=NULL WHERE id=?").run(id);
        }
        else if (action === 'pause') {
            if (!['running','queued','paused','needs_user'].includes(task.state)) throw Error('Only an active task can be paused.');
            this.db.prepare("UPDATE tasks SET state='paused',reason='Paused by you',next_retry=NULL WHERE id=?").run(id);
        }
        else if (action === 'resume' || action === 'start') {
            const hold:any=this.db.prepare('SELECT not_before FROM task_retry_holds WHERE task_id=?').get(id);if(hold?.not_before>Date.now())throw Error(`Provider Retry-After: resume no earlier than ${new Date(hold.not_before).toISOString()}.`);
            if (!['paused','needs_user'].includes(task.state) || task.reason === 'Planning your request') throw Error('Only a reviewed or interrupted task can start or resume.');
            if (task.next_retry && task.next_retry > Date.now())
                throw Error('Wait until the displayed retry time.');
            if (task.state === 'failed')
                throw Error('Failed tasks cannot resume; create a new task.');
            this.db.prepare("UPDATE tasks SET state='queued',reason=NULL,next_retry=NULL WHERE id=?").run(id);
        }
        else
            throw Error('Unknown task action.');
        event(this.db, id, `Task ${action}`);
    }
    async tick() {
        if (this.busy)
            return;
        this.busy = true;
        try {
            if(this.tools && await this.tools())return;
            this.db.prepare("UPDATE tasks SET state='queued',reason=NULL WHERE state='paused' AND next_retry IS NOT NULL AND next_retry<=?").run(Date.now());
            const task: any = this.db.prepare("SELECT * FROM tasks WHERE state IN ('queued','running') ORDER BY created LIMIT 1").get();
            if (!task)
                return;
            this.db.prepare("UPDATE tasks SET state='running' WHERE id=?").run(task.id);
            if(this.db.prepare('SELECT task_id FROM task_plans WHERE task_id=?').get(task.id)){await this.planTask(task.id);return;}
            const step: any = this.db.prepare("SELECT * FROM steps WHERE task_id=? AND state='pending' LIMIT 1").get(task.id);
            if (!step) {
                this.db.prepare("UPDATE tasks SET state='completed',reason=NULL,next_retry=NULL WHERE id=?").run(task.id);
                event(this.db, task.id, 'Completed: all drafts saved; no messages sent.');
                return;
            }
            const lead: any = this.db.prepare('SELECT * FROM leads WHERE id=?').get(step.lead_id);
            this.db.prepare("UPDATE steps SET state='working',attempts=attempts+1 WHERE task_id=? AND lead_id=?").run(task.id, lead.id);
            try {
                const result = await this.makeDraft(lead, task.instruction, task.mode,{active:()=>this.db.prepare('SELECT state FROM tasks WHERE id=?').get(task.id)?.state==='running',stage:'draft'});
                const current: any = this.db.prepare('SELECT state FROM tasks WHERE id=?').get(task.id);
                if (current.state !== 'running') {
                    this.db.prepare("UPDATE steps SET state='pending' WHERE task_id=? AND lead_id=?").run(task.id, lead.id);
                    return;
                }
                this.db.exec('BEGIN');
                try {
                    this.db.prepare('INSERT OR IGNORE INTO drafts VALUES(?,?,?,?,?,?,?)').run(randomUUID(), task.id, lead.id, result.subject, result.body, task.mode, new Date().toISOString());
                    this.db.prepare("UPDATE steps SET state='done',error=NULL WHERE task_id=? AND lead_id=?").run(task.id, lead.id);
                    event(this.db, task.id, `Draft saved for ${lead.name}`);
                    this.db.exec('COMMIT');
                }
                catch (e) {
                    this.db.exec('ROLLBACK');
                    throw e;
                }
            }
            catch (e) {
                const err = e as Error;
                this.db.prepare("UPDATE steps SET state='pending',error=? WHERE task_id=? AND lead_id=?").run(err.message, task.id, lead.id);
                const current: any = this.db.prepare('SELECT state FROM tasks WHERE id=?').get(task.id);
                if (current.state !== 'running')
                    return;
                if(err instanceof TransientFailure){if(err.retryAt)this.db.prepare('INSERT OR REPLACE INTO task_retry_holds VALUES(?,?)').run(task.id,err.retryAt);this.db.prepare("UPDATE tasks SET state='paused',reason=?,next_retry=NULL WHERE id=?").run(`Draft generation: ${err.message}`,task.id);}
                else if (err instanceof RateLimit && step.attempts < 2) {
                    this.db.prepare("UPDATE tasks SET state='paused',reason='Provider rate limit; bounded retry scheduled',next_retry=? WHERE id=?").run(err.retryAt, task.id);
                }
                else
                    this.db.prepare("UPDATE tasks SET state=?,reason=?,next_retry=NULL WHERE id=?").run(err instanceof RateLimit ? 'needs_user' : 'failed', err instanceof RateLimit ? 'Three attempts reached. Check quota before resuming.' : err.message, task.id);
                event(this.db, task.id, err.message);
            }
        }
        finally {
            this.busy = false;
        }
    }
}
