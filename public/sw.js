// Service worker de SmartPath — Web Push (§37.2)
// Muestra la notificación aunque la app esté cerrada y abre la URL al tocar.
self.addEventListener('push', (e) => {
  let d = { title: 'SmartPath', body: '', url: '/' }
  try {
    d = { ...d, ...e.data.json() }
  } catch (_e) {
    if (e.data) d.body = e.data.text()
  }
  e.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body,
      icon: '/logo.svg',
      badge: '/logo.svg',
      data: d.url,
    }),
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if (c.url.includes(url) && 'focus' in c) return c.focus()
      }
      return clients.openWindow(url)
    }),
  )
})
