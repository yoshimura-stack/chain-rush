import * as T from './vendor/three.module.js';
import {Game,RunnerMotion,LENGTH,MIDPOINT,CHAPTERS,createCourse,bridgeRange,bridgeOffset,logHeight,slotOffset,poseMatches} from './engine.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {clone as cloneSkeleton} from './vendor/SkeletonUtils.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {ChainNetwork,createRoomCode} from './network.js';

// CHAIN RUSH V0.13 MULTIPLAYER: 1-7 humans, no bots, host-authoritative team flow.
const $=id=>document.getElementById(id),TAU=Math.PI*2;
let seed=52719;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const between=(a,b)=>a+(b-a)*rand();
const scene=new T.Scene();scene.fog=new T.FogExp2(0xb9d7df,.00115);
const world=new T.Group();scene.add(world);
const camera=new T.PerspectiveCamera(50,innerWidth/innerHeight,.15,2600);
const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance',alpha:false});
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();$('loadtext').textContent='3D描画が中断されました。ほかのタブを閉じて、このページを再読み込みしてください。';$('loading').classList.remove('ready')});
const hemi=new T.HemisphereLight(0xc8e5ff,0x716242,1.65);scene.add(hemi);
const sun=new T.DirectionalLight(0xffe3b0,3.65);sun.position.set(-48,70,28);sun.target.position.set(0,0,-30);scene.add(sun,sun.target);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-47,right:47,top:48,bottom:-45,near:1,far:190});sun.shadow.normalBias=.07;sun.shadow.bias=-.0001;
const rim=new T.DirectionalLight(0xc5eaff,1.38);rim.position.set(30,30,-70);scene.add(rim);
const uniforms={time:{value:0}};

