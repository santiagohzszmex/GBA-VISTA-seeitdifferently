/* Device delivery only: no fetch interception, document caching or stored sessions. */
const validId=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
self.addEventListener('push',event=>{
 let data;try{data=event.data.json();}catch{return;}
 if(data.v!==1||!validId(data.owner)||!validId(data.deliveryId)||(data.notificationId!==null&&!validId(data.notificationId)))return;
 event.waitUntil(self.registration.showNotification(data.test?'Avisos de Workspace activados':'Workspace · Tienes una actualización',{
  body:data.test?'Este dispositivo ya puede recibir tus avisos.':'Abre Workspace para consultar el aviso con tu GBA ID.',
  icon:'/workspace/notification-icon.png',badge:'/workspace/notification-icon.png',
  tag:`workspace:${data.owner}:${data.notificationId||data.deliveryId}`,renotify:false,
  data:{owner:data.owner,notificationId:data.notificationId}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const url=new URL('/workspace/web/',self.location.origin),id=event.notification.data?.notificationId;
 if(validId(id))url.searchParams.set('notification',id);
 // A new window preserves documents being edited in an existing Workspace tab.
 event.waitUntil(self.clients.openWindow(url.href));
});
self.addEventListener('pushsubscriptionchange',event=>{
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{for(const client of clients)client.postMessage({type:'workspace-push-expired'});}));
});
