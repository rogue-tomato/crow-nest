'use strict';
/* CROW NEST — Journey rules shared by the browser and the server (server/rules.mjs runs this file in a vm, as it does
   game-rules.js). Pure: no DOM, no app globals, no Math.random — dice come in as functions or numbers, so the Ref's
   device can roll a procedure and a player can type a physical die into the same code.
   Sources: CROWS Playtest 3 Rules — Travel Pace, Travel Roles, Lost, Back on Track, Rest, Rest Encounters, Miasma;
   The Ref — Travel Encounters, Bad Weather. Anything the rules leave open is marked as an app default.
   docs/journey.md describes the flow these pieces serve. */
(function(root){
  /* ---------- the travel day ---------- */
  const PACE={slow:{hex:1,en:2,mod:'edge',label:'Slow'},normal:{hex:2,en:4,mod:'',label:'Normal'},fast:{hex:3,en:6,mod:'bane',label:'Fast'}};
  // What each role result or route fact the Ref ticks does to the day. h hexes, en travel EN, ren rest EN, chk and rchk
  // extra travel and rest checks, lost, found ('start' or 'end' of the day), ruin (a shelter), loot (rolled into the pool).
  // The order is the order of the Ref's Travel day screen; the loot list follows it.
  const FX={normal:{h:1},secret1:{lost:1},secret2:{en:-1,h:-1},secret3:{en:-2},short1:{lost:1},short2:{h:1,en:1},short3:{h:2},
    back1:{},back2:{found:'end'},back3:{found:'start'},
    danger:{en:-1},places:{},shelter1:{rchk:1},shelter2:{ren:-1,en:1},shelter3:{ruin:1},treasure1:{chk:1},treasure2:{chk:1,loot:'treasure'},treasure3:{loot:'treasure'},
    forage:{loot:'forage'},hunt1:{chk:1},hunt2:{en:1,loot:'hunt2'},hunt3:{loot:'hunt3'},track1:{chk:1},track2:{},track3:{},
    road:{h:1},river:{h:-1},down:{h:1},dungeon:{en:1},
    // rest and weather facts the Journey ticks: Seclude Camp rest EN −1; Bad Weather slows the group (The Ref: Bad Weather)
    seclude:{ren:-1},rain:{h:-1},blizzard:{h:-2},sandstorm:{h:-2},thunderstorm:{h:-2}};
  const GUIDE_KEYS=['normal','secret1','secret2','secret3','short1','short2','short3'],BACK_KEYS=['back1','back2','back3'],ROUTE_KEYS=['road','river','down','dungeon'];
  // Travel roles and their tasks (Rules: Travel Roles). safe: nothing to roll; ch: the characteristics the test may use;
  // targets: allies the task names. Assist is not a role: anyone without one can help a risky test.
  const ROLES={
    guide:{limit:1,tasks:{normal:{safe:1},secret:{ch:['A','M']},short:{ch:['A','M']},back:{ch:['M'],lost:1}}},
    scout:{limit:1,tasks:{danger:{safe:1},places:{safe:1,second:1},shelter:{ch:['A','M']},treasure:{ch:['M','S']}}},
    tracker:{tasks:{forage:{safe:1},hunt:{ch:['A','S']},track:{ch:['A','M']}}},
    supporter:{tasks:{fight:{safe:1,targets:1},everyone:{ch:['M','S'],targets:3}}},
    assist:{targets:1,tasks:{}}};
  const TASK_NAMES={normal:'Normal Route',secret:'Secret Path',short:'Shortcut',back:'Back on Track',danger:'Scout for Danger',places:'Scout for Places',
    shelter:'Scout for Shelter',treasure:'Treasure Hunt',forage:'Forage',hunt:'Hunt',track:'Track Specific Creature',fight:'Fight the Miasma',everyone:'Support Everyone'};
  const TASKS=Object.keys(TASK_NAMES);
  const roleOf=task=>Object.keys(ROLES).find(r=>ROLES[r].tasks[task]);
  // The Ref's tick for a task result: safe tasks have one, a risky task one per tier; supporter tasks change no numbers.
  function fxKey(task,tier){const role=roleOf(task);if(!role||role==='supporter')return null;const t=ROLES[role].tasks[task];
    if(t.safe)return task;return tier>=1&&tier<=3?task+tier:null}
  // Speed (Rules: Travel Pace): the slowest member sets it; 3 or less −1 hex, 7–9 +1, 10 or more +2. No party: 5.
  const speedShift=slow=>slow<=3?-1:slow>=10?2:slow>=7?1:0;
  /** The day's numbers from the session's travel state (S.rtravel) and the slowest member's speed. */
  function dayTotals(rt,slowest){const p=PACE[rt.pace]||PACE.normal,on=Object.keys(FX).filter(k=>rt.mods&&rt.mods[k]).map(k=>FX[k]),sum=k=>on.reduce((a,x)=>a+(x[k]||0),0);
    const slow=slowest==null?5:slowest,sp=speedShift(slow);
    return {p,slow,sp,hexes:Math.max(0,p.hex+sum('h')+sp),en:Math.max(1,p.en+sum('en')),ren:Math.max(1,p.en+sum('ren')),chk:2+sum('chk'),rchk:1+sum('rchk'),
      lost:rt.lost&&!on.some(x=>x.found==='start')||on.some(x=>x.lost),foundEnd:on.some(x=>x.found==='end'),ruin:on.some(x=>x.ruin),loot:on.map(x=>x.loot).filter(Boolean)}}
  /** A tick on the Ref's Travel day: a guide or Back on Track result replaces the others (one guide). Returns new mods and camp. */
  function setMod(rt,key,on,{radio=false}={}){const mods={...rt.mods};let camp=rt.camp;
    if(radio){for(const g of [...GUIDE_KEYS,...BACK_KEYS])delete mods[g];mods[key]=true}else mods[key]=on;
    if(key==='shelter3'&&!on&&camp==='ruin')camp=null;return {mods,camp}}
  /** The Ref's ticks that follow from the crows' answers for the day: a safe task counts as done, a risky one by its tier.
      A guide's Back on Track counts only while lost, and any other guide task only while not (Rules: Travel Roles). */
  function modsFromInputs(list,{lost=false}={}){const mods={};for(const x of list){if(!x||!x.task||x.role!==roleOf(x.task))continue;
    if(x.role==='guide'&&(x.task==='back')!==!!lost)continue;const k=fxKey(x.task,x.doom?1:x.tier);if(k)mods[k]=true}return mods}
  /** The pace most votes ask for; null with no votes or a tie (the Ref decides). votes: ['slow', 'normal', …]. */
  function paceVote(votes){const n={};for(const v of votes)if(PACE[v])n[v]=(n[v]||0)+1;const top=Object.entries(n).sort((a,b)=>b[1]-a[1]);
    return top.length&&(top.length===1||top[0][1]>top[1][1])?top[0][0]:null}
  /** Who holds which slot: one guide; one scout, or two when one of them scouts for places. Returns the crow ids over the limit. */
  function slotConflicts(byId){const over=[],g=Object.entries(byId).filter(([,x])=>x&&x.role==='guide'),s=Object.entries(byId).filter(([,x])=>x&&x.role==='scout');
    if(g.length>1)over.push(...g.slice(1).map(([id])=>id));const sMax=s.some(([,x])=>x.task==='places')?2:1;if(s.length>sMax)over.push(...s.slice(sMax).map(([id])=>id));return over}
  const clearGuide=rt=>{const mods={...rt.mods};for(const g of [...GUIDE_KEYS,...BACK_KEYS])delete mods[g];return mods};
  // Which follow-up table the Ref opens for a Travel Encounters result. Wild Animal by terrain arrives with the map (slice 4).
  const TRAVEL_SUB={'Any Monster':'any-monster-encounter','Traveler':'traveler-encounters','Miasma-Touched':'miasma-touched-encounters','Wild Animal':'forest-animal-encounters'};
  /** n encounter checks at EN: a d10 at or under EN is an encounter, then Travel Encounters (d100).
      dice: {d10:()=>number, table:id=>({r,row})} — the Ref's procedure rolls them. */
  function encounterChecks(n,en,dice,sub=TRAVEL_SUB){return Array.from({length:n},()=>{const r=dice.d10();const c={r,hit:r<=en};
    if(c.hit){const x=dice.table('travel-encounters');c.roll=x.r;c.text=x.row[1];c.sub=sub[c.text]}return c})}
  /** The next day's travel state: pace stays, role results and checks go, Lost carries on unless the guide found the way. */
  const nextDay=(rt,T)=>({day:rt.day+1,pace:rt.pace,mods:{},checks:[],restChecks:[],lost:T.lost&&!T.foundEnd,camp:null});
  // Lost (Rules): a d6 for each hex the group leaves, counting from the northernmost neighbour clockwise. On a map with
  // pointy tops there is no hex due north; the app counts from the first one clockwise of north (north-east). App default.
  const bearing=ang=>((90-ang)%360+360)%360;
  /** Neighbours ({ang} in degrees, 90 = north, counter-clockwise as hexmap.js nbs gives them) in d6 order. */
  const lostOrder=ns=>[...ns].sort((a,b)=>bearing(a.ang)-bearing(b.ang));
  const DIRS=['north','northeast','southeast','south','southwest','northwest'];
  const ruinInhabited=d100=>d100<=10;

  /* ---------- the Miasma ---------- */
  const MI_NAMES={1:'Despondent',3:'Ravenous and greedy',5:'Destructive rage',7:'Secret jealousy',9:'Lazy',11:'Relish violence',13:'Lost to the Miasma'};
  // How long each pair of effects lasts (Rules: Miasma): ends when cruelty is gone, when out of the Miasma, once, or forever.
  const MI_DUR={1:'cruelty',3:'out',5:'once',7:'cruelty',9:'out',11:'cruelty',13:'perm'};
  /** The Miasma Effects table (d10 + Cruelty) as rows {lo,hi,t,up,n,dur}. */
  const miasmaRows=table=>table.rows.slice(1).map(r=>{const [lo,hi]=r[0].includes('+')?[+r[0].replace('+',''),99]:r[0].split('-').map(Number);return {lo,hi,t:r[1],up:r[2],n:MI_NAMES[lo]||r[0],dur:MI_DUR[lo]}});
  const snapOf=c=>({cruelty:c.cruelty,miasma:[...c.miasma]});
  /** Mind RR against the Miasma with tier 1: cruelty goes up by one, then d10 + cruelty picks the effect; a pair the crow
      already has is rolled again. d10: a function giving the die (the Ref's or a typed physical die). Returns the crow's
      new cruelty, effects and miLast (stored, so the player and the Ref see the same roll and cannot apply it twice). */
  function miasmaRoll(c,rows,d10,rest){const snap=snapOf(c),cr=c.cruelty+1;let r,hit,tries=0;
    do{r=d10();hit=rows.find(x=>r+cr>=x.lo&&r+cr<=x.hi);tries++}while(hit.lo<13&&c.miasma.some(x=>x.n===hit.n)&&tries<30);
    const fx={n:hit.n,t:hit.t,up:hit.up,dur:hit.dur},lost=hit.lo>=13;
    return {cruelty:lost?0:cr,miasma:lost?[fx]:[...c.miasma,fx],miLast:{rest,k:'fx',snap,r,cr,hit,rerolled:tries>1}}}
  /** One typed d10 for tier 1: the row, and whether it repeats a pair the crow has (then the player rolls again). */
  function miasmaHit(c,rows,r){const cr=c.cruelty+1,hit=rows.find(x=>r+cr>=x.lo&&r+cr<=x.hi);return {hit,cr,again:!!hit&&hit.lo<13&&c.miasma.some(x=>x.n===hit.n)}}
  /** Tier 3 on the Mind RR: cruelty to 0; effects that last until there is no cruelty end. */
  function miasmaClear(c,rows,rest){const snap=snapOf(c),durOf=x=>x.dur||(rows.find(r=>r.n===x.n)||{}).dur;
    return {cruelty:0,miasma:c.miasma.filter(x=>durOf(x)!=='cruelty'),miLast:{rest,k:'clear',snap}}}
  const miasmaDone=c=>!!c.miLast&&c.miLast.rest===(c.rests||0);
  /** The Mind RR modifier: Mind minus cruelty (Rules: Miasma); Fight the Miasma +1; Strong Miasma is a bane. */
  const mindRR=(c,{fight=false,strong=false}={})=>({mod:c.ch.M-c.cruelty+(fight?1:0),bane:!!strong});

  /* ---------- resting ---------- */
  // Rest by place (docs/journey.md, «Отдых по месту»). check: roll rest encounter checks; mind: humans make the Mind RR
  // (the place is in the Miasma); food: who feeds the crow. Villages are always clear of the Miasma (The Village); a ruin
  // found by Scout for Shelter tier 3 is outside it; a dungeon depends on the place (asked once); the beacon's radius is clear.
  const REST={outdoor:{check:true,mind:true,food:'own'},ruin:{check:true,mind:false,food:'own',inhabited:10},dungeon:{check:'dungeon',mind:null,food:'own'},
    home:{check:false,mind:false,food:'home'},village:{check:false,mind:false,food:'inn'},beacon:{check:true,mind:false,food:'own'}};
  /** What a rest at a place means. closed: a dungeon closed off from the Miasma. where: 'miasma' or 'clear' as crows store it. */
  function restAt(place,{closed=false}={}){const r=REST[place]||REST.outdoor,mind=r.mind==null?!closed:r.mind;
    return {place:REST[place]?place:'outdoor',check:r.check,mind,effort:!mind,food:r.food,inhabited:r.inhabited||0,where:mind?'miasma':'clear'}}
  /** Food for one rest (Rules: Rest): 1 ration, 2 if Ravenous. Home feeds for free; a night at the inn feeds one meal.
      ration: the player eats from their rations; have: rations on hand. eat: rations used. */
  function restFood({need,home=false,innFood=false,ration=false,have=0}){const inn=home?need:innFood?1:0,own=need-inn,ate=own<=0||(ration&&have>=own);
    if(ate)return {ate:true,own,eat:Math.max(0,own),kind:home?'home':inn?'inn':'own'};
    // Ravenous with only part of a meal: they ate (no starvation wound) but the rest gives nothing
    if(inn>0)return {ate:false,own,eat:0,kind:'short'};
    if(ration&&have>0)return {ate:false,own,eat:1,kind:'short'};
    return {ate:false,own,eat:0,kind:'none'}}
  /** What a completed rest (the crow ate) restores: full Stamina, one wound (two when Lazy, highest slot first), and outside
      the Miasma full Effort, cruelty 0 and the effects that last until then. Wound slots of starvation and exhaustion are
      cleared by the caller first. Returns the crow's new values and what changed, for the log. */
  function restBody(c,{where,lazy=false,stMax,effMax,rows}){let left=[...c.wounds];const removed=[];
    for(let k=0;k<(lazy?2:1);k++){const w=[...left].sort((a,b)=>b-a)[0];if(w!=null){left=left.filter(x=>x!==w);removed.push(w)}}
    const out={stamina:stMax,removed};
    if(where==='clear'){out.effort=effMax;if(c.cruelty||c.miasma.length){const durOf=x=>x.dur||(rows.find(r=>r.n===x.n)||{}).dur;
      out.cruelty=0;out.miasma=c.miasma.filter(x=>!['cruelty','out'].includes(durOf(x)));out.cleared=true}}
    return out}
  const RESTS=['lore','craft','identify','repair','harvest','sleep','tend','seclude','gamble'];

  /* ---------- places on the map ---------- */
  // Hexer terrain → the Wild Animal table and the climate for Bad Weather (docs/journey.md, adopted 2026-11-11).
  // assumed: the rules do not name the place; the Ref can change it for a type or a region in the map settings.
  const T=(animals,climate,assumed)=>({animals,climate,assumed:!!assumed});
  const TERRAIN={plains:T('grassland','temperate'),grassland:T('grassland','temperate'),meadow:T('grassland','temperate'),farmland:T('grassland','temperate'),
    valley:T('grassland','temperate',1),heath:T('grassland','temperate',1),savanna:T('grassland','tropical',1),steppe:T('grassland','temperate',1),
    forest:T('forest','temperate'),'dense-forest':T('forest','temperate'),jungle:T('forest','tropical',1),glade:T('forest','temperate'),
    swamp:T('marsh-swamp','temperate'),marsh:T('marsh-swamp','temperate'),bog:T('marsh-swamp','temperate'),
    hill:T('hill-mountain','temperate'),crag:T('hill-mountain','temperate'),mountain:T('hill-mountain','temperate'),'mountain-peak':T('hill-mountain','cold',1),volcano:T('hill-mountain','temperate',1),
    desert:T('desert','desert'),badlands:T('desert','desert',1),canyon:T('desert','desert',1),crater:T('hill-mountain','temperate',1),
    tundra:T('cold-climate','cold'),glacier:T('cold-climate','cold'),
    oasis:T('desert','desert',1),'mushroom-forest':T('forest','temperate',1),'crystal-cavern':T('hill-mountain','temperate',1),
    'frozen-lake':T('cold-climate','cold',1),rapids:T('coastal','temperate',1),coast:T('coastal','temperate'),fjord:T('coastal','cold',1),delta:T('marsh-swamp','temperate',1)};
  const WATER=['ocean','deep-ocean','sea','reef','lake','pond'];
  /** The place of a hex for encounters. overrides: {[type]:{animals,climate}} from the map settings; region: the same for a
      region the hex is in. Water has no place; hot-spring and unknown types are for the Ref to decide (null). */
  function placeOf(type,{overrides={},region=null}={}){if(WATER.includes(type))return {animals:null,climate:null,assumed:false,water:true,table:null};
    const parts=[TERRAIN[type],overrides[type],region].filter(Boolean),base=parts.length?Object.assign({},...parts):null;
    if(!base)return {animals:null,climate:null,assumed:true,water:false,table:null};
    return {animals:base.animals||null,climate:base.climate||null,assumed:!!base.assumed,water:false,table:base.animals?base.animals+'-animal-encounters':null}}
  const SEASONS=['spring','summer','fall','winter'];
  /** Bad Weather's pair (The Ref): a cold, desert or tropical climate has its own; a temperate one goes by the season. */
  function weatherGroup(climate,season){if(climate==='cold')return 'cold';if(climate==='desert')return 'desert';if(climate==='tropical')return 'tropical';
    if(climate!=='temperate')return null; // an unknown place: the Ref decides
    return season==='winter'?'cold':season==='summer'?'tropical':season==='fall'?'fall':season==='spring'?'spring':null}
  /** Bad Weather (The Ref): the climate's or season's pair from the book's table; any die, odd the first, even the second.
      rows: the table rows ['Climate or Season','Weather'], e.g. ['Fall','Rain or Thunderstorm']. */
  const WEATHER_ROW={cold:'Cold or Winter',desert:'Desert',fall:'Fall',spring:'Spring',tropical:'Tropical or Summer'};
  function weatherFor(rows,group,die){const row=(rows||[]).find(r=>r[0]===WEATHER_ROW[group]);if(!row)return null;const [a,b]=String(row[1]).split(' or ');return die%2?a:b}
  const WEATHER_FX={Rain:'rain',Blizzard:'blizzard',Sandstorm:'sandstorm',Thunderstorm:'thunderstorm'};
  // Banes on the tests of guides, scouts and trackers while the weather lasts (The Ref: Blizzard, Sandstorm, Thunderstorm)
  const WEATHER_BANES={Blizzard:2,Sandstorm:2,Thunderstorm:1};
  /** Edges and banes (Rules: Tests with Edges and Banes): two or more make a double; an edge and a bane cancel, and so do
      two doubles; a double and a single leave a single. One edge +2, one bane −2; a double moves the tier by one, not the dice. */
  function edgesBanes(edges,banes){const r=Math.min(edges,2)-Math.min(banes,2);return {mod:Math.abs(r)===1?2*r:0,shift:Math.abs(r)===2?Math.sign(r):0}}
  // Beacon (Characters: The Village): the village hex and hexes within its level are clear of the Miasma; Burn Bright
  // (beacon 5 and Prosperity 10) reaches 6.
  const beaconRadius=(level,burnBright=false)=>level>0?(burnBright&&level>=5?6:Math.min(5,level)):0;

  /* ---------- shared state: the journey entity and the players' input ---------- */
  const STEPS=['off','plan','roles','script','road','camp','night','dawn'];
  const STOP_KINDS=['enc','rest','village','poi','night'],STOP_STATES=['pending','shown','fight','done','removed'];
  const EFFECTS=['weather','strong'];
  const HEX=/^-?\d{1,4},-?\d{1,4}$/;
  const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v),isStr=v=>typeof v==='string';
  // text the database accepts: no NUL, no lone surrogate (PostgreSQL refuses both in JSON)
  const BAD_TEXT=/\u0000|[\ud800-\udbff](?![\udc00-\udfff])|(?:^|[^\ud800-\udbff])[\udc00-\udfff]/;
  const text=(v,n)=>isStr(v)&&v.length<=n&&!BAD_TEXT.test(v);
  const int=(v,lo,hi)=>Number.isSafeInteger(v)&&v>=lo&&v<=hi;
  const hexes=(v,n)=>Array.isArray(v)&&v.length<=n&&v.every(k=>isStr(k)&&HEX.test(k));
  const opt=(v,f)=>v===undefined||f(v);
  const oneOf=list=>v=>list.includes(v);
  // What a player enters for the day (on their own crow, field trip). route/at: the route proposal (slice 1); day: the
  // travel day the other answers belong to (older ones do not count); '' or 0 means not answered.
  const TRIP={route:v=>hexes(v,60),at:v=>typeof v==='number'&&Number.isFinite(v)&&v>=0,day:v=>int(v,1,1e6),
    pace:oneOf(['','slow','normal','fast']),role:oneOf(['',...Object.keys(ROLES),'none']),task:oneOf(['',...TASKS]),what:v=>text(v,200),
    targets:v=>Array.isArray(v)&&v.length<=3&&v.every(x=>text(x,200)),tier:v=>int(v,0,3),doom:v=>typeof v==='boolean',effort:v=>typeof v==='boolean',
    nights:v=>hexes(v,60),stay:oneOf(['','rest','go']),explore:oneOf(['','yes','no']),
    act:oneOf(['',...RESTS]),pick:v=>text(v,200),food:oneOf(['','own','inn','home','none']),
    mind:v=>int(v,0,3),d10:v=>int(v,0,10),help:v=>text(v,200),
    // Mind RR tier 3 (Rules: Miasma): lift: the ally whose result this crow raises a tier; lifted: this crow's result was raised
    lift:v=>text(v,200),lifted:v=>typeof v==='boolean',
    // wx: today's weather tests, "Rain:2;Heat Wave:3" (the player rolls, taps the tier)
    wx:v=>text(v,200),
    // ride: how the crow travels — '' on foot, 'p:<pet uid>' on a mount, 'v:<uid>,<uid>' in a vehicle those pets pull (Rules: Changing Pace)
    ride:v=>text(v,200),
    // hires: their hirelings' travel roles, {<hireling uid>: {role, task, tier}} (Rules: Travel Procedure — each PC and hireling)
    hires:v=>isObj(v)&&Object.keys(v).length<=10&&Object.entries(v).every(([k,x])=>text(k,40)&&isObj(x)&&opt(x.role,oneOf(['',...Object.keys(ROLES),'none']))&&opt(x.task,oneOf(['',...TASKS]))&&opt(x.tier,t=>int(t,0,3))&&opt(x.ride,r=>text(r,200))),
    // n: how many answers the player has given today; the Ref's entry records the n it was made over
    n:v=>int(v,0,1e9)};
  const TRIP_KEYS=Object.keys(TRIP);
  function validateTrip(t){if(t===null)return [];if(!isObj(t))return ['Invalid trip'];
    const bad=TRIP_KEYS.filter(k=>!opt(t[k],TRIP[k]));return bad.length?['Invalid trip: '+bad.join(', ')]:[]}
  /** The trip as the table sees it: the fields above only, so a stray key never reaches anyone. */
  function projectTrip(t){if(t===null)return null;if(!isObj(t))return null;const out={};for(const k of TRIP_KEYS)if(t[k]!==undefined&&TRIP[k](t[k]))out[k]=Array.isArray(t[k])?[...t[k]]:k==='hires'?Object.fromEntries(Object.entries(t[k]).map(([u,x])=>[u,pick(x,['role','task','tier','ride'])])):t[k];return out}
  /** A crow's answers for a travel day: its own trip if it belongs to that day, with the Ref's entries on top. */
  /** A crow's answers for a travel day: its own trip if it belongs to that day. The Ref's entry for the crow wins while
      the player has not answered again since (the entry's n is the player's answer count it was made over); after that
      the player's own answers win and the Ref's entry only fills what they left open. No device clocks are compared. */
  function inputsFor(trip,ref,day){const own={};if(isObj(trip)&&trip.day===day)for(const k of TRIP_KEYS)if(k!=='route'&&k!=='at'&&trip[k]!==undefined)own[k]=trip[k];
    if(!(isObj(ref)&&ref.day===day))return own;const seen=(ref.n||0)===(own.n||0);return seen?{...own,...ref,n:own.n||0}:{...ref,...own}}

  // day: the travel day the journey is on, as the Ref's device last set it (players have no session travel state).
  const defaultJourney=()=>({v:1,step:'off',day:1,season:null,from:'',plan:null,inputs:{},script:null,camp:null,effects:[]});
  const PLAN={route:v=>hexes(v,60),pace:oneOf(Object.keys(PACE)),by:v=>text(v,200),nights:v=>hexes(v,60),locked:v=>typeof v==='boolean'};
  const STOP={id:v=>text(v,40),i:v=>int(v,0,199),k:v=>isStr(v)&&HEX.test(v),kind:oneOf(STOP_KINDS),state:oneOf(STOP_STATES),check:v=>int(v,0,100),text:v=>text(v,1000),table:v=>text(v,100),
    // a merchant's or travelers' scene once the Ref rolls it (journey.js): what players need to trade or to see who they meet
    scene:v=>validScene(v)};
  // a scene has a known shape: numbers are numbers, names are short text (players' screens print them)
  const counts=o=>isObj(o)&&Object.keys(o).length<=20&&Object.entries(o).every(([k,n])=>text(k,200)&&int(n,1,100));
  // what players see of a scene: the caravan to trade with and how many guard it; how many travelers, what they want in a word,
  // and the reward — not the Ref's prompt text, stat blocks or Power
  const sceneFor=v=>v.kind==='merchant'?{...pick(v,['kind','inst','name','lvl','pct','inst2','name2','lvl2']),gn:Object.values(isObj(v.guards)?v.guards:{}).reduce((a,n)=>a+(+n||0),0)}
    :v.kind==='traveler'?{kind:'traveler',n:v.n,title:String(v.react||'').split(':')[0],...(v.reward!==undefined?{reward:v.reward}:{})}:{};
  function validScene(v){if(!isObj(v)||JSON.stringify(v).length>4000)return false;
    if(v.kind==='merchant')return text(v.inst,40)&&text(v.name,200)&&text(v.npc,200)&&int(v.lvl,1,6)&&int(v.pct,0,100)&&counts(v.guards)
      &&opt(v.inst2,x=>text(x,40))&&opt(v.name2,x=>text(x,200))&&opt(v.lvl2,x=>int(x,1,6));
    if(v.kind==='traveler')return int(v.n,1,10)&&counts(v.who)&&text(v.react,1000)&&opt(v.reward,r=>text(r,500));
    return false}
  // base: each crow's rest count when the camp began, so everyone can see who has finished their rest
  const CAMP={place:oneOf(Object.keys(REST)),k:v=>v===null||isStr(v)&&HEX.test(v),poi:v=>text(v,200),closed:v=>v===null||typeof v==='boolean',restart:v=>int(v,0,100),ready:v=>typeof v==='boolean',
    base:v=>isObj(v)&&Object.keys(v).length<=100&&Object.entries(v).every(([id,n])=>text(id,200)&&int(n,0,1e6))};
  const fieldsOk=(o,spec,required=[])=>isObj(o)&&required.every(k=>o[k]!==undefined)&&Object.keys(spec).every(k=>opt(o[k],spec[k]));
  /** The journey entity (Ref-only writes): the step of the day and what the Ref's device keeps for it. The day's numbers
      stay in the session's travel state (S.rtravel); this holds the flow around them. Returns a list of problems. */
  function validateJourney(j){const f=[];if(!isObj(j))return ['Invalid journey'];
    if(j.v!==1||!STEPS.includes(j.step)||!opt(j.day,v=>int(v,1,1e6)))f.push('Invalid journey step');
    if(!opt(j.season,v=>v===null||SEASONS.includes(v))||!opt(j.from,v=>v===null||text(v,200)))f.push('Invalid journey season or start');
    if(!opt(j.plan,v=>v===null||fieldsOk(v,PLAN,['route','pace'])))f.push('Invalid journey plan');
    if(!opt(j.inputs,v=>v===null||isObj(v)&&Object.keys(v).length<=100&&Object.entries(v).every(([id,x])=>text(id,200)&&isObj(x)&&!validateTrip(x).length)))f.push('Invalid journey entries');
    if(!opt(j.script,v=>v===null||isObj(v)&&hexes(v.path,200)&&int(v.at,0,200)&&v.at<=Math.max(0,v.path.length-1)&&opt(v.lost,x=>typeof x==='boolean')
      &&Array.isArray(v.stops)&&v.stops.length<=100&&v.stops.every(s=>fieldsOk(s,STOP,['id','kind','state'])&&(s.i===undefined||s.i<v.path.length))))f.push('Invalid journey script');
    if(!opt(j.camp,v=>v===null||fieldsOk(v,CAMP,['place'])))f.push('Invalid journey camp');
    if(!opt(j.effects,v=>v===null||Array.isArray(v)&&v.length<=20&&v.every(e=>isObj(e)&&EFFECTS.includes(e.kind)&&text(e.name,100)&&int(e.until,1,1e6)&&opt(e.hours,h=>int(h,0,100))&&opt(e.carried,x=>typeof x==='boolean'))))f.push('Invalid journey effects');
    // fight: crows still holding a Fight the Miasma +1 from an earlier day (it lasts until their next Mind RR)
    if(!opt(j.fight,v=>v===null||Array.isArray(v)&&v.length<=100&&v.every(id=>text(id,200))))f.push('Invalid journey Fight the Miasma');
    return f}
  const pick=(o,keys)=>{const out={};for(const k of keys)if(o[k]!==undefined)out[k]=Array.isArray(o[k])?[...o[k]]:o[k];return out};
  /** What players see of the journey. The day's script stays with the Ref until a stop is shown: no rolls, no tables,
      no hits waiting on the road; on the road a stop at the party's place shows only as "the road stops" (rest-check hits
      not even that). While the party is lost, neither its real path nor its camp hex. */
  function projectJourney(j){if(!isObj(j))return defaultJourney();const lost=!!(j.script&&j.script.lost),out=pick(j,['v','step','day','season','from']);
    out.plan=isObj(j.plan)?pick(j.plan,Object.keys(PLAN)):null;
    out.inputs={};if(isObj(j.inputs))for(const [id,x] of Object.entries(j.inputs))if(isObj(x))out.inputs[id]=projectTrip(x);
    if(isObj(j.script)){const s=j.script,at=int(s.at,0,200)?s.at:0,here=Array.isArray(s.path)?s.path[at]:undefined,stops=Array.isArray(s.stops)?s.stops:[];
      out.script={at,lost,path:lost||!Array.isArray(s.path)?[]:s.path.slice(0,at+1),
        stops:stops.filter(x=>isObj(x)&&(['shown','fight','done'].includes(x.state)||x.state==='pending'&&j.step==='road'&&x.kind!=='rest'&&(x.i!==undefined?x.i===at:here!==undefined&&x.k===here))).map(x=>x.state==='pending'?{id:x.id,kind:x.kind,state:'pending'}:({...pick(x,lost?['id','i','kind','state','text']:['id','i','k','kind','state','text']),...(isObj(x.scene)?{scene:sceneFor(x.scene)}:{})}))}}
    else out.script=null;
    // the camp's hex and place name only with a script that is not lost: they would show where a lost party really is
    out.camp=isObj(j.camp)?pick(j.camp,!lost&&isObj(j.script)?['place','k','poi','closed','restart','base','ready']:['place','closed','restart','base','ready']):null;
    out.effects=Array.isArray(j.effects)?j.effects.filter(isObj).map(e=>pick(e,['kind','name','until','hours'])):[];
    if(Array.isArray(j.fight))out.fight=j.fight.filter(x=>typeof x==='string');
    return out}

  root.JourneyRules={PACE,FX,GUIDE_KEYS,BACK_KEYS,ROUTE_KEYS,ROLES,TASKS,TASK_NAMES,roleOf,fxKey,speedShift,dayTotals,setMod,clearGuide,TRAVEL_SUB,
    modsFromInputs,paceVote,slotConflicts,encounterChecks,nextDay,lostOrder,DIRS,ruinInhabited,MI_NAMES,MI_DUR,miasmaRows,miasmaRoll,miasmaHit,miasmaClear,miasmaDone,mindRR,
    REST,restAt,restFood,restBody,RESTS,TERRAIN,placeOf,SEASONS,weatherGroup,weatherFor,WEATHER_FX,WEATHER_BANES,edgesBanes,beaconRadius,
    STEPS,STOP_KINDS,STOP_STATES,TRIP_KEYS,validateTrip,projectTrip,inputsFor,defaultJourney,validateJourney,projectJourney};
})(globalThis);