// Continuous cloud field, sun disc and aerial sky. Clouds are part of the sky shader.
const sky=new T.Mesh(new T.SphereGeometry(1200,32,20),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{uTime:uniforms.time},vertexShader:`varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`
varying vec3 vDir;uniform float uTime;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float f=0.;float a=.55;for(int i=0;i<5;i++){f+=a*noise(p);p=p*2.04+13.1;a*=.5;}return f;}
void main(){vec3 d=normalize(vDir);float y=max(d.y,0.);vec3 col=mix(vec3(.78,.88,.9),vec3(.18,.46,.68),pow(y,.55));
vec2 uv=d.xz/max(d.y+.16,.08)*1.8+vec2(uTime*.003,0.);float n=fbm(uv);float c=smoothstep(.51,.76,n)*smoothstep(-.04,.19,d.y);col=mix(col,vec3(.98,.96,.89),c*.92);
float s=max(dot(d,normalize(vec3(-.6,.58,-.53))),0.);col+=vec3(1.,.72,.38)*pow(s,45.)*.33;col+=vec3(1.,.94,.72)*pow(s,850.)*.8;
gl_FragColor=vec4(col,1.);}` }));scene.add(sky);

function texture(size,paint){const c=document.createElement('canvas');c.width=c.height=size;paint(c.getContext('2d'),size);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t}
const stoneTex=texture(256,(c,n)=>{c.fillStyle='#b3a084';c.fillRect(0,0,n,n);for(let i=0;i<19000;i++){const v=between(65,220)|0;c.fillStyle=`rgba(${v},${v*.92|0},${v*.76|0},${between(.015,.14)})`;const s=between(.4,4);c.fillRect(rand()*n,rand()*n,s,s)}for(let i=0;i<35;i++){let x=rand()*n,y=rand()*n;c.beginPath();c.moveTo(x,y);for(let j=0;j<5;j++)c.lineTo(x+=between(-10,10),y+=between(1,8));c.strokeStyle='#514b4224';c.lineWidth=.6;c.stroke()}});
const fabricTex=texture(64,(c,n)=>{c.fillStyle='#ffffff';c.fillRect(0,0,n,n);c.strokeStyle='#858585';c.globalAlpha=.12;for(let i=0;i<n;i+=3){c.beginPath();c.moveTo(i,0);c.lineTo(i,n);c.moveTo(0,i);c.lineTo(n,i);c.stroke()}});fabricTex.repeat.set(7,7);
const barkTex=texture(256,(c,n)=>{c.fillStyle='#73604a';c.fillRect(0,0,n,n);for(let i=0;i<220;i++){c.beginPath();let x=rand()*n;c.moveTo(x,0);for(let y=0;y<=n;y+=8)c.lineTo(x+Math.sin(y*.04+i)*3,y);c.strokeStyle=rand()>.45?'#ad907144':'#28271966';c.lineWidth=between(.4,3);c.stroke()}});
const ropeTex=texture(128,(c,n)=>{c.fillStyle='#99743b';c.fillRect(0,0,n,n);for(let i=-n;i<n*2;i+=16){c.beginPath();c.moveTo(i,0);c.lineTo(i+n,n);c.lineWidth=8;c.strokeStyle='#d9bf7b';c.stroke();c.beginPath();c.moveTo(i+5,0);c.lineTo(i+n+5,n);c.lineWidth=2;c.strokeStyle='#4f3926';c.stroke()}});ropeTex.repeat.set(10,1);
const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.88,...extra});
const stone=mat(0xcab898,{map:stoneTex,bumpMap:stoneTex,bumpScale:.075});
const lightStone=mat(0xe6d5b1,{map:stoneTex,bumpMap:stoneTex,bumpScale:.065});
const darkStone=mat(0x827766,{map:stoneTex,bumpMap:stoneTex,bumpScale:.13});
const rockMat=mat(0xb0aca2,{map:stoneTex,vertexColors:true,bumpMap:stoneTex,bumpScale:.25});
const moss=mat(0x667a40,{map:stoneTex});const grass=mat(0x59703c);const leaves=mat(0x41673d,{vertexColors:true});const roofMat=mat(0x3a6168,{metalness:.13,roughness:.68});
const dark=mat(0x263638),wood=mat(0xa48863,{map:barkTex,bumpMap:barkTex,bumpScale:.18}),iron=mat(0x324149,{metalness:.65,roughness:.5}),gold=mat(0xc6a25c,{metalness:.65,roughness:.4});
const pools=new Map(),dummy=new T.Object3D();
// Static architecture is merged by material, avoiding thousands of draw calls.
function place(geo,material,x,y,z,sx=1,sy=1,sz=1,ry=0,rx=0,rz=0,parent=null){
 if(parent){const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.set(rx,ry,rz);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
 dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,rz);dummy.updateMatrix();const g=(geo.index?geo.toNonIndexed():geo.clone()).applyMatrix4(dummy.matrix);if(!pools.has(material))pools.set(material,[]);pools.get(material).push(g);
}
const cube=new T.BoxGeometry(1,1,1),cylinder=new T.CylinderGeometry(1,1,1,12),cone=new T.ConeGeometry(1,1,6),torus=new T.TorusGeometry(1,.08,6,28);
// Bevelled blocks retain readable edges in directional light.
const block=(()=>{const s=new T.Shape();s.moveTo(-.47,-.47);s.lineTo(.47,-.47);s.lineTo(.47,.47);s.lineTo(-.47,.47);s.closePath();const g=new T.ExtrudeGeometry(s,{depth:.94,bevelEnabled:true,bevelSize:.03,bevelThickness:.03,bevelSegments:1,steps:1});g.translate(0,0,-.47);return g})();
const box=(x,y,z,w,h,d,m=stone,parent=null,ry=0)=>place(block,m,x,y,z,w,h,d,ry,0,0,parent);
const animatedFlags=[];
const bannerTex=texture(256,(c,n)=>{c.fillStyle='#921e2d';c.fillRect(0,0,n,n);c.fillStyle='#dcb874';c.fillRect(12,0,3,n);c.fillRect(n-15,0,3,n);c.font='italic 900 34px Arial';c.textAlign='center';c.fillStyle='#ffefd0';c.fillText('CHAIN',n/2,124);c.fillText('RUSH',n/2,163);c.beginPath();c.moveTo(128,38);c.lineTo(149,65);c.lineTo(128,90);c.lineTo(107,65);c.closePath();c.strokeStyle='#dcb874';c.lineWidth=3;c.stroke()});
function flag(x,y,z,w,h){const g=new T.PlaneGeometry(w,h,8,12),m=new T.Mesh(g,new T.MeshStandardMaterial({map:bannerTex,side:T.DoubleSide,roughness:.92}));m.position.set(x,y,z);world.add(m);animatedFlags.push({m,base:g.attributes.position.array.slice(),phase:rand()*6});place(cylinder,gold,x,y+h/2+.15,z,w*.63,.13,.13,0,0,Math.PI/2);}
function lancet(x,y,z,w,h){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(-w/2,h-w/2);s.quadraticCurveTo(-w/2,h,0,h+w*.2);s.quadraticCurveTo(w/2,h,w/2,h-w/2);s.lineTo(w/2,0);s.closePath();place(new T.ShapeGeometry(s),dark,x,y,z);}
function tower(x,z,h,w=6,base=0,banner=true){
 box(x,base+h/2,z,w,h,w,darkStone);box(x,base+1,z,w+1.8,2,w+1.8,stone);
 const rows=Math.floor(h/1.9),bw=w/3;
 for(let row=0;row<rows;row++)for(let col=0;col<3;col++){const yy=base+(row+.5)*h/rows,xx=x+(col-1)*bw;box(xx,yy,z+w/2+.09,bw-.08,h/rows-.08,.17,row%4===0?lightStone:stone);box(x+w/2+.09,yy,z+(col-1)*bw,.17,h/rows-.08,bw-.08,stone);}

 for(let level=3;level<h;level+=5){box(x,base+level,z,w+.3,.45,w+.3,lightStone);for(let i=0;i<3;i++)box(x-w/2+.45+i*(w-.9)/2,base+level-2,z+w/2+.03,.6,3,.38,stone);lancet(x,base+level-1.8,z+w/2+.22,.9,1.7)}
 for(const a of [-1,1])for(const b of [-1,1])box(x+a*(w/2-.15),base+h/2,z+b*(w/2-.15),.75,h+.2,.75,lightStone);
 box(x,base+h,z,w+1.9,1,w+1.9,lightStone);box(x,base+h+1,z,w+1.2,1,w+1.2,stone);
 for(let k=0;k<4;k++){const f=-w/2+k*w/3;box(x+f,base+h+2.1,z+w/2+.1,1,1.5,1,lightStone);box(x+f,base+h+2.1,z-w/2-.1,1,1.5,1,lightStone);if(k===1||k===2){box(x+w/2+.1,base+h+2.1,z+f,1,1.5,1,lightStone);box(x-w/2-.1,base+h+2.1,z+f,1,1.5,1,lightStone)}}
 if(h>28){place(new T.ConeGeometry(w*.83,w*1.8,4),roofMat,x,base+h+w*.9+3,z,1,1,1,Math.PI/4);place(cylinder,gold,x,base+h+w*1.8+3.4,z,.09,3,.09)}
 if(banner)flag(x,base+h*.58,z+w/2+.5,w*.59,h*.34);
}
// The deck has real holes; the narrow bridge pieces are the only traversable surfaces.
const courseDefinition=createCourse();
const gaps=courseDefinition.filter(e=>e.bridge).map(e=>({...bridgeRange(e),e}));
const spans=[];let spanStart=-45;for(const gap of gaps){spans.push([spanStart,gap.a]);spanStart=gap.b}spans.push([spanStart,LENGTH+85]);
const floor=new T.Group();world.add(floor);const tileTransforms=[];
for(const [a,b] of spans){const len=b-a,z=3.5-(a+b)/2;
 box(0,-.85,z,34,1.45,len,darkStone);
 for(const side of [-1,1]){box(side*16.6,.37,z,.7,.85,len,lightStone);box(side*16.12,.2,z,.12,.1,len,gold)}
 const rows=Math.ceil(len/3.3),depth=len/rows;
 for(let row=0;row<rows;row++)for(let col=0;col<8;col++)tileTransforms.push({x:(col-3.5)*4.1,z:3.5-a-(row+.5)*depth,depth:depth-.055});
}
const tiles=new T.InstancedMesh(block,stone,tileTransforms.length);const cm=new T.Color();
tileTransforms.forEach((t,i)=>{dummy.position.set(t.x,between(-.012,.012),t.z);dummy.rotation.set(0,0,0);dummy.scale.set(4.045,.27,t.depth);dummy.updateMatrix();tiles.setMatrixAt(i,dummy.matrix);cm.setHSL(.10+between(-.012,.012),between(.12,.24),between(.59,.77));tiles.setColorAt(i,cm)});tiles.receiveShadow=true;floor.add(tiles);
for(const side of [-1,1])for(let d=-25;d<LENGTH+65;d+=17){if(gaps.some(g=>d>g.a-2&&d<g.b+2))continue;const z=3.5-d;box(side*16.8,.65,z,1.1,1.3,1.4,stone);box(side*16.8,1.36,z,1.45,.24,1.8,lightStone);if(d%34<17){box(side*15,-14,z,3,27,4,darkStone);box(side*15,-3,z,4,2,5,lightStone)}}
for(const gap of gaps){for(let lane=0;lane<7;lane++){const laneX=(lane-3)*4.22,length=gap.b-gap.a,count=Math.ceil(length/.65),step=length/count;
 for(let i=0;i<count;i++){const d=gap.a+(i+.5)*step,x=laneX+bridgeOffset(gap.e,d),slope=(bridgeOffset(gap.e,d+.05)-bridgeOffset(gap.e,d-.05))/.1;
  box(x,-.03,3.5-d,1.70,.30,step+.08,wood,null,-Math.atan(slope));
  if(i%4===0)for(const side of [-1,1])place(cylinder,iron,x+side*.68,.14,3.5-d,.035,.03,.035);
 }
 for(const side of [-1,1]){const points=[];for(let i=0;i<=count;i++){const d=gap.a+i*step,u=i/count,x=laneX+bridgeOffset(gap.e,d)+side*.85;points.push(new T.Vector3(x,1.18-Math.sin(u*Math.PI)*.15,3.5-d));if(i%7===0||i===count)place(cylinder,wood,x,.64,3.5-d,.055,1.3,.055)}
 const curve=new T.CatmullRomCurve3(points);place(new T.TubeGeometry(curve,count*2,.04,5,false),wood,0,0,0)}
 // Landing plates visually connect each strip to the stone road.
 for(const d of [gap.a,gap.b])box(laneX+bridgeOffset(gap.e,d),.02,3.5-d,1.9,.18,1.2,iron);
}}

function rockyGeo(radius,height,sides=27,levels=16){const p=[],uv=[],col=[],idx=[];const cr=new T.Color();const jitter=Array.from({length:sides},()=>between(.7,1.15));
 for(let j=0;j<=levels;j++){let t=j/levels;let r=radius*(.24+Math.pow(t,.3)*.76);for(let i=0;i<=sides;i++){const a=(i%sides)/sides*TAU;const rr=r*jitter[i%sides]*(1+Math.sin(j*2.4+i)*.075+Math.sin(j*1.8)*.035);p.push(Math.cos(a)*rr,-height*(1-t),Math.sin(a)*rr);uv.push(i/sides*4,t*6);cr.setHSL(.11+between(-.02,.03),between(.04,.15),between(.57,.79)*(t*.2+.8));col.push(cr.r,cr.g,cr.b)}}
 for(let j=0;j<levels;j++)for(let i=0;i<sides;i++){const a=j*(sides+1)+i,b=a+sides+1;idx.push(a,b,a+1,b,b+1,a+1)}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
function leafGeo(){const g=new T.IcosahedronGeometry(1,2),p=g.attributes.position,c=[],color=new T.Color();for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const noise=Math.sin(x*9+y*5)*Math.cos(z*8-x*3);const r=1+noise*.065;p.setXYZ(i,x*r,y*r,z*r);color.setHSL(.27+noise*.013,.36,.52+y*.09+noise*.035);c.push(color.r,color.g,color.b)}g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.computeVertexNormals();return g}
const foliage=leafGeo();
function tree(x,y,z,s=1){place(cylinder,wood,x,y+2.8*s,z,.22*s,5.6*s,.22*s,0,0,.04);for(let k=0;k<5;k++){const a=k*2.4;place(foliage,leaves,x+Math.cos(a)*1.5*s,y+(4.2+k*.6)*s,z+Math.sin(a)*1.4*s,2*s,1.6*s,2*s,a)}}
function island(x,y,z,r,h,trees=true){place(rockyGeo(r,h),rockMat,x,y,z);place(new T.CylinderGeometry(r*.87,r*.98,1.3,15),moss,x,y+.15,z);if(trees)for(let i=0;i<9;i++){const a=rand()*TAU,d=rand()*r*.78;tree(x+Math.cos(a)*d,y+.7,z+Math.sin(a)*d,between(.6,1.5))}}
// Capture only the nearest right-hand island, preserving all random calls and other geometry.
const originalIsland=new T.Group(),blenderIsland=new T.Group();world.add(originalIsland,blenderIsland);
function captureOriginalIsland(){const counts=new Map([...pools].map(([m,g])=>[m,g.length]));island(55,4,-98,29,118);for(const [material,geos] of pools){const own=geos.splice(counts.get(material)||0);if(!own.length)continue;const mesh=new T.Mesh(mergeGeometries(own,false),material);mesh.castShadow=material!==rockMat&&material!==leaves;mesh.receiveShadow=true;originalIsland.add(mesh);own.forEach(g=>g.dispose())}}
let islandReady=false;
function setIslandVersion(after){originalIsland.visible=!after||!islandReady;blenderIsland.visible=after&&islandReady;$('islandBefore').setAttribute('aria-pressed',String(!blenderIsland.visible));$('islandAfter').setAttribute('aria-pressed',String(blenderIsland.visible));}
async function loadComparisonIsland(){try{const bytes=Uint8Array.from(atob(window.CHAIN_ISLAND_GLB),c=>c.charCodeAt(0));const gltf=await new Promise((ok,no)=>loader.parse(bytes.buffer,'',ok,no));const asset=gltf.scene;asset.updateMatrixWorld(true);
 const crownBounds=new T.Box3();asset.traverse(o=>{if(o.isMesh&&/CliffFace|Crown|GrassPlateau/.test(o.name))crownBounds.expandByObject(o)});if(crownBounds.isEmpty())crownBounds.setFromObject(asset);
 const fullBounds=new T.Box3().setFromObject(asset);const size=fullBounds.getSize(new T.Vector3()),center=fullBounds.getCenter(new T.Vector3()),scale=58/Math.max(size.x,size.z);
 asset.scale.setScalar(scale);asset.position.set(55-center.x*scale,4-2.15*scale,-98-center.z*scale);asset.updateMatrixWorld(true);
 // Merge the static asset by material: hundreds of Blender objects become a handful of draw calls.
 const batches=new Map();asset.traverse(o=>{if(!o.isMesh)return;const geo=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);const key=o.material.uuid+':'+Object.keys(geo.attributes).sort().join(',');if(!batches.has(key))batches.set(key,{material:o.material,geos:[]});batches.get(key).geos.push(geo)});
 for(const {material,geos} of batches.values()){const mesh=new T.Mesh(mergeGeometries(geos,false),material);mesh.castShadow=false;mesh.receiveShadow=true;blenderIsland.add(mesh);geos.forEach(g=>g.dispose())}
 islandReady=true;window.CHAIN_ISLAND_GLB=null;$('islandAfter').disabled=false;$('islandNote').textContent='右手前の浮島1個だけを比較 · Pで一時停止';setIslandVersion(true);
 }catch(e){$('islandNote').textContent='GLBを読み込めないため既存の浮島を表示';console.error(e);setIslandVersion(false)}}
island(-49,-4,-48,23,91);captureOriginalIsland();island(-76,8,-135,36,147);island(84,20,-220,44,180);island(-67,16,-220,25,145);island(95,16,-340,43,158);island(-128,40,-330,50,175);island(145,24,-380,66,210);
for(let i=0;i<17;i++){const side=i%2?1:-1;island(side*between(95,290),between(-20,95),between(-640,-140),between(9,23),between(45,120),false)}
// Distant mountains are supplied by the connected canyon below.

tower(-24,-42,25,6.8,0,true);tower(25,-73,34,7.7,3,true);tower(-57,-115,43,8.5,8,true);tower(64,-172,39,8.7,8,true);
// Hero gateway: a strong, symmetrical mid-distance landmark that reads instantly in the first frame.
tower(-21,-96,46,9,4,true);tower(21,-96,46,9,4,true);
box(0,32,-98,34,3,7,lightStone);box(0,28.5,-98,29,4,6,stone);
// Skyline citadel, asymmetric spires and elevated connecting galleries.
box(0,31,-1860,44,29,25,stone);box(0,18,-1860,54,5,33,lightStone);
for(let y=22;y<43;y+=7)for(let x=-17;x<=17;x+=5.6)lancet(x,y,-1847.2,1.5,3.5);
tower(-22,-1842,49,10,16,true);tower(24,-1860,64,11,16,true);tower(-5,-1876,76,12,16,false);tower(8,-1849,46,7,16,false);
box(1,45,-1857,48,1.6,27,lightStone);for(let x=-18;x<22;x+=4)box(x,47,-1844,1.7,3.5,1.6,lightStone);
for(let i=0;i<3;i++){tower(-94+i*18,-1907-i*9,between(32,54),7,22,false)}
// An arched gallery crosses the ravine on the right.
box(67,15,-182,82,2,6,stone);for(let x=31;x<110;x+=13){box(x,-5,-182,2.3,39,3.8,stone);for(let i=0;i<9;i++){let a=i/8*Math.PI;place(block,lightStone,x+6+6*Math.cos(a),6+7*Math.sin(a),-179,1.8,2,1.8,0,0,a-Math.PI/2)}}
for(let i=0;i<12;i++){const x=i%2?18.2:-18.2;const z=-rand()*210;place(foliage,leaves,x,.4,z,between(.8,1.8),between(.3,.8),between(.8,1.8),rand()*6)}

// Water curtains: irregular transparent edges, animated striations and foam below.
const waterMaterial=new T.ShaderMaterial({side:T.DoubleSide,transparent:true,depthWrite:false,uniforms:{uTime:uniforms.time},vertexShader:`varying vec2 vUv;void main(){vUv=uv;vec3 p=position;p.z+=sin(uv.y*26.+uv.x*15.)*.2;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`varying vec2 vUv;uniform float uTime;float hash(float p){return fract(sin(p*123.45)*4567.8);}void main(){float bands=sin(vUv.x*138.+sin(vUv.y*15.-uTime*2.))*sin(vUv.y*43.+uTime*7.);float thin=pow(abs(sin(vUv.x*89.+sin(vUv.y*3.-uTime)*2.)),12.);float edge=smoothstep(0.,.12,vUv.x)*smoothstep(0.,.12,1.-vUv.x);float a=edge*smoothstep(0.,.09,vUv.y)*(.52+.24*bands+.18*thin);vec3 col=mix(vec3(.29,.62,.73),vec3(.94,.99,1.),.48+bands*.2+thin*.4);gl_FragColor=vec4(col,a);}`});
const mistTex=texture(128,(c,n)=>{const g=c.createRadialGradient(n/2,n/2,0,n/2,n/2,n/2);g.addColorStop(0,'rgba(255,255,255,.8)');g.addColorStop(.4,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,n,n)});
const mists=[];
function mist(x,y,z,s,opacity=.3){const m=new T.Sprite(new T.SpriteMaterial({map:mistTex,color:0xe5eff0,transparent:true,opacity,depthWrite:false}));m.position.set(x,y,z);m.scale.set(s*2,s,1);world.add(m);mists.push({m,x,z,phase:rand()*6});}
function waterfall(x,top,z,w,h){const m=new T.Mesh(new T.PlaneGeometry(w,h,8,24),waterMaterial);m.position.set(x,top-h/2,z);world.add(m);for(let i=0;i<6;i++)mist(x+between(-w,w),top-h+between(-5,8),z+between(-2,8),between(13,25),.28);box(x,top,z,w,.4,5,new T.MeshStandardMaterial({color:0x90d0d5,metalness:.25,roughness:.25}));}
waterfall(-45,-3,-29,8,86);waterfall(54,4,-71,11,108);waterfall(-72,8,-102,12,139);waterfall(83,20,-180,15,153);
for(let i=0;i<35;i++)mist(between(-200,200),between(-75,-33),between(-450,-25),between(25,70),between(.16,.35));

