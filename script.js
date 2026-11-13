(() => {
  'use strict';
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const pages = ['home','intro','lesson','lab','challenge','quiz','summary'];
  const state = { page: 'home', visited: new Set(['home']), labDone: false, tasks: [false,false], quizAnswers: [], sound: false };
  const narrations = [
    '夜晚，小明在桌子下面发现了掉落的钥匙。他打开手电筒，光束沿直线向前照去，却被桌面挡住了。钥匙仍然藏在阴影里。光不能自己拐弯，小明有些困惑：怎样才能让光绕过障碍，照亮钥匙呢？',
    '小明想到了一面镜子。他把镜子放在光束前，黄色的入射光线先射到镜面。光到达镜面后改变方向，形成青色的反射光线。轻轻转动镜子，反射光线的方向也随之变化。调整到合适角度，光终于照到了钥匙。原来，镜面可以改变光的传播方向。',
    '现在仔细观察反射发生的位置。射向镜面的黄色光线叫入射光线，离开镜面的青色光线叫反射光线。经过入射点、并且垂直于镜面的虚线叫法线。入射光线与法线的夹角是入射角，反射光线与法线的夹角是反射角。注意，两个角都是从法线量起，不是从镜面量起。',
    '我们来总结光的反射定律。第一，反射光线、入射光线和法线在同一平面内。第二，反射光线和入射光线分居法线两侧。第三，也是最重要的一点，反射角等于入射角，写作反射角 r 等于入射角 i。记住这三个要点。现在，亲自调整镜子试一试吧！'
  ];
  const captions = narrations;
  let toastTimer;
  function showToast(text){ const el=$('#toast'); el.textContent=text; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2200); }
  function go(page){
    if(!pages.includes(page)) return;
    if(state.page==='lesson'&&page!=='lesson'&&playing){playing=false;cancelAnimationFrame(lessonFrame);sceneCanvas.classList.remove('scene-running');pauseNarration();$('#playLesson').textContent='▶ 继续';}
    $$('.page').forEach(p=>p.classList.toggle('active',p.id===page));
    state.page=page; state.visited.add(page);
    $$('.step-nav button').forEach((b,i)=>{const target=b.dataset.go;b.classList.toggle('active',target===page);b.classList.toggle('done',state.visited.has(target)&&target!==page);});
    $('#courseProgress').style.width=`${((pages.indexOf(page)+1)/pages.length)*100}%`;
    $('#stepNav').classList.remove('open'); $('#navToggle').setAttribute('aria-expanded','false');
    window.scrollTo({top:0,behavior:'smooth'});
    if(page==='intro') playIntro();
    if(page==='lab') requestAnimationFrame(()=>updateLab(labAngle));
    if(page==='challenge') requestAnimationFrame(()=>{updateChallenge(Number($('#challengeRange').value));if(window.lightPathChallenge)window.lightPathChallenge.showHub();});
    if(location.hash!==`#${page}`) history.replaceState(null,'',`#${page}`);
  }
  $$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
  $('#navToggle').addEventListener('click',()=>{const open=$('#stepNav').classList.toggle('open');$('#navToggle').setAttribute('aria-expanded',String(open));});
  const goals=$('#goalsDialog'), knowledge=$('#knowledgeDialog');
  $('#openGoals').addEventListener('click',()=>goals.showModal());
  $('#openKnowledge').addEventListener('click',()=>knowledge.showModal());
  $$('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
  $$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close();}));

  let introTimers=[];
  function playIntro(){
    introTimers.forEach(clearTimeout); introTimers=[];
    const visual=$('.story-visual'); visual.classList.remove('playing'); void visual.offsetWidth; visual.classList.add('playing');
    const steps=$$('.story-steps li'), status=$('#storyStatus');
    const updates=[
      ['1','小明开始寻找','手电筒发出一束光。'],['2','光线受阻','光沿直线传播，被桌面挡住。'],['3','镜子出现','镜面可以改变光的传播方向。'],['4','轮到你思考','怎样把光准确地照到钥匙？']
    ];
    updates.forEach((u,i)=>introTimers.push(setTimeout(()=>{steps.forEach((s,j)=>s.classList.toggle('on',j===i));status.innerHTML=`<span>${u[0]}</span><p><b>${u[1]}</b>${u[2]}</p>`;},i*1200)));
  }
  $('#replayIntro').addEventListener('click',playIntro);

  let scene=0, playing=false, lessonStart=0, elapsed=0, lessonFrame=0;
  let narrationMode='none', narrationToken=0, currentUtterance=null;
  const sceneDuration=30000, totalDuration=sceneDuration*4;
  const narrationAudio=$('#narrationAudio'), sceneCanvas=$('#sceneCanvas');
  const audioAvailability=new Map(); let audioDirectoryListing=null;
  function stopNarration(){
    narrationToken++; narrationMode='none'; currentUtterance=null;
    narrationAudio.pause(); narrationAudio.removeAttribute('src'); narrationAudio.load();
    if('speechSynthesis' in window) speechSynthesis.cancel();
  }
  function speakFallback(){
    if(!state.sound||!playing||!('speechSynthesis' in window)) return;
    try{
      currentUtterance=new SpeechSynthesisUtterance(narrations[scene]); currentUtterance.lang='zh-CN'; currentUtterance.rate=.92;
      narrationMode='speech'; speechSynthesis.cancel(); speechSynthesis.speak(currentUtterance); updateSoundLabel('浏览器朗读');
    }catch(_){ narrationMode='none'; updateSoundLabel('字幕模式'); }
  }
  async function hasLocalAudio(index){
    if(audioAvailability.has(index)) return audioAvailability.get(index);
    try{
      if(location.protocol==='file:'){audioAvailability.set(index,false);return false;}
      if(audioDirectoryListing===null){const response=await fetch('assets/audio/',{cache:'no-store'});audioDirectoryListing=response.ok?await response.text():'';}
      const exists=new RegExp(`(?:href=["'][^"']*)?scene${index+1}\\.mp3(?:[?"'#<]|$)`,'i').test(audioDirectoryListing);
      audioAvailability.set(index,exists); return exists;
    }catch(_){ audioAvailability.set(index,false); return false; }
  }
  function updateSoundLabel(text){ if(state.sound){$('#soundIcon').textContent='🔊';$('#soundText').textContent=text||'声音开启';}else{$('#soundIcon').textContent='🔇';$('#soundText').textContent='字幕模式';} }
  async function startNarration(offsetSeconds=0){
    stopNarration(); if(!state.sound||!playing)return;
    const token=++narrationToken, targetScene=scene;
    if(await hasLocalAudio(targetScene)){
      if(token!==narrationToken||targetScene!==scene||!state.sound||!playing)return;
      narrationAudio.src=`assets/audio/scene${targetScene+1}.mp3`; narrationAudio.currentTime=Math.max(0,offsetSeconds);
      try{ await narrationAudio.play(); narrationMode='audio'; updateSoundLabel('本地音频'); }
      catch(_){ if(token===narrationToken) speakFallback(); }
    }else if(token===narrationToken) speakFallback();
  }
  function pauseNarration(){ if(narrationMode==='audio') narrationAudio.pause(); else if(narrationMode==='speech'&&'speechSynthesis' in window) speechSynthesis.pause(); }
  function resumeNarration(){
    if(!state.sound)return;
    if(narrationMode==='audio') narrationAudio.play().catch(()=>speakFallback());
    else if(narrationMode==='speech'&&'speechSynthesis' in window) speechSynthesis.resume();
    else startNarration((elapsed%sceneDuration)/1000);
  }
  function restartSceneAnimation(){
    const active=$('.scene.active'); if(!active)return;
    active.classList.remove('active'); void active.getBoundingClientRect(); active.classList.add('active');
  }
  function setScene(i, manual=true){
    const next=Math.max(0,Math.min(3,i)); stopNarration(); scene=next;
    $$('.scene').forEach((s,j)=>s.classList.toggle('active',j===scene));
    $$('.scene-list>button').forEach((b,j)=>b.classList.toggle('active',j===scene));
    $('#sceneNumber').textContent=scene+1; $('#lessonCaption').textContent=captions[scene];
    if(manual){elapsed=scene*sceneDuration;updateLessonUi();restartSceneAnimation();}
    if(state.sound&&playing) startNarration(0);
  }
  function updateLessonUi(){
    $('#lessonProgress').style.width=`${Math.min(100,(elapsed/totalDuration)*100)}%`;
    const secs=Math.floor(elapsed/1000);$('#lessonClock').textContent=`${String(Math.floor(secs/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`;
  }
  function tick(now){
    if(!playing)return;
    elapsed=Math.min(totalDuration,elapsed+(now-lessonStart));lessonStart=now;
    const nextScene=Math.min(3,Math.floor(elapsed/sceneDuration));if(nextScene!==scene)setScene(nextScene,false);
    updateLessonUi();
    if(elapsed>=totalDuration){playing=false;sceneCanvas.classList.remove('scene-running');stopNarration();$('#playLesson').textContent='▶ 重新播放';showToast('动画讲解播放完成');return;}
    lessonFrame=requestAnimationFrame(tick);
  }
  function toggleLesson(){
    if(elapsed>=totalDuration){elapsed=0;setScene(0,false);}
    playing=!playing;$('#playLesson').textContent=playing?'Ⅱ 暂停':'▶ 继续';sceneCanvas.classList.toggle('scene-running',playing);
    if(playing){lessonStart=performance.now();lessonFrame=requestAnimationFrame(tick);resumeNarration();}else{cancelAnimationFrame(lessonFrame);pauseNarration();}
  }
  $('#playLesson').addEventListener('click',toggleLesson);
  $('#restartLesson').addEventListener('click',()=>{playing=false;cancelAnimationFrame(lessonFrame);sceneCanvas.classList.remove('scene-running');elapsed=0;setScene(0,false);restartSceneAnimation();updateLessonUi();$('#playLesson').textContent='▶ 播放';});
  $('#prevScene').addEventListener('click',()=>setScene(scene-1));$('#nextScene').addEventListener('click',()=>setScene(scene+1));
  $$('.scene-list>button').forEach(b=>b.addEventListener('click',()=>setScene(Number(b.dataset.scene))));
  $('#soundToggle').addEventListener('click',()=>{state.sound=!state.sound;$('#soundToggle').setAttribute('aria-pressed',String(state.sound));updateSoundLabel();if(!state.sound)stopNarration();else if(playing)startNarration((elapsed%sceneDuration)/1000);showToast(state.sound?'声音已开启：优先本地MP3，缺失时使用浏览器朗读':'已切换为静音字幕模式');});
  setScene(0,false);

  const P={source:{x:115,y:120},pivot:{x:480,y:250},target:{x:820,y:130},targetR:38};
  let labAngle=28, dragging=false;
  const rad=d=>d*Math.PI/180, deg=r=>r*180/Math.PI;
  const normAngle=a=>{while(a>90)a-=180;while(a<-90)a+=180;return a;};
  function reflectData(angle, cfg=P){
    const vx=cfg.pivot.x-cfg.source.x,vy=cfg.pivot.y-cfg.source.y,l=Math.hypot(vx,vy),v={x:vx/l,y:vy/l};
    const m={x:Math.cos(rad(angle)),y:Math.sin(rad(angle))}; const dot=v.x*m.x+v.y*m.y;
    const r={x:2*dot*m.x-v.x,y:2*dot*m.y-v.y}; const n={x:-m.y,y:m.x};
    const back={x:-v.x,y:-v.y}; const incidence=deg(Math.acos(Math.min(1,Math.abs(back.x*n.x+back.y*n.y))));
    const tx=cfg.target.x-cfg.pivot.x,ty=cfg.target.y-cfg.pivot.y,t=tx*r.x+ty*r.y; const closest={x:cfg.pivot.x+Math.max(0,t)*r.x,y:cfg.pivot.y+Math.max(0,t)*r.y};
    const distance=Math.hypot(cfg.target.x-closest.x,cfg.target.y-closest.y);return{v,r,n,incidence,distance,hit:t>0&&distance<=cfg.targetR};
  }
  function endpoint(p,d,len){return{x:p.x+d.x*len,y:p.y+d.y*len};}
  function arcPath(cx,cy,v1,v2,r){const a=endpoint({x:cx,y:cy},v1,r),b=endpoint({x:cx,y:cy},v2,r);const cross=v1.x*v2.y-v1.y*v2.x;return`M ${a.x} ${a.y} A ${r} ${r} 0 0 ${cross>0?1:0} ${b.x} ${b.y}`;}
  function updateLab(angle){
    labAngle=Math.max(-75,Math.min(75,angle)); const d=reflectData(labAngle), end=endpoint(P.pivot,d.r,720);
    $('#mirrorGroup').setAttribute('transform',`translate(${P.pivot.x} ${P.pivot.y}) rotate(${labAngle})`);$('#reflectedRay').setAttribute('x2',end.x);$('#reflectedRay').setAttribute('y2',end.y);
    const nDisplay=(d.v.x*d.n.x+d.v.y*d.n.y)>0?{x:-d.n.x,y:-d.n.y}:d.n; const na=endpoint(P.pivot,nDisplay,140),nb=endpoint(P.pivot,{x:-nDisplay.x,y:-nDisplay.y},140);$('#normalLine').setAttribute('x1',na.x);$('#normalLine').setAttribute('y1',na.y);$('#normalLine').setAttribute('x2',nb.x);$('#normalLine').setAttribute('y2',nb.y);
    const back={x:-d.v.x,y:-d.v.y}; const outN=(d.r.x*nDisplay.x+d.r.y*nDisplay.y)>0?nDisplay:{x:-nDisplay.x,y:-nDisplay.y}; const inN=(back.x*nDisplay.x+back.y*nDisplay.y)>0?nDisplay:{x:-nDisplay.x,y:-nDisplay.y};
    $('#incArc').setAttribute('d',arcPath(P.pivot.x,P.pivot.y,back,inN,68));$('#refArc').setAttribute('d',arcPath(P.pivot.x,P.pivot.y,outN,d.r,68));
    const il=endpoint(P.pivot,{x:(back.x+inN.x)/2,y:(back.y+inN.y)/2},88),rl=endpoint(P.pivot,{x:(d.r.x+outN.x)/2,y:(d.r.y+outN.y)/2},88);$('#incAngleLabel').setAttribute('x',il.x);$('#incAngleLabel').setAttribute('y',il.y);$('#refAngleLabel').setAttribute('x',rl.x);$('#refAngleLabel').setAttribute('y',rl.y);
    const val=Math.round(d.incidence);$('#incAngle').textContent=val;$('#refAngle').textContent=val;$('#mirrorAngle').textContent=Math.round(labAngle);$('#mirrorRange').value=Math.round(labAngle);$('#rangeOutput').textContent=`${Math.round(labAngle)}°`;$('#mirrorHandle').setAttribute('aria-valuenow',Math.round(labAngle));
    const feedback=$('#labFeedback'), dot=$('#labStateDot');feedback.className='lab-feedback';dot.className='';$('#targetAura').setAttribute('opacity','0');
    if(d.hit){feedback.classList.add('success');feedback.innerHTML='<span class="feedback-icon">✓</span><p><b>成功照亮目标！</b><small>反射角等于入射角，你完成了实验任务。</small></p>';dot.classList.add('on');$('#targetAura').setAttribute('opacity','1');if(!state.labDone){state.labDone=true;showToast('实验成功：目标已被照亮！');}}
    else if(d.distance<90){feedback.classList.add('near');feedback.innerHTML='<span class="feedback-icon">◎</span><p><b>光线已经接近目标</b><small>再小幅调整镜面角度。</small></p>';}
    else feedback.innerHTML='<span class="feedback-icon">↻</span><p><b>继续调整镜面角度</b><small>让蓝色反射光线穿过黄色目标区。</small></p>';
  }
  function pointerAngle(e){const svg=$('#labSvg'),pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const p=pt.matrixTransform(svg.getScreenCTM().inverse());return normAngle(deg(Math.atan2(p.y-P.pivot.y,p.x-P.pivot.x)));}
  $('#mirrorHandle').addEventListener('pointerdown',e=>{dragging=true;e.target.setPointerCapture(e.pointerId);});
  $('#labSvg').addEventListener('pointermove',e=>{if(dragging)updateLab(pointerAngle(e));});
  $('#labSvg').addEventListener('pointerup',()=>dragging=false);$('#labSvg').addEventListener('pointercancel',()=>dragging=false);
  $('#mirrorHandle').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(e.key)){e.preventDefault();updateLab(labAngle+(['ArrowRight','ArrowUp'].includes(e.key)?1:-1));}});
  $('#mirrorRange').addEventListener('input',e=>updateLab(Number(e.target.value)));
  $('#normalToggle').addEventListener('change',e=>$('#normalLine').style.display=e.target.checked?'':'none');
  $('#angleToggle').addEventListener('change',e=>$$('#incArc,#refArc,#incAngleLabel,#refAngleLabel').forEach(x=>x.style.display=e.target.checked?'':'none'));
  $('#resetLab').addEventListener('click',()=>{state.labDone=false;$('#normalToggle').checked=true;$('#angleToggle').checked=true;$$('#normalLine,#incArc,#refArc,#incAngleLabel,#refAngleLabel').forEach(x=>x.style.display='');updateLab(28);showToast('实验已重置');});updateLab(28);

  const CP={source:{x:60,y:72},pivot:{x:260,y:145},target:{x:455,y:78},targetR:27};
  function updateTasks(){const count=state.tasks.filter(Boolean).length;$('#challengeCount').textContent=count;$('#challengeBar').style.width=`${count*50}%`;}
  function updateChallenge(angle){const d=reflectData(angle,CP),end=endpoint(CP.pivot,d.r,340);$('#cMirror').setAttribute('transform',`translate(260 145) rotate(${angle})`);$('#cReflected').setAttribute('x2',end.x);$('#cReflected').setAttribute('y2',end.y);$('#challengeAngle').textContent=`${angle}°`;const f=$('#taskOneFeedback');if(d.hit){state.tasks[0]=true;$('#taskOneCard').classList.add('completed');$('#taskOneCard .task-state').textContent='已完成';f.className='task-feedback success';f.textContent='成功！你通过调整镜面方向改变了反射光线。';}else{f.className='task-feedback';f.textContent=d.distance<65?'已经很接近了，再调整一点点。':'继续调整，试着让光线靠近目标。';}updateTasks();}
  $('#challengeRange').addEventListener('input',e=>updateChallenge(Number(e.target.value)));
  $('#retryTaskOne').addEventListener('click',()=>{state.tasks[0]=false;$('#taskOneCard').classList.remove('completed');$('#taskOneCard .task-state').textContent='待完成';$('#challengeRange').value=28;updateChallenge(28);});
  $$('#challengeOptions button').forEach(b=>b.addEventListener('click',()=>{const correct=b.dataset.value==='30';$$('#challengeOptions button').forEach(x=>{x.disabled=true;if(x.dataset.value==='30')x.classList.add('correct');});if(!correct)b.classList.add('wrong');const f=$('#challengeFeedback');f.classList.remove('hidden');f.innerHTML=correct?'<b>回答正确！</b> 根据反射定律，反射角等于入射角，所以反射角也是 30°。':'<b>再想一想。</b> 反射角与入射角相等，因此正确答案是 B：30°。';state.tasks[1]=correct;$('#taskTwoCard').classList.toggle('completed',correct);$('#taskTwoCard .task-state').textContent=correct?'已完成':'再试一次';updateTasks();}));
  $('#retryTaskTwo').addEventListener('click',()=>{state.tasks[1]=false;$('#taskTwoCard').classList.remove('completed');$('#taskTwoCard .task-state').textContent='待作答';$('#challengeFeedback').classList.add('hidden');$$('#challengeOptions button').forEach(x=>{x.disabled=false;x.classList.remove('correct','wrong');});updateTasks();});
  $('#nextQuestion').addEventListener('click',()=>go('quiz'));

  const questions=[
    {topic:'概念辨析',q:'关于反射角，下列说法正确的是哪一项？',options:['反射光线与镜面的夹角','反射光线与法线的夹角','入射光线与镜面的夹角','法线与镜面的夹角'],answer:1,explain:'反射角是反射光线与法线之间的夹角。测量时要从法线量起。'},
    {topic:'规律应用',q:'一束光射向平面镜，入射角逐渐增大 10°，反射角将怎样变化？',options:['增大 10°','减小 10°','保持不变','增大 20°'],answer:0,explain:'反射角始终等于入射角。因此入射角增大 10°，反射角也增大 10°。'},
    {topic:'生活应用',q:'想让手电筒的光照到被遮挡的钥匙，最合理的做法是？',options:['只把手电筒调得更亮','移动镜面方向，使反射光线对准钥匙','用黑纸挡住镜面','让光线垂直射向桌面'],answer:1,explain:'调整镜面方向会改变反射光线的传播方向，从而把光引向原本照不到的位置。'}
  ];
  let qi=0,selected=null,score=0,answered=false;
  function renderQuestion(){const q=questions[qi];selected=null;answered=false;$('#questionIndex').textContent=qi+1;$('#questionTopic').textContent=q.topic;$('#questionText').textContent=q.q;$('#quizProgress').style.width=`${((qi+1)/3)*100}%`;$('#quizFeedback').classList.add('hidden');$('#nextQuiz').classList.add('hidden');$('#submitAnswer').classList.remove('hidden');$('#submitAnswer').disabled=true;$('#quizOptions').innerHTML=q.options.map((o,i)=>`<button data-index="${i}"><b>${String.fromCharCode(65+i)}</b>${o}</button>`).join('');$$('#quizOptions button').forEach(b=>b.addEventListener('click',()=>{if(answered)return;selected=Number(b.dataset.index);$$('#quizOptions button').forEach(x=>x.classList.toggle('selected',x===b));$('#submitAnswer').disabled=false;}));}
  $('#submitAnswer').addEventListener('click',()=>{if(selected===null||answered)return;answered=true;const q=questions[qi],ok=selected===q.answer;if(ok)score++;state.quizAnswers[qi]=ok;$('#liveScore').textContent=score*10;$$('#quizOptions button').forEach((b,i)=>{b.disabled=true;if(i===q.answer)b.classList.add('correct');else if(i===selected)b.classList.add('wrong');});const f=$('#quizFeedback');f.classList.remove('hidden');f.innerHTML=`<b>${ok?'回答正确！':'回答错误。'}</b> ${q.explain}`;$('#submitAnswer').classList.add('hidden');$('#nextQuiz').classList.remove('hidden');$('#nextQuiz').textContent=qi===2?'查看结果 →':'下一题 →';});
  $('#nextQuiz').addEventListener('click',()=>{if(qi<2){qi++;renderQuestion();}else showResults();});
  function showResults(){let final=score*10;$('#quizArea').classList.add('hidden');$('#resultCard').classList.remove('hidden');$('#finalScore').textContent=final;$('#correctCount').textContent=score;$('#resultTitle').textContent=score===3?'太棒了，全部答对！':score===2?'掌握得很不错！':'继续练习，你会更熟练！';$('#resultText').textContent=score===3?'你已经能准确辨认概念、应用反射定律并解决生活情境中的问题。':score===2?'大部分知识已经掌握，建议回看答错题目的解析。':'建议重新观看动画讲解，并在互动实验中再次观察两个角的变化。';$('.result-ring').style.background=`conic-gradient(var(--green) 0 ${final/30*100}%,var(--surface-2) 0)`;}
  function resetQuiz(){qi=0;score=0;state.quizAnswers=[];$('#liveScore').textContent='0';$('#quizArea').classList.remove('hidden');$('#resultCard').classList.add('hidden');renderQuestion();}
  $('#restartQuiz').addEventListener('click',resetQuiz);renderQuestion();
  $('#restartCourse').addEventListener('click',()=>{state.visited=new Set(['home']);state.labDone=false;state.tasks=[false,false];resetQuiz();updateLab(28);$('#retryTaskTwo').click();$('#retryTaskOne').click();go('intro');showToast('学习记录已重置');});
  window.addEventListener('hashchange',()=>{const target=location.hash.slice(1);if(pages.includes(target)&&target!==state.page)go(target);});
  const initialPage=location.hash.slice(1);if(pages.includes(initialPage))go(initialPage);else go('home');
})();
