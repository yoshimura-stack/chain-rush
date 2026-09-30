// Shared physical definitions are used by rendering, collision and BOT guidance.
export const LENGTH=1800,MIDPOINT=900;
export const LEVELS={normal:{start:11.5,end:16.5,pumps:42,notice:3.5},hard:{start:14,end:20,pumps:58,notice:2.8}};
export const CHAPTERS=[{at:0,name:'天空の回廊',en:'SKYBOUND CAUSEWAY'},{at:300,name:'双瀑の峡谷',en:'VALLEY OF WATERFALLS'},{at:600,name:'翡翠の大河',en:'THE EMERALD RIVER'},{at:900,name:'古王の隧道',en:'THE ANCIENT TUNNEL'},{at:1250,name:'嵐の山稜',en:'STORMRIDGE'},{at:1580,name:'王都への凱旋',en:'THE ROYAL APPROACH'}];
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const slotOffset=(slot,count,spacing=4.22)=>(slot-(Math.max(1,count)-1)/2)*spacing;
export function poseMatches(e,pose,distance,elapsed,recovery=false){
 const side=pose?.side||0,jumpY=pose?.jumpY||0,duck=pose?.duck||0;
 if(e.bridge)return Math.abs(side-bridgeOffset(e,distance))<.68;
 if(e.type==='movingLog'){const y=logHeight(e,elapsed),bodyHeight=4.05-1.60*duck;return jumpY>y+.62||jumpY+bodyHeight<y-.62}
 if(e.need==='jump')return jumpY>(recovery?.82:e.height+.08);
 if(e.need==='duck')return duck>.90&&jumpY<.18;
 if(e.need==='left')return side< -1.20;if(e.need==='right')return side>1.20;return false
}
export class RunnerMotion{
 constructor(){this.reset()}
 reset(){this.flight=-1;this.jumpY=0;this.jumpVelocity=0;this.jumpCut=false;this.jumpBuffer=0;this.duck=0;this.side=0;this.sideVelocity=0;this.landing=0;this.controls={left:false,right:false,duck:false,dash:false,jump:false};this.energy=1;this.dashExhausted=false;}
 get dashing(){return this.controls.dash&&!this.controls.duck&&this.duck<.1&&!this.dashExhausted&&this.energy>0}
 hold(name,value){if(name in this.controls)this.controls[name]=value}
 release(){for(const k in this.controls)this.controls[k]=false;this.jumpBuffer=0}
 jump(){if(this.flight>=0){this.jumpBuffer=.12;return false}this.flight=0;this.jumpVelocity=12.5;this.jumpCut=false;this.jumpBuffer=0;return true}
 step(dt,enabled=true){dt=clamp(dt,0,.05);for(let remain=dt;remain>1e-8;){const h=Math.min(remain,1/120);this.integrate(h,enabled);remain-=h}}
 integrate(dt,enabled){this.landing*=Math.exp(-15*dt);if(!enabled){this.release();this.sideVelocity*=Math.exp(-12*dt);this.duck+=(0-this.duck)*(1-Math.exp(-16*dt));return}
  if(this.dashing){this.energy=Math.max(0,this.energy-dt/3);if(this.energy<1e-8){this.energy=0;this.dashExhausted=true}}else{this.energy=Math.min(1,this.energy+dt/5);if(!this.controls.dash&&this.energy>=.25)this.dashExhausted=false}
  this.duck+=(Number(this.controls.duck)-this.duck)*(1-Math.exp(-16*dt));
  const input=Number(this.controls.right)-Number(this.controls.left),target=input*(this.controls.duck?2.6:4.6),response=this.flight>=0?9:input?13:18;
  this.sideVelocity+=(target-this.sideVelocity)*(1-Math.exp(-response*dt));this.side=clamp(this.side+this.sideVelocity*dt,-1.65,1.65);if(Math.abs(this.side)>=1.65&&Math.sign(this.sideVelocity)===Math.sign(this.side))this.sideVelocity=0;
  this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);
  if(this.flight>=0){this.flight+=dt;if(!this.controls.jump&&!this.jumpCut&&this.jumpVelocity>0){this.jumpVelocity*=.78;this.jumpCut=true}const gravity=this.controls.jump&&this.flight<.25&&this.jumpVelocity>0?12:36;this.jumpVelocity-=gravity*dt;this.jumpY+=this.jumpVelocity*dt;if(this.jumpY<=0){this.landing=Math.min(1,Math.abs(this.jumpVelocity)/14);this.flight=-1;this.jumpY=0;this.jumpVelocity=0;if(this.jumpBuffer>0)this.jump()}}
 }
 snapshot(){return {side:this.side,jumpY:this.jumpY,duck:this.duck,sideVelocity:this.sideVelocity,landing:this.landing,dashing:this.dashing,energy:this.energy}}
}