// Distinct regions in world coordinates. Nothing wraps back to the start.
for(let d=330;d<1700;d+=95){const side=d%190<95?-1:1;const r=between(16,28);island(side*between(49,75),between(-12,2),-d,r,between(65,135),true);if(d<650||d>1260)waterfall(side*between(38,49),1,-d+12,between(6,11),between(65,95));}
for(let d=330;d<600;d+=95){island(-83,22,-d,34,145);island(92,16,-d-35,37,142);waterfall(-59,22,-d+11,9,112);waterfall(64,16,-d-12,11,106)}
const riverMaterial=new T.MeshStandardMaterial({color:0x36878f,roughness:.23,metalness:.32,transparent:true,opacity:.92});
box(0,-11,-749,225,.35,340,riverMaterial);
// Barrel-vault tunnel: open mouth, ribbed stone walls, arch roof and warm braziers.
const tunnelLights=[];
for(let d=930;d<1235;d+=14){for(const side of [-1,1]){box(side*20,5,-d,5,10,14,darkStone);if(d%28<14){box(side*18.5,5,-d,1,10,2,lightStone);const flame=new T.Mesh(new T.IcosahedronGeometry(.35,1),new T.MeshBasicMaterial({color:0xffb64b}));flame.position.set(side*17.9,5,-d);world.add(flame);tunnelLights.push(flame);place(cylinder,iron,side*18,3.7,-d,.12,2,.12)}}
 for(let j=0;j<15;j++){let a=j/14*Math.PI;place(block,j%3===0?lightStone:darkStone,20*Math.cos(a),9+11*Math.sin(a),-d,4.5,2.2,14,0,0,a-Math.PI/2)}
}
const tunnelLamp=new T.PointLight(0xffb862,0,65,1);tunnelLamp.position.set(0,8,-8);scene.add(tunnelLamp);
// Extra distant ranges, terraced cliff faces, ruins and a sheltered mission platform.
// Continuous canyon walls: a shared grid joins river bank, cliff and distant ridge.
// No inverted open cylinders: every near cliff extends down below the valley floor.
const cliffTex=texture(256,(c,n)=>{c.fillStyle='#aaa18d';c.fillRect(0,0,n,n);for(let y=0;y<n;y+=3){c.beginPath();for(let x=0;x<=n;x+=4){const yy=y+Math.sin(x*.024+y*.11)*2+Math.sin(x*.07)*.6;if(x===0)c.moveTo(x,yy);else c.lineTo(x,yy)}c.strokeStyle=y%9===0?'#514d4250':'#e2d9c02c';c.lineWidth=y%9===0?1.7:.7;c.stroke()}for(let i=0;i<3200;i++){const v=between(60,200)|0;c.fillStyle='rgba('+v+','+v+','+v+',.08)';c.fillRect(rand()*n,rand()*n,1,2)}});
function canyon(side){const positions=[],uv=[],colors=[],indices=[],rows=128,profile=[[-1,-150],[0,0],[.25,24],[.55,65],[1,16]],cols=profile.length;
 for(let i=0;i<=rows;i++){const d=280+i*13.2,near=54+Math.sin(d*.017)*7+Math.sin(d*.043)*3,top=8+Math.sin(d*.013)*9;
  for(let j=0;j<cols;j++){const [t,h]=profile[j],x=side*(near+Math.max(0,t)*150),y=j===0?-150:top+h+Math.sin(d*.033+j)*7;positions.push(x,y,-d);uv.push(d/28,j*1.5);const c=new T.Color().setHSL(.105,.12,j===0?.26:.43+j*.035+Math.sin(d*.05)*.045);colors.push(c.r,c.g,c.b)}
 }
 for(let i=0;i<rows;i++)for(let j=0;j<cols-1;j++){const a=i*cols+j,b=a+cols;indices.push(a,b,a+1,b,b+1,a+1)}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();const material=rockMat.clone();material.side=T.DoubleSide;material.map=cliffTex;material.bumpMap=cliffTex;material.bumpScale=.32;place(g,material,0,0,0);
 // Vegetation follows the actual top edge, instead of hovering above water.
 for(let d=310;d<1770;d+=39){const near=54+Math.sin(d*.017)*7+Math.sin(d*.043)*3,top=8+Math.sin(d*.013)*9+Math.sin(d*.033+1)*7;tree(side*(near+2),top,-d,between(.7,1.25))}
}
for(const side of [-1,1])canyon(side);
// Continuous low banks support all trees bordering the river.
for(const side of [-1,1]){box(side*47,-9,-752,30,8,326,darkStone);box(side*47,-4.9,-752,30,.35,326,moss);for(let d=603;d<911;d+=29){place(rockyGeo(7,19,13,6),rockMat,side*34,-6,-d);tree(side*43,-4.7,-d,between(.8,1.4))}}

box(0,-.8,-900,48,1.4,48,lightStone);for(const side of [-1,1]){tree(side*23,0,-887,1.3);tree(side*24,0,-913,1.7);tower(side*29,-910,20,5,0,false)}
// Physical finish plaza, gate, pennants and breakable finish ribbon.
box(0,-.7,-1816,76,1.3,95,lightStone);tower(-24,-1810,39,8,0,true);tower(24,-1810,39,8,0,true);box(0,16,-1810,40,2.5,4,stone);
const finishRibbon=new T.Group();finishRibbon.position.z=3.5-LENGTH;world.add(finishRibbon);
const ribbonTex=texture(512,(c,n)=>{c.fillStyle='#eee4c9';c.fillRect(0,0,n,n);c.fillStyle='#b72e36';for(let i=0;i<16;i++){c.fillRect(i*32,0,16,42);c.fillRect(i*32,n-42,16,42)}c.fillStyle='#9e2831';c.font='900 84px Arial';c.textAlign='center';c.fillText('FINISH',n/2,n/2+27)});
const ribbonMat=new T.MeshStandardMaterial({map:ribbonTex,side:T.DoubleSide,roughness:.9});
for(const side of [-1,1]){const m=new T.Mesh(new T.PlaneGeometry(16,.9,8,1),ribbonMat);m.position.set(side*8,2.6,0);finishRibbon.add(m)}
const goalSign=new T.Mesh(new T.PlaneGeometry(13,3.5),new T.MeshStandardMaterial({map:ribbonTex}));goalSign.position.set(0,16,-1807.8);world.add(goalSign);
for(const side of [-1,1])for(let d=1745;d<1840;d+=12){place(cylinder,gold,side*19,4,-d,.08,8,.08);flag(side*19,6.4,-d,1.7,2.6)}

