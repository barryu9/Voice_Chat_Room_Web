// 最小化 Service Worker — 主要用于启用 PWA 安装提示（beforeinstallprompt）
// 当前版本仅做网络优先的缓存穿透，不缓存任何资源，确保始终加载最新内容
self.addEventListener('install', () => {
  // 跳过等待阶段，立即激活
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // 接管所有客户端（立即生效，不需要刷新）
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // 网络优先：始终从网络获取，不 cache
  event.respondWith(fetch(event.request));
});
