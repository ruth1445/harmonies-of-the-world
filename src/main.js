import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css';

const canvas = document.querySelector('#universe');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x030304, 0.00028);
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, .01, 12000);
camera.position.set(0, 20, 1800);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = .05;
controls.enablePan = false;
controls.minDistance = .5;
controls.maxDistance = 4000;

const clock = new THREE.Clock();
let currentScene = 0;
let targetCamera = new THREE.Vector3(0, 20, 1800);
let targetLook = new THREE.Vector3();
let soundEnabled = true;
let entered = false;
let timeOffsetYears = 0;
let activeSystem = null;

const ui = {
  intro: document.querySelector('#intro'), topbar: document.querySelector('#topbar'), panel: document.querySelector('#storyPanel'),
  chapter: document.querySelector('#chapter'), title: document.querySelector('#sceneTitle'), body: document.querySelector('#sceneBody'),
  metric: document.querySelector('#sceneMetric'), actions: document.querySelector('#sceneActions'), hint: document.querySelector('#hint'),
  breadcrumb: document.querySelector('#breadcrumb'), datePanel: document.querySelector('#datePanel'), dateReadout: document.querySelector('#dateReadout'),
  slider: document.querySelector('#dateSlider'), scaleNav: document.querySelector('#scaleNav'), loading: document.querySelector('#loading'),
  birthdayEntry: document.querySelector('#birthdayEntry'), birthdayInput: document.querySelector('#birthdayInput')
};

const root = new THREE.Group(); scene.add(root);
const ambient = new THREE.AmbientLight(0x777788, .55); scene.add(ambient);

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); const g = x.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,'rgba(255,245,210,1)'); g.addColorStop(.18,'rgba(230,190,110,.8)'); g.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0,0,128,128); return new THREE.CanvasTexture(c);
}
const glow = glowTexture();

function stars(count, radius, size=.8, warm=false) {
  const pos = new Float32Array(count * 3); const col = new Float32Array(count * 3);
  for (let i=0;i<count;i++) {
    const r = Math.pow(Math.random(), .55) * radius;
    const t = Math.random()*Math.PI*2; const p = Math.acos(2*Math.random()-1);
    pos[i*3]=r*Math.sin(p)*Math.cos(t); pos[i*3+1]=r*Math.cos(p); pos[i*3+2]=r*Math.sin(p)*Math.sin(t);
    const c = new THREE.Color(warm && Math.random()>.65 ? 0xd9b76d : 0xcdd7ef);
    c.multiplyScalar(.5 + Math.random()*.65); col.set([c.r,c.g,c.b],i*3);
  }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.BufferAttribute(pos,3)); geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  const pts=new THREE.Points(geo,new THREE.PointsMaterial({size,vertexColors:true,transparent:true,opacity:.8,sizeAttenuation:true}));
  return pts;
}
root.add(stars(5000, 5200, 2.0, true));

const galaxy = new THREE.Group(); root.add(galaxy);
(function createGalaxy(){
  const count=14000, pos=new Float32Array(count*3), col=new Float32Array(count*3), arms=5;
  for(let i=0;i<count;i++){
    const r=Math.pow(Math.random(),.62)*520; const branch=(i%arms)/arms*Math.PI*2;
    const spin=r*.025; const randomness=Math.pow(Math.random(),2.5)*55*(Math.random()<.5?-1:1);
    const a=branch+spin+randomness*.008;
    pos[i*3]=Math.cos(a)*r+randomness; pos[i*3+1]=(Math.random()-.5)*Math.max(5,36*(1-r/540)); pos[i*3+2]=Math.sin(a)*r+randomness;
    const c=new THREE.Color().lerpColors(new THREE.Color(0xd9b76d),new THREE.Color(0x7186bc),r/520); col.set([c.r,c.g,c.b],i*3);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  galaxy.add(new THREE.Points(geo,new THREE.PointsMaterial({size:2.2,vertexColors:true,transparent:true,opacity:.78,blending:THREE.AdditiveBlending,depthWrite:false})));
  const core=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,color:0xffd38b,transparent:true,opacity:.75,blending:THREE.AdditiveBlending})); core.scale.set(260,260,1); galaxy.add(core);
  galaxy.rotation.x=.24;
})();

const solar = new THREE.Group(); solar.scale.setScalar(.18); root.add(solar);
const sunLight = new THREE.PointLight(0xffdf9a, 1300, 700, 1.8); solar.add(sunLight);
const sun = new THREE.Mesh(new THREE.SphereGeometry(9,48,48),new THREE.MeshBasicMaterial({color:0xffd787})); solar.add(sun);
const sunHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,color:0xffc35d,transparent:true,opacity:.78,blending:THREE.AdditiveBlending}));sunHalo.scale.set(60,60,1);solar.add(sunHalo);
const planetData=[
 ['Mercury',15,.9,0x9f9284,88,.205],['Venus',22,1.5,0xd5b36a,224.7,.007],['Earth',30,1.65,0x4b78b8,365.25,.017],['Mars',39,1.2,0xb65c39,687,.093],['Jupiter',55,4.2,0xcaa77d,4331,.049],['Saturn',72,3.7,0xd9c08d,10747,.057],['Uranus',89,2.5,0x8fcbd0,30589,.046],['Neptune',105,2.4,0x496bb7,59800,.01]
];
const planets=[];
planetData.forEach((d,idx)=>{
  const [name,r,size,color,period,e]=d;
  const curve=new THREE.EllipseCurve(0,0,r,r*(1-e),0,Math.PI*2,false,0); const pts=curve.getPoints(180).map(p=>new THREE.Vector3(p.x,0,p.y));
  const orbit=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x9f8d67,transparent:true,opacity:.18})); solar.add(orbit);
  const pivot=new THREE.Group(); solar.add(pivot);
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(size,32,32),new THREE.MeshStandardMaterial({color,roughness:.8,metalness:.05})); mesh.position.x=r; pivot.add(mesh);
  if(name==='Saturn') { const ring=new THREE.Mesh(new THREE.RingGeometry(5,7.5,64),new THREE.MeshBasicMaterial({color:0xcab78d,side:THREE.DoubleSide,transparent:true,opacity:.48}));ring.rotation.x=Math.PI/2.4;mesh.add(ring); }
  planets.push({name,r,size,period,e,pivot,mesh,base:idx*.9});
});

const earthWorld = new THREE.Group(); earthWorld.visible=false; root.add(earthWorld);
const earth = new THREE.Mesh(new THREE.SphereGeometry(14,64,64),new THREE.MeshStandardMaterial({color:0x31577e,roughness:.85,metalness:.05})); earthWorld.add(earth);
const wire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(14.06,20,14)),new THREE.LineBasicMaterial({color:0xc6d0c9,transparent:true,opacity:.09})); earthWorld.add(wire);
const moonPivot=new THREE.Group();earthWorld.add(moonPivot);const moon=new THREE.Mesh(new THREE.SphereGeometry(3.7,32,32),new THREE.MeshStandardMaterial({color:0xb9b6ad,roughness:1}));moon.position.x=34;moonPivot.add(moon);
const tide=new THREE.Mesh(new THREE.SphereGeometry(14.65,64,64),new THREE.MeshBasicMaterial({color:0x6cb3d8,wireframe:true,transparent:true,opacity:.12}));tide.scale.set(1.08,1,1);earthWorld.add(tide);
scene.add(new THREE.DirectionalLight(0xf4e4be,2.4));

const forms = new THREE.Group(); forms.visible=false; root.add(forms);
function lineMaterial(op=.65){return new THREE.LineBasicMaterial({color:0xd9b76d,transparent:true,opacity:op});}
const dna=new THREE.Group();
for(let j=0;j<2;j++){
 const pts=[]; for(let i=0;i<120;i++){const t=i/119*Math.PI*8;pts.push(new THREE.Vector3(Math.cos(t+j*Math.PI)*9,(i-60)*.55,Math.sin(t+j*Math.PI)*9));}
 dna.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),lineMaterial(.75)));
}
for(let i=0;i<38;i++){const t=i/37*Math.PI*8,y=(i-18.5)*1.75;dna.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(Math.cos(t)*9,y,Math.sin(t)*9),new THREE.Vector3(-Math.cos(t)*9,y,-Math.sin(t)*9)]),lineMaterial(.25)));}
dna.position.x=-54;forms.add(dna);
const leaf=new THREE.Group();
for(let i=0;i<90;i++){const a=i*2.399963;const r=2.2*Math.sqrt(i);const m=new THREE.Mesh(new THREE.SphereGeometry(.65,12,12),new THREE.MeshBasicMaterial({color:i%3===0?0xd9b76d:0x79976a}));m.position.set(Math.cos(a)*r,Math.sin(a)*r,0);leaf.add(m);}leaf.position.x=0;forms.add(leaf);
const honey=new THREE.Group();
const hexShape=new THREE.Shape();for(let i=0;i<6;i++){const a=Math.PI/3*i;const x=Math.cos(a)*4,y=Math.sin(a)*4;i?hexShape.lineTo(x,y):hexShape.moveTo(x,y);}hexShape.closePath();
const hexGeo=new THREE.EdgesGeometry(new THREE.ShapeGeometry(hexShape));for(let q=-3;q<=3;q++)for(let r=-3;r<=3;r++){const h=new THREE.LineSegments(hexGeo,lineMaterial(.38));h.position.set((q+r/2)*7,(r)*6.05,0);honey.add(h);}honey.position.x=55;forms.add(honey);

const snow = new THREE.Group(); snow.visible=false; root.add(snow);
for(let arm=0;arm<6;arm++){
 const branch=new THREE.Group();
 const main=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0,62,0)]),lineMaterial(.9));branch.add(main);
 for(let y=13;y<58;y+=9){for(const side of [-1,1]){const twig=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,y,0),new THREE.Vector3(side*(8+(y%4)),y+10,0)]),lineMaterial(.65));branch.add(twig);}}
 branch.rotation.z=arm*Math.PI/3;snow.add(branch);
}

const sceneDefs=[
 {key:'galaxy',crumb:['Universe','Milky Way'],chapter:'I · The first descent',title:'A spiral of worlds',body:'Begin far enough away that the familiar becomes a pattern. Billions of stars gather into a rotating form, and one quiet point contains everything that follows.',metric:'Scale is the first instrument. Zooming changes not only what we see, but what relationships become audible.',camera:[0,130,900],look:[0,0,0],actions:[['Enter the solar system',1]]},
 {key:'solar',crumb:['Universe','Milky Way','Solar system'],chapter:'II · The celestial choir',title:'Eight moving voices',body:'Each planet follows an ellipse. Its speed changes continuously, so its voice bends rather than holding a single note. Scrub through time and listen to the chord rearrange itself.',metric:'Pitch follows orbital velocity. Rhythm follows orbital period. Ratios remain intact even when transposed into human hearing.',camera:[0,65,235],look:[0,0,0],actions:[['Hear Earth alone',2],['Freeze this chord','freeze']]},
 {key:'earth',crumb:['Solar system','Earth','Moon'],chapter:'III · A harmony with consequences',title:'The orbit becomes a tide',body:'Celestial geometry does not remain in the sky. The Moon pulls oceans into a repeating breath, turning an orbit into motion felt on Earth.',metric:'Orbit → gravity → tide → rhythm. One relationship, crossing scales.',camera:[0,22,92],look:[0,0,0],actions:[['Enter living forms',3],['Back to the planets',1]]},
 {key:'forms',crumb:['Earth','Living forms'],chapter:'IV · Forms that recur',title:'Nature composes by constraint',body:'A helix twists, leaves distribute themselves around a stem, circles press into hexagons. Harmony appears not as decoration, but as the shape that remains when forces negotiate.',metric:'DNA: paired rotation · Leaf: phyllotaxis · Honeycomb: circles becoming hexagons under pressure',camera:[0,0,150],look:[0,0,0],actions:[['Enter the snowflake',4],['Return to Earth',2]]},
 {key:'snow',crumb:['Earth','Water','Snowflake'],chapter:'V · Sixfold becoming',title:'No law repeats itself exactly',body:'A snow crystal obeys a sixfold symmetry, yet temperature and humidity write a singular history into every branch. Law and accident collaborate.',metric:'The same rule can produce uncountable forms. Harmony is not sameness. It is variation held inside constraint.',camera:[0,0,155],look:[0,0,0],actions:[['Return to the beginning',0],['Hear another date',1]]}
];

// Minimal generative audio: one oscillator per planet, continuously retuned.
let audioCtx, master, voices=[];
function initAudio(){
  audioCtx=new (window.AudioContext||window.webkitAudioContext)(); master=audioCtx.createGain(); master.gain.value=.075; master.connect(audioCtx.destination);
  voices=planetData.map((d,i)=>{const osc=audioCtx.createOscillator(),gain=audioCtx.createGain(),filter=audioCtx.createBiquadFilter();osc.type=i<4?'sine':'triangle';filter.type='lowpass';filter.frequency.value=700+i*110;gain.gain.value=0;osc.connect(filter).connect(gain).connect(master);osc.start();return{osc,gain};});
}
function setAudioScene(){ if(!audioCtx)return; voices.forEach((v,i)=>v.gain.gain.setTargetAtTime(currentScene===1?.018*(1-i*.045):currentScene===2&&i===2?.06:0,audioCtx.currentTime,.7)); }
function updateAudio(t){if(!audioCtx||!soundEnabled)return;planets.forEach((p,i)=>{const eccentricMod=1+p.e*Math.sin(t*.22+timeOffsetYears*.05+p.base);const ratio=(365.25/p.period)*eccentricMod;const hz=110*Math.pow(2,Math.log2(Math.max(.018,ratio))*0.43+i*.018);voices[i].osc.frequency.setTargetAtTime(Math.max(45,Math.min(850,hz)),audioCtx.currentTime,.08);});}

function setScene(index){
  currentScene=Math.max(0,Math.min(sceneDefs.length-1,index)); const d=sceneDefs[currentScene];
  targetCamera.set(...d.camera); targetLook.set(...d.look);
  galaxy.visible=d.key==='galaxy'; solar.visible=d.key==='solar'; earthWorld.visible=d.key==='earth'; forms.visible=d.key==='forms'; snow.visible=d.key==='snow';
  ui.chapter.textContent=d.chapter;ui.title.textContent=d.title;ui.body.textContent=d.body;ui.metric.textContent=d.metric;
  ui.actions.innerHTML='';d.actions.forEach(([label,target])=>{const b=document.createElement('button');b.textContent=label;b.onclick=()=>target==='freeze'?freezeChord():setScene(target);ui.actions.appendChild(b);});
  ui.breadcrumb.innerHTML=d.crumb.map((c,i)=>`<button class="${i===d.crumb.length-1?'current':''}" data-i="${Math.max(0,currentScene-(d.crumb.length-1-i))}">${c}</button>${i<d.crumb.length-1?'<span class="slash">/</span>':''}`).join('');
  ui.breadcrumb.querySelectorAll('button').forEach(b=>b.onclick=()=>setScene(Number(b.dataset.i)));
  [...ui.scaleNav.children].forEach((b,i)=>b.classList.toggle('active',i===currentScene));
  ui.datePanel.classList.toggle('hidden',currentScene!==1); setAudioScene();
}
function freezeChord(){ ui.metric.textContent='This instant has been held. Eight moving voices, briefly made into one object.'; }
sceneDefs.forEach((s,i)=>{const b=document.createElement('button');b.innerHTML=`<span>${s.key}</span>`;b.onclick=()=>setScene(i);ui.scaleNav.appendChild(b);});

function enter(){
  entered=true;ui.intro.classList.remove('active');ui.topbar.classList.remove('hidden');ui.panel.classList.remove('hidden');ui.hint.classList.remove('hidden');ui.scaleNav.classList.remove('hidden');
  if(!audioCtx)initAudio();audioCtx.resume();setScene(0);
}
document.querySelector('#enterButton').onclick=enter;
document.querySelector('#homeButton').onclick=()=>setScene(0);
document.querySelector('#soundButton').onclick=()=>{soundEnabled=!soundEnabled;document.querySelector('#soundButton').textContent=soundEnabled?'Sound on':'Sound off';if(master)master.gain.setTargetAtTime(soundEnabled?.075:0,audioCtx.currentTime,.2);};
ui.slider.oninput=e=>{timeOffsetYears=Number(e.target.value);updateDateReadout();};
function updateDateReadout(base=new Date('2026-07-18T12:00:00')){const d=new Date(base);d.setFullYear(d.getFullYear()+timeOffsetYears);ui.dateReadout.textContent=d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});}
document.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{
 const type=b.dataset.date;if(type==='birthday'){ui.birthdayEntry.classList.toggle('hidden');return;}
 ui.slider.value=0;timeOffsetYears=0;let d=type==='today'?new Date():type==='kepler'?new Date('1619-05-15T12:00:00'):new Date('2026-07-18T12:00:00');
 ui.dateReadout.textContent=d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
});
document.querySelector('#birthdayGo').onclick=()=>{const v=ui.birthdayInput.value;if(v){const d=new Date(v+'T12:00:00');ui.dateReadout.textContent=d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});ui.birthdayEntry.classList.add('hidden');}};

addEventListener('wheel',e=>{if(!entered||Math.abs(e.deltaY)<12)return; if(e.deltaY>0&&currentScene<4)setScene(currentScene+1);else if(e.deltaY<0&&currentScene>0)setScene(currentScene-1);},{passive:true});
addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowRight')setScene(currentScene+1);if(e.key==='ArrowUp'||e.key==='ArrowLeft')setScene(currentScene-1);});

function animate(){
 requestAnimationFrame(animate); const dt=clock.getDelta(),t=clock.elapsedTime;
 controls.target.lerp(targetLook,.045); camera.position.lerp(targetCamera,.035);controls.update();
 galaxy.rotation.y+=dt*.012;
 planets.forEach((p,i)=>{const speed=.6*Math.pow(365.25/p.period,.42);p.pivot.rotation.y=p.base+t*speed+timeOffsetYears*.16*Math.pow(365.25/p.period,.3);p.mesh.rotation.y+=dt*(.2+i*.04);});
 moonPivot.rotation.y=t*.16;tide.rotation.y=-t*.05;earth.rotation.y+=dt*.04;wire.rotation.y=earth.rotation.y;
 dna.rotation.y=t*.17;leaf.rotation.z=t*.045;honey.rotation.z=-t*.025;forms.rotation.y=Math.sin(t*.18)*.12;snow.rotation.z=t*.025;
 updateAudio(t); renderer.render(scene,camera);
}
setTimeout(()=>ui.loading.classList.add('hidden'),600);updateDateReadout();animate();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
