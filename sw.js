/* LOTI-CUENTAS — service worker: permite usar la app sin internet.
 * - Archivos de la app: se sirven desde el dispositivo y se actualizan en segundo
 *   plano cuando hay internet (la próxima vez que abras la app verás la versión nueva).
 * - Librería de Excel (versión fija): se guarda una vez y se usa siempre.
 * Los datos de tus lotizaciones NO pasan por aquí: viven en el almacenamiento del navegador.
 */
'use strict';

var CACHE = 'loticuentas-app-v1';
var CACHE_LIB = 'loticuentas-lib-v1';
var EXCELJS = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
var ARCHIVOS = [
  './',
  'index.html',
  'css/styles.css',
  'js/calc.js',
  'js/excel.js',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-48.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ARCHIVOS); }).then(function () {
      // la librería de Excel es opcional: si falla, la app se instala igual
      return caches.open(CACHE_LIB).then(function (c) {
        return c.add(new Request(EXCELJS, { mode: 'cors' })).catch(function () {});
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE && k !== CACHE_LIB; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Librería de Excel: primero lo guardado
  if (req.url === EXCELJS) {
    e.respondWith(caches.open(CACHE_LIB).then(function (c) {
      return c.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) { if (res.ok) c.put(req, res.clone()); return res; });
      });
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Archivos de la app: responder con lo guardado y actualizar en segundo plano
  var clave = req.mode === 'navigate' ? 'index.html' : req;
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(clave, { ignoreSearch: true }).then(function (hit) {
      var red = fetch(req).then(function (res) {
        if (res.ok && res.type === 'basic') c.put(clave, res.clone());
        return res;
      }).catch(function () { return hit; });
      if (hit) { e.waitUntil(red.catch(function () {})); return hit; }
      return red;
    });
  }));
});
