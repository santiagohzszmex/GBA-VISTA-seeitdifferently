export const DEADLINE_ZONE='America/Mexico_City';
const dayMs=86400000;
const partsFormat=new Intl.DateTimeFormat('en-CA',{timeZone:DEADLINE_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function mexicoParts(value){const d=new Date(value);if(!Number.isFinite(+d))throw Error('Fecha inválida');return Object.fromEntries(partsFormat.formatToParts(d).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));}
export function mexicoInstant(date,time='23:59'){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))throw Error('Indica una fecha y hora válidas.');
 const [y,m,d]=date.split('-').map(Number),[h,min]=time.split(':').map(Number),target=Date.UTC(y,m-1,d,h,min);
 const valid=new Date(target);if(valid.getUTCFullYear()!==y||valid.getUTCMonth()!==m-1||valid.getUTCDate()!==d||h>23||min>59)throw Error('Fecha inválida');
 let instant=target;
 for(let i=0;i<4;i++){const p=mexicoParts(instant),wall=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);if(wall===target)return new Date(instant).toISOString();instant+=target-wall;}
 throw Error('Esa hora no existe en Ciudad de México; elige otra.');
}
export const deadlineInstant=value=>!value?null:/^\d{4}-\d{2}-\d{2}$/.test(value)?mexicoInstant(value):new Date(value).toISOString();
export function deadlineInput(value,hasTime=true){if(!value)return{date:'',time:''};const p=mexicoParts(deadlineInstant(value));return{date:`${p.year}-${p.month}-${p.day}`,time:hasTime?`${p.hour}:${p.minute}`:''};}
export function dayNumber(value){const p=mexicoParts(value);return Date.UTC(+p.year,+p.month-1,+p.day)/dayMs;}
export function deadlineDate(value,{time=false}={}){if(!value)return'Sin fecha';const instant=deadlineInstant(value),base=new Intl.DateTimeFormat('es-MX',{timeZone:DEADLINE_ZONE,weekday:'short',day:'numeric',month:'short'}).format(new Date(instant)).replaceAll('.','');return time?`${base}, ${new Intl.DateTimeFormat('es-MX',{timeZone:DEADLINE_ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(instant))} · Ciudad de México`:base;}
export function relativeDate(value,now=new Date()){if(!value)return'';const n=dayNumber(deadlineInstant(value))-dayNumber(now);return n===0?'hoy':n>0?`en ${n} ${n===1?'día':'días'}`:`hace ${-n} ${n===-1?'día':'días'}`;}
const sent=new Set(['review','area_approved','in_qa','qa_approved','published']);
export function deliveryGroup(task){const state=task.state==='blocked'?task.blocked_from:task.state;return sent.has(state)||(state==='archived'&&task.current_version>0)?'delivered':'pending';}
export function deadlineStatus(task,now=new Date()){
 const delivered=deliveryGroup(task)==='delivered',first=task.first_submitted_at;
 if(delivered&&(!first||task.submitted_deadline_known!==true))return{key:'unknown',text:'Plazo histórico no disponible',tone:'',relative:'',label:deadlineDate(task.due_at)};
 const value=delivered?task.submitted_due_at:task.due_at;
 if(!value)return{key:'none',text:'Sin fecha',tone:'',relative:'',label:'Sin fecha'};
 const due=+new Date(deadlineInstant(value)),at=+new Date(delivered?first:now),days=dayNumber(at)-dayNumber(due),late=at>due;
 const common={label:deadlineDate(task.due_at),relative:relativeDate(task.due_at,now)};
 if(delivered)return{...common,key:late?'delivered-late':'on-time',text:late?(days>0?`Con ${days} ${days===1?'día':'días'} de retraso`:'Con menos de 1 día de retraso'):'A tiempo',tone:late?'late':'ok'};
 if(late)return{...common,key:'late',text:days>0?`Vencida hace ${days} ${days===1?'día':'días'}`:'Vencida hoy',tone:'late'};
 if(days===0)return{...common,key:'today',text:'Vence hoy',tone:'soon'};
 if(due-at<=48*3600000)return{...common,key:'soon',text:'Vence pronto',tone:'soon'};
 return{...common,key:'on-track',text:'En plazo',tone:''};
}
export function deliverySummary(tasks,now=new Date()){const delivered=tasks.filter(t=>deliveryGroup(t)==='delivered').length;return{total:tasks.length,delivered,pending:tasks.length-delivered,late:tasks.filter(t=>deadlineStatus(t,now).key==='late').length,soon:tasks.filter(t=>['soon','today'].includes(deadlineStatus(t,now).key)).length};}
export function withDeadlineFacts(task,data){const fact=data.deadlines?.[task.id];if(fact)return{...task,...fact};const first=(data.versions||[]).filter(v=>v.deliverable_id===task.id).sort((a,b)=>a.version_number-b.version_number)[0];return{...task,first_submitted_at:first?.created_at||null,submitted_due_at:first?.due_at_on_submit??null,submitted_deadline_known:first?.deadline_snapshot_known===true,deadline_changes:[]};}