const obstacles=[];
const markerMaterials={jump:0x388dbc,duck:0xd86031,left:0xdbaf44,right:0xdbaf44};
function arrowTexture(text,color){return texture(128,(c,n)=>{c.fillStyle=color;c.fillRect(0,0,n,n);c.strokeStyle='#fff9';c.lineWidth=4;c.strokeRect(5,5,n-10,n-10);c.font='900 87px Arial';c.fillStyle='#fff5d7';c.textAlign='center';c.fillText(text,n/2,94)})}
const arrows={left:arrowTexture('←','#936e26'),right:arrowTexture('→','#936e26'),jump:arrowTexture('↑','#286b85'),duck:arrowTexture('↓','#9c432d')};
const arrowMats={left:new T.MeshBasicMaterial({map:arrows.left}),right:new T.MeshBasicMaterial({map:arrows.right})};
function obstacle(e){const g=new T.Group();g.position.z=3.5-e.at;world.add(g);
 if(e.type==='movingLog'){
  const lift=new T.Group();g.add(lift);g.userData.lift=lift;
  for(const x of [-15.4,15.4]){box(x,3.5,0,1.5,7,2.3,darkStone,g);box(x,7.1,0,2.6,.55,3.1,lightStone,g);box(x,3.5,1.2,.26,5.5,.2,iron,g);const gear=place(new T.TorusGeometry(.55,.12,6,12),iron,x,6.45,1.45,1,1,1,0,0,0,g);gear.userData.gear=true;}
  place(new T.CylinderGeometry(.62,.62,31,20),wood,0,0,0,1,1,1,0,0,Math.PI/2,lift);
  for(const x of [-13,-6,6,13])place(new T.CylinderGeometry(.70,.70,.4,18,1,true),iron,x,0,0,1,1,1,0,0,Math.PI/2,lift);
  for(const x of [-14.5,14.5]){const chain=place(cylinder,iron,x,3,0,.055,6,.055,0,0,0,g);chain.userData.chain=true}
  lift.position.y=logHeight(e,0);
 }else if(e.type==='duck'){
  for(const x of [-15.4,15.4]){box(x,4.6,0,1.6,9.2,2.2,darkStone,g);box(x,9.25,0,2.7,.65,3.2,lightStone,g)}
  place(new T.CylinderGeometry(1,1.15,31,18,3),wood,0,3.75,0,1,1,1,0,0,Math.PI/2,g);
  for(const x of [-13,-6,6,13])place(new T.CylinderGeometry(1.18,1.18,.4,18,1,true),iron,x,3.75,0,1,1,1,0,0,Math.PI/2,g);
 }else if(e.need==='jump'&&e.type!=='rock'){
  for(let i=0;i<10;i++){box((i-4.5)*3.1,(e.height-.25)/2,0,3,e.height-.25,e.depth,stone,g);box((i-4.5)*3.1,e.height-.125,0,3,.25,e.depth+.06,lightStone,g)}
 }else if(e.type==='rock'){
  for(let i=0;i<7;i++){const m=place(new T.DodecahedronGeometry(1.6,1),darkStone,(i-3)*4.22,1.2,0,1,.85,1,.3,0,.15,g);m.userData.drop=true}
 }else if(!e.bridge){
  const sign=e.need==='left'?1:-1;
  for(let lane=0;lane<7;lane++){const x=(lane-3)*4.22+sign*.66;const height=12+(lane%3)*1.5;
   box(x,height/2,0,2.68,height,3.1,darkStone,g);for(let y=1;y<height;y+=2)box(x,y,1.64,2.73,.18,.24,lightStone,g);
   box(x,height,0,2.96,.55,3.3,lightStone,g);box(x,3.5,1.73,.65,4,.18,stone,g);
   const mark=new T.Mesh(new T.PlaneGeometry(1.4,1.4),arrowMats[e.need]);mark.position.set((lane-3)*4.22-sign*1.25,4.8,1.8);g.add(mark);
  }
 }
 const label=document.createElement('div');label.className='obstacle-label';label.textContent=e.type==='movingLog'?'↕ 昇降丸太':e.type==='bridgeCurve'?'A / D · 曲がる橋':e.type==='jumpHigh'?'W長押し · 高い壁':e.type==='jumpLow'?'W短押し · 低い壁':e.type==='rock'?'落石 — JUMP':e.bridge?(e.need==='left'?'← 左の橋':'右の橋 →'):{jump:'↑ JUMP',duck:'↓ DUCK',left:'← LEFT',right:'RIGHT →'}[e.need];$('labels').appendChild(label);
 obstacles.push({g,event:e,label});
}
courseDefinition.forEach(obstacle);
for(const o of obstacles){if(['rock','movingLog'].includes(o.event.type))continue;const batches=new Map();for(const child of [...o.g.children]){if(!child.isMesh)continue;child.updateMatrix();const geo=(child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone()).applyMatrix4(child.matrix);if(!batches.has(child.material))batches.set(child.material,[]);batches.get(child.material).push(geo);o.g.remove(child)}for(const [material,geos] of batches){const mesh=new T.Mesh(mergeGeometries(geos,false),material);mesh.castShadow=mesh.receiveShadow=true;o.g.add(mesh);geos.forEach(g=>g.dispose())}}

// Finalize all immobile meshes into material batches.
for(const [material,geometries] of pools){const g=mergeGeometries(geometries,false);if(!g)throw new Error('Geometry merge failed');const m=new T.Mesh(g,material);m.castShadow=material!==rockMat&&material!==leaves;m.receiveShadow=true;world.add(m);geometries.forEach(g=>g.dispose())}pools.clear();

const colors=['#2899d1','#efba3a','#e968a6','#c83c30','#43924d','#d57b2f','#9365b7'];
const players=[];const loader=new GLTFLoader();
const parse=data=>new Promise((resolve,reject)=>loader.parse(JSON.stringify(data),'',resolve,reject));
const game=new Game('normal',{networkMode:true}),runner=new RunnerMotion(),network=new ChainNetwork({maxPlayers:7});
let mode='run',selected=-1,elapsed=0,speed=0,stuckMix=0;let missionMix=0,finishMix=0;const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let lobbyRoster=[],matchRoster=[],matchLocked=false,localSlot=-1,isHost=false,roomJoined=false,currentMatchId='';
const localPlayerId=network.clientId,remotePoses=new Map();let hostRecovery=0,lastPoseSent=0,lastStateSent=0,forceStateSend=false,cameraCenterX=0;
let netTargetDistance=0,netTargetElapsed=0,netTargetCountdown=0,modelsReady=false;
const v3=new T.Vector3(),vA=new T.Vector3(),vB=new T.Vector3();
function marker(i){const el=document.createElement('div');el.className='runner-label';el.style.setProperty('--color',colors[i]);el.innerHTML='<span class="number">'+String(i+1).padStart(2,'0')+'</span>';$('labels').appendChild(el);return el;}
function makeCharacter(gltf,i){const model=cloneSkeleton(gltf.scene);const group=new T.Group();group.add(model);scene.add(group);
 model.updateMatrixWorld(true);const restBounds=new T.Box3().setFromObject(model,true);const size=restBounds.getSize(new T.Vector3());const sc=4.02/size.y;model.scale.setScalar(sc);model.position.y=.17;model.rotation.y=Math.PI;
 model.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;if(o.isSkinnedMesh)o.frustumCulled=false;const customize=m=>{m=m.clone();m.roughness=.82;m.metalness=0;
 if(['Purple','Orange'].includes(m.name)){m.color.set(colors[i]);m.map=fabricTex;m.bumpMap=fabricTex;m.bumpScale=.014;}
 if(['LightBlue','Grey'].includes(m.name))m.color.set('#273c47');
 if(m.name==='White')m.color.set('#d5d1b9');if((i===2||i===6)&&o.name.includes('Body')&&m.name==='White'){m.color.set(colors[i]);m.map=fabricTex}if((i===2||i===6)&&m.name==='Orange')m.color.set('#273c47');
 if(m.name.includes('Hair'))m.color.set(['#172b32','#724a25','#703044','#38281d','#3a332a','#292a28','#402245'][i]);
 if(m.name==='Skin')m.color.set(['#c9946e','#b4835f','#d6a280','#c68d69','#b67e57','#bb916c','#cfa280'][i]);
 return m};o.material=Array.isArray(o.material)?o.material.map(customize):customize(o.material)}});
 const mixer=new T.AnimationMixer(model),run=mixer.clipAction(gltf.animations.find(c=>c.name==='Run'));run.play();run.time=i*.13;
 const hit=mixer.clipAction(gltf.animations.find(c=>c.name==='HitRecieve'));hit.play();hit.enabled=true;hit.setEffectiveWeight(0);
 const idle=mixer.clipAction(gltf.animations.find(c=>c.name==='Idle_Neutral'));idle.play();idle.setEffectiveWeight(0);
 const bones={};model.traverse(o=>{if(o.isBone){bones[o.name]=o;if(/[LR]$/.test(o.name))bones[o.name.slice(0,-1)+'.'+o.name.slice(-1)]=o}});
 const p={group,model,mixer,run,hit,idle,bones,scale:sc,index:i,x:(i-3)*4.22,z:3.5,label:marker(i),height:4.02,playerId:null,displayName:''};group.position.set(p.x,0,p.z);players.push(p);
 const belt=new T.Mesh(new T.TorusGeometry(.43,.075,5,24),mat(0x59482c));belt.rotation.x=Math.PI/2;belt.scale.set(1,.8,1);belt.position.y=1.90;group.add(belt);p.belt=belt;
 const btn=document.createElement('button');btn.textContent=String(i+1).padStart(2,'0');btn.style.setProperty('--color',colors[i]);btn.className='';btn.title='EMPTY';btn.setAttribute('aria-label',btn.title);btn.tabIndex=-1;$('teamButtons').appendChild(btn);p.button=btn;
}

// Verlet ropes: fixed waist endpoints, gravity, length constraints, visible woven tubes.
const ropes=[];const ropeMaterial=mat(0xe1c284,{map:ropeTex,roughness:.92});
function makeRope(a,b){const N=17,R=7,verts=(N+1)*(R+1),g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(verts*3),3));g.setAttribute('normal',new T.BufferAttribute(new Float32Array(verts*3),3));const uv=[],indices=[];
 for(let i=0;i<=N;i++)for(let j=0;j<=R;j++){uv.push(i/N,j/R);if(i<N&&j<R){const k=i*(R+1)+j;indices.push(k,k+R+1,k+1,k+1,k+R+1,k+R+2)}}g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);const m=new T.Mesh(g,ropeMaterial.clone());m.castShadow=true;m.frustumCulled=false;scene.add(m);const pts=[],prev=[];for(let i=0;i<=N;i++){const p=new T.Vector3().lerpVectors(a.group.position,b.group.position,i/N);p.y=1.90-Math.sin(i/N*Math.PI)*.4;pts.push(p);prev.push(p.clone())}ropes.push({m,pts,prev,a,b,N,R,slot:a.index});}
function updateRopes(dt){for(const r of ropes){const {pts,prev,N,R,a,b}=r;const start=a.group.position.clone().add(new T.Vector3(.32,a.waist||1.91,0)),end=b.group.position.clone().add(new T.Vector3(-.32,b.waist||1.91,0));const d=start.distanceTo(end);const tension=mode==='stuck'&&(a.playerId===game.stuckPlayerId||b.playerId===game.stuckPlayerId);const length=tension?Math.max(3.6,d*1.006):Math.max(3.55,d*1.075);
 for(let i=1;i<N;i++){const p=pts[i],old=p.clone();p.addScaledVector(v3.subVectors(p,prev[i]),.985);p.y-=10*dt*dt;p.z+=Math.sin(elapsed*3+i*.6)*dt*dt*.5;prev[i].copy(old)}
 for(let k=0;k<9;k++){pts[0].copy(start);pts[N].copy(end);for(let i=0;i<N;i++){const delta=v3.subVectors(pts[i+1],pts[i]);const dist=delta.length();const correction=(dist-length/N)/Math.max(dist,.00001);if(i>0)pts[i].addScaledVector(delta,correction*.5);if(i+1<N)pts[i+1].addScaledVector(delta,-correction*.5)}}pts[0].copy(start);pts[N].copy(end);
 const pos=r.m.geometry.attributes.position,normal=r.m.geometry.attributes.normal;for(let i=0;i<=N;i++){const tangent=vA.subVectors(pts[Math.min(i+1,N)],pts[Math.max(i-1,0)]).normalize();const side=vB.crossVectors(tangent,new T.Vector3(0,1,0)).normalize();const up=new T.Vector3().crossVectors(side,tangent).normalize();for(let j=0;j<=R;j++){let ang=j/R*TAU;const nx=side.x*Math.cos(ang)+up.x*Math.sin(ang),ny=side.y*Math.cos(ang)+up.y*Math.sin(ang),nz=side.z*Math.cos(ang)+up.z*Math.sin(ang);const k=i*(R+1)+j;pos.setXYZ(k,pts[i].x+nx*.066,pts[i].y+ny*.066,pts[i].z+nz*.066);normal.setXYZ(k,nx,ny,nz)}}pos.needsUpdate=normal.needsUpdate=true;r.m.material.color.lerp(new T.Color(tension?0xff7946:0xe1c284),.12);r.m.material.emissive.set(tension?0x5d1204:0);}}

