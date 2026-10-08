import type { z } from 'zod';
import { planSchema } from './provider.js';
const country=(value:string)=>/^(uae|united arab emirates|u\.a\.e\.?)$/i.test(value.trim())?'uae':value.trim().toLowerCase();
const industry=(value:string)=>value.toLowerCase().replace(/\bstores?\b|\bshops?\b/g,'').trim();
export function selectLeads(leads:any[],plan:z.infer<typeof planSchema>){return leads.filter(l=>(!plan.city||(l.city||'').toLowerCase().includes(plan.city.toLowerCase()))&&(!plan.company||(l.company||'').toLowerCase().includes(plan.company.toLowerCase()))&&(!plan.country||country(l.country||'')===country(plan.country))&&(!plan.industry||industry(l.industry||'').includes(industry(plan.industry)))).slice(0,plan.limit);}
