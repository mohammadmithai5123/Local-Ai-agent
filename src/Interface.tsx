import React,{useEffect,useRef} from 'react';

function trapDialogTab(event:React.KeyboardEvent<HTMLDialogElement>) {
    if(event.key!=='Tab')return;
    const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')).filter(el=>el.getClientRects().length>0);
    const first=controls[0],last=controls.at(-1);if(!first)return;
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
}

export function Icon({name,size=20}:{name:string;size?:number}) {
    const paths:Record<string,React.ReactNode>={
        Chat:<><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-1 1v-8.5a8.5 8.5 0 0 1 18-1Z"/><path d="M8 9h8M8 13h5"/></>,
        Leads:<><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M6 16c0-3 6-3 6 0m3-7h3m-3 5h3"/></>,
        Tasks:<><rect x="4" y="4" width="16" height="17" rx="2"/><path d="M9 3h6v4H9zM8 12l1 1 2-2m3 1h3m-9 5h9"/></>,
        Connections:<><path d="m9 15 6-6m-7 3-2 2a4 4 0 0 0 6 6l2-2m-2-12 2-2a4 4 0 0 1 6 6l-2 2"/></>,
        Settings:<><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/></>,
        Gmail:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></>,
        Setup:<><path d="M8 3h8l5 6-9 12L3 9Z"/><path d="m8 11 3 3 5-6"/></>,
        menu:<path d="M4 6h16M4 12h16M4 18h16"/>,close:<path d="m6 6 12 12M6 18 18 6"/>,
        arrow:<path d="M12 19V5m-6 6 6-6 6 6"/>,panel:<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></>,
        download:<><path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/></>,
        search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    };
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]||paths.Chat}</svg>;
}
export const tabs=['Chat','Leads','Tasks','Connections','Gmail','Settings','Setup'];
export function Navigation({tab,navigate}:{tab:string;navigate:(tab:string)=>void}) {
    return <nav aria-label="Workspace navigation">{tabs.map(name=><button type="button" key={name} className={tab===name?'active':''} onClick={()=>navigate(name)} aria-current={tab===name?'page':undefined}><Icon name={name}/><span>{name==='Setup'?'Guided setup':name==='Gmail'?'Email reviews':name}</span></button>)}</nav>;
}
export function Drawer({open,onClose,children}:{open:boolean;onClose:()=>void;children:React.ReactNode}) {
    const dialog=useRef<HTMLDialogElement>(null);
    useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();if(!open&&dialog.current?.open)dialog.current.close();},[open]);
    return <dialog ref={dialog} className="navDrawer" aria-label="Navigation" onKeyDown={trapDialogTab} onCancel={onClose} onClose={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="drawerTop"><strong>Workspace</strong><button type="button" className="iconButton" onClick={onClose} aria-label="Close navigation" autoFocus><Icon name="close"/></button></div>{children}</dialog>;
}
export function LeadEditor({editing,onClose,onChange,onSave,busy}:any) {
    const dialog=useRef<HTMLDialogElement>(null);
    const previous=useRef(document.activeElement as HTMLElement|null);
    useEffect(()=>{dialog.current?.showModal();dialog.current?.querySelector('input')?.focus();return ()=>{dialog.current?.close();previous.current?.focus();};},[]);
    return <dialog ref={dialog} className="editDialog" aria-labelledby="editTitle" onKeyDown={trapDialogTab} onCancel={e=>{if(busy)e.preventDefault();else onClose();}} onClose={onClose}>
        <div className="sectionHead"><div><span className="eyebrow">CONTACT DETAILS</span><h2 id="editTitle">Edit lead</h2></div><button type="button" className="iconButton" onClick={onClose} disabled={busy} aria-label="Close editor"><Icon name="close"/></button></div>
        <form onSubmit={onSave}><div className="editFields">{['name','email','company','city','country','industry','notes'].map(field=><label key={field}>{field}<input autoFocus={field==='name'} type={field==='email'?'email':'text'} required={['name','email'].includes(field)} maxLength={field==='notes'?2000:300} value={editing[field]||''} onChange={e=>onChange({...editing,[field]:e.target.value})}/></label>)}</div><div className="row"><button disabled={busy}>{busy?'Saving…':'Save changes'}</button><button type="button" className="secondary" disabled={busy} onClick={onClose}>Cancel</button></div></form>
    </dialog>;
}
export function Activity({events}:{events:any[]}) {
    return <details className="activity"><summary>Activity log <span className="count">{events.length}</span></summary><p className="muted">Recorded events for troubleshooting.</p>{events.length?events.map(e=><article key={e.id}><time>{new Date(e.created).toLocaleTimeString()}</time><p>{e.text}</p></article>):<p className="muted">No activity recorded.</p>}</details>;
}