const ring=new T.Mesh(new T.RingGeometry(.75,.95,48),new T.MeshBasicMaterial({color:0xff5634,side:T.DoubleSide,transparent:true,opacity:.9,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.visible=false;scene.add(ring);
const ring2=ring.clone();ring2.material=ring.material.clone();ring2.material.opacity=.3;scene.add(ring2);
const sparks=[];const dustMat=new T.PointsMaterial({color:0xffe6b5,size:.16,transparent:true,opacity:.52,depthWrite:false});const dustPos=new Float32Array(180*3);for(let i=0;i<180;i++){dustPos[i*3]=between(-17,17);dustPos[i*3+1]=between(.08,3);dustPos[i*3+2]=between(-45,22)}const dustGeo=new T.BufferGeometry();dustGeo.setAttribute('position',new T.BufferAttribute(dustPos,3));scene.add(new T.Points(dustGeo,dustMat));
const actionNames={jump:'↑ / W　ジャンプ',duck:'↓ / S　しゃがむ',left:'← / A　左へ',right:'→ / D　右へ',steer:'A / D　足場に沿って調整',timing:'低い時はW · 高い時はS'};
const spectators=[],pumpHandles=[],pumpRods=[],pumpParts=[];
const missionScene=new T.Group();scene.add(missionScene);missionScene.visible=false;
const balloon=new T.Mesh(new T.SphereGeometry(1,40,28),new T.MeshStandardMaterial({color:0xe93850,roughness:.24,metalness:.16}));balloon.position.set(0,10,-5);missionScene.add(balloon);
const knot=new T.Mesh(new T.ConeGeometry(.35,.7,12),balloon.material);knot.position.set(0,5,-5);missionScene.add(knot);
const string=new T.Mesh(new T.CylinderGeometry(.035,.035,5,7),wood);string.position.set(0,2.8,-5);missionScene.add(string);
for(let i=0;i<7;i++){const x=(i-3)*3.1,z=-1+Math.abs(i-3)*.45;const base=box(x,.45,z,1.3,.8,1.4,gold,missionScene),pole=place(cylinder,iron,x,1.2,z,.15,1.6,.15,0,0,0,missionScene),handle=box(x,2,z,1.5,.17,.26,wood,missionScene),rod=place(cylinder,iron,x,2.3,z,.065,.9,.065,0,0,0,missionScene);pumpHandles.push(handle);pumpRods.push(rod);pumpParts.push([base,pole,handle,rod])}
const confettiGeo=new T.PlaneGeometry(.15,.32),confetti=new T.InstancedMesh(confettiGeo,new T.MeshBasicMaterial({side:T.DoubleSide}),140);confetti.frustumCulled=false;confetti.visible=false;scene.add(confetti);
const confettiData=Array.from({length:140},(_,i)=>{confetti.setColorAt(i,new T.Color(colors[i%7]));return {x:between(-19,19),y:between(5,19),z:between(-13,13),v:between(1.1,3),r:rand()*6}});
const rainGeo=new T.BufferGeometry(),rainPositions=new Float32Array(180*6);const rainDrops=Array.from({length:180},()=>({x:between(-25,25),y:between(0,30),z:between(-55,20)}));rainGeo.setAttribute('position',new T.BufferAttribute(rainPositions,3));const rain=new T.LineSegments(rainGeo,new T.LineBasicMaterial({color:0xbedce9,transparent:true,opacity:.36,depthWrite:false}));scene.add(rain);rain.visible=false;


function activeRoster(){return matchLocked?matchRoster:lobbyRoster}
function neutralPose(){return {side:0,jumpY:0,duck:0,sideVelocity:0,landing:0,dashing:false,energy:1,receivedAt:performance.now()}}
function poseForPlayer(playerId){if(playerId===localPlayerId)return {...runner.snapshot(),receivedAt:performance.now()};return remotePoses.get(playerId)||neutralPose()}
function reseedRopes(){for(const r of ropes){const visible=r.slot<Math.max(0,activeRoster().length-1);r.m.visible=visible;if(!visible)continue;for(let i=0;i<=r.N;i++){r.pts[i].lerpVectors(r.a.group.position,r.b.group.position,i/r.N).y=1.9-Math.sin(i/r.N*Math.PI)*.3;r.prev[i].copy(r.pts[i])}}}
function syncRosterVisuals(){
 const list=activeRoster();localSlot=list.findIndex(p=>p.playerId===localPlayerId);selected=localSlot;
 for(const p of players){const entry=list[p.index];const visible=!!entry;p.group.visible=visible;p.label.style.visibility='hidden';p.button.style.display=visible?'':'none';p.playerId=entry?.playerId||null;p.displayName=entry?.name||'';p.x=slotOffset(p.index,list.length,4.22);p.z=3.5+(entry?.playerId===localPlayerId?1.1:0);
  if(visible){p.group.position.x=p.x;p.group.position.z=p.z;const mine=entry.playerId===localPlayerId;p.button.textContent=mine?'YOU':String(p.index+1).padStart(2,'0');p.button.className=mine?'you selected':'';p.button.title=(mine?'YOU · ':String(p.index+1).padStart(2,'0')+' · ')+entry.name;p.button.setAttribute('aria-label',p.button.title);p.label.classList.toggle('you',mine);p.label.firstChild.textContent=mine?'YOU':entry.name;}
 }
 for(let i=0;i<pumpHandles.length;i++){const visible=i<list.length,px=slotOffset(i,list.length,3.1),pz=-.35+Math.abs(i-(list.length-1)/2)*.45;for(const part of pumpParts[i]||[])part.visible=visible;if(pumpParts[i]){pumpParts[i][0].position.x=px;pumpParts[i][0].position.z=pz;pumpParts[i][1].position.x=px;pumpParts[i][1].position.z=pz;}pumpHandles[i].position.x=px;pumpHandles[i].position.z=pz;pumpRods[i].position.x=px;pumpRods[i].position.z=pz;}
 reseedRopes();
}
function renderLobby(message=''){
 if(!$('lobbyJoin'))return;$('lobbyJoin').hidden=roomJoined;$('lobbyRoom').hidden=!roomJoined;
 if(!roomJoined){$('lobbyStatus').textContent=message||'名前を入れてROOMを作成、または4桁ROOM IDで参加。';return}
 const list=lobbyRoster,allReady=list.length>0&&list.every(p=>p.ready);$('roomCodeText').textContent=network.room;$('playerCount').textContent=`${list.length} / 7 PLAYERS`;$('networkMode').textContent=network.mode==='supabase'?'SUPABASE REALTIME':'LOCAL TAB MODE';
 $('roster').innerHTML=list.map((p,i)=>`<li class="${p.playerId===localPlayerId?'me':''}"><span><b>${String(i+1).padStart(2,'0')}</b>${escapeHtml(p.name)}${i===0?' <em>HOST</em>':''}</span><strong>${p.ready?'READY ✓':'WAITING'}</strong></li>`).join('');
 const me=list.find(p=>p.playerId===localPlayerId);$('readyToggle').textContent=me?.ready?'READY ✓ 解除':'READY';$('readyToggle').classList.toggle('is-ready',!!me?.ready);$('start').hidden=!isHost;$('difficulty').disabled=!isHost;$('start').disabled=!isHost||!allReady||list.length<1;
 $('lobbyStatus').textContent=message||(isHost?(allReady?'全員READY。スタートできます。':'全員のREADYを待っています。'):'HOSTのスタートを待っています。');
}
function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
async function joinRoomFlow(code,hostCandidate=false){
 const name=$('playerName').value.trim();if(!name){renderLobby('名前を入力してください。');$('playerName').focus();return}
 try{localStorage.setItem('chainRushName',name);$('lobbyStatus').textContent='接続中…';const mode=await network.join(code,name,{hostCandidate});roomJoined=true;matchLocked=false;renderLobby(mode==='local'?'LOCAL TAB MODEで接続。同じブラウザの別タブで同期テストできます。':'Supabase Realtimeへ接続しました。')}catch(e){roomJoined=false;renderLobby('接続エラー：'+e.message)}
}
function rosterPayload(list){return list.map(({playerId,name,joinedAt,slot})=>({playerId,name,joinedAt,slot}))}
function beginMatch(data){
 if(!data?.matchId||data.matchId===currentMatchId)return;currentMatchId=data.matchId;matchRoster=(data.roster||lobbyRoster).slice(0,7).map((p,i)=>({...p,slot:i}));matchLocked=true;isHost=matchRoster[0]?.playerId===localPlayerId;game.level=data.level||'normal';game.reset();runner.reset();remotePoses.clear();hostRecovery=0;netTargetDistance=0;netTargetElapsed=0;netTargetCountdown=3;game.start();game.countdown=3;elapsed=0;missionMix=0;finishMix=0;syncRosterVisuals();renderLobby();clearInputs();forceStateSend=true;
}
function gameSnapshot(){return {matchId:currentMatchId,hostId:matchRoster[0]?.playerId||'',state:game.state,distance:game.distance,elapsed:game.elapsed,countdown:game.countdown,paused:game.paused,fill:game.fill,strokes:game.strokes,failures:game.failures,combo:game.combo,bestCombo:game.bestCombo,cleared:game.cleared,missionDone:game.missionDone,burstTimer:game.burstTimer,fallTimer:game.fallTimer,pulse:game.pulse,lastEventId:game.lastEvent?.id??null,stuckPlayerId:game.stuckPlayerId,course:game.course.map(e=>e.status)}}
function applyState(s){
 if(!matchLocked||s.matchId!==currentMatchId||isHost)return;const prev=game.state;game.state=s.state;netTargetDistance=s.distance;netTargetElapsed=s.elapsed;netTargetCountdown=s.countdown;game.paused=!!s.paused;game.fill=s.fill;game.strokes=s.strokes;game.failures=s.failures;game.combo=s.combo;game.bestCombo=s.bestCombo;game.cleared=s.cleared;game.missionDone=!!s.missionDone;game.burstTimer=s.burstTimer;game.fallTimer=s.fallTimer;game.pulse=s.pulse||0;game.stuckPlayerId=s.stuckPlayerId||null;game.lastEvent=s.lastEventId==null?null:game.course.find(e=>e.id===s.lastEventId)||null;if(Array.isArray(s.course))s.course.forEach((status,i)=>{if(game.course[i])game.course[i].status=status});
 if((prev==='fall'&&game.state==='countdown')||(prev!==game.state&&game.state==='mission'))runner.reset();if(['mission','finished','fall'].includes(game.state)&&prev!==game.state)clearInputs();
}
function sendState(force=false){if(!isHost||!matchLocked)return;const t=performance.now(),hz=Number(window.CHAIN_CONFIG?.stateHz)||12;if(!force&&t-lastStateSent<1000/hz)return;lastStateSent=t;network.send('state',gameSnapshot())}
function sendPose(force=false){if(!roomJoined||!matchLocked)return;const t=performance.now(),hz=Number(window.CHAIN_CONFIG?.poseHz)||20;if(!force&&t-lastPoseSent<1000/hz)return;lastPoseSent=t;network.send('pose',{matchId:currentMatchId,pose:runner.snapshot()})}
function requestPump(){if(game.state!=='mission'||game.paused)return;network.send('pump',{matchId:currentMatchId})}
function hostEvaluateTeam(dt){
 if(!isHost||!matchLocked)return;const team=matchRoster;if(game.state==='stuck'){
  const pose=poseForPlayer(game.stuckPlayerId);if(game.lastEvent&&poseMatches(game.lastEvent,pose,game.distance,game.elapsed,true)){hostRecovery+=dt;if(hostRecovery>.12){game.networkRecover();hostRecovery=0;forceStateSend=true}}else hostRecovery=0;return}
 if(game.state!=='run')return;
 for(const e of game.course){if(e.status!=='pending')continue;
  if(e.bridge){const {a,b}=bridgeRange(e);if(game.distance>=a&&game.distance<=b){for(const member of team){const pose=poseForPlayer(member.playerId);if((pose.jumpY||0)<.6&&!poseMatches(e,pose,game.distance,game.elapsed)){game.networkFail(e,member.playerId);forceStateSend=true;return}}}if(game.distance>b)game.networkClear(e)}
  else{const rel=game.distance-e.at;if(rel>=-e.halfDepth&&rel<=e.halfDepth){for(const member of team){if(!poseMatches(e,poseForPlayer(member.playerId),game.distance,game.elapsed)){game.networkFail(e,member.playerId);forceStateSend=true;return}}}if(rel>e.halfDepth)game.networkClear(e)}
 }
}
function advanceRemoteState(dt){if(isHost||!matchLocked)return;game.distance=T.MathUtils.damp(game.distance,netTargetDistance,12,dt);game.elapsed=T.MathUtils.damp(game.elapsed,netTargetElapsed,8,dt);if(game.state==='countdown')game.countdown=Math.max(0,game.countdown-dt);else game.countdown=netTargetCountdown;game.pumpAge+=dt;}
async function resetToLobby(){currentMatchId='';matchLocked=false;matchRoster=[];remotePoses.clear();game.reset();runner.reset();elapsed=0;missionMix=0;finishMix=0;clearInputs();await network.setReady(false);syncRosterVisuals();renderLobby('ロビーへ戻りました。');}
function initMultiplayer(){
 $('playerName').value=localStorage.getItem('chainRushName')||'';$('createRoom').onclick=()=>joinRoomFlow(createRoomCode(),true);$('joinRoom').onclick=()=>joinRoomFlow($('roomCodeInput').value,false);$('roomCodeInput').addEventListener('input',e=>e.target.value=e.target.value.replace(/\D/g,'').slice(0,4));$('readyToggle').onclick=()=>{const me=lobbyRoster.find(p=>p.playerId===localPlayerId);network.setReady(!me?.ready)};
 network.on('roster',info=>{if(info.roomFull){network.leave();roomJoined=false;lobbyRoster=[];syncRosterVisuals();renderLobby('ROOM FULL：最大7人です。');return}lobbyRoster=info.players;if(!matchLocked){isHost=info.isHost;syncRosterVisuals();}renderLobby()});
 network.on('event',packet=>{const {kind,payload,from}=packet;if(kind==='pose'&&payload?.matchId===currentMatchId&&from!==localPlayerId){remotePoses.set(from,{...payload.pose,receivedAt:performance.now()});return}if(kind==='start'){beginMatch(payload);return}if(kind==='state'){if(matchRoster[0]?.playerId===from)applyState(payload);return}if(kind==='pump'&&isHost&&payload?.matchId===currentMatchId){game.pump();forceStateSend=true;return}if(kind==='reset'&&from===matchRoster[0]?.playerId&&from!==localPlayerId){resetToLobby();return}});
 network.on('status',s=>{if(roomJoined)renderLobby(s.status==='SUBSCRIBED'?'接続済み。':'接続状態：'+s.status)});renderLobby();
}

function formatTime(s){const ms=Math.floor(s*1000);return `${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`}
function startRun(){if(game.state!=='ready'||!roomJoined||!isHost)return;const allReady=lobbyRoster.length>0&&lobbyRoster.every(p=>p.ready);if(!allReady){renderLobby('全員がREADYになるまで開始できません。');return}const payload={matchId:`${network.room}-${Date.now()}`,level:$('difficulty').value,roster:rosterPayload(lobbyRoster)};beginMatch(payload);network.send('start',payload);$('start').blur();}
function resetRun(){if(matchLocked&&!isHost)return;if(matchLocked)network.send('reset',{matchId:currentMatchId});resetToLobby();}
const heldKeys=new Set(),heldPointers=new Map();
const bindings={ArrowUp:'jump',KeyW:'jump',ArrowDown:'duck',KeyS:'duck',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ShiftLeft:'dash',ShiftRight:'dash'};
function syncInputs(){for(const name of ['left','right','duck','dash','jump'])runner.hold(name,[...heldKeys].some(k=>bindings[k]===name)||[...heldPointers.values()].includes(name));sendPose(true)}
function clearInputs(){heldKeys.clear();heldPointers.clear();runner.release();sendPose(true)}
function pause(){if(matchLocked&&!isHost)return;clearInputs();game.togglePause();forceStateSend=true;sendState(true);document.body.classList.remove('hud-off')}
$('start').onclick=startRun;$('pause').onclick=pause;$('resume').onclick=pause;$('restart').onclick=resetRun;$('again').onclick=resetRun;
$('hide').onclick=()=>document.body.classList.add('hud-off');$('restore').onclick=()=>document.body.classList.remove('hud-off');
$('quality').onchange=()=>{const q=$('quality').value;renderer.setPixelRatio(q==='low'?1:q==='high'?Math.min(devicePixelRatio,2):Math.min(devicePixelRatio,1.35));renderer.shadowMap.enabled=q!=='low'};
const actionButtons=[...document.querySelectorAll('[data-action]')];
for(const b of actionButtons){const a=b.dataset.action;b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture?.(e.pointerId);heldPointers.set(e.pointerId,a);if(a==='jump')runner.jump();syncInputs()});for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,e=>{heldPointers.delete(e.pointerId);syncInputs()});b.addEventListener('click',e=>{if(e.detail===0&&a==='jump')runner.jump()})}
$('islandBefore').onclick=()=>setIslandVersion(false);$('islandAfter').onclick=()=>setIslandVersion(true);
$('pump').onclick=requestPump;
addEventListener('keydown',e=>{const editing=['SELECT','INPUT','TEXTAREA'].includes(e.target?.tagName);if(editing)return;
 if(e.code==='Enter'&&!e.repeat){if(game.state==='ready'){e.preventDefault();startRun();return}}
 if(e.code==='KeyP'||e.code==='Escape'){if(!e.repeat){e.preventDefault();pause()}return}
 if(e.code==='KeyH'&&!e.repeat){document.body.classList.toggle('hud-off');return}
 if(e.code==='Space'){e.preventDefault();if(!e.repeat)requestPump();return}
 const a=bindings[e.code];if(a){e.preventDefault();if(a==='jump'&&!e.repeat)runner.jump();heldKeys.add(e.code);syncInputs()}
});
addEventListener('keyup',e=>{heldKeys.delete(e.code);syncInputs()});
addEventListener('blur',()=>clearInputs());
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInputs()});