export function bridgeRange(e){return {a:e.at-(e.type==='bridgeCurve'?15:6),b:e.at+(e.type==='bridgeCurve'?19:10)}}
export function bridgeOffset(e,distance){if(e.type!=='bridgeCurve')return e.need==='left'?-1.38:1.38;const {a,b}=bridgeRange(e),u=clamp((distance-a)/(b-a),0,1);return Math.sin(u*Math.PI*2)*1.18*(e.id%2?-1:1)}
export function logHeight(e,time){const cycle=Math.sin(time*Math.PI*2/5.8+e.phase);return 2.65+1.45*clamp(cycle*1.65,-1,1)}
export function createCourse(){const rows=[[65,'jumpLow'],[125,'duck'],[185,'left'],[242,'right'],[285,'bridgeLeft'],[347,'movingLog'],[399,'jump'],[448,'bridgeCurve'],[504,'left'],[549,'movingLog'],[602,'right'],[653,'bridgeCurve'],[710,'jumpLow'],[754,'duck'],[798,'right'],[844,'jumpHigh'],[962,'movingLog'],[1008,'left'],[1052,'jump'],[1092,'movingLog'],[1135,'right'],[1180,'bridgeCurve'],[1268,'left'],[1310,'rock'],[1353,'bridgeLeft'],[1405,'movingLog'],[1442,'right'],[1480,'rock'],[1528,'bridgeCurve'],[1600,'jumpHigh'],[1636,'duck'],[1672,'left'],[1709,'right'],[1748,'jump']];return rows.map(([at,type],id)=>({at,type,id,status:'pending',bridge:type.startsWith('bridge'),need:type.startsWith('jump')||type==='rock'?'jump':type==='bridgeCurve'?'steer':type==='bridgeLeft'?'left':type==='bridgeRight'?'right':type==='movingLog'?'timing':type,depth:type==='jumpLow'?1:2.3,halfDepth:type==='jumpLow'?.85:1.6,height:type==='jumpLow'?.85:type==='jumpHigh'?2.85:type==='rock'?2.6:2.3,phase:id*.73}))}
export class Game{
 constructor(level='normal',options={}){this.level=level;this.networkMode=!!options.networkMode;this.reset()}
 reset(){this.config=LEVELS[this.level]||LEVELS.normal;this.state='ready';this.distance=0;this.elapsed=0;this.flight=-1;this.jumpY=0;this.jumpVelocity=0;this.jumpCut=false;this.jumpBuffer=0;this.duck=0;this.side=0;this.sideVelocity=0;this.landing=0;this.controls={left:false,right:false,duck:false,dash:false,jump:false};this.course=createCourse();this.missionDone=false;this.fill=0;this.strokes=0;this.failures=0;this.combo=0;this.bestCombo=0;this.cleared=0;this.fallTimer=0;this.recovery=0;this.burstTimer=0;this.countdown=0;this.paused=false;this.lastEvent=null;this.feedback='';this.feedbackTime=0;this.pulse=0;this.pumpAge=1;this.energy=1;this.dashExhausted=false;this.stuckPlayerId=null;}
 get dashing(){return this.state==='run'&&this.controls.dash&&!this.controls.duck&&this.duck<.1&&!this.dashExhausted&&this.energy>0}
 get speed(){const base=this.config.start+(this.config.end-this.config.start)*this.distance/LENGTH;return this.networkMode?base:base*(1-.45*this.duck)*(this.dashing?1.45:1)}
 get chapter(){let n=0;CHAPTERS.forEach((c,i)=>{if(this.distance>=c.at)n=i});return n}
 start(){if(this.state==='ready'){this.state='countdown';this.countdown=3}}
 hold(name,value){if(name in this.controls)this.controls[name]=value}
 release(){for(const k in this.controls)this.controls[k]=false;this.jumpBuffer=0}
 jump(){if(this.paused||!['run','stuck'].includes(this.state))return false;if(this.flight>=0){this.jumpBuffer=.12;return false}this.flight=0;this.jumpVelocity=12.5;this.jumpCut=false;this.jumpBuffer=0;return true}
 pump(){if(this.state!=='mission'||this.paused)return false;this.strokes++;this.fill=Math.min(1,this.fill+1/this.config.pumps);this.pumpAge=0;if(this.fill>=1-1e-8){this.fill=1;this.state='burst';this.burstTimer=2.4;this.missionDone=true}return true}
 togglePause(){if(['ready','finished'].includes(this.state))return;this.paused=!this.paused;this.release();this.sideVelocity=0}
 upcoming(){return this.course.find(e=>e.status==='pending'&&(e.bridge?bridgeRange(e).b:e.at+2)>=this.distance)||null}
 notify(text){this.feedback=text;this.feedbackTime=1.35}
 matches(e,recovery=false){return poseMatches(e,{side:this.side,jumpY:this.jumpY,duck:this.duck},this.distance,this.elapsed,recovery)}
 fail(e){this.lastEvent=e;this.failures++;this.combo=0;this.release();this.sideVelocity=0;this.jumpBuffer=0;if(e.bridge){this.state='fall';this.fallTimer=1.2;this.notify('足場から落下 — 橋の手前へ')}else{this.state='stuck';this.recovery=0;this.notify('YOU STUCK!')}}
 networkFail(e,playerId){if(!e||e.status!=='pending'||!['run'].includes(this.state))return false;this.lastEvent=e;this.stuckPlayerId=playerId||null;this.failures++;this.combo=0;if(e.bridge){this.state='fall';this.fallTimer=1.2;this.notify('TEAM FALL — 橋の手前へ')}else{this.state='stuck';this.recovery=0;this.notify('TEAM STUCK!')}return true}
 networkRecover(){if(this.state!=='stuck'||!this.lastEvent)return false;this.lastEvent.status='rescued';this.stuckPlayerId=null;this.recovery=0;this.state='run';this.notify('RECONNECTED — GO!');return true}
 networkClear(e){if(e?.status==='pending')this.clear(e)}
 step(dt){dt=clamp(dt,0,.05);if(this.paused||['ready','finished'].includes(this.state))return;for(let remain=dt;remain>1e-8;){const h=Math.min(remain,1/120);this.integrate(h);remain-=h;if(this.state==='finished')break}}
 integrate(dt){this.feedbackTime=Math.max(0,this.feedbackTime-dt);this.pumpAge+=dt;this.pulse=this.pumpAge<.30?Math.sin(Math.PI*this.pumpAge/.30):0;this.landing*=Math.exp(-15*dt);
  if(this.state==='countdown'){this.countdown-=dt;if(this.countdown<=0)this.state='run';return}this.elapsed+=dt;
  if(this.dashing){this.energy=Math.max(0,this.energy-dt/3);if(this.energy<1e-8){this.energy=0;this.dashExhausted=true}}else if(this.state==='run'){this.energy=Math.min(1,this.energy+dt/5);if(!this.controls.dash&&this.energy>=.25)this.dashExhausted=false}
  if(this.state==='mission'){if(this.level==='hard')this.fill=Math.max(0,this.fill-dt*.0025);return}
  if(this.state==='burst'){this.burstTimer-=dt;if(this.burstTimer<=0){this.state='run';this.release();this.notify('MISSION CLEAR!')}return}
  if(this.state==='fall'){this.fallTimer-=dt;if(this.fallTimer<=0){this.distance=Math.max(0,bridgeRange(this.lastEvent).a-18);this.flight=-1;this.jumpY=0;this.jumpVelocity=0;this.duck=0;this.side=0;this.sideVelocity=0;this.state='countdown';this.countdown=1.6;this.stuckPlayerId=null;this.release()}return}
  if(!['run','stuck'].includes(this.state))return;
  this.duck+=(Number(this.controls.duck)-this.duck)*(1-Math.exp(-16*dt));
  const input=Number(this.controls.right)-Number(this.controls.left),target=input*(this.controls.duck?2.6:4.6),response=this.flight>=0?9:input?13:18;
  this.sideVelocity+=(target-this.sideVelocity)*(1-Math.exp(-response*dt));this.side=clamp(this.side+this.sideVelocity*dt,-1.65,1.65);if(Math.abs(this.side)>=1.65&&Math.sign(this.sideVelocity)===Math.sign(this.side))this.sideVelocity=0;
  this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);
  if(this.flight>=0){this.flight+=dt;if(!this.controls.jump&&!this.jumpCut&&this.jumpVelocity>0){this.jumpVelocity*=.78;this.jumpCut=true}const gravity=this.controls.jump&&this.flight<.25&&this.jumpVelocity>0?12:36;this.jumpVelocity-=gravity*dt;this.jumpY+=this.jumpVelocity*dt;if(this.jumpY<=0){this.landing=Math.min(1,Math.abs(this.jumpVelocity)/14);this.flight=-1;this.jumpY=0;this.jumpVelocity=0;if(this.jumpBuffer>0)this.jump()}}
  if(this.state==='stuck'){if(this.networkMode)return;if(this.matches(this.lastEvent,true)){this.recovery+=dt;if(this.recovery>.09){this.lastEvent.status='rescued';this.state='run';this.notify('RECONNECTED — GO!')}}else this.recovery=0;return}
  const nextDistance=this.distance+this.speed*dt;
  if(!this.missionDone&&this.distance<MIDPOINT&&nextDistance>=MIDPOINT){this.distance=MIDPOINT;this.state='mission';this.flight=-1;this.jumpY=0;this.jumpVelocity=0;this.duck=0;this.side=0;this.sideVelocity=0;this.release();this.notify('BALLOON PUMP');return}
  this.distance=Math.min(LENGTH,nextDistance);
  if(!this.networkMode){for(const e of this.course){if(e.status!=='pending')continue;if(e.bridge){const {a,b}=bridgeRange(e);if(this.distance>=a&&this.distance<=b&&!this.matches(e)&&this.jumpY<.6){this.fail(e);return}if(this.distance>b)this.clear(e)}else{const rel=this.distance-e.at;if(rel>=-e.halfDepth&&rel<=e.halfDepth&&!this.matches(e)){this.fail(e);return}if(rel>e.halfDepth)this.clear(e)}}}
  if(this.distance>=LENGTH){this.state='finished';this.release()}
 }
 clear(e){e.status='cleared';this.cleared++;this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);this.notify(this.combo>1?this.combo+' CHAIN!':'CLEAR!')}
}
