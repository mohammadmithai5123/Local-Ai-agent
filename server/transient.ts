export class TransientFailure extends Error {
 constructor(public retryAt:number|null=null){super('Gemini 503 retry budget exhausted. Task paused; resume manually when service is available.');}
}
export type RequestControl={active?:()=>boolean;stage?:'health'|'planning'|'draft'|'discovery'|'analysis'};
export function retryDelay(header:string|null,attempt:number,now=Date.now(),random=Math.random){
 if(header){const seconds=Number(header);const date=Date.parse(header);if(Number.isFinite(seconds)&&seconds>=0)return seconds*1000;if(Number.isFinite(date))return Math.max(0,date-now);}
 return Math.min(8000,1000*2**(attempt-1))*(0.5+random()*0.5);
}
export async function bounded503<T>(operation:(timeout:number,attempt:number)=>Promise<{value?:T;retryAfter?:string|null;unavailable?:boolean}>,control:RequestControl={},runtime={now:Date.now,random:Math.random,sleep:(ms:number)=>new Promise<void>(r=>setTimeout(r,ms))},totalDeadline=Infinity){
 const started=runtime.now(),deadline=Math.min(started+90000,totalDeadline);
 const active=()=>{if(control.active&&!control.active())throw Error('Generation stopped by task control.');};
 for(let attempt=1;attempt<=3;attempt++){
  active();const remaining=deadline-runtime.now();if(remaining<=0)throw new TransientFailure();
  const result=await operation(Math.min(30000,remaining),attempt);active();if(!result.unavailable)return result.value!;
  const delay=retryDelay(result.retryAfter||null,attempt,runtime.now(),runtime.random),retryAt=runtime.now()+delay;
  if(attempt===3||retryAt>=deadline)throw new TransientFailure(result.retryAfter?retryAt:null);
  const until=retryAt;while(runtime.now()<until){active();await runtime.sleep(Math.min(200,until-runtime.now()));}active();
 }
 throw new TransientFailure();
}