function screenLabel(el,x,y,z,offset=0){v3.set(x,y,z).project(camera);el.style.visibility=v3.z<1&&v3.z> -1&&Math.abs(v3.x)<1.08?'visible':'hidden';el.style.transform=`translate(${(v3.x*.5+.5)*innerWidth}px,${(-v3.y*.5+.5)*innerHeight+offset}px) translate(-50%,-50%)`;}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}addEventListener('resize',resize);
const yAxis=new T.Vector3(0,1,0),qTemp=new T.Quaternion();
function animatePose(p,dt){if(p.basePose)for(const v of p.basePose){v.b.position.copy(v.p);v.b.quaternion.copy(v.q);v.b.scale.copy(v.s)}p.mixer.update(dt);if(!p.basePose)p.basePose=[...new Set(Object.values(p.bones))].map(b=>({b,p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}));else for(const v of p.basePose){v.p.copy(v.b.position);v.q.copy(v.b.quaternion);v.s.copy(v.b.scale)}}
function bend(bone,axis,angle){if(bone)bone.quaternion.multiply(qTemp.setFromAxisAngle(axis,angle))}
const axisX=new T.Vector3(1,0,0),axisZ=new T.Vector3(0,0,1);
function alignBone(bone,from,to){const origin=bone.getWorldPosition(new T.Vector3()),current=from.clone().sub(origin).normalize(),desired=to.clone().sub(origin).normalize();const worldQ=bone.getWorldQuaternion(new T.Quaternion());worldQ.premultiply(new T.Quaternion().setFromUnitVectors(current,desired));const parentQ=bone.parent.getWorldQuaternion(new T.Quaternion()).invert();bone.quaternion.copy(parentQ.multiply(worldQ)).normalize();bone.updateWorldMatrix(false,true)}
// Analytic two-bone arm reach. Elbow pole stays outside the body.
function reachHand(p,side,target){const b=p.bones,upper=b['UpperArm.'+side],lower=b['LowerArm.'+side],wrist=b['Wrist.'+side];if(!upper||!lower||!wrist)return;p.model.updateWorldMatrix(true,true);const shoulder=upper.getWorldPosition(new T.Vector3()),elbow=lower.getWorldPosition(new T.Vector3()),hand=wrist.getWorldPosition(new T.Vector3());const a=shoulder.distanceTo(elbow),c=elbow.distanceTo(hand),dir=target.clone().sub(shoulder),d=Math.max(.001,Math.min(a+c-.001,dir.length()));dir.normalize();const along=(a*a-c*c+d*d)/(2*d),h=Math.sqrt(Math.max(0,a*a-along*along));const pole=new T.Vector3(side==='L'?1:-1,-.5,0).applyQuaternion(p.model.getWorldQuaternion(new T.Quaternion()));pole.addScaledVector(dir,-pole.dot(dir)).normalize();const knee=shoulder.clone().addScaledVector(dir,along).addScaledVector(pole,h);alignBone(upper,elbow,knee);alignBone(lower,wrist.getWorldPosition(new T.Vector3()),target);}
function crouchPose(p,amount){
 const b=p.bones;if(!b.Body)return;
 b.Body.position.y-=.58*amount;
 bend(b.Torso,axisX,.90*amount);bend(b.Chest,axisX,.24*amount);bend(b.Head,axisX,-.55*amount);
 for(const side of ['L','R']){bend(b['UpperArm.'+side],axisX,-.70*amount);bend(b['LowerArm.'+side],axisX,-.65*amount)}
 p.model.updateMatrixWorld(true);
 // Two-bone IK bends the knees toward travel while keeping each independent foot at ground level.
 for(const side of ['L','R']){const upper=b['UpperLeg.'+side],lower=b['LowerLeg.'+side],foot=b['Foot.'+side];if(!upper||!lower||!foot)continue;
  const hip=upper.getWorldPosition(new T.Vector3()),ankle=foot.getWorldPosition(new T.Vector3()),kneeOld=lower.getWorldPosition(new T.Vector3());
  const a=lower.position.length()*p.scale,leg=p.legLengths?.[side];const lengthB=leg||Math.max(.8,kneeOld.distanceTo(ankle));
  const dir=ankle.clone().sub(hip),d=Math.min(a+lengthB-.001,Math.max(.01,dir.length()));dir.normalize();const along=(a*a-lengthB*lengthB+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along));
  const forward=new T.Vector3(0,0,1).applyQuaternion(p.model.getWorldQuaternion(new T.Quaternion()));forward.addScaledVector(dir,-forward.dot(dir)).normalize();const knee=hip.clone().addScaledVector(dir,along).addScaledVector(forward,height);
  alignBone(upper,kneeOld,knee);const lowerOrigin=lower.getWorldPosition(new T.Vector3());const currentEnd=new T.Vector3(0,lengthB/p.scale,0).applyMatrix4(lower.matrixWorld);alignBone(lower,currentEnd,ankle);p.model.updateMatrixWorld(true);
 }
}
function calibrate(p){p.run.setEffectiveWeight(0);p.idle.setEffectiveWeight(1);p.mixer.update(0);p.model.updateMatrixWorld(true);p.legLengths={};for(const s of ['L','R']){p.legLengths[s]=p.bones['LowerLeg.'+s].getWorldPosition(new T.Vector3()).distanceTo(p.bones['Foot.'+s].getWorldPosition(new T.Vector3()))}p.run.setEffectiveWeight(1);p.idle.setEffectiveWeight(0);p.duckVisual=0;p.waist=1.91;}
function makeSpectators(gltf){for(let i=0;i<24;i++){const model=cloneSkeleton(gltf.scene),g=new T.Group();g.add(model);world.add(g);model.updateMatrixWorld(true);const h=new T.Box3().setFromObject(model,true).getSize(new T.Vector3()).y;model.scale.setScalar(between(3.2,3.9)/h);const side=i%2?1:-1;g.position.set(side*(19.6+(i%4)*.7),.16,-1755-Math.floor(i/2)*6.5);g.rotation.y=side>0?-Math.PI/2:Math.PI/2;
 model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false;const customize=m=>{const c=m.clone();if(['Purple','Orange','White'].includes(c.name))c.color.set(colors[i%7]);return c};o.material=Array.isArray(o.material)?o.material.map(customize):customize(o.material)}});
 const mixer=new T.AnimationMixer(model),idle=mixer.clipAction(gltf.animations.find(a=>a.name==='Idle_Neutral'));idle.play();const bones={};model.traverse(o=>{if(o.isBone){bones[o.name]=o;if(/[LR]$/.test(o.name))bones[o.name.slice(0,-1)+'.'+o.name.slice(-1)]=o}});spectators.push({model,g,mixer,bones,phase:i*.65});
}}
function renderActors(dt){const team=activeRoster();for(const p of players){const member=team[p.index];if(!member){p.group.visible=false;p.label.style.visibility='hidden';continue}p.group.visible=true;const mine=member.playerId===localPlayerId;const caught=game.state==='stuck'&&game.stuckPlayerId===member.playerId,falling=game.state==='fall'&&game.stuckPlayerId===member.playerId;const statePose=mine?runner.snapshot():poseForPlayer(member.playerId);
 const pumping=missionMix>.02,waiting=['ready','countdown','mission','burst','finished'].includes(game.state)||game.paused;
 const duckTarget=pumping?0:(statePose.duck||0);p.duckVisual=mine?T.MathUtils.damp(p.duckVisual,duckTarget,22,dt||.016):T.MathUtils.damp(p.duckVisual,duckTarget,14,dt||.016);
 const idleWeight=waiting||pumping?1:p.duckVisual;
 p.run.setEffectiveWeight(caught||falling?0:1-idleWeight);p.idle.setEffectiveWeight(caught||falling?0:idleWeight);p.hit.setEffectiveWeight(caught||falling?1:0);p.hit.time=.2;
 animatePose(p,game.paused?0:dt*(waiting?.4:Math.max(8,game.speed)/12));
 p.group.rotation.set(caught?-.28:0,0,falling?(1.2-game.fallTimer)*1.6:0);p.model.scale.setScalar(p.scale);p.model.position.set(0,.17,0);p.model.rotation.set(0,Math.PI,0);
 if(mine&&!pumping&&!waiting&&!caught&&!falling){p.model.rotation.y-=(statePose.sideVelocity||0)*.035;p.group.rotation.z=-(statePose.sideVelocity||0)*.018;p.model.position.y-=(statePose.landing||0)*.09;}
 if(p.duckVisual>.005)crouchPose(p,p.duckVisual);
 let targetX=p.x+(statePose.side||0),targetZ=p.z+(caught?4.3:0),targetY=statePose.jumpY||0;
 if(falling)targetY=-Math.pow((1.2-game.fallTimer)*4,2);
 if(pumping){const px=slotOffset(p.index,team.length,3.1),pz=-.35+Math.abs(p.index-(team.length-1)/2)*.45;targetX=T.MathUtils.lerp(targetX,px,missionMix);targetZ=T.MathUtils.lerp(targetZ,pz,missionMix);targetY*=1-missionMix;const stroke=game.pulse;bend(p.bones.Torso,axisX,.35*missionMix+stroke*.24);for(const side of ['L','R']){bend(p.bones['UpperArm.'+side],axisX,-.85*missionMix);bend(p.bones['LowerArm.'+side],axisX,-.55*missionMix-stroke*.4)}p.bones.Body.position.y-=stroke*.12;pumpHandles[p.index].position.y=2.75-stroke*.48;pumpRods[p.index].position.y=(1.8+pumpHandles[p.index].position.y)/2;pumpRods[p.index].scale.y=pumpHandles[p.index].position.y-1.8;
  if(game.state==='burst'){const u=(2.4-game.burstTimer)/2.4;targetY+=Math.sin(u*Math.PI)*2.1;targetZ+=Math.sin(u*Math.PI)*2.6;p.group.rotation.x=Math.sin(u*Math.PI)*-.6;}
 }
 p.group.position.x=mine&&missionMix<.005?targetX:T.MathUtils.damp(p.group.position.x,targetX,18,dt||.016);p.group.position.z=T.MathUtils.damp(p.group.position.z,targetZ,7,dt||.016);p.group.position.y=mine&&missionMix<.005&&!falling?targetY:T.MathUtils.damp(p.group.position.y,targetY,24,dt||.016);
 if(pumping&&game.state!=='burst'){p.group.updateWorldMatrix(true,true);for(const side of ['L','R']){const handle=pumpHandles[p.index];const target=handle.getWorldPosition(new T.Vector3());target.x+=side==='L'?-.4:.4;reachHand(p,side,target)}}
 p.waist=1.91-p.duckVisual*1.22;p.belt.position.y=p.waist;
 if(game.state==='finished'){const wave=Math.sin(elapsed*5+p.index);bend(p.bones['UpperArm.L'],axisZ,-1.2);bend(p.bones['UpperArm.R'],axisZ,1.2);bend(p.bones['LowerArm.L'],axisX,wave*.25)}
 p.button.classList.toggle('caught',caught||falling);p.label.classList.toggle('caught',caught);p.label.firstChild.textContent=caught?(mine?'YOU — STUCK':member.name+' — STUCK'):(mine?'YOU':member.name);
 }}
