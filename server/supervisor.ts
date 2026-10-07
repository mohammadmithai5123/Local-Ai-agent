import { randomUUID } from 'node:crypto';
import { event, type Store } from './store.js';
import { draft, RateLimit } from './provider.js';
export class Supervisor {
    busy = false;
    constructor(public db: Store, public makeDraft = draft) {
        db.prepare("UPDATE tasks SET state='paused',reason='Server restarted. Review and resume to continue.' WHERE state IN ('running','queued')").run();
        db.prepare("UPDATE steps SET state='pending' WHERE state='working'").run();
        db.prepare("UPDATE tasks SET state='failed',reason='Server restarted while planning. Create a new request.' WHERE state='needs_user' AND reason='Planning your request'").run();
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
            if (!['running','queued','paused'].includes(task.state)) throw Error('Only an active draft task can be paused.');
            this.db.prepare("UPDATE tasks SET state='paused',reason='Paused by you',next_retry=NULL WHERE id=?").run(id);
        }
        else if (action === 'resume' || action === 'start') {
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
            this.db.prepare("UPDATE tasks SET state='queued',reason=NULL WHERE state='paused' AND next_retry IS NOT NULL AND next_retry<=?").run(Date.now());
            const task: any = this.db.prepare("SELECT * FROM tasks WHERE state IN ('queued','running') ORDER BY created LIMIT 1").get();
            if (!task)
                return;
            this.db.prepare("UPDATE tasks SET state='running' WHERE id=?").run(task.id);
            const step: any = this.db.prepare("SELECT * FROM steps WHERE task_id=? AND state='pending' LIMIT 1").get(task.id);
            if (!step) {
                this.db.prepare("UPDATE tasks SET state='completed',reason=NULL,next_retry=NULL WHERE id=?").run(task.id);
                event(this.db, task.id, 'Completed: all drafts saved; no messages sent.');
                return;
            }
            const lead: any = this.db.prepare('SELECT * FROM leads WHERE id=?').get(step.lead_id);
            this.db.prepare("UPDATE steps SET state='working',attempts=attempts+1 WHERE task_id=? AND lead_id=?").run(task.id, lead.id);
            try {
                const result = await this.makeDraft(lead, task.instruction, task.mode);
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
                if (err instanceof RateLimit && step.attempts < 2) {
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
