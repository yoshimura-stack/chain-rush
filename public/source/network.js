const now=()=>Date.now();
const cleanName=v=>(String(v||'PLAYER').trim().replace(/\s+/g,' ').slice(0,18)||'PLAYER');
const roomCode=v=>String(v||'').replace(/\D/g,'').slice(0,4);
const randomId=()=>crypto?.randomUUID?.()||('p-'+Math.random().toString(36).slice(2)+Date.now().toString(36));

export class ChainNetwork{
 constructor(options={}){
  this.maxPlayers=options.maxPlayers||7;
  this.clientId=randomId();
  this.joinedAt=now()+Math.random();
  this.name='PLAYER';this.ready=false;this.room='';this.mode='local';this.hostPriority=1;this.channel=null;this.client=null;this.bc=null;
  this.peers=new Map();this.listeners={roster:new Set(),event:new Set(),status:new Set()};this.heartbeat=null;this.presenceHeal=null;this.closed=false;
 }
 on(type,fn){this.listeners[type]?.add(fn);return()=>this.listeners[type]?.delete(fn)}
 emit(type,data){for(const fn of this.listeners[type]||[])try{fn(data)}catch(e){console.error(e)}}
 get config(){return window.CHAIN_CONFIG||{}}
 get configured(){const c=this.config;return /^https:\/\//.test(c.supabaseUrl||'')&&String(c.supabaseAnonKey||'').length>40&&window.supabase?.createClient}
 async join(room,name,options={}){await this.leave();if(window.CHAIN_SUPABASE_READY)try{await window.CHAIN_SUPABASE_READY}catch{}this.closed=false;this.joinedAt=now();this.hostPriority=options.hostCandidate?0:1;this.room=roomCode(room);this.name=cleanName(name);this.ready=false;if(this.room.length!==4)throw new Error('ROOM IDは4桁で入力してください。');
  if(this.config.forceLocal||!this.configured){this.mode='local';await this.joinLocal()}else{this.mode='supabase';await this.joinSupabase()}
  return this.mode;
 }
 async joinSupabase(){
  const c=this.config;this.client=window.supabase.createClient(c.supabaseUrl,c.supabaseAnonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},realtime:{params:{eventsPerSecond:40}}});
  this.channel=this.client.channel(`chain-rush:${this.room}`,{config:{broadcast:{self:true,ack:false},presence:{key:this.clientId}}});
  this.channel.on('presence',{event:'sync'},()=>this.syncSupabasePresence());
  this.channel.on('presence',{event:'join'},()=>this.syncSupabasePresence());
  this.channel.on('presence',{event:'leave'},()=>this.syncSupabasePresence());
  this.channel.on('broadcast',{event:'chain'},msg=>this.receiveEvent(msg.payload));
  await new Promise((resolve,reject)=>{let done=false;const t=setTimeout(()=>{if(!done)reject(new Error('Supabase接続がタイムアウトしました。'))},10000);this.channel.subscribe(async status=>{this.emit('status',{mode:'supabase',status});if(status==='SUBSCRIBED'&&!done){done=true;clearTimeout(t);await this.track();this.syncSupabasePresence();setTimeout(()=>this.syncSupabasePresence(),250);setTimeout(()=>this.syncSupabasePresence(),900);this.presenceHeal=setInterval(()=>this.syncSupabasePresence(),2000);resolve()}if(status==='CHANNEL_ERROR'&&!done){done=true;clearTimeout(t);reject(new Error('Supabase Realtimeへ接続できませんでした。'))}})});
 }
 async track(){if(!this.channel)return;await this.channel.track({playerId:this.clientId,name:this.name,joinedAt:this.joinedAt,hostPriority:this.hostPriority,ready:this.ready,version:'0.13.2'});}
 syncSupabasePresence(){if(!this.channel)return;const state=this.channel.presenceState();const list=[];for(const metas of Object.values(state))for(const m of metas||[])if(m?.playerId)list.push({playerId:m.playerId,name:cleanName(m.name),joinedAt:Number(m.joinedAt)||now(),hostPriority:Number.isFinite(Number(m.hostPriority))?Number(m.hostPriority):1,ready:!!m.ready});this.applyRoster(list)}
 async joinLocal(){
  this.bc=new BroadcastChannel(`chain-rush:${this.room}`);this.bc.onmessage=e=>this.receiveLocal(e.data);this.peers.clear();this.touchSelf();this.bc.postMessage({type:'hello',from:this.clientId,ts:now()});this.bc.postMessage({type:'presence',peer:this.selfMeta(),ts:now()});
  this.heartbeat=setInterval(()=>{this.touchSelf();this.bc?.postMessage({type:'presence',peer:this.selfMeta(),ts:now()});this.pruneLocal()},1200);
  setTimeout(()=>{this.touchSelf();this.emitLocalRoster()},80);this.emit('status',{mode:'local',status:'SUBSCRIBED'});
 }
 selfMeta(){return {playerId:this.clientId,name:this.name,joinedAt:this.joinedAt,hostPriority:this.hostPriority,ready:this.ready,lastSeen:now()}}
 touchSelf(){this.peers.set(this.clientId,this.selfMeta())}
 receiveLocal(msg){if(!msg||msg.from===this.clientId&&msg.type!=='event')return;if(msg.type==='hello'){this.bc?.postMessage({type:'presence',peer:this.selfMeta(),ts:now()});return}if(msg.type==='presence'&&msg.peer){this.peers.set(msg.peer.playerId,{...msg.peer,lastSeen:now()});this.emitLocalRoster();return}if(msg.type==='leave'){this.peers.delete(msg.from);this.emitLocalRoster();return}if(msg.type==='event')this.receiveEvent(msg.packet)}
 pruneLocal(){const cutoff=now()-4200;for(const [id,p] of this.peers)if(id!==this.clientId&&(p.lastSeen||0)<cutoff)this.peers.delete(id);this.emitLocalRoster()}
 emitLocalRoster(){this.applyRoster([...this.peers.values()])}
 applyRoster(list){
  const dedupe=new Map();for(const p of list){const prev=dedupe.get(p.playerId);if(!prev||Number(p.joinedAt)<Number(prev.joinedAt))dedupe.set(p.playerId,p)}
  const sorted=[...dedupe.values()].sort((a,b)=>((a.hostPriority??1)-(b.hostPriority??1))||(a.joinedAt-b.joinedAt)||a.playerId.localeCompare(b.playerId));
  const active=sorted.slice(0,this.maxPlayers).map((p,i)=>({...p,slot:i}));const hostId=active[0]?.playerId||null;const localSlot=active.findIndex(p=>p.playerId===this.clientId);
  this.emit('roster',{players:active,hostId,isHost:hostId===this.clientId,localSlot,roomFull:localSlot<0&&sorted.some(p=>p.playerId===this.clientId),totalSeen:sorted.length,mode:this.mode});
 }
 async setReady(value){this.ready=!!value;if(this.mode==='supabase')await this.track();else{this.touchSelf();this.bc?.postMessage({type:'presence',peer:this.selfMeta(),ts:now()});this.emitLocalRoster()}}
 async rename(name){this.name=cleanName(name);if(this.mode==='supabase')await this.track();else{this.touchSelf();this.bc?.postMessage({type:'presence',peer:this.selfMeta(),ts:now()});this.emitLocalRoster()}}
 send(kind,payload={}){if(!this.room)return;const packet={kind,payload,from:this.clientId,ts:now()};if(this.mode==='supabase')return this.channel?.send({type:'broadcast',event:'chain',payload:packet});this.bc?.postMessage({type:'event',packet,from:this.clientId});this.receiveEvent(packet)}
 receiveEvent(packet){if(!packet?.kind)return;this.emit('event',packet)}
 async leave(){
  if(this.heartbeat){clearInterval(this.heartbeat);this.heartbeat=null}if(this.presenceHeal){clearInterval(this.presenceHeal);this.presenceHeal=null}if(this.bc){try{this.bc.postMessage({type:'leave',from:this.clientId,ts:now()});this.bc.close()}catch{}this.bc=null}
  if(this.channel){try{await this.channel.untrack()}catch{}try{await this.client?.removeChannel(this.channel)}catch{}this.channel=null}this.client=null;this.peers.clear();this.room='';
 }
}

export const createRoomCode=()=>String(Math.floor(1000+Math.random()*9000));