function updateHUD(){
 $('dashMeter').style.width=(runner.energy*100)+'%';$('dashStatus').textContent=runner.controls.duck?'しゃがみ：速度55%':runner.dashing?'DASH!':runner.dashExhausted?'回復してShiftを離す':'押している間';
 const state=game.state,percent=Math.floor(game.distance/LENGTH*100);$('timer').textContent=formatTime(game.elapsed);$('progressText').textContent=percent+'%';$('progressBar').style.width=percent+'%';$('progressDot').style.left=percent+'%';$('remaining').textContent='あと '+Math.ceil(LENGTH-game.distance).toLocaleString()+' m';
 const c=CHAPTERS[game.chapter];$('chapterNumber').textContent=String(game.chapter+1).padStart(2,'0')+' / '+c.en;$('chapterName').textContent=c.name;[...$('route').children].forEach((el,i)=>{el.className=i===game.chapter?'current':i<game.chapter?'done':''});
 $('startPanel').hidden=state!=='ready';$('pausePanel').hidden=!game.paused;$('finishPanel').hidden=state!=='finished';$('mission').hidden=!['mission','burst'].includes(state);$('pump').hidden=state!=='mission';$('actions').hidden=['mission','burst','finished'].includes(state)||!matchLocked;$('pause').hidden=matchLocked&&!isHost;$('resume').disabled=matchLocked&&!isHost;$('restart').disabled=matchLocked&&!isHost;$('again').disabled=matchLocked&&!isHost;$('pause').textContent=game.paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',game.paused?'再開':'一時停止');
 $('missionBar').style.width=(game.fill*100)+'%';$('missionPercent').textContent=state==='burst'?'MISSION CLEAR!':Math.round(game.fill*100)+'%';$('pump').classList.toggle('pressed',game.pulse>.45);
 $('countdown').textContent=state==='countdown'?Math.ceil(game.countdown):'';$('feedback').textContent=game.feedbackTime>0&&!['mission','finished'].includes(state)?game.feedback:'';
 document.body.classList.toggle('is-stuck',state==='stuck');document.body.classList.toggle('is-fall',state==='fall');
 $('combo').textContent=game.combo>0?game.combo+' CHAIN  /  MISS '+game.failures:`${activeRoster().length||0} PLAYERS · NO BOTS`;
 if(state==='stuck'&&game.lastEvent){const stuck=activeRoster().find(p=>p.playerId===game.stuckPlayerId);$('warning').querySelector('strong').textContent=game.stuckPlayerId===localPlayerId?'YOU STUCK!':`${stuck?.name||'TEAMMATE'} STUCK!`;$('recoveryText').textContent=actionNames[game.lastEvent.need]+' でロープを外す';}
 const next=game.upcoming(),d=next?next.at-game.distance:999;const show=state==='run'&&next&&d<game.speed*game.config.notice;
 $('cue').style.display=show?'block':'none';if(show){$('cueLabel').textContent=next.type==='movingLog'?'丸太の高さを見て判断':next.type==='bridgeCurve'?'湾曲した足場に沿って走る':next.bridge?'足場のある側をキープ':next.type==='rock'?'落石注意':'NEXT OBSTACLE';$('cueAction').textContent=next.type==='jumpHigh'?'W 長押し · 高いジャンプ':next.type==='jumpLow'?'W 短押し · 小さくジャンプ':actionNames[next.need];$('cueDistance').textContent=next.bridge&&game.distance>bridgeRange(next).a-5?'A / Dで微調整 · 離すとその場で減速':Math.max(0,d/game.speed).toFixed(1)+' 秒';$('cueMeter').style.width=Math.min(100,Math.max(0,(1-d/(game.speed*game.config.notice))*100))+'%';$('cue').classList.toggle('urgent',d/game.speed<.8)}
 for(const b of actionButtons){const a=b.dataset.action;b.classList.toggle('pressed',a==='jump'?runner.flight>=0:!!runner.controls[a])}
 if(state==='finished'){$('finalTime').textContent=formatTime(game.elapsed);$('finalStats').textContent=`${game.level.toUpperCase()}  ·  MISS ${game.failures}  ·  BEST CHAIN ${game.bestCombo}`;}
}
let last=performance.now(),acc=0,frames=0,sec=0,qualityAdjusted=false;
function frame(now){requestAnimationFrame(frame);const delta=Math.min(.045,Math.max(0,(now-last)/1000));last=now;if(document.hidden)return;
 const prev=game.state;if(matchLocked){runner.step(delta,['run','stuck'].includes(game.state)&&!game.paused);sendPose();if(isHost){game.step(delta);hostEvaluateTeam(delta);sendState(forceStateSend);forceStateSend=false}else advanceRemoteState(delta)}else runner.step(delta,false);if((prev==='fall'&&game.state==='countdown')||(prev!==game.state&&game.state==='mission'))runner.reset();if(game.state!==prev&&['fall','mission','finished'].includes(game.state)){clearInputs();document.body.classList.remove('hud-off');if(isHost)forceStateSend=true}
 const dt=game.paused?0:delta;elapsed+=dt;mode=game.state==='stuck'?'stuck':'run';speed=game.state==='run'?game.speed:0;stuckMix=T.MathUtils.damp(stuckMix,mode==='stuck'?1:0,7,dt);
 world.position.z=game.distance;uniforms.time.value=elapsed;
 missionMix=T.MathUtils.damp(missionMix,['mission','burst'].includes(game.state)?1:0,3,dt);finishMix=T.MathUtils.damp(finishMix,game.state==='finished'?1:0,2,dt);
 missionScene.visible=missionMix>.005;balloon.visible=game.state!=='burst';knot.visible=balloon.visible;const bs=1.3+game.fill*4.4;balloon.scale.set(bs,bs*1.11,bs);balloon.position.y=5.6+bs;knot.position.y=balloon.position.y-bs*1.1;
 renderActors(dt);
 acc+=dt;let n=0;while(acc>=1/60&&n++<4){updateRopes(1/60);acc-=1/60}
 for(const f of animatedFlags){const a=f.m.geometry.attributes.position;for(let i=0;i<a.count;i++){let x=f.base[i*3],y=f.base[i*3+1];const hanging=(f.m.geometry.parameters.height/2-y)/f.m.geometry.parameters.height;a.setZ(i,(Math.sin(x*1.4+elapsed*2.8+f.phase+hanging*2)*.2+Math.sin(hanging*8+elapsed*2)*.13)*hanging)}a.needsUpdate=true;f.m.geometry.computeVertexNormals()}
 for(const {m,x,phase} of mists)m.position.x=x+Math.sin(elapsed*.05+phase)*3;
 const tunnel=game.distance>924&&game.distance<1240;const storm=game.distance>1250&&game.distance<1575;const envBlend=1-Math.exp(-dt*2);
 hemi.intensity+=( (tunnel?.55:storm?1.05:1.65)-hemi.intensity)*envBlend;sun.intensity+=((tunnel?.1:storm?1.65:3.65)-sun.intensity)*envBlend;tunnelLamp.intensity+=((tunnel?16:0)-tunnelLamp.intensity)*envBlend;
 scene.fog.color.lerp(new T.Color(tunnel?0x33454b:storm?0x91aebd:0xb9d7df),envBlend);scene.fog.density=T.MathUtils.damp(scene.fog.density,tunnel?.009:storm?.0032:.00115,2,dt);
 for(const m of tunnelLights)m.scale.setScalar(.9+Math.sin(elapsed*8+m.position.z)*.15);
 rain.visible=storm;const rp=rainGeo.attributes.position;if(storm){rainDrops.forEach((r,i)=>{r.y-=dt*21;r.x-=dt*2;if(r.y< -2){r.y=30;r.x=between(-25,25)}rp.setXYZ(i*2,r.x,r.y,r.z);rp.setXYZ(i*2+1,r.x-.2,r.y-1.2,r.z)});rp.needsUpdate=true}
 const flash=storm&&!reducedMotion?Math.pow(Math.max(0,Math.sin(elapsed*1.7)),80)*.20:0;$('weather').style.opacity=flash;
 for(const o of obstacles){const rel=o.event.at-game.distance;o.g.visible=rel<220&&rel> -35;if(o.event.type==='movingLog'){const h=logHeight(o.event,game.elapsed);o.g.userData.lift.position.y=h;for(const part of o.g.children){if(part.userData.gear)part.rotation.z=game.elapsed*.7;if(part.userData.chain){part.position.y=(h+6.5)/2;part.scale.y=6.5-h;}}o.label.textContent=h>3.25?'↓ Sでしゃがむ':h<1.65?'↑ Wでジャンプ':'↕ 丸太が移動中';}if(o.event.type==='rock'){const drop=T.MathUtils.clamp((rel/game.speed-.8)/1.2,0,1);for(const m of o.g.children)if(m.userData.drop)m.position.y=1.2+drop*15}}
 const dp=dustGeo.attributes.position;for(let i=0;i<dp.count;i++){let z=dp.getZ(i)+speed*dt*1.3;if(z>24)z=-45;dp.setZ(i,z)}dp.needsUpdate=true;
 ring.visible=ring2.visible=game.state==='stuck';const stuckIndex=activeRoster().findIndex(p=>p.playerId===game.stuckPlayerId),stuckPlayer=stuckIndex>=0?players[stuckIndex]:null;if(stuckPlayer){ring.position.copy(stuckPlayer.group.position);ring.position.y=.19;ring.scale.setScalar(1.5+Math.sin(elapsed*6)*.1);ring2.position.copy(ring.position);ring2.scale.setScalar(2.1+(elapsed*.7%1)*.7);ring2.material.opacity=.3*(1-(elapsed*.7%1))}
 for(const sp of spectators){const visible=game.distance>1650;sp.g.visible=visible;if(!visible)continue;animatePose(sp,dt);const clap=.035+(1-Math.cos(elapsed*6.5+sp.phase))*.07;sp.g.updateWorldMatrix(true,true);const chest=sp.bones.Chest.getWorldPosition(new T.Vector3());for(const side of ['L','R']){const offset=new T.Vector3(side==='L'?clap:-clap,-.16,.52).applyQuaternion(sp.model.getWorldQuaternion(new T.Quaternion()));reachHand(sp,side,chest.clone().add(offset))}sp.g.position.y=.16;}
 finishRibbon.children.forEach((m,i)=>{m.rotation.y=(i?1:-1)*finishMix*1.3;m.position.z=finishMix*3;m.position.y=2.6-finishMix*1.4});
 confetti.visible=game.state==='burst'||game.state==='finished';if(confetti.visible){confettiData.forEach((p,i)=>{dummy.position.set(p.x+Math.sin(elapsed+p.r),((p.y-elapsed*p.v)%18+18)%18,p.z);dummy.rotation.set(elapsed*2+p.r,p.r,elapsed+p.r);dummy.scale.setScalar(1);dummy.updateMatrix();confetti.setMatrixAt(i,dummy.matrix)});confetti.instanceMatrix.needsUpdate=true}
 const portrait=Math.max(0,1.55-camera.aspect);const bob=reducedMotion?0:Math.sin(elapsed*10)*.028*(speed/15);
 const cx=missionMix*17+finishMix*11,cy=8.6+bob+stuckMix*.65+missionMix*4+finishMix*2.5,cz=26.6+portrait*17+stuckMix*4+missionMix*5+finishMix*9;
 const localP=localSlot>=0?players[localSlot]:null,selfX=localP?.group.visible?localP.group.position.x:0;cameraCenterX=T.MathUtils.damp(cameraCenterX,selfX,reducedMotion?14:7,dt||.016);const selfFocus=cameraCenterX*(1-missionMix)*(1-finishMix);camera.position.set(selfFocus+cx,cy,cz);camera.lookAt(selfFocus,4.2+missionMix*1.4,-32+missionMix*28+finishMix*23);camera.updateMatrixWorld();
 for(const p of players){const member=activeRoster()[p.index],mine=member?.playerId===localPlayerId,stuck=member?.playerId===game.stuckPlayerId;if(!member||(!mine&&!stuck)||missionMix>.4||game.state==='finished'){p.label.style.visibility='hidden';continue}screenLabel(p.label,p.group.position.x,stuck?4.8:.25,p.group.position.z,stuck?-4:19)}
 for(const o of obstacles){const d=o.event.at-game.distance;if(d>8&&d<70&&game.state==='run'&&o.event.type!=='left'&&o.event.type!=='right')screenLabel(o.label,0,o.event.bridge?3.5:o.event.need==='duck'?8:5.8,o.g.position.z+world.position.z);else o.label.style.visibility='hidden'}
 updateHUD();renderer.render(scene,camera);frames++;sec+=delta;if(sec>6&&!qualityAdjusted){if(frames/sec<26&&$('quality').value==='standard'){renderer.setPixelRatio(1)}qualityAdjusted=true}
}
loadComparisonIsland();
Promise.all([parse(window.CHAIN_MODELS.male),parse(window.CHAIN_MODELS.female)]).then(([male,female])=>{for(let i=0;i<7;i++)makeCharacter(i===2||i===6?female:male,i);for(const p of players)calibrate(p);for(let i=0;i<6;i++)makeRope(players[i],players[i+1]);for(let i=0;i<60;i++)updateRopes(1/60);makeSpectators(male);window.CHAIN_MODELS=null;modelsReady=true;syncRosterVisuals();initMultiplayer();$('loading').classList.add('ready');$('quality').onchange();updateHUD();requestAnimationFrame(frame);}).catch(e=>{$('loadtext').textContent='キャラクターを展開できませんでした: '+e.message;console.error(e)});

