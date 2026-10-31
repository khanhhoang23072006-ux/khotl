// Service worker HUSTDOCU: trang chính luôn lấy mạng trực tiếp, mất mạng thì dùng bản đã lưu.
const CACHE = "hustdocu-v4";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname === "api.anthropic.com") return;
  if (url.origin !== location.origin) return;
  // API luôn đi thẳng mạng, không lưu cache
  if (url.pathname.startsWith("/api/")) return;

  // Với trang chính và tài nguyên cùng nguồn: ưu tiên mạng với no-cache để luôn có bản mới nhất
  e.respondWith(
    fetch(req, { cache: "no-cache" })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html"))),
  );
});
