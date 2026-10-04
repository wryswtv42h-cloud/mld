import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import httpProxy from 'http-proxy';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const API = (process.env.API_URL || 'https://api-production-5bddb.up.railway.app').replace(/\/$/, '');
const proxy = httpProxy.createProxyServer({ target: API, changeOrigin: true, ws: true, xfwd: true });

proxy.on('error', (err, req, res) => {
  if (res && !res.headersSent) res.writeHead(502, {'content-type':'application/json'});
  if (res) try { res.end(JSON.stringify({error:'تعذر الاتصال بخدمة MLD API'})); } catch {}
});

function contentType(file) {
  const ext=path.extname(file).toLowerCase();
  return ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'})[ext] || 'application/octet-stream';
}
const server=http.createServer((req,res)=>{
  if(req.url==='/health'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:true,service:'mld-web'}));}
  if(req.url.startsWith('/api/') || req.url.startsWith('/socket.io/')){
    proxy.web(req,res,{target:API});
    return;
  }
  let pathname=decodeURIComponent((req.url||'/').split('?')[0]);
  if(pathname==='/') pathname='/index.html';
  const file=path.normalize(path.join(publicDir,pathname));
  if(!file.startsWith(publicDir)) return res.writeHead(403).end();
  fs.readFile(file,(err,data)=>{
    if(err) return res.writeHead(404,{'content-type':'text/plain; charset=utf-8'}).end('Not found');
    res.writeHead(200,{'content-type':contentType(file),'cache-control':'no-cache'});
    res.end(data);
  });
});
server.on('upgrade',(req,socket,head)=>{
  if(req.url.startsWith('/socket.io/')) proxy.ws(req,socket,head,{target:API});
  else socket.destroy();
});
server.listen(process.env.PORT||3000,()=>console.log('🚀 MLD Web + API proxy running'));
