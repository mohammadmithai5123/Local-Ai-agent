export function nearBottom(scrollTop:number,clientHeight:number,scrollHeight:number) {
    return scrollHeight-clientHeight-scrollTop<=96;
}
export function resultStatus(set:any,task?:any) {
    if (task?.state==='paused') return 'paused';
    if (['failed','needs_user'].includes(task?.state)) return 'failed';
    if (task?.state==='cancelled') return 'cancelled';
    if (['queued','running'].includes(task?.state)||set.state==='running') return 'working';
    if (set.state==='partial'||set.origin!=='imported'&&set.rows.length<set.requested) return 'partial';
    return 'completed';
}
export function groupConversation(messages:any[]) {
    const groups:{id:string;messages:any[]}[]=[];
    for(const message of messages) {
        if(message.role==='user'||!groups.length) groups.push({id:message.role==='user'?message.id:'older-history',messages:[]});
        groups.at(-1)!.messages.push(message);
    }
    return groups;
}
export function filterLeads(leads:any[],query:string,country:string) {
    const search=query.trim().toLocaleLowerCase();
    return leads.filter(lead=>(!country||lead.country===country)&&(!search||['name','company','email','city','country','industry'].some(field=>String(lead[field]||'').toLocaleLowerCase().includes(search))));
}
export function leadsCsv(leads:any[]) {
    const cell=(value:unknown)=>{const text=String(value??'');return '"'+(/^[\s\u0000-\u001f]*[=+\-@]/u.test(text)?"'"+text:text).replaceAll('"','""')+'"';};
    return '\ufeff'+[['Name','Company','Email','City','Country','Industry'],...leads.map(lead=>['name','company','email','city','country','industry'].map(field=>lead[field]))].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
