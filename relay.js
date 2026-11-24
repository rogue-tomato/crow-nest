'use strict';
/* CROW NEST — the table's second way through (owner, 2026-11-24). Two Macs in one room hung on Connecting…: WebRTC found no way
   between them (PeerJS's own TURN relays are gone) and the owner wants no account anywhere. So a table also runs through public
   MQTT brokers that need none. The host listens on all of them at once; a device whose direct link does not open in a few seconds
   asks on all of them and keeps the first that answers as this table; when that broker drops, it asks again and gets another.
   Everything is sealed with a key made from the table code (AES-GCM): a broker carries bytes it cannot read.
   A relay link looks like a PeerJS DataConnection to sync.js (open, send, close; open/data/close events), so wire() and the rest
   do not know which way a device came. Topics: <code>/h to the host, <code>/p/<device> to one device, <code>/all from the host. */
const RELAYS=['wss://broker.hivemq.com:8884/mqtt','wss://test.mosquitto.org:8081/mqtt','wss://broker.emqx.io:8084/mqtt'];
const RELAY_T='crownest/v1/';
let MQTTJS=null; // loaded only when a table opens, as PeerJS is
const loadMqtt=()=>MQTTJS??=new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/mqtt/5.10.1/mqtt.min.js';s.onload=ok;s.onerror=()=>{MQTTJS=null;s.remove();no()};document.head.append(s)});
const RKEY={},TE=new TextEncoder();
const relayKey=code=>RKEY[code]??=crypto.subtle.importKey('raw',TE.encode(code),'PBKDF2',false,['deriveKey'])
  .then(k=>crypto.subtle.deriveKey({name:'PBKDF2',salt:TE.encode('crownest-relay-v1'),iterations:100000,hash:'SHA-256'},k,{name:'AES-GCM',length:256},false,['encrypt','decrypt']));
async function rSeal(code,o){const iv=crypto.getRandomValues(new Uint8Array(12)),ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await relayKey(code),TE.encode(JSON.stringify(o))));
  const b=new Uint8Array(12+ct.length);b.set(iv);b.set(ct,12);return b}
// not sealed with this code (another table, a stray): dropped
async function rOpen(code,b){try{b=new Uint8Array(b);return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b.slice(0,12)},await relayKey(code),b.slice(12))))}catch{return null}}
class RelayConn{constructor(link,to){this.link=link;this.to=to;this.open=false;this.h={}}
  on(e,f){(this.h[e]||=[]).push(f);return this}
  emit(e,...a){for(const f of this.h[e]||[])f(...a)}
  send(m){if(this.open)this.link.say(this.to,{t:'d',m})}
  shut(){if(!this.open)return;this.open=false;this.emit('close')} // the other side left, or the broker dropped
  close(){if(this.open)this.link.say(this.to,{t:'bye'});this.shut()}}
// one broker connection; what it sends goes out sealed and in order (sealing is async)
function relayLink(url,code,me,opts){const L={url,code,me,sq:Promise.resolve(),rq:Promise.resolve(),conns:{},
  c:mqtt.connect(url,{clientId:'cn'+Math.random().toString(36).slice(2,12),connectTimeout:6000,keepalive:20,...opts})};
  const pub=(topic,o)=>{L.sq=L.sq.then(()=>rSeal(code,{...o,from:me})).then(b=>L.c.connected&&L.c.publish(topic,b,{qos:1})).catch(()=>{})};
  L.say=(to,o)=>pub(RELAY_T+code+(to==='h'?'/h':'/p/'+to),o);L.all=o=>pub(RELAY_T+code+'/all',o);
  L.got=f=>L.c.on('message',(t,b)=>{L.rq=L.rq.then(()=>rOpen(code,b)).then(o=>o&&f(o)).catch(()=>{})});
  return L}

