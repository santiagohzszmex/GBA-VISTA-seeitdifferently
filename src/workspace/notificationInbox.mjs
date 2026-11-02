// One generation per request/mutation: old reads can never restore unread flags.
export function createNotificationInbox(call,onChange){
 let active=true,generation=0,pending=0;
 let state={items:[],unread_count:0,fetched_at:null,error:'',reading:false,message:''};
 const emit=patch=>{if(active){state={...state,...patch};onChange(state);}};
 async function refresh(force=false){
  if(!active || (pending || state.reading)&&!force)return;
  const ticket=++generation;pending++;
  try{const inbox=await call('workspace_notifications');if(active&&ticket===generation)emit({...inbox,error:''});}
  catch(e){if(active&&ticket===generation)emit({error:e.message || 'No pudimos consultar tus notificaciones.'});}
  finally{pending--;}
 }
 async function read(id=null){
  if(!active || state.reading)return null;
  if(!id&&!state.fetched_at)throw Error('Actualiza las notificaciones antes de marcarlas.');
  const ticket=++generation;emit({reading:true,error:'',message:''});
  try{
   const result=await call('workspace_read_notification',{p_id:id,p_before:id?null:state.fetched_at});
   if(!active || ticket!==generation)return result;
   if(result.inbox)emit({...result.inbox,message:id?'Notificación marcada como leída.':`${result.read || 0} notificaciones marcadas como leídas.`});
   else{await refresh(true);emit({message:id?'Notificación marcada como leída.':'Notificaciones marcadas como leídas.'});}
   return result;
  }catch(e){if(active)emit({error:e.message || 'No pudimos marcar los avisos.'});return null;}
  finally{if(active)emit({reading:false});}
 }
 return {refresh,read,get snapshot(){return state;},dispose(){active=false;generation++;}};
}
