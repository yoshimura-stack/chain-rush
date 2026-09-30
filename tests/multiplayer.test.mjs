import assert from "node:assert/strict";
import {RunnerMotion,slotOffset,createCourse,poseMatches} from "../source/engine.js";

assert.deepEqual([0,1,2].map(i=>slotOffset(i,3,4.22).toFixed(2)),["-4.22","0.00","4.22"]);
assert.equal(slotOffset(0,7,4.22).toFixed(2),"-12.66");
assert.equal(slotOffset(6,7,4.22).toFixed(2),"12.66");

const r=new RunnerMotion();
r.hold("right",true); for(let i=0;i<60;i++)r.step(1/60,true); assert(r.side>1.2);
r.release(); for(let i=0;i<60;i++)r.step(1/60,true); assert(Math.abs(r.sideVelocity)<0.05);
r.jump(); r.hold("jump",true); for(let i=0;i<12;i++)r.step(1/60,true); assert(r.jumpY>0.5);

const course=createCourse();
const left=course.find(e=>e.need==="left"); assert(poseMatches(left,{side:-1.4,jumpY:0,duck:0},left.at,0)); assert(!poseMatches(left,{side:0,jumpY:0,duck:0},left.at,0));
const jump=course.find(e=>e.type==="jumpLow"); assert(poseMatches(jump,{side:0,jumpY:1.2,duck:0},jump.at,0));
console.log("multiplayer foundation tests passed");