// The host: listens on every broker for as long as the table is open (mqtt.js reconnects a broker that drops)
async function relayHost(code){relayStop();const R=NET.relay={code,links:[]};
  try{await loadMqtt()}catch{return}if(NET.relay!==R)return;
  const will={topic:RELAY_T+code+'/all',payload:await rSeal(code,{t:'gone',from:'h'}),qos:1};
  for(const url of RELAYS){const L=relayLink(url,code,'h',{reconnectPeriod:5000,will});R.links.push(L);
    L.c.on('connect',()=>{L.c.subscribe(RELAY_T+code+'/h',{qos:1});if(!NET.ready&&NET.relay===R){NET.ready=true;drawNet()}});
    // a device asks on every broker at once: each answers, and the link opens only on the broker it picked ('ok'); its link on
    // any other broker (the one it had before it dropped) goes, so each device is one connection here
    L.got(o=>{const id=o.from;if(typeof id!=='string'||id==='h'||NET.relay!==R)return;
      if(o.t==='hello')return L.say(id,{t:'welcome'});
      if(o.t==='ok'){for(const K of R.links){const y=K.conns[id];if(y){delete K.conns[id];y.shut()}}
        const x=L.conns[id]=new RelayConn(L,id);wire(x);x.open=true;x.emit('open');return} // sync.js sends it the table on 'open'
      const x=L.conns[id];if(!x)return;if(o.t==='d')x.emit('data',o.m);else if(o.t==='bye'){delete L.conns[id];x.shut()}})}}

// A device: asks on every broker at once and keeps the first that answers; the others close
async function relayJoin(){if(NET.rj||!NET.code||NET.host||NET.conns.length)return;NET.rj=true;const code=NET.code,me=DEV; // the same id after a drop: the host drops the old link
  try{await loadMqtt();const will={topic:RELAY_T+code+'/h',payload:await rSeal(code,{t:'bye',from:me}),qos:1};
    const L=await new Promise(done=>{let left=RELAYS.length,won=null;const tries=[];
      for(const url of RELAYS){const L=relayLink(url,code,me,{reconnectPeriod:0,will});tries.push(L);let over=false;
        const out=()=>{if(over)return;over=true;clearTimeout(L.t);L.c.end(true);if(!--left&&!won)done(null)};L.t=setTimeout(out,7000);
        // the winner's link: the table, until the host leaves or the broker drops (sync.js's close handler then asks again)
        const drop=()=>{const x=L.x;if(!x||NET.rl?.x!==x)return;NET.rl=null;L.c.end(true);x.shut()};
        L.c.on('connect',()=>L.c.subscribe([RELAY_T+code+'/p/'+me,RELAY_T+code+'/all'],{qos:1},e=>e?out():L.say('h',{t:'hello'})));
        L.c.on('close',()=>L.x?drop():out());L.c.on('error',()=>L.x||out());
        // one handler, in arrival order: the welcome opens the link at once, so the table sent right after it is not missed
        L.got(o=>{if(o.from!=='h')return;
          if(L.x){if(o.t==='d')L.x.emit('data',o.m);else if(o.t==='gone'||o.t==='bye')drop();return}
          if(o.t!=='welcome'||over)return;over=true;clearTimeout(L.t);
          if(won||NET.code!==code||NET.conns.length){L.c.end(true);return}won=L;for(const t of tries)if(t!==L)t.c.end(true);
          L.say('h',{t:'ok'});const x=L.x=new RelayConn(L,'h');NET.rl={L,x};NET.via='relay';wire(x);x.open=true;x.emit('open');done(L)})}});
    if(!L)relayFail()}
  catch{relayFail()}finally{NET.rj=false}}
// no broker answered as this table either: say it once, keep trying (sync.js retry)
function relayFail(){if(!NET.peer||!NET.code||NET.conns.length)return;if(!NET.tries)toast(`Can’t reach table ${NET.code} from this network. Retrying…`);retry()}
function relayStop(){const R=NET.relay;NET.relay=null;if(R)for(const L of R.links){for(const x of Object.values(L.conns))x.shut();L.all({t:'gone'});L.sq.then(()=>L.c.end(false))}
  const J=NET.rl;NET.rl=null;if(J){J.x.close();J.L.sq.then(()=>J.L.c.end(false))}NET.via=''}
