/* Farol - service worker (26 out 2026). So para as notificacoes push: nao
   guarda nada em cache (a app continua a vir sempre fresca do servidor). */
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function(e){
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Farol', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Farol', {
    body: d.body || '',
    tag: d.tag || undefined,
    icon: '/icone-180.png',
    badge: '/icone-180.png',
    data: { url: d.url || '/' }
  }));
});

/* Tocar na notificacao: se o Farol ja esta aberto, vai para la e mostra o
   que foi avisado; senao abre-o nesse sitio. */
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(cs){
    for (var i = 0; i < cs.length; i++){
      if (cs[i].url.indexOf(self.registration.scope) === 0){
        cs[i].postMessage({ farolAbrir: url });
        return cs[i].focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
