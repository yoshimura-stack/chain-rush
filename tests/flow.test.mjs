import assert from 'node:assert/strict';
import {Game,bridgeOffset,bridgeRange,logHeight,createCourse} from '../source/engine.js';
const advance=(g,seconds,dt=1/120)=>{for(let t=0;t<seconds-1e-8;t+=dt)g.step(Math.min(dt,seconds-t))};
const free=()=>{const g=new Game();g.state='run';g.missionDone=true;g.course.forEach(e=>e.status='cleared');return g};
const checks=[];
for(const dt of [1/30,1/60,1/144]){const g=free();g.hold('right',true);advance(g,.17,dt);assert.ok(g.side>.35&&g.side<.6);g.release();advance(g,.8,dt);const stopped=g.side;advance(g,.5,dt);assert.ok(stopped>.5&&Math.abs(g.side-stopped)<.001,'No automatic recentering');g.hold('left',true);advance(g,2,dt);assert.equal(g.side,-1.65);checks.push({fps:Math.round(1/dt),stoppedAt:stopped})}
function apex(held){const g=free();g.hold('jump',true);g.jump();let max=0;for(let t=0;t<1.5;t+=1/120){if(t>=held)g.hold('jump',false);g.step(1/120);max=Math.max(max,g.jumpY)}return max}
const low=apex(0),medium=apex(.12),high=apex(.6);assert.ok(low>1&&low<1.5);assert.ok(medium>low+.5);assert.ok(high>3.7&&high<4.5);checks.push({jumpApex:{low,medium,high}});
for(const [type,hold,approach,success] of [['jumpLow',false,3,true],['jumpHigh',false,5.5,false],['jumpHigh',true,5.5,true]]){const g=free(),e={...createCourse().find(e=>e.type===type),at:20,status:'pending'};g.course=[e];g.distance=20-approach;g.hold('jump',hold);g.jump();advance(g,.9);assert.equal(e.status==='cleared',success,type+' physical crossing');}
{const g=free();g.hold('jump',true);g.jump();advance(g,.1);assert.equal(g.jump(),false);const before=[g.distance,g.jumpY,g.elapsed];g.togglePause();advance(g,1);assert.deepEqual([g.distance,g.jumpY,g.elapsed],before);g.togglePause();advance(g,1);assert.equal(g.jumpY,0)}
{const g=free();g.hold('duck',true);advance(g,1);const base=g.config.start+(g.config.end-g.config.start)*g.distance/1800;assert.ok(Math.abs(g.speed/base-.55)<.001);g.hold('dash',true);assert.equal(g.dashing,false);g.hold('duck',false);advance(g,.3);assert.ok(g.dashing);advance(g,3.5);assert.ok(g.dashExhausted);g.release();advance(g,5);assert.equal(g.energy,1);assert.equal(g.dashExhausted,false)}
{const e=createCourse().find(e=>e.type==='bridgeCurve'),{a,b}=bridgeRange(e);assert.ok(Math.abs(bridgeOffset(e,a))<1e-8);assert.ok(Math.abs(bridgeOffset(e,a+(b-a)*.25))>1);assert.ok(Math.abs(bridgeOffset(e,a+(b-a)*.75))>1);const g=free();g.course=[{...e}];g.distance=a+5;g.side=bridgeOffset(e,g.distance);assert.ok(g.matches(e));g.side=-1.65*Math.sign(g.side);g.step(.01);assert.equal(g.state,'fall');advance(g,1.3);assert.equal(g.state,'countdown');assert.equal(g.distance,a-18);checks.push({curveCollisionAndCheckpoint:true})}
{const e=createCourse().find(e=>e.type==='movingLog'),g=free();const lowTime=(Math.PI*1.5-e.phase+Math.PI*8)/(Math.PI*2/5.8),highTime=lowTime+2.9;g.elapsed=lowTime;assert.ok(logHeight(e,g.elapsed)<1.3);g.jumpY=2;assert.ok(g.matches(e));g.jumpY=0;assert.ok(!g.matches(e));g.elapsed=highTime;g.duck=1;assert.ok(g.matches(e));g.duck=0;assert.ok(!g.matches(e));checks.push({movingLogJumpAndDuck:true})}
// End-to-end controller uses real inputs; never teleports or clears an obstacle directly.
for(const level of ['normal','hard']){const g=new Game(level);g.start();let maxSteps=72000,missionCount=0;const missedTypes=[];
 for(let n=0;n<maxSteps&&g.state!=='finished';n++){
  const e=g.upcoming();g.hold('left',false);g.hold('right',false);g.hold('duck',false);g.hold('jump',g.flight>=0);
  if(g.state==='mission'){if(n%18===0)g.pump();missionCount++}
  else if(['run','stuck'].includes(g.state)&&e){const d=e.at-g.distance;let target=0;
   if(e.bridge){const range=bridgeRange(e);if(g.distance>range.a-17){target=bridgeOffset(e,g.distance+g.speed*.12)}}
   else if((e.need==='left'||e.need==='right')&&d<24)target=e.need==='left'?-1.5:1.5;
   const error=target-g.side-g.sideVelocity*.07;if(Math.abs(error)>.045)g.hold(error>0?'right':'left',true);
   if(e.need==='duck'&&d<17)g.hold('duck',true);
   if(e.need==='jump'&&d/g.speed<.38&&g.flight<0){g.hold('jump',true);g.jump()}
   if(e.type==='movingLog'&&d<23){const impact=g.elapsed+Math.max(0,d/g.speed);if(logHeight(e,impact)>3.3)g.hold('duck',true);else if(d/g.speed<.38&&g.flight<0){g.hold('jump',true);g.jump()}}
   if(g.state==='stuck'){const stuck=g.lastEvent;if(stuck.type==='movingLog'||stuck.need==='duck')g.hold('duck',true);else if(stuck.need==='jump'&&g.flight<0){g.hold('jump',true);g.jump()}else if(stuck.need==='left'||stuck.need==='right')g.hold(stuck.need,true)}
  }
  const failures=g.failures;g.step(1/120);if(g.failures>failures)missedTypes.push(g.lastEvent.type);
 }
 assert.equal(g.state,'finished',`${level}: ${g.state} ${g.distance} event ${g.lastEvent?.type}`);assert.ok(missionCount>0);assert.ok(!missedTypes.some(t=>t.startsWith('bridge')),'Input controller must traverse all bridges');assert.equal(g.cleared+g.course.filter(e=>e.status==='rescued').length,34);checks.push({level,finish:true,seconds:g.elapsed,misses:g.failures,missedTypes});g.reset();assert.equal(g.sideVelocity,0);assert.equal(g.jumpVelocity,0);assert.equal(g.state,'ready');
}
console.log(JSON.stringify({status:'PASS',checks},null,2));


