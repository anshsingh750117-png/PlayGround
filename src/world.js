import * as THREE from 'three';
import { makeRNG, rand, pick } from './utils.js';

const mat = (color, roughness=.8, extra={}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
const box = (w,h,d,m) => new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);

export class ViceportWorld {
  constructor(scene) {
    this.scene=scene; this.scene.background=new THREE.Color('#070b14'); this.rng=makeRNG(82341); this.colliders=[]; this.vehicles=[]; this.people=[]; this.markers=[];
    this.materials={road:mat('#202a35'),side:mat('#a3a99b'),grass:mat('#25483d'),water:mat('#126078',.25,{metalness:.2}),building: ['#334452','#4b4c58','#615248','#3c5a5a','#555c70'].map(c=>mat(c)),window:mat('#50d9d4',.28,{emissive:'#145b60',emissiveIntensity:.35}),white:mat('#ded8c4'),yellow:mat('#dfb74c'),red:mat('#d55b53'),blue:mat('#4b9cbb'),black:mat('#161c25'),leaf:mat('#28715c'),trunk:mat('#604a38')};
    this.makeGround(); this.makeCity(); this.makeLandmarks(); this.makeVehicles(); this.makePeople(); this.makeLights();
  }
  add(mesh,x,y,z,group=this.scene){mesh.position.set(x,y,z);group.add(mesh);return mesh;}
  makeGround(){const g=box(500,.4,500,this.materials.grass);this.add(g,0,-.3,0);const sea=box(500,.2,85,this.materials.water);this.add(sea,0,-.08,-205);}
  makeCity(){
    // Seamless 1.2 km city grid; broad avenues, neighborhood blocks and coastal promenade.
    const roadMat=this.materials.road, sidewalk=this.materials.side;
    for(let i=-5;i<=5;i++){
      const p=i*38; let r=box(9,.08,420,roadMat);this.add(r,p,.01,0);let r2=box(420,.08,9,roadMat);this.add(r2,0,.012,p);
      for(const s of [-1,1]){this.add(box(1,.15,420,sidewalk),p+s*5,.07,0);this.add(box(420,.15,1,sidewalk),0,.07,p+s*5);}
      if(i>-5&&i<5) for(let j=-5;j<5;j++){
        const x=p+19,z=j*38+19, rng=this.rng, district=(Math.abs(x)<60&&Math.abs(z)<60)?'core':Math.abs(z)>140?'coast':Math.abs(x)>115?'residential':'mixed';
        const count=district==='core'?4:2;
        for(let k=0;k<count;k++){
          const bx=x+rng.range(-12,12),bz=z+rng.range(-12,12),w=rng.range(7,13),d=rng.range(7,13);
          const h=district==='core'?rng.range(24,78):district==='mixed'?rng.range(10,32):rng.range(7,18);
          const b=box(w,h,d,rng.pick(this.materials.building));this.add(b,bx,h/2,bz);this.colliders.push({x:bx,z:bz,w,d,h});
          for(let yy=3;yy<h-1;yy+=4){const strip=box(w*.78,.35,.08,this.materials.window);this.add(strip,bx,yy,bz+d/2+.05);const strip2=box(.08,.35,d*.75,this.materials.window);this.add(strip2,bx+w/2+.05,yy,bz);}
          const roof=box(w*.25,1,d*.22,this.materials.black);this.add(roof,bx,h+.5,bz);
        }
        if(rng.f()<.42) this.makeTree(x+rng.range(-13,13),z+rng.range(-13,13));
      }
    }
    // Beach + promenade and park islands
    for(let i=0;i<30;i++){const x=-190+i*13;const sand=box(12,.16,25,mat('#c5a978'));this.add(sand,x,-.05,-178);this.makeTree(x+4,-166);}
  }
  makeTree(x,z){const t=new THREE.Group();t.add(box(.8,4,.8,this.materials.trunk));const crown=new THREE.Mesh(new THREE.SphereGeometry(2.4,7,6),this.materials.leaf);crown.position.y=3.5;t.add(crown);this.add(t,x,1.8,z);}
  makeLandmarks(){
    const mark=(name,x,z,color)=>{let g=new THREE.Group();const base=new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.3,.4,16),mat(color,.3,{emissive:color,emissiveIntensity:.8}));base.position.y=.2;g.add(base);const beam=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,8,8),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.2}));beam.position.y=4;g.add(beam);g.position.set(x,.2,z);this.scene.add(g);this.markers.push({name,x,z,obj:g});};
    const labels=[['SABLE · FIRST CONTACT',8,6,'#ffcb5c'],['MAMA C · LITTLE HAVANA',-114,76,'#43f0d0'],['WRENCH · IRONWORKS',130,0,'#ff3d81'],['SAFEHOUSE · SOLANO',-76,-114,'#64ff9b'],['DOCKS · JOB BOARD',-76,152,'#ffc857'],['AIRFIELD · KINSPORT',152,-152,'#b49cff']];labels.forEach(a=>mark(...a));
    // skyline landmark: port tower and lit sign
    const tower=box(18,96,18,mat('#243443'));this.add(tower,0,48,0);const beacon=box(19,1,19,mat('#46d9d1',.3,{emissive:'#46d9d1',emissiveIntensity:2}));this.add(beacon,0,96,0);
  }
  makeCar(x,z,color,police=false){const g=new THREE.Group();const body=box(2.2,.72,4,mat(color,.4,{metalness:.3}));body.position.y=.75;g.add(body);const cab=box(1.65,.7,1.8,mat(police?'#b8c5cb':'#18232b',.25,{metalness:.2}));cab.position.set(0,1.38,-.1);g.add(cab);
    for(const xx of [-1,1])for(const zz of [-1.25,1.25]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.22,10),mat('#11151a'));wheel.rotation.z=Math.PI/2;wheel.position.set(xx, .4, zz);g.add(wheel);}
    if(police){const l=box(.8,.16,.35,mat('#267bff',.2,{emissive:'#135cff',emissiveIntensity:1.5}));l.position.set(0,1.8,0);g.add(l);}
    this.scene.add(g);const v={obj:g,x,z,yaw:0,speed:0,health:100,police,occupied:false,name:police?'VCPD Cruiser':pick(['Calypso GT','Solano LX','Mariner SUV','Porter Compact'])};this.vehicles.push(v);return v;
  }
  makeVehicles(){for(let i=0;i<40;i++){const road=this.rng.int(-5,5)*38, cross=this.rng.range(-180,180);const vertical=this.rng.f()>.5;const v=this.makeCar(vertical?road:cross,vertical?cross:road,this.rng.pick(['#e4e6d9','#c04b57','#d0a63e','#387d9a','#333d49']));v.yaw=vertical?0:Math.PI/2;v.obj.rotation.y=v.yaw;v.speed=this.rng.range(2,5);} for(let i=0;i<3;i++){const v=this.makeCar(-150+i*12,130,'#dedede',true);v.yaw=Math.PI/2;v.obj.rotation.y=v.yaw;}}
  makePerson(x,z){const g=new THREE.Group();const body=box(.55,1,.35,mat(pick(['#e95770','#e8c85b','#62c3aa','#5779d5','#d7d9de'])));body.position.y=1.1;g.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.24,8,6),mat('#bd8d69'));head.position.y=1.78;g.add(head);this.scene.add(g);this.people.push({obj:g,x,z,dir:rand(0,Math.PI*2),speed:rand(.4,1),panic:0});}
  makePeople(){for(let i=0;i<55;i++){const x=rand(-180,180),z=rand(-180,180);if(Math.abs(x%38)<7||Math.abs(z%38)<7)this.makePerson(x,z);}}
  makeLights(){const ambient=new THREE.HemisphereLight('#a9c7dd','#25313b',1.25);this.scene.add(ambient);const sun=new THREE.DirectionalLight('#ffd8a1',2.2);sun.position.set(-80,120,40);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);this.scene.add(sun);this.sun=sun;this.ambient=ambient;}
  update(dt,time,player){for(const p of this.people){if(p.panic>0)p.panic-=dt;else if(Math.random()<dt*.35)p.dir+=rand(-1,1);p.x+=Math.sin(p.dir)*p.speed*dt;p.z+=Math.cos(p.dir)*p.speed*dt;p.obj.position.set(p.x,0,p.z);p.obj.rotation.y=p.dir;}
    for(const v of this.vehicles){if(v.occupied)continue;if(v.police)continue;if(Math.abs(v.speed)>0.1){v.x+=Math.sin(v.yaw)*v.speed*dt;v.z+=Math.cos(v.yaw)*v.speed*dt;v.obj.position.set(v.x,0,v.z);}}
    const daylight=(Math.sin(time*.015-.6)+1)/2;this.sun.intensity=.45+daylight*2;this.ambient.intensity=.35+daylight*1.1;this.scene.background.setRGB(.025+daylight*.23,.045+daylight*.36,.1+daylight*.5);
  }
}
