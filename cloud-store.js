'use strict';
/* One record holds the confirmed base, projection and outbox. A single IDB
   transaction therefore commits the user's operation and its local result. */
(function(root){
  let database;
  const open=()=>database||(database=new Promise((resolve,reject)=>{
    const req=indexedDB.open('crow-nest-cloud',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('records',{keyPath:'key'});
    req.onsuccess=()=>{req.result.onversionchange=()=>{req.result.close();database=null};resolve(req.result)};
    req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('Close the other CROW NEST tabs to update local storage.'));
  }));
  async function read(key){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('records','readonly'),req=tx.objectStore('records').get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)})}
  async function write(record,expected){const db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction('records','readwrite'),s=tx.objectStore('records'),req=s.get(record.key);let failure,result;
    req.onsuccess=()=>{const old=req.result;if(expected!==undefined&&(old?.generation||0)!==expected){failure=new Error('Another tab changed this save. Refresh before trying again.');failure.code='tab_changed';tx.abort();return}
      result={...structuredClone(record),generation:(old?.generation||0)+1};s.put(result)};
    tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(failure||tx.error||new Error('Local save failed.'));tx.onerror=()=>{};
  })}
  async function list(prefix=''){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('records','readonly'),req=tx.objectStore('records').getAll();req.onsuccess=()=>resolve(req.result.filter(x=>x.key.startsWith(prefix)));req.onerror=()=>reject(req.error)})}
  root.CloudStore={open,read,write,list};
})(globalThis);
