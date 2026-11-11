'use strict';
/* Durable, account-scoped operation client. Rendering never sends game state.
   Server snapshots are read models; writes are bounded field CAS or transfers. */
(function(root){
  const enabled=!!root.CROW_SERVER?.enabled;
  const clone=x=>JSON.parse(JSON.stringify(x,(k,v)=>v instanceof Set?[...v]:v));
  const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])])):value;
  const equal=(a,b)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b));
  const uuid=()=>crypto.randomUUID();
  const legacy={party:clone(PARTY),villages:clone(VILLAGES),custom:clone(CUSTOM),journal:clone(JOURNAL),pool:clone(S.pool),session:{dt:clone(S.dt),rtravel:clone(S.rtravel),combat:clone(S.combat),phase:S.phase||'',here:S.here||'',xp:S.xp||null,journey:clone(S.journey)}};
  const injectedIds=new Set(),originalIds=new Set(D.items.filter(it=>!CUSTOM.some(c=>c.id===it.id)).map(it=>it.id));
  function clearDefinitions(){const ids=new Set([...injectedIds,...CUSTOM.map(it=>it.id)]);for(const id of ids)if(!originalIds.has(id))delete IT[id];D.items.splice(0,D.items.length,...D.items.filter(it=>!ids.has(it.id)||originalIds.has(it.id)));CUSTOM.splice(0,CUSTOM.length);injectedIds.clear()}
  function injectDefinition(it){if(!it?.id||originalIds.has(it.id))return;IT[it.id]=clone(it);const index=D.items.findIndex(x=>x.id===it.id);if(index<0)D.items.push(IT[it.id]);else D.items[index]=IT[it.id];injectedIds.add(it.id)}
  function scrubView(){closePanel();hidePreview();closePops(0);closeSlotSearch();P.stack=[];P.i=-1;for(const id of ['pbody','ptitle','preview'])document.getElementById(id)?.replaceChildren();const dialog=document.getElementById('dlg');if(dialog?.open)dialog.close();if(dialog)dialog.replaceChildren();S.invPop=null;S.lib.pick=null;S.lookup.pick=null;S.b=null;S.mi={last:null};S.rmi={};S.rest={act:null,pick:null,where:null,ration:true,part:'angel-part',size:1,plus:false,log:null};S.sell={sel:{},greed:{},val:{},to:{},ar:{}}}
  const listeners=new Set(),state={enabled,user:null,adventureId:null,snapshot:null,status:'Synced',pending:0,error:null,authenticated:false};
  let record=null,staging=null,committing=false,applying=false,pumping=false,fetching=false,retryTimer=null,retries=0,stream=null,deviceId,renderWanted=false,epoch=0,creationStaging=false,importJobs=[],importing=false;
  const channel=enabled&&typeof BroadcastChannel!=='undefined'?new BroadcastChannel('crow-nest-cloud'):null;
  try{deviceId=localStorage.getItem('ctk-cloud-device')||uuid();localStorage.setItem('ctk-cloud-device',deviceId)}catch{deviceId=uuid()}
  function notify(){state.pending=(record?.outbox?.length||0)+importJobs.length;state.snapshot=record?.local||null;for(const fn of listeners)fn(state);document.dispatchEvent(new CustomEvent('cloudchange',{detail:state}))}
  const explanations={field_conflict:'Someone changed the same value. Review your pending change before trying again.',version_conflict:'The item or destination changed. Refresh and choose the transfer again.',slots_unavailable:'Those slots are no longer available. Choose another destination.',item_unavailable:'Another player already moved or took this item.',inventory_requires_referee:'This inventory change needs the Referee. Your server inventory was not changed.',entity_deleted:'This character or item was deleted. An older change cannot restore it.',changed_on_server:'A pending change overlaps a newer server change. Review it before continuing.',dependency_failed:'An earlier change was rejected. Review this change and those that depend on it.',upgrade_required:'This save needs a newer compatible CROW NEST client.'};
  function status(value,error=null){state.status=value;state.error=explanations[error]||error;notify()}
  function remember(){try{localStorage.setItem('ctk-cloud-context',JSON.stringify({accountId:state.user?.id,context:state.adventureId,user:state.user&&{id:state.user.id,name:state.user.name,email:state.user.email}}))}catch{}}
  const contextPath=id=>id.startsWith('character:')?'/api/characters/'+encodeURIComponent(id.slice(10)):'/api/adventures/'+encodeURIComponent(id);
  function normalize(snapshot){const s=clone(snapshot);for(const [key,entry] of Object.entries(s.entities||{}))if(key.startsWith('crow:')&&entry.data)entry.data=clone(reviveCrow(entry.data));return s}
  async function request(path,options={}){const response=await fetch(path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});let body;try{body=await response.json()}catch{body={}}
    if(!response.ok){const error=new Error(body.message||body.error?.message||body.code||(typeof body.error==='string'?body.error:'The server could not complete this request.'));error.status=response.status;error.code=body.code||body.error?.code||(typeof body.error==='string'?body.error:undefined);error.body=body;throw error}return body}
  const post=(path,body)=>request(path,{method:'POST',body:JSON.stringify(body)});
  function runtime(){const entities={};if(record?.local?.entities.custom)entities.custom={data:clone(CUSTOM)};for(const c of PARTY)entities['crow:'+c.id]={data:clone(c)};
    if(!/^(character:|pending:)/.test(state.adventureId||'')){entities.pool={data:clone(S.pool)};entities.villages={data:clone(VILLAGES)};const session={dt:S.dt,rtravel:S.rtravel,combat:S.combat,phase:S.phase||'',here:S.here||'',xp:S.xp||null};entities.session={data:clone(Object.fromEntries(Object.keys(record?.local?.entities.session?.data||session).map(k=>[k,session[k]])))};if(record?.local?.entities.mapPub)entities.mapPub={data:clone(S.mapPub??record.local.entities.mapPub.data)};if(record?.local?.entities.journey)entities.journey={data:clone(S.journey??record.local.entities.journey.data)}}return entities}
  function install(snapshot){if(!snapshot)return;applying=true;try{
    clearDefinitions();for(const it of Object.values(snapshot.itemDefinitions||{}))injectDefinition(it);for(const it of snapshot.entities?.custom?.data||[]){injectDefinition(it);CUSTOM.push(clone(it))}
    const chosen=ME?.id,entities=snapshot.entities||{},crows=Object.entries(entities).filter(([k,x])=>k.startsWith('crow:')&&x.data).map(([,x])=>reviveCrow(clone(x.data)));
    PARTY.splice(0,PARTY.length,...crows);ME=PARTY.find(c=>c.id===chosen)||PARTY[0]||null;
    S.pool=clone(entities.pool?.data||[]);VILLAGES.splice(0,VILLAGES.length,...clone(entities.villages?.data||[]));
    const v=clone(entities.session?.data||{});Object.assign(S,{dt:{n:1,running:false,left:1800,len:30,dungeon:'undead',crowded:false,chaos:false,end:null},rtravel:{day:1,pace:'normal',mods:{},checks:[],restChecks:[],lost:false,camp:null},combat:[],phase:'',here:'',xp:{rows:[],players:1}});for(const key of ['dt','rtravel','combat','phase','here','xp'])if(key in v)S[key]=v[key];S.mapPub=clone(entities.mapPub?.data??null);S.journey=clone(entities.journey?.data??JourneyRules.defaultJourney());
    JOURNAL=clone(record?.journal||[]);for(const key of Object.keys(REMOTE_LOG))delete REMOTE_LOG[key];
    S.role=snapshot.role==='referee'?'ref':'player';S.placing=clone(record?.ui?.placing||null);S.moving=null;S.pendingWounds=record?.ui?.pendingWounds||0;S.invPop=null;
    if(S.area==='session'&&S.role==='player')S.area='crows';
    root.hxCloudInstall?.(snapshot.role==='referee');
    render();if(document.body.classList.contains('panel-open'))renderPanel();
  }finally{applying=false}}
  function restoreLegacy(){applying=true;try{clearDefinitions();for(const it of legacy.custom){injectDefinition(it);CUSTOM.push(clone(it))}PARTY.splice(0,PARTY.length,...legacy.party.map(x=>reviveCrow(clone(x))));ME=PARTY[0]||null;VILLAGES.splice(0,VILLAGES.length,...clone(legacy.villages));S.pool=clone(legacy.pool);JOURNAL=clone(legacy.journal);Object.assign(S,clone(legacy.session));root.hxCloudLeave?.();S.area='crows';render()}finally{applying=false}}
  function changes(before,after){const out=[];for(const key of new Set([...Object.keys(before),...Object.keys(after)])){
    const b=before[key]?.data??null,a=after[key]?.data??null;if(equal(a,b))continue;
    // The shared map starts and stops as a whole ({} means no map); in between only its changed fields travel.
    if(b===null||a===null||Array.isArray(b)||Array.isArray(a)||key==='mapPub'&&(!Object.keys(a).length||!Object.keys(b).length)){out.push({entity:key,path:'',before:b,after:a});continue}
    for(const path of new Set([...Object.keys(b),...Object.keys(a)]))if(!equal(b[path]??null,a[path]??null))out.push({entity:key,path,before:b[path]??null,after:a[path]??null});
  }return out}
  function replay(base,ops){const local=clone(base);for(const queued of ops){if(queued.state==='conflict')break;
    if(queued.op.type==='transfer'||queued.op.type==='identify'&&!queued.op.payload.changes)continue; // Shared ownership is displayed only after server confirmation.
    let conflict=false;for(const change of queued.op.payload.changes||[]){const entry=local.entities[change.entity],current=change.path?entry?.data?.[change.path]??null:entry?.data??null;if(!equal(current,change.before)&&!equal(current,change.after)){conflict=true;break}}
    if(conflict){queued.state='conflict';queued.code='changed_on_server';break}
    for(const change of queued.op.payload.changes||[]){if(change.path){if(!local.entities[change.entity])continue;local.entities[change.entity].data[change.path]=clone(change.after)}else{local.entities[change.entity]={...(local.entities[change.entity]||{}),data:clone(change.after)}}if(queued.op.type==='identify'){const item=local.entities[queued.op.payload.entity]?.data?.inv?.find(i=>i.uid===queued.op.payload.uid);if(item)item.unid=true}}
  }return local}
  async function persist(next,expected=record?.generation){const stamp=epoch;const saved=await CloudStore.write(next,expected);if(stamp!==epoch||(record&&record.key!==next.key)){const e=new Error('The active account or save changed.');e.code='context_changed';throw e}record=saved;channel?.postMessage({key:saved.key,generation:saved.generation});return saved}
  function begin(){if(!enabled||!record||applying||staging)return false;if(committing){toast('Please wait for the local save.');return false}staging={before:runtime(),journalId:JOURNAL.at(-1)?.id,identify:S.rest?.act==='identify'&&S.rest.pick?{entity:'crow:'+ME.id,uid:+S.rest.pick,method:'rest'}:null};return true}
  function runMutation(fn){if(!enabled||!record||applying)return fn();if(committing){toast('Please wait for the local save.');return}const owner=begin();let result;try{result=fn()}catch(e){if(owner){staging=null;install(record.local)}throw e}finally{if(owner)queueMicrotask(settle)}return result}
  async function settle(){if(!staging||committing)return;const before=staging.before,lastJournalId=staging.journalId,identification=staging.identify,after=runtime();staging=null;const delta=changes(before,after);if(!delta.length){if(renderWanted){renderWanted=false;applying=true;try{render()}finally{applying=false}}return}
    const old=clone(record),stamp=epoch;committing=true;status('Saving locally');
    try{
      if(record.outbox.some(x=>x.state==='conflict'))throw new Error('Resolve the queued conflict before making another change.');
      if(delta.some(x=>x.path===''&&x.before===null))throw new Error('Create new characters from Account before opening a shared adventure.');
      const operation={protocolVersion:1,operationId:uuid(),deviceId,type:'changes',payload:{changes:delta},expectedVersions:Object.fromEntries(delta.map(c=>[c.entity,record.local.entities[c.entity]?.version||0])),dependsOn:record.outbox.length?[record.outbox.at(-1).op.operationId]:[]};
      if(identification&&delta.some(c=>c.entity===identification.entity&&c.path==='inv'&&c.after?.some(i=>i.uid===identification.uid&&!i.unid))){operation.type='identify';operation.payload={...identification,changes:delta}}
      const next=clone(record),entry=JOURNAL.at(-1)?.id!==lastJournalId?JOURNAL.at(-1):null;const journalEntry=entry?{...clone(entry),cloudOperationId:operation.operationId}:{id:'cloud:'+operation.operationId,t:Date.now(),who:ME?.id||'ref',label:'Updated game state',cloudOperationId:operation.operationId};
      next.journal=clone(JOURNAL);if(entry)next.journal[next.journal.length-1]=journalEntry;else next.journal.push(journalEntry);next.journal=next.journal.slice(-80);next.ui={pendingWounds:S.pendingWounds,placing:clone(S.placing)};
      next.outbox.push({op:operation,state:'pending',journalId:journalEntry.id});next.local={...clone(record.local),entities:Object.fromEntries(Object.entries(after).map(([k,v])=>[k,{...record.local.entities[k],...v}]))};if(operation.type==='identify'){const item=next.local.entities[operation.payload.entity]?.data?.inv?.find(i=>i.uid===operation.payload.uid);if(item)item.unid=true}await persist(next,old.generation);
      status('Saved locally');install(record.local);void flush();
    }catch(e){if(stamp!==epoch)return;record=old;install(old.local);status('Needs attention',e.message);toast('Local save failed: '+e.message)}finally{committing=false;renderWanted=false}}
  function deferRender(){if(creationStaging&&!applying){renderWanted=true;return true}if(!enabled||!record||applying)return false;if(staging||committing){renderWanted=true;return true}
    // Unsupported writes cannot silently mutate a shared save through render().
    if(changes(record.local.entities,runtime()).length){queueMicrotask(()=>{install(record.local);status('Needs attention','This action is not yet supported in a shared save.');toast('This action was not saved. Use a supported action or a local copy.');});return true}return false}
  async function transfer(payload){if(!record)return false;if(/^(character:|pending:)/.test(state.adventureId)){toast('Open an adventure to share items with its party.');return true}if(!state.authenticated||!navigator.onLine){toast('Connect to the server before transferring a shared item.');return true}if(committing||staging||record.outbox.length){toast('Wait for your pending changes to sync before transferring an item.');return true}
    committing=true;try{const next=clone(record),op={protocolVersion:1,operationId:uuid(),deviceId,type:'transfer',payload,expectedVersions:{[payload.from]:record.local.entities[payload.from]?.version,[payload.to]:record.local.entities[payload.to]?.version},dependsOn:[]};next.outbox.push({op,state:'pending'});await persist(next);status('Saved locally');void flush()}catch(e){status('Needs attention',e.message);toast('Local save failed. No item was transferred.')}finally{committing=false}return true}
  function schedule(){clearTimeout(retryTimer);const delay=Math.min(30000,700*2**Math.min(retries++,6))*(.7+Math.random()*.6);retryTimer=setTimeout(()=>{void flushImports();void flush()},delay)}
  async function refreshAccount(){if(!enabled)return null;try{const data=await request('/api/me');await setAccount(data.user||null);return data}catch(e){if(e.status===401){state.authenticated=false;if(record)status('Needs attention','Sign in again to synchronize this device.');else{state.user=null;status('Local only');return {user:null,characters:[],adventures:[]}}}throw e}}
  async function setAccount(user){if(user?.id!==state.user?.id){epoch++;scrubView();if(record){stream?.close();stream=null;record=null;state.adventureId=null;restoreLegacy()}}state.user=user;state.authenticated=!!user;if(!user)importJobs=[];remember();if(!record)status(user?'Synced':'Local only');else notify();return user}
  // While an adventure opens, its saved record is rewritten after the fetch: other writers wait (hexmap.js asks isOpening).
  let opening=0;
  async function openContext(id){opening++;try{return await openContextNow(id)}finally{opening--}}
  async function openContextNow(id){
    if(!state.user?.id)throw new Error('Sign in before opening a cloud save.');
    if(committing||staging||pumping||creationStaging)throw new Error('Wait for the local save to finish.');
    const stamp=++epoch,accountId=state.user.id;if(state.adventureId!==id)scrubView();if(!record){legacy.party=clone(PARTY);legacy.villages=clone(VILLAGES);legacy.pool=clone(S.pool);legacy.journal=clone(JOURNAL);legacy.custom=clone(CUSTOM);legacy.session=clone({dt:S.dt,rtravel:S.rtravel,combat:S.combat,phase:S.phase||'',here:S.here||'',xp:S.xp||null,journey:S.journey})}stream?.close();stream=null;
    const key=accountId+':'+id,stored=await CloudStore.read(key);if(stamp!==epoch)return null;
    if(stored&&stored.protocolVersion!==1)throw new Error('This local queue needs a compatible version of CROW NEST. Export it before upgrading.');
    state.adventureId=id;record=stored;if(stored)install(stored.local);remember();if(id.startsWith('pending:')){if(!stored)throw new Error('The pending character is unavailable on this device.');status('Saved locally');void flushImports();return stored.local}
    try{
      const snapshot=normalize(await request(contextPath(id)));if(stamp!==epoch)return null;
      if(stored){const next=clone(stored);next.confirmed=snapshot;next.local=replay(snapshot,next.outbox);await persist(next,stored.generation)}
      else await persist({key,protocolVersion:1,confirmed:snapshot,local:clone(snapshot),outbox:[],journal:[]},0);
      if(stamp!==epoch)return null;install(record.local);status(record.outbox.some(x=>x.state==='conflict')?'Needs attention':record.outbox.length?'Saved locally':'Synced');startEvents();void flush();return record.local;
    }catch(e){if(stamp!==epoch)return null;if(stored&&!e.status&&e.code!=='context_changed'){status('Saved locally','Offline. Changes stay on this device until it reconnects.');return stored.local}state.adventureId=null;record=null;remember();restoreLegacy();throw e}
  }
  async function refreshSnapshot(){if(state.adventureId?.startsWith('pending:')||!record||staging||committing||fetching||pumping)return;fetching=true;const stamp=epoch;try{const result=await request(contextPath(state.adventureId)+(state.adventureId.startsWith('character:')?'':'/events?after='+encodeURIComponent(record.confirmed.adventure.revision)));const snapshot=normalize(result.snapshot||result);if(stamp!==epoch||!record)return;if(snapshot.adventure?.revision===record.confirmed.adventure?.revision){record.confirmed.presence=snapshot.presence;record.confirmed.session=snapshot.session;record.local.presence=snapshot.presence;record.local.session=snapshot.session;notify();return;}const next=clone(record);next.confirmed=snapshot;next.local=replay(snapshot,next.outbox);await persist(next);install(record.local);status(next.outbox.some(x=>x.state==='conflict')?'Needs attention':next.outbox.length?'Saved locally':'Synced')}catch(e){if(stamp!==epoch)return;if(e.status===401){state.authenticated=false;status('Needs attention','Sign in again to synchronize.')}else if(e.status===403||e.status===404){stream?.close();status('Needs attention','Access to this save was revoked. The pending queue is preserved.');}}finally{fetching=false}}
  async function heartbeat(){if(!record||!state.authenticated||document.hidden||/^(character:|pending:)/.test(state.adventureId))return;const id=state.adventureId;try{await post('/api/adventures/'+encodeURIComponent(id)+'/presence',{})}catch{}}
  function startEvents(){if(!record||!state.authenticated)return;void heartbeat();stream?.close();stream=null;if(typeof EventSource!=='undefined'&&!/^(character:|pending:)/.test(state.adventureId)){stream=new EventSource(contextPath(state.adventureId)+'/stream');stream.onmessage=()=>void refreshSnapshot();stream.addEventListener('revision',()=>void refreshSnapshot());stream.onerror=()=>void refreshSnapshot()}}
  async function flush(){if(state.adventureId?.startsWith('pending:')){if(!importing)void flushImports();return}if(!enabled||!record||!record.outbox.length||pumping||staging||!state.user||!navigator.onLine)return;if(!state.authenticated){status('Needs attention','Sign in again to send saved changes.');return}pumping=true;const currentEpoch=epoch;
    try{const account=await request('/api/me');if(currentEpoch!==epoch)return;if(account.user?.id!==state.user.id){await setAccount(account.user||null);status('Needs attention','The signed-in account changed. Its earlier queue is preserved separately.');return}while(record?.outbox.length){const queued=record.outbox[0];if(queued.state==='conflict'){status('Needs attention',queued.code||'Review the change that conflicts with the server.');break}status('Syncing');let response;
        try{response=await post(contextPath(state.adventureId)+'/operations',queued.op)}catch(e){if(e.status===409&&e.body?.snapshot)response={...e.body,status:'conflict'};else throw e}
        if(currentEpoch!==epoch||!record)return;const next=clone(record);if(response.status==='conflict'){next.outbox[0].state='conflict';next.outbox[0].code=response.code||'conflict'}else {next.outbox.shift();next.accepted=[...(next.accepted||[]),queued.op.operationId].slice(-160);if(queued.op.type==='undo'){const original=(next.journal||[]).find(e=>e.cloudOperationId===queued.op.payload.operationId);if(original)original.undone=Date.now();next.journal??=[];next.journal.push({id:'cloud:'+queued.op.operationId,cloudOperationId:queued.op.operationId,t:Date.now(),who:ME?.id||'ref',kind:original?.kind==='undo'?'redo':'undo',label:(original?.kind==='undo'?'Redid: ':'Undid: ')+(original?.label||'game change')})}}
        if(response.snapshot)next.confirmed=normalize(response.snapshot);else next.confirmed=normalize(await request(contextPath(state.adventureId)));next.local=replay(next.confirmed,next.outbox);await persist(next);install(record.local);if(response.identification){const r=response.identification;toast(r.identified?(r.item?.name?('Identified: '+r.item.name):'Item identified.'):(r.tier===1?'The item goes off harmfully. Ask the Ref to resolve the effect.':'You learn nothing from this study.'))}retries=0;if(response.status==='conflict'){status('Needs attention',response.code||'The server changed this value. Review your queued change.');break}}
      if(record&&!record.outbox.length)status('Synced');
    }catch(e){if(currentEpoch!==epoch||!record)return;if(e.code==='tab_changed'){const fresh=await CloudStore.read(record.key);if(fresh){record=fresh;install(fresh.local)}schedule()}else if(e.status===401){state.authenticated=false;status('Needs attention','Your sign-in expired. Pending changes remain saved on this device.')}else if(e.status===403||e.status===404){status('Needs attention','Access was revoked. Pending changes remain saved on this device.')}else if(e.status&&e.status<500&&e.status!==429&&e.status!==425){const next=clone(record);if(next.outbox[0]){next.outbox[0].state='conflict';next.outbox[0].code=e.code||e.message;try{await persist(next)}catch{}}status('Needs attention',e.message)}else{status('Saved locally','Waiting for the server.');schedule()}}finally{pumping=false}}
  async function closeAdventure(){if(staging||committing||creationStaging)throw new Error('Wait for the local save to finish.');epoch++;scrubView();stream?.close();stream=null;record=null;state.adventureId=null;state.snapshot=null;remember();restoreLegacy();status('Synced')}
  async function discardConflict(operationId){
    const job=importJobs.find(x=>x.operationId===operationId);if(job&&state.user){const key=state.user.id+':imports',saved=await CloudStore.read(key);const next=await CloudStore.write({...saved,jobs:saved.jobs.filter(x=>x.operationId!==operationId)},saved.generation);importJobs=next.jobs;status(importJobs.length?'Saved locally':'Synced');return}
    if(!record||pumping||committing)return;const next=clone(record),index=next.outbox.findIndex(x=>x.op.operationId===operationId);if(index<0)return;next.outbox.splice(index);next.local=replay(next.confirmed,next.outbox);await persist(next);install(next.local);status(next.outbox.length?'Saved locally':'Synced');void flush()}
  async function identify(payload){
    if(!record)return;if(staging)await settle();if(!state.authenticated||!navigator.onLine){toast('Reconnect to identify an item. Its hidden details stay on the server.');return}
    if(committing||record.outbox.length){toast('Wait for pending changes to sync first.');return}committing=true;
    try{const next=clone(record),op={protocolVersion:1,operationId:uuid(),deviceId,type:'identify',payload,expectedVersions:{[payload.entity]:record.local.entities[payload.entity]?.version},dependsOn:[]};next.outbox.push({op,state:'pending'});await persist(next);status('Saved locally');void flush()}catch(e){status('Needs attention',e.message)}finally{committing=false}
  }
  async function undoOperations(ids){if(!record)return;if(staging)await settle();if(committing||record.outbox.length){toast('Synchronize or resolve pending changes before undoing.');return}committing=true;try{const next=clone(record);for(const id of ids){if(!(next.accepted||[]).includes(id))throw new Error('This change has not been confirmed by the server.');const op={protocolVersion:1,operationId:uuid(),deviceId,type:'undo',payload:{operationId:id},dependsOn:next.outbox.length?[next.outbox.at(-1).op.operationId]:[]};next.outbox.push({op,state:'pending'})}await persist(next);status('Saved locally');void flush()}catch(e){status('Needs attention',e.message)}finally{committing=false}}
  async function queueCharacter(character,options={}){
    if(!state.user)throw new Error('Sign in first.');const accountId=state.user.id,key=accountId+':imports',old=await CloudStore.read(key),job={operationId:uuid(),character:clone(character),sourceId:options.sourceId||character.id,kind:options.import?'import':'create'};
    const used=new Set([...(character.inv||[]),...(character.pets||[]).flatMap(p=>p.inv||[]),...(character.hires||[]).flatMap(p=>p.inv||[])].map(i=>i.id));job.custom=[...used].filter(id=>!originalIds.has(id)&&IT[id]&&IT[id].cat!=='unidentified').map(id=>clone(IT[id]));
    const next={...(old||{}),key,jobs:[...(old?.jobs||[]),job]};if(options.import&&!next.backup){const rawCtk={};for(const k of Object.keys(localStorage))if(k.startsWith('ctk-'))rawCtk[k]=localStorage.getItem(k);next.backup={createdAt:new Date().toISOString(),legacy:clone(legacy),rawCtk}}await CloudStore.write(next,old?.generation||0);
    if(state.user?.id===accountId){importJobs=next.jobs;status('Saved locally')}return job;
  }
  async function lifecycle(route,body){
    if(!state.user)throw new Error('Sign in first.');const accountId=state.user.id,key=accountId+':imports',saved=await CloudStore.read(key),operationId=uuid(),job={operationId,kind:'lifecycle',route,body:{...body,operationId}};
    const next={...(saved||{}),key,jobs:[...(saved?.jobs||[]),job]};await CloudStore.write(next,saved?.generation||0);if(state.user?.id===accountId){importJobs=next.jobs;status('Saved locally')}return flushImports(operationId);
  }
  async function createCharacter(character,options={}){const job=await queueCharacter(character,options);return flushImports(job.operationId)}
  async function openPending(job){
    const id='pending:'+job.operationId,key=state.user.id+':'+id,stored=await CloudStore.read(key);
    if(!stored){const snapshot=normalize({protocolVersion:1,adventure:{id,name:job.character.name,revision:1},role:'owner',entities:{['crow:'+job.character.id]:{version:1,data:job.character}},participants:[],itemDefinitions:Object.fromEntries((job.custom||[]).map(it=>[it.id,it]))});await CloudStore.write({key,protocolVersion:1,confirmed:snapshot,local:clone(snapshot),outbox:[],journal:[]},0)}
    return openContext(id);
  }
  async function migratePending(job,serverId){
    if(!serverId)return;const pendingKey=state.user.id+':pending:'+job.operationId,saved=record?.key===pendingKey?record:await CloudStore.read(pendingKey);if(!saved)return;
    const stamp=epoch,accountId=state.user.id,snapshot=normalize(await request('/api/characters/'+encodeURIComponent(serverId)));if(stamp!==epoch||state.user.id!==accountId)return;
    if(staging)await settle();while(committing)await new Promise(resolve=>setTimeout(resolve,10));if(stamp!==epoch)return;committing=true;
    try{const source=record?.key===pendingKey?record:saved,key=accountId+':character:'+serverId,existing=await CloudStore.read(key),next=clone(source);next.key=key;next.confirmed=snapshot;next.local=replay(snapshot,next.outbox);const updated=await CloudStore.write(next,existing?.generation||0);
      if(stamp!==epoch)return;if(record?.key===pendingKey){epoch++;record=updated;state.adventureId='character:'+serverId;remember();install(updated.local);status(updated.outbox.length?'Saved locally':'Synced');void flush()}
    }finally{committing=false}
  }
  async function flushImports(wanted){
    if(!state.user||!state.authenticated||importing)return {pending:!!importJobs.length};importing=true;
    const accountId=state.user.id,stamp=epoch,key=accountId+':imports';let r,result;
    try{
      r=await CloudStore.read(key);if(!r?.jobs?.length){importJobs=[];notify();return}importJobs=r.jobs;notify();
      let authenticated;try{authenticated=await request('/api/me')}catch(e){if(stamp===epoch){importJobs=r.jobs;status(e.status?'Needs attention':'Saved locally',e.status?'Sign in again to upload your saved character.':'Character saved locally. Reconnect to upload it.');if(!e.status||e.status>=500||e.status===429)schedule()}return {pending:true}}
      if(stamp!==epoch||authenticated.user?.id!==accountId)return {pending:true};
      while(r?.jobs?.length){if(state.user?.id!==accountId)return {pending:true};const job=r.jobs[0];if(job.state==='conflict'){status('Needs attention',job.code);return {pending:true,operationId:job.operationId}}
        try{
          const response=await post(job.route||('/api/characters'+(job.kind==='import'?'/import':'')),job.body||job);if(state.user?.id!==accountId)return {pending:true};
          if(job.kind!=='lifecycle')await migratePending(job,response.character?.id||response.id||response.characterId);if(state.user?.id!==accountId)return {pending:true};
          if(job.operationId===wanted)result=response;r=await CloudStore.write({...r,jobs:r.jobs.slice(1)},r.generation);importJobs=r.jobs;notify();
        }catch(e){if(state.user?.id!==accountId)return {pending:true};status(e.status?'Needs attention':'Saved locally',e.status?e.message:'Saved locally. Waiting for the server.');if(!e.status||e.status>=500||e.status===429||e.status===425)schedule();else if(e.status!==401){r=await CloudStore.write({...r,jobs:r.jobs.map((x,index)=>index?x:{...x,state:'conflict',code:e.code||e.message})},r.generation);importJobs=r.jobs;notify()}return {pending:true,operationId:job.operationId}}
      }
      status(record?.outbox.some(x=>x.state==='conflict')?'Needs attention':record?.outbox.length?'Saved locally':'Synced');return result;
    }finally{importing=false}
  }
  async function logout(){state.authenticated=false;stream?.close();stream=null;await closeAdventure();state.user=null;remember();notify()}
  const Cloud=root.Cloud={state,enabled,isApplying:()=>applying,isCommitting:()=>committing,isOpening:()=>opening>0,peekConfirmed:key=>record?.confirmed?.entities?.[key]?.data??null,hasConflict:()=>!!record?.outbox.some(x=>x.state==='conflict'),ownCrows:()=>(record?.local?.participants||[]).filter(p=>p.accountId===state.user?.id&&typeof p.entityKey==='string'&&p.entityKey.startsWith('crow:')).map(p=>p.entityKey.slice(5)),request,refreshAccount,refreshAuth:refreshAccount,setAccount,openAdventure:openContext,openCharacter:id=>openContext('character:'+id),closeAdventure,createCharacter,importCharacter:(c,o={})=>createCharacter(c,{...o,import:true}),legacyCharacters:()=>clone(legacy.party),flush,retry:async()=>{await refreshAccount();await flushImports();return flush()},runMutation,deferRender,transfer,identify,discardConflict,undo:operationId=>undoOperations([operationId]),logout,operations:()=>clone([...(record?.outbox||[]),...importJobs.map(job=>({op:{operationId:job.operationId,type:job.kind==='lifecycle'?job.route:'character.'+job.kind,payload:job},state:job.state||'pending',code:job.code}))]),getState:()=>state,isBusy:()=>!!(staging||committing||pumping||fetching||creationStaging||importing),isSavingCreation:()=>creationStaging,describeConflict:code=>explanations[code]||code,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},isActive:()=>!!record,createAdventure:name=>lifecycle('/api/adventures',{name}),startSession:id=>lifecycle('/api/adventures/'+id+'/sessions',{}),joinSession:(code,characterId)=>lifecycle('/api/sessions/join',{code,characterId}),endSession:()=>lifecycle(contextPath(state.adventureId)+'/sessions/end',{}),exportQueue:async()=>CloudStore.list((state.user?.id||'')+':'),exportLegacyBackup:async()=>state.user?(await CloudStore.read(state.user.id+':imports'))?.backup:null};
  Object.defineProperties(Cloud,{user:{get:()=>state.user},active:{get:()=>state.snapshot},status:{get:()=>state.status}});
  if(!enabled){Cloud.ready=Promise.resolve();return}
  // Every synchronous interaction is staged before the application's handlers.
  for(const type of ['click','change','submit','pointerup','keydown','input'])document.addEventListener(type,event=>{
    if(applying||event.target.closest?.('[data-cloud-ui]'))return;if(creationStaging){event.preventDefault();event.stopImmediatePropagation();return}if(!record)return;
    if(committing){event.preventDefault();event.stopImmediatePropagation();toast('Please wait for the local save.');return}
    if(begin())setTimeout(settle,0);
  },true);
  for(const [name,fn] of Object.entries(A))A[name]=function(...args){return runMutation(()=>fn.apply(this,args))};
  const oldNew=A['new-crow'];A['new-crow']=async b=>{if(record){if(staging)await settle();await closeAdventure()}return oldNew(b)};
  const oldSaveBuild=saveBuild;saveBuild=function(){
    if(!state.user||S.b?.edit)return oldSaveBuild();
    const stamp=epoch,before={party:clone(PARTY),me:ME?.id,b:clone(S.b),area:S.area,tab:clone(S.tab)},ids=new Set(PARTY.map(c=>c.id));
    creationStaging=true;oldSaveBuild();const created=PARTY.find(c=>!ids.has(c.id));
    if(!created){creationStaging=false;render();return}
    status('Saving locally');
    void queueCharacter(created).then(job=>{
      if(stamp!==epoch){creationStaging=false;return}legacy.party.push(clone(created));creationStaging=false;saveCrows();render();
      return openPending(job).then(()=>flushImports(job.operationId)).then(result=>{if(result?.pending){toast('Character saved locally. Reconnect to upload it.');return}const id=result?.character?.id||result?.id||result?.characterId;return id?Cloud.openCharacter(id):null});
    }).catch(error=>{
      if(stamp!==epoch){creationStaging=false;return}if(creationStaging){PARTY.splice(0,PARTY.length,...before.party.map(reviveCrow));ME=PARTY.find(c=>c.id===before.me)||PARTY[0]||null;S.b=before.b;S.area=before.area;S.tab=before.tab;creationStaging=false;render()}
      status('Needs attention',error.message);toast('Character was not sent: '+error.message);
    });
  };
  const oldToPool=toPool;toPool=function(i,count){if(record){setTimeout(()=>transfer({from:'crow:'+ME.id,to:'pool',uid:i.uid,count}));return}return oldToPool(i,count)};
  const oldFinish=finishPlace;finishPlace=function(sec,idx){if(record&&S.placing?.pool){const p=S.placing;setTimeout(()=>transfer({from:'pool',to:'crow:'+ME.id,uid:p.pool,count:p.count,sec,idx}));S.placing=null;return}return oldFinish(sec,idx)};
  const oldTake=A.take;A.take=b=>{if(record){const p=S.pool.find(x=>x.uid===+b.dataset.uid);if(!p)return;askQty('Take '+nm(p),p.count,q=>{const pos=firstFit(p.id);if(!pos)return toast('No free slot.');void transfer({from:'pool',to:'crow:'+ME.id,uid:p.uid,count:q,...pos})});return}return oldTake(b)};
  const oldStudy=A['id-study'];A['id-study']=b=>{
    if(!record)return oldStudy(b);const item=findInst(b.dataset.uid);if(!item||!held(item))return toast('Hold it first: move it to a hand, or a magic slot if wearable.');if(item.tried)return toast('You can only study an item once.');
    const entity='crow:'+ME.id,uid=item.uid;askNum('Study: first physical d10',0,10,first=>{if(first<1||first>10)return toast('Enter the die result from 1 to 10.');askNum('Study: second physical d10',0,10,second=>{if(second<1||second>10)return toast('Enter the die result from 1 to 10.');void identify({entity,uid,method:'study',roll:[first,second]})})});
  };
  const oldUse=A['id-use'];A['id-use']=b=>{if(!record)return oldUse(b);const item=findInst(b.dataset.uid);if(!item||!held(item))return toast('Hold it first: move it to a hand, or a magic slot if wearable.');const entity='crow:'+ME.id,uid=item.uid;askYes('Use the unidentified item?','The Ref describes the effect. A consumable is used up.','Use it',()=>void identify({entity,uid,method:'use'}))};
  const oldUndo=undoEntry;undoEntry=function(e){if(record){if(!e?.cloudOperationId)return toast('This local history entry has no confirmed server operation.');void undoOperations([e.cloudOperationId]);return}return oldUndo(e)};
  const oldRewind=rewindTo;rewindTo=function(e){if(record){const entries=JOURNAL.filter(x=>x.t>=e.t&&!x.undone&&x.cloudOperationId);askYes('Undo these shared changes?',`The server will check each of ${entries.length} changes. If another player changed the same value, it will stop with a conflict.`,'Undo changes',()=>void undoOperations(entries.reverse().map(x=>x.cloudOperationId)));return}return oldRewind(e)};
  channel&&(channel.onmessage=async event=>{if(!record||event.data.key!==record.key||event.data.generation===record.generation||staging||committing||pumping)return;const fresh=await CloudStore.read(record.key);if(fresh){record=fresh;install(fresh.local);status(fresh.outbox.some(x=>x.state==='conflict')?'Needs attention':fresh.outbox.length?'Saved locally':'Synced')}});
  addEventListener('online',()=>{void refreshAccount().then(()=>{startEvents();void flushImports();void flush()}).catch(()=>{})});
  setInterval(()=>{void refreshSnapshot();if(record?.outbox.length)void flush()},4000);setInterval(()=>void heartbeat(),20000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void heartbeat()});
  Cloud.ready=(async()=>{await CloudStore.open();let remembered;try{remembered=JSON.parse(localStorage.getItem('ctk-cloud-context')||'null')}catch{}
    if(remembered?.accountId&&remembered.context){state.user=remembered.user;state.adventureId=remembered.context;record=await CloudStore.read(remembered.accountId+':'+remembered.context);if(record)install(record.local);importJobs=(await CloudStore.read(remembered.accountId+':imports'))?.jobs||[]}
    try{await refreshAccount();if(state.user){await flushImports();if(state.adventureId)await openContext(state.adventureId)}}catch(e){if(!e.status&&record)status('Saved locally','Offline. Your saved queue will resume when you reconnect.');else if(e.status!==401)status('Needs attention',e.message)}notify();
  })().catch(e=>{status('Needs attention','Browser storage is unavailable: '+e.message);toast('Cloud saves need working browser storage. No changes were sent.')});
})(window);
