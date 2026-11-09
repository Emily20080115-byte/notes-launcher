/* 筆記離線版 service worker */
const CACHE="notes-offline-20261109091743";
const CORE=["./","index.html","manifest.json","icon-180.png","icon-192.png","icon-512.png"];
const CDN=["https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js","https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js","https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js",
  "https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,500;7..72,700&family=Noto+Sans+TC:wght@400;500;700&display=swap"];
self.addEventListener("install", e=>{ e.waitUntil((async()=>{ const c=await caches.open(CACHE); await c.addAll(CORE);
  await Promise.all(CDN.map(u=>fetch(u,{mode:"no-cors"}).then(r=>c.put(u,r)).catch(()=>{}))); self.skipWaiting(); })()); });
self.addEventListener("activate", e=>{ e.waitUntil((async()=>{ for(const k of await caches.keys()) if(k!==CACHE && k.startsWith("notes-offline-")) await caches.delete(k); await self.clients.claim(); })()); });
function getFile(id){ return new Promise(ok=>{ const r=indexedDB.open("notes-offline",1); r.onupgradeneeded=()=>r.result.createObjectStore("files");
  r.onsuccess=()=>{ try{ const q=r.result.transaction("files","readonly").objectStore("files").get(id); q.onsuccess=()=>ok(q.result||null); q.onerror=()=>ok(null); }catch(e){ ok(null); } }; r.onerror=()=>ok(null); }); }
self.addEventListener("fetch", e=>{
  const req=e.request; if(req.method!=="GET") return;
  const url=new URL(req.url);
  if(url.origin===location.origin && url.pathname.includes("/_blob/")){
    const id=decodeURIComponent(url.pathname.split("/_blob/")[1]||"");
    e.respondWith(getFile(id).then(b=>b?new Response(b,{headers:{"Content-Type":b.type||"application/octet-stream"}}):new Response("not found",{status:404})));
    return;
  }
  if(url.origin===location.origin){
    /* app files: answer from the cache at once, refresh it in the background */
    e.respondWith((async()=>{ const c=await caches.open(CACHE); const hit=await c.match(req,{ignoreSearch:true});
      const net=fetch(req).then(r=>{ if(r.ok) c.put(req,r.clone()); return r; }).catch(()=>null);
      return hit || (await net) || (await c.match("index.html")) || new Response("offline",{status:503}); })());
    return;
  }
  /* libraries and fonts from CDNs: cache first */
  e.respondWith((async()=>{ const c=await caches.open(CACHE); const hit=await c.match(req.url); if(hit) return hit;
    try{ const r=await fetch(req); if(r.ok||r.type==="opaque") c.put(req.url,r.clone()); return r; }catch(err){ return new Response("",{status:504}); } })());
});
