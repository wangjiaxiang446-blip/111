(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.LightPathPhysics=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const EPS=1e-6, WIDTH=900, HEIGHT=500;
  const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y});
  const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
  const scale=(a,k)=>({x:a.x*k,y:a.y*k});
  const dot=(a,b)=>a.x*b.x+a.y*b.y;
  const cross=(a,b)=>a.x*b.y-a.y*b.x;
  const length=a=>Math.hypot(a.x,a.y);
  const normalize=a=>{const n=length(a)||1;return{x:a.x/n,y:a.y/n};};
  const rad=d=>d*Math.PI/180;
  const deg=r=>r*180/Math.PI;
  function normalizeAngle(angle){while(angle>90)angle-=180;while(angle<=-90)angle+=180;return angle;}
  function angleDelta(from,to){let d=normalizeAngle(to)-normalizeAngle(from);while(d>90)d-=180;while(d<-90)d+=180;return d;}
  function direction(angle){return{x:Math.cos(rad(angle)),y:Math.sin(rad(angle))};}
  function reflect(v,mirrorAngle){const m=direction(mirrorAngle),k=2*dot(v,m);return normalize({x:k*m.x-v.x,y:k*m.y-v.y});}
  function solutionAngle(from,pivot,to){const incoming=normalize(sub(pivot,from)),outgoing=normalize(sub(to,pivot));return normalizeAngle(deg(Math.atan2(incoming.y+outgoing.y,incoming.x+outgoing.x)));}
  function raySegment(origin,dir,a,b){const s=sub(b,a),den=cross(dir,s);if(Math.abs(den)<EPS)return null;const ao=sub(a,origin),t=cross(ao,s)/den,u=cross(ao,dir)/den;return t>EPS&&u>=-EPS&&u<=1+EPS?{t,point:add(origin,scale(dir,t))}:null;}
  function rayCircle(origin,dir,circle){const oc=sub(origin,circle),b=2*dot(oc,dir),c=dot(oc,oc)-circle.r*circle.r,disc=b*b-4*c;if(disc<0)return null;const root=Math.sqrt(disc),values=[(-b-root)/2,(-b+root)/2].filter(t=>t>EPS);if(!values.length)return null;const t=Math.min(...values);return{t,point:add(origin,scale(dir,t))};}
  function rayRect(origin,dir,rect){let tmin=-Infinity,tmax=Infinity;for(const axis of ['x','y']){const min=rect[axis],max=rect[axis]+rect[axis==='x'?'w':'h'];if(Math.abs(dir[axis])<EPS){if(origin[axis]<min||origin[axis]>max)return null;}else{let t1=(min-origin[axis])/dir[axis],t2=(max-origin[axis])/dir[axis];if(t1>t2)[t1,t2]=[t2,t1];tmin=Math.max(tmin,t1);tmax=Math.min(tmax,t2);if(tmin>tmax)return null;}}const t=tmin>EPS?tmin:(tmax>EPS?tmax:null);return t===null?null:{t,point:add(origin,scale(dir,t))};}
  function mirrorEnds(mirror,angle){const d=direction(angle),half=mirror.length/2;return{a:add(mirror,scale(d,-half)),b:add(mirror,scale(d,half))};}
  function rayToBounds(origin,dir){const candidates=[];if(dir.x>EPS)candidates.push((WIDTH-origin.x)/dir.x);if(dir.x<-EPS)candidates.push((0-origin.x)/dir.x);if(dir.y>EPS)candidates.push((HEIGHT-origin.y)/dir.y);if(dir.y<-EPS)candidates.push((0-origin.y)/dir.y);const t=Math.min(...candidates.filter(v=>v>EPS));return{t,point:add(origin,scale(dir,t))};}
  function nearest(origin,dir,objects){let best=null;for(const object of objects){let hit=null;if(object.type==='mirror'){const ends=mirrorEnds(object,object.angle);hit=raySegment(origin,dir,ends.a,ends.b);}else if(object.type==='target')hit=rayCircle(origin,dir,{x:object.x,y:object.y,r:object.r});else if(object.type==='obstacle')hit=rayRect(origin,dir,object);if(hit&&(!best||hit.t<best.t))best={...hit,object};}return best;}
  function distanceToRay(point,origin,dir){const t=Math.max(0,dot(sub(point,origin),dir));return length(sub(point,add(origin,scale(dir,t))));}
  const levels=[
    {id:1,name:'基础反射',difficulty:'简单',difficultyStars:1,mirrors:[{x:420,y:260,length:170}],source:{x:90,y:130},target:{x:760,y:150,r:46},obstacles:[],initialOffsets:[12],thresholds:[4,8],objective:'调整镜面，让反射光线照到目标。',hint:'观察镜面转动时反射光线的变化，试着让它逐渐靠近目标。',success:'你已经掌握了基本的单次反射。'},
    {id:2,name:'绕过障碍',difficulty:'较简单',difficultyStars:2,mirrors:[{x:360,y:380,length:170}],source:{x:80,y:120},target:{x:790,y:120,r:38},obstacles:[{x:420,y:82,w:185,h:76,label:'遮挡物'}],initialOffsets:[-18],thresholds:[5,10],objective:'直接照射行不通，试着利用镜面改变光路。',hint:'先观察障碍物的位置。你需要利用镜面，让反射光线绕开障碍。',success:'反射可以帮助我们改变光的传播方向。'},
    {id:3,name:'精准命中',difficulty:'中等',difficultyStars:3,mirrors:[{x:430,y:220,length:150}],source:{x:90,y:380},target:{x:800,y:100,r:19},obstacles:[],initialOffsets:[31],thresholds:[6,12],objective:'缩小的目标需要更细致的镜面调整。',hint:'接近目标以后不要大幅转动镜子，尝试小角度微调。',success:'镜面方向的细微变化，也会改变反射光线的方向。'},
    {id:4,name:'二次反射',difficulty:'较难',difficultyStars:4,mirrors:[{x:310,y:300,length:160},{x:600,y:160,length:160}],source:{x:80,y:360},target:{x:830,y:340,r:30},obstacles:[],initialOffsets:[26,-24],thresholds:[9,16],objective:'先让光到达镜子2，再想办法照亮目标。',hint:'先解决第一段光路：让镜子1把光准确反射到镜子2，再调整镜子2。',success:'光可以经过多个镜面连续改变传播方向。'},
    {id:5,name:'终极挑战',difficulty:'困难',difficultyStars:5,mirrors:[{x:290,y:330,length:150},{x:610,y:130,length:150}],source:{x:70,y:420},target:{x:835,y:360,r:21},obstacles:[{x:385,y:335,w:150,h:72,label:'遮挡物'}],initialOffsets:[-34,29],thresholds:[11,19],objective:'用两面镜子避开障碍，让光最终到达小目标。',hint:'把复杂问题分成两步：先让光到达第二面镜子，再考虑怎样避开障碍并命中目标。',success:'终极挑战完成！'}
  ];
  levels.forEach(level=>{const points=[level.source,...level.mirrors,level.target];level.solutionAngles=level.mirrors.map((m,i)=>solutionAngle(points[i],m,points[i+2]));level.initialAngles=level.solutionAngles.map((a,i)=>normalizeAngle(a+level.initialOffsets[i]));});
  function traceLevel(level,angles){
    const mirrors=level.mirrors.map((m,i)=>({...m,type:'mirror',id:i+1,angle:angles[i]}));
    const obstacles=level.obstacles.map((o,i)=>({...o,type:'obstacle',id:i+1}));
    const target={...level.target,type:'target'};
    const segments=[];let origin={...level.source};let dir=normalize(sub(level.mirrors[0],origin));let hitCount=0,blocked=false,status='';
    for(let stage=0;stage<=level.mirrors.length;stage++){
      const objects=[...obstacles,target];if(stage<mirrors.length)objects.push(mirrors[stage]);
      const collision=nearest(origin,dir,objects);const end=collision?collision.point:rayToBounds(origin,dir).point;
      segments.push({from:{...origin},to:end,dir:{...dir},kind:stage===0?'incident':'reflected',stage,collision:collision?collision.object.type:'bounds'});
      if(!collision){status=stage===0?'入射光线没有到达镜面。':'继续调整镜面方向。';break;}
      if(collision.object.type==='obstacle'){blocked=true;status='光线被障碍挡住了。';break;}
      if(collision.object.type==='target'){status=stage===mirrors.length?'hit':'光线直接到达了目标，还需要按关卡要求使用镜面。';break;}
      if(collision.object.type==='mirror'){
        hitCount++;dir=reflect(dir,collision.object.angle);origin=add(collision.point,scale(dir,.08));
        if(stage===0&&mirrors.length===2)status='第一次反射已经到达镜子2，继续调整镜子2。';
      }
    }
    const last=segments[segments.length-1];const nearDistance=last?distanceToRay(level.target,last.from,last.dir):Infinity;
    const hit=status==='hit'&&hitCount===level.mirrors.length;
    if(hit)status='成功命中目标。';else if(!blocked&&level.mirrors.length===2&&hitCount<2)status='第一次反射还没有到达镜子2。';else if(!blocked&&nearDistance<level.target.r+42)status='已经很接近目标了，再微调一下。';
    return{segments,hit,blocked,hitCount,nearDistance,status,angles:[...angles]};
  }
  function referencePath(level){return[level.source,...level.mirrors,level.target].map(p=>({x:p.x,y:p.y}));}
  function validateLevel(level){const trace=traceLevel(level,level.solutionAngles);return{level:level.id,valid:trace.hit&&!trace.blocked,hit:trace.hit,blocked:trace.blocked,hitCount:trace.hitCount,solutionAngles:level.solutionAngles.map(a=>Number(a.toFixed(4))),segments:trace.segments};}
  return{WIDTH,HEIGHT,levels,normalizeAngle,angleDelta,direction,reflect,solutionAngle,raySegment,rayCircle,rayRect,mirrorEnds,traceLevel,referencePath,validateLevel};
});