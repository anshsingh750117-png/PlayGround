import * as THREE from 'three';
import { makeRNG, rand, pick } from './utils.js';

const mat = (color, roughness=.8, extra={}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
const box = (w,h,d,m) => new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);

export class ViceportWorld {
  constructor(scene) {
    this.scene=scene; this.scene.background=new THREE.Color('#070b14'); this.rng=makeRNG(82341); this.colliders=[]; this.vehicles=[]; this.people=[]; this.markers=[]; this.treeSites=[];
    this.materials={road:mat('#202a35'),side:mat('#a3a99b'),grass:mat('#25483d'),water:mat('#126078',.25,{metalness:.2}),building:['#334452','#4b4c58','#615248','#3c5a5a','#555c70'].map(c=>mat(c)),window:mat('#50d9d4',.28,{emissive:'#145b60',emissiveIntensity:.35}),white:mat('#ded8c4'),yellow:mat('#dfb74c'),red:mat('#d55b53'),blue:mat('#4b9cbb'),black:mat('#161c25'),leaf:mat('#28715c'),leaf2:mat('#3d8061'),trunk:mat('#604a38'),sand:mat('#c5a978')};
    this.makeGround(); this.makeCity(); this.buildTrees(); this.makeLandmarks(); this.makeVehicles(); this.makePeople(); this.makeLights();
  }
  add(mesh,x,y,z,group=this.scene){mesh.position.set(x,y,z);group.add(mesh);return mesh;}
  makeGround(){const g=box(1400,.4,1400,this.materials.grass);g.receiveShadow=true;this.add(g,0,-.3,0);const sea=box(1400,.2,110,this.materials.water);this.add(sea,0,-.08,-665);}
  makeCity(){
    // A 1.2 km by 1.2 km city grid. Wide blocks leave room for parks and side streets.
    const spacing=75, extent=600, roadLen=1200, roadMat=this.materials.road, sidewalk=this.materials.side;
    for(let i=-8;i<=8;i++){
      const p=i*spacing;this.add(box(10,.08,roadLen,roadMat),p,.01,0);this.add(box(roadLen,.08,10,roadMat),0,.012,p);
      for(const s of [-1,1]){this.add(box(1.2,.15,roadLen,sidewalk),p+s*5.7,.07,0);this.add(box(roadLen,.15,1.2,sidewalk),0,.07,p+s*5.7);}
    }
    for(let i=-8;i<8;i++)for(let j=-8;j<8;j++){
      const cx=(i+.5)*spacing,cz=(j+.5)*spacing,rng=this.rng;
      const core=Math.abs(cx)<115&&Math.abs(cz)<115, coast=cz < -400, district=core?'core':coast?'coast':Math.abs(cx)>300?'residential':'mixed';
      const count=district==='core'?4:(district==='residential'?1:2);
      const slots=count===4?[[-17,-17],[17,-17],[-17,17],[17,17]]:count===2?[[-15,-13],[15,13]]:[[0,0]];
      for(const [sx,sz] of slots){
        const bx=cx+sx+rng.range(-2.5,2.5),bz=cz+sz+rng.range(-2.5,2.5),w=rng.range(8,13),d=rng.range(8,13);
        const h=district==='core'?rng.range(26,78):district==='mixed'?rng.range(10,34):rng.range(7,19);
        const b=box(w,h,d,rng.pick(this.materials.building));this.add(b,bx,h/2,bz);this.colliders.push({x:bx,z:bz,w,d,h});
        for(let yy=3;yy<h-1;yy+=4){const strip=box(w*.78,.35,.08,this.materials.window);this.add(strip,bx,yy,bz+d/2+.05);const side=box(.08,.35,d*.75,this.materials.window);this.add(side,bx+w/2+.05,yy,bz);}
        const roof=box(w*.25,1,d*.22,this.materials.black);this.add(roof,bx,h+.5,bz);
      }
      // Tree-lined blocks and pocket parks fill the gaps between buildings.
      if(rng.f()<.78){const n=district==='coast'?rng.int(2,4):rng.int(1,3);for(let k=0;k<n;k++)this.makeTree(cx+rng.range(-29,29),cz+rng.range(-29,29),district==='coast'&&rng.f()<.6);}
      if(rng.f()<.22){const lawn=box(18,.12,18,this.materials.grass);this.add(lawn,cx+rng.range(-22,22),.02,cz+rng.range(-22,22));}
    }
    // Sandy waterfront, palms, and a continuous coastal promenade.
    this.add(box(1200,.2,8,mat('#c7a978')),0,-.06,-547);
    this.add(box(1200,.18,4,mat('#bbb6a5')),0,.02,-537);
    for(let x=-570;x<=570;x+=24){this.makeTree(x,-563,true);if(x%48===0)this.makeTree(x+9,-526,true);}
    // A few planted boulevard medians make the long avenues read at a distance.
    for(let p=-525;p<=525;p+=150){for(const z of [-38,38])this.makeTree(p,z,false);}
  }
  makeTree(x,z,palm=false){this.treeSites.push({x,z,palm:palm||this.rng.f()<.28,scale:this.rng.range(.78,1.22),rotation:this.rng.range(0,Math.PI*2)});}
  buildTrees(){
    const sites=this.treeSites, broad=sites.filter(t=>!t.palm), palms=sites.filter(t=>t.palm), dummy=new THREE.Object3D();
    const addInstances=(geometry,material,count,build,castShadow=false)=>{if(!count)return;const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.castShadow=castShadow;mesh.receiveShadow=true;for(let i=0;i<count;i++){build(dummy,i);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}mesh.instanceMatrix.needsUpdate=true;this.scene.add(mesh);};
    const trunkGeo=new THREE.CylinderGeometry(.24,.38,4,7),crownGeo=new THREE.SphereGeometry(2.05,8,6),palmGeo=new THREE.ConeGeometry(.18,3.4,5);
    addInstances(trunkGeo,this.materials.trunk,sites.length,(o,i)=>{const t=sites[i],s=t.scale;o.position.set(t.x,t.palm?2.7*s:2*s,t.z);o.rotation.set(0,t.rotation,0);o.scale.set(s,t.palm?1.35*s:s,s);});
    addInstances(crownGeo,this.materials.leaf,broad.length*3,(o,i)=>{const t=broad[Math.floor(i/3)],k=i%3,s=t.scale,offsets=[[0,4.05,0],[-.9,3.55,.1],[.85,3.62,-.12]][k];o.position.set(t.x+offsets[0]*s,offsets[1]*s,t.z+offsets[2]*s);o.rotation.set(0,t.rotation+k*.7,0);o.scale.set(k===0?1.08:.78,k===0?1:.76,k===0?1.08:.82);});
    addInstances(palmGeo,this.materials.leaf2,palms.length*7,(o,i)=>{const t=palms[Math.floor(i/7)],a=(i%7)/7*Math.PI*2+t.rotation,s=t.scale;o.position.set(t.x+Math.sin(a)*.45*s,5.25*s,t.z+Math.cos(a)*.45*s);o.rotation.set(Math.cos(a)*.9,0,Math.sin(a)*.9);o.scale.set(s,.82*s,s);});
  }
  makeLandmarks(){
    const mark=(name,x,z,color)=>{const g=new THREE.Group(),base=new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.3,.4,16),mat(color,.3,{emissive:color,emissiveIntensity:.8}));base.position.y=.2;g.add(base);const beam=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,8,8),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.2}));beam.position.y=4;g.add(beam);g.position.set(x,.2,z);this.scene.add(g);this.markers.push({name,x,z,obj:g});};
    const labels=[['SABLE · FIRST CONTACT',8,6,'#ffcb5c'],['MAMA C · LITTLE HAVANA',-114,76,'#43f0d0'],['WRENCH · IRONWORKS',130,0,'#ff3d81'],['SAFEHOUSE · SOLANO',-76,-114,'#64ff9b'],['DOCKS · JOB BOARD',-76,152,'#ffc857'],['AIRFIELD · KINSPORT',152,-152,'#b49cff']];labels.forEach(a=>mark(...a));
    const tower=box(18,96,18,mat('#243443'));this.add(tower,0,48,0);const beacon=box(19,1,19,mat('#46d9d1',.3,{emissive:'#46d9d1',emissiveIntensity:2}));this.add(beacon,0,96,0);
  }
  makeCar(x,z,color,police=false){const g=new THREE.Group(),body=box(2.2,.72,4,mat(color,.4,{metalness:.3}));body.position.y=.75;g.add(body);const cab=box(1.65,.7,1.8,mat(police?'#b8c5cb':'#18232b',.25,{metalness:.2}));cab.position.set(0,1.38,-.1);g.add(cab);
    for(const xx of [-1,1])for(const zz of [-1.25,1.25]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.22,10),mat('#11151a'));wheel.rotation.z=Math.PI/2;wheel.position.set(xx,.4,zz);g.add(wheel);}
    if(police){const l=box(.8,.16,.35,mat('#267bff',.2,{emissive:'#135cff',emissiveIntensity:1.5}));l.position.set(0,1.8,0);g.add(l);}
    this.scene.add(g);const v={obj:g,x,z,yaw:0,speed:0,health:100,police,occupied:false,name:police?'VCPD Cruiser':pick(['Calypso GT','Solano LX','Mariner SUV','Porter Compact'])};this.vehicles.push(v);return v;
  }
  makeVehicles(){const starter=this.makeCar(-4,12,'#25cbbd');starter.name='Solano LX';starter.speed=0;for(let i=0;i<76;i++){const road=this.rng.int(-8,8)*75,cross=this.rng.range(-550,550),vertical=this.rng.f()>.5,v=this.makeCar(vertical?road:cross,vertical?cross:road,this.rng.pick(['#e4e6d9','#c04b57','#d0a63e','#387d9a','#333d49']));v.yaw=vertical?0:Math.PI/2;v.obj.rotation.y=v.yaw;v.speed=this.rng.range(2,5);}for(let i=0;i<3;i++){const v=this.makeCar(-150+i*12,130,'#dedede',true);v.yaw=Math.PI/2;v.obj.rotation.y=v.yaw;}}
  makePerson(x,z){const g=new THREE.Group(),body=box(.55,1,.35,mat(pick(['#e95770','#e8c85b','#62c3aa','#5779d5','#d7d9de'])));body.position.y=1.1;g.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.24,8,6),mat('#bd8d69'));head.position.y=1.78;g.add(head);this.scene.add(g);this.people.push({obj:g,x,z,dir:rand(0,Math.PI*2),speed:rand(.4,1),panic:0});}
  makePeople(){for(let i=0;i<150;i++){const x=rand(-550,550),z=rand(-510,550);if(Math.abs(x%75)>8&&Math.abs(z%75)>8)this.makePerson(x,z);}}
  makeLights(){const ambient=new THREE.HemisphereLight('#a9c7dd','#25313b',1.25);this.scene.add(ambient);const sun=new THREE.DirectionalLight('#ffd8a1',2.2);sun.position.set(-80,120,40);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);this.scene.add(sun);this.sun=sun;this.ambient=ambient;}
  update(dt,time,player){for(const p of this.people){if(p.panic>0)p.panic-=dt;else if(Math.random()<dt*.35)p.dir+=rand(-1,1);p.x+=Math.sin(p.dir)*p.speed*dt;p.z+=Math.cos(p.dir)*p.speed*dt;p.obj.position.set(p.x,0,p.z);p.obj.rotation.y=p.dir;}
    for(const v of this.vehicles){if(v.occupied||v.police)continue;if(Math.abs(v.speed)>.1){v.x+=Math.sin(v.yaw)*v.speed*dt;v.z+=Math.cos(v.yaw)*v.speed*dt;if(Math.abs(v.x)>585||Math.abs(v.z)>585)v.speed*=-1;v.obj.position.set(v.x,0,v.z);}}
    const daylight=(Math.sin(time*.015-.6)+1)/2;this.sun.intensity=.45+daylight*2;this.ambient.intensity=.35+daylight*1.1;this.scene.background.setRGB(.025+daylight*.23,.045+daylight*.36,.1+daylight*.5);
  }
}
