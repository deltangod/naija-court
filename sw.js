self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch(_){d={body:e.data&&e.data.text()}}
e.waitUntil(self.registration.showNotification(d.title||'Naija Court',{body:d.body||'',icon:'./icon-192.png',badge:'./icon-192.png',data:{url:d.url||'./'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();const u=e.notification.data.url;
e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{for(const c of l){if('focus' in c){c.navigate(u).catch(()=>{});return c.focus()}}return clients.openWindow(u)}))});
self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(clients.claim()));
