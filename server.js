// Zero-dependency static server + WebSocket relay.  Run: node server.js [port]
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=+process.argv[2]||process.env.PORT||8000,ROOT=__dirname,MAX_ROOM=8;
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'};
const srv=http.createServer((req,res)=>{
 let u=decodeURIComponent(req.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,path.normalize(u));
 if(!f.startsWith(ROOT)||/server\.js$/.test(f)){res.writeHead(403);return res.end()}
 fs.readFile(f,(e,b)=>{if(e){res.writeHead(404);return res.end('Not found')}
  res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});res.end(b)})});
const rooms=new Map();let nextId=1;
function frame(str){const b=Buffer.from(str),n=b.length;
 const h=n<126?Buffer.from([0x81,n]):n<65536?Buffer.from([0x81,126,n>>8,n&255]):null;
 return h?Buffer.concat([h,b]):null}
srv.on('upgrade',(req,sock)=>{
 const url=new URL(req.url,'http://x');
 if(url.pathname!=='/ws'||!req.headers['sec-websocket-key'])return sock.destroy();
 const room=(url.searchParams.get('room')||'main').slice(0,24).replace(/[^\w-]/g,'');
 const set=rooms.get(room)||new Map();rooms.set(room,set);
 if(set.size>=MAX_ROOM)return sock.destroy();
 sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+
  crypto.createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')+'\r\n\r\n');
 const id=nextId++,me={sock,state:null,last:0};set.set(id,me);
 sock.write(frame(JSON.stringify({t:'hi',id})));
 let buf=Buffer.alloc(0);
 sock.on('data',d=>{buf=Buffer.concat([buf,d]);
  while(buf.length>=2){const op=buf[0]&15;let len=buf[1]&127,off=2;
   if(len===126){if(buf.length<4)return;len=buf.readUInt16BE(2);off=4}else if(len===127)return sock.destroy();
   if(buf.length<off+4+len)return;const mask=buf.slice(off,off+4),pl=Buffer.from(buf.slice(off+4,off+4+len));
   for(let i=0;i<len;i++)pl[i]^=mask[i&3];buf=buf.slice(off+4+len);
   if(op===8)return sock.end();
   if(op===1&&len<300){try{const m=JSON.parse(pl),now=Date.now();
    if(m.t==='p'&&now-me.last>40&&isFinite(m.x)&&isFinite(m.y)){me.last=now;
     me.state={id,x:m.x|0,y:m.y|0,a:+m.a||0,n:String(m.n||'').slice(0,20),c:/^#[0-9a-f]{6}$/i.test(m.c)?m.c:'#ffe7b2',d:m.d?1:0,r:m.r?1:0,ts:now}}}catch{}}}});
 const bye=()=>{set.delete(id);if(!set.size)rooms.delete(room)};
 sock.on('close',bye);sock.on('error',bye);
});
setInterval(()=>{const now=Date.now();for(const set of rooms.values()){
 const all=[...set.values()].filter(c=>c.state&&now-c.state.ts<5000).map(c=>c.state);
 for(const [id,c] of set){const f=frame(JSON.stringify({t:'s',p:all.filter(s=>s.id!==id)}));if(f&&!c.sock.destroyed)c.sock.write(f)}}},66);
srv.listen(PORT,()=>console.log(`The Far Backrooms → http://localhost:${PORT}  (share  ?room=NAME  to group up)`));
