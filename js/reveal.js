// 카드 안 룰렛과 상위 등급의 빛·입자 연출을 연결한다.
import { cardRoulette } from './animation.js?v=202611051333';
import { revealPlan, replayPlan, rouletteRows, gemKind, revealSecondsLeft, REVEAL_TIME as TIME } from './reveal-plan.js?v=202611051333';

export function showFirstPick(dialog, { name, category, tierId, sound, onSkip, replay = false, names = [], startedAt = performance.now() }) {
  const plan = replay ? replayPlan(tierId, Boolean(category)) : revealPlan(tierId, Boolean(category));
  if(!plan)return Promise.resolve();
  const current = { name, category, tier: plan.long ? tierId : 'stone' };
  dialog.innerHTML = `      <div class="rv-stage" id="rv-stage" data-phase="arrival" aria-hidden="true" data-tier="diamond">
        <div class="rv-stars"></div><div class="rv-grid"></div><div class="rv-center-guide"></div><div class="rv-ambient"></div><div class="rv-rings" id="rv-rings"></div><div class="rv-beam" id="rv-beam"></div>
        <canvas id="rv-particles" aria-hidden="true"></canvas>
        ${replay ? '<div class="rv-roulette" id="rv-roulette"><p class="rv-reel-caption">SELECTING YOUR MOMENT</p><div class="rv-brackets"></div><div class="rv-reel-window"><div class="rv-reel-track" id="rv-reel-track"></div></div></div>' : ''}
        <div class="rv-charge-core" id="rv-charge-core"></div>
        <div class="rv-cue" id="rv-category-cue" hidden><p class="rv-cue-kicker">THE FIRST CLUE / 오늘의 업종</p><h2 class="rv-cue-main" id="rv-category-text">중식</h2><div class="rv-cue-rule"></div></div>
        <div class="rv-cue" id="rv-grade-cue" hidden><div class="rv-grade-symbol" id="rv-grade-symbol"></div><p class="rv-grade-en" id="rv-grade-en">DIAMOND</p><h2 class="rv-grade-name" id="rv-grade-name">다이아</h2><p class="rv-grade-whisper" id="rv-grade-whisper"></p></div>
        <div class="rv-result-wrap" id="rv-result-wrap" hidden><article class="rv-result-card" id="rv-result-card"><div class="rv-card-top"><span id="rv-card-tier">DIAMOND</span><span>FIRST PICK / 01</span></div><div class="rv-card-gem" id="rv-card-gem"></div><p class="rv-result-label">오늘의 선택</p><h2 class="rv-result-name" id="rv-result-name"></h2><div class="rv-card-divider"></div><p class="rv-result-category" id="rv-result-category"></p><div class="rv-card-bottom" id="rv-card-bottom"></div></article></div>
        <div class="rv-flash" id="rv-flash"></div>
      </div>
<div class="rv-footer"><span class="rv-help" id="rv-help">화면을 누르면 건너뛰어요</span><button type="button" class="rv-close" id="rv-close" hidden>결과 보기</button><span class="rv-countdown" id="rv-countdown" aria-hidden="true" hidden></span></div>`;
  const $ = id => dialog.querySelector('#rv-' + id);
  const stage = $('stage'), canvas = $('particles'), ctx = canvas.getContext('2d');
  const effects = new Set(), timers = new Map();
  const particles = [];
  let width=1,height=1,frame=0,reelFrame=0,lastTime=0,spawn=0,active=true,final=false,closed=false,finalAt=0,autoClose=0,countdownTimer=0;
  let resolveClosed;
  const closedPromise = new Promise(resolve => { resolveClosed = resolve; });
  const cancelled = Symbol('cancelled');
  function pause(ms) {
    return new Promise((resolve,reject) => {
      const id=setTimeout(()=>{timers.delete(id);resolve();},ms);
      timers.set(id,reject);
    });
  }
  function transition(el,keyframes,options={}) {
    const a=el.animate(keyframes,{duration:TIME.summary,easing:'cubic-bezier(.16,1,.3,1)',...options});
    effects.add(a);a.finished.then(()=>effects.delete(a),()=>effects.delete(a));return a;
  }
  function phase(value) { stage.dataset.phase=value; }
  function stopVisuals() {
    active=false;cancelAnimationFrame(frame);cancelAnimationFrame(reelFrame);frame=0;reelFrame=0;
    for(const [id,reject] of timers){clearTimeout(id);reject(cancelled);}timers.clear();
    for(const a of effects)a.cancel();effects.clear();
    particles.length=0;ctx?.clearRect(0,0,width,height);
    dialog.getAnimations({subtree:true}).forEach(a=>a.cancel());
  }
  function makeGem() {
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('fill','none');svg.setAttribute('aria-hidden','true');
    const drawings = {
      emerald: [
        {d:'M29 8h42l15 15v54L71 92H29L14 77V23L29 8Z',stroke:'currentColor','stroke-width':'1.25'},
        {d:'M35 22h30l9 9v38l-9 9H35l-9-9V31l9-9Z',stroke:'currentColor','stroke-width':'.7',opacity:'.65'},
        {d:'M29 8l6 14M71 8l-6 14M86 23l-12 8M86 77l-12-8M71 92l-6-14M29 92l6-14M14 77l12-8M14 23l12 8',stroke:'currentColor','stroke-width':'.7',opacity:'.65'},
        {d:'M29 8h42l-6 14H35L29 8Z',fill:'currentColor',opacity:'.12'},
        {d:'M71 8l15 15v54L71 92l-6-14 9-9V31l-9-9 6-14Z',fill:'currentColor',opacity:'.08'},
        {d:'M35 22h30l9 9v38l-9 9H35l-9-9V31l9-9Z',fill:'currentColor',opacity:'.04'},
      ],
      ruby: [
        {d:'M50 7C72 7 87 26 87 50C87 74 72 93 50 93C28 93 13 74 13 50C13 26 28 7 50 7Z',stroke:'currentColor','stroke-width':'1.25'},
        {d:'M37 27h26l12 14v18L63 73H37L25 59V41l12-14Z',stroke:'currentColor','stroke-width':'.7',opacity:'.65'},
        {d:'M50 7v20M76 20L63 27M87 50H75M76 80L63 73M50 93V73M24 80l13-7M13 50h12M24 20l13 7',stroke:'currentColor','stroke-width':'.7',opacity:'.65'},
        {d:'M50 7L37 27h26L50 7Z',fill:'currentColor',opacity:'.12'},
        {d:'M75 41l12 9-12 9V41Z',fill:'currentColor',opacity:'.2'},
        {d:'M37 27h26l12 14v18L63 73H37L25 59V41l12-14Z',fill:'currentColor',opacity:'.06'},
      ],
      diamond: [
      {d:'M24 18h52l18 25-44 44L6 43 24 18Z',stroke:'currentColor','stroke-width':'1.25'},
      {d:'m24 18 26 69 26-69M6 43h88M24 18l26 25 26-25M50 43v44',stroke:'currentColor','stroke-width':'.7',opacity:'.65'},
      {d:'m24 18 26 25L6 43 24 18Z',fill:'currentColor',opacity:'.12'},
      {d:'m50 43 26-25 18 25H50Z',fill:'currentColor',opacity:'.2'},
      {d:'m50 43 44 0L50 87V43Z',fill:'currentColor',opacity:'.06'},
      ],
    };
    const kind = gemKind(tierId);
    const paths = drawings[kind] ?? [];
    svg.dataset.gem = kind ?? '';
    paths.forEach(attrs=>{const path=document.createElementNS(ns,'path');Object.entries(attrs).forEach(([key,value])=>path.setAttribute(key,value));svg.append(path);});
    return svg;
  }

  // 입자는 무대 안에서만 그리며, 잔광이 사라지면 프레임 요청을 멈춘다.
  function color(){return plan.grade.color;}
  function addParticle(gather=false){const angle=Math.random()*Math.PI*2,dist=Math.max(width,height)*(.35+Math.random()*.35),cx=width/2,cy=height*.49;
    if(gather)particles.push({x:cx+Math.cos(angle)*dist,y:cy+Math.sin(angle)*dist,vx:-Math.cos(angle)*(dist/1.3),vy:-Math.sin(angle)*(dist/1.3),life:1.3,max:1.3,size:Math.random()*1.8+.5,color:color(),gather:true});
  }
  function burst(count){const cx=width/2,cy=height*.49;for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=60+Math.random()*300;particles.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1.2+Math.random()*1.9,max:3.1,size:1+Math.random()*3,color:current.tier==='diamond'&&i%4===0?['#ded0ff','#fff1bb','#d6fff0'][i%3]:color(),shard:i%4===0});}ensureFrame();}
  function ensureFrame(){if(!frame&&ctx&&!closed){lastTime=performance.now();frame=requestAnimationFrame(draw);}}
  function draw(time){frame=0;const dt=Math.min(.04,(time-lastTime)/1000);lastTime=time;ctx.clearRect(0,0,width,height);
    const gathering=active&&['charge','category','grade'].includes(stage.dataset.phase);
    if(gathering){spawn+=dt*(stage.dataset.phase==='grade'?75:45);while(spawn>=1){addParticle(true);spawn--;}}
    ctx.globalCompositeOperation='lighter';
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue;}const ox=p.x,oy=p.y;p.x+=p.vx*dt;p.y+=p.vy*dt;if(!p.gather){p.vx*=Math.pow(.985,dt*60);p.vy=p.vy*Math.pow(.985,dt*60)+dt*12;}
      const alpha=Math.min(1,p.life/.5)*(p.gather?Math.sin(Math.PI*p.life/p.max):.7);ctx.globalAlpha=Math.max(0,alpha);ctx.strokeStyle=p.color;ctx.fillStyle=p.color;ctx.lineWidth=p.size*.45;ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(p.x,p.y);ctx.stroke();
      if(p.shard){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(time*.001+i);ctx.fillRect(-p.size,-p.size,p.size*2,p.size*2);ctx.restore();}else{ctx.beginPath();ctx.arc(p.x,p.y,p.size*.55,0,Math.PI*2);ctx.fill();}
    }ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';if(particles.length||gathering)frame=requestAnimationFrame(draw);
  }

  function resize() {
    const rect=stage.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
    width=rect.width;height=rect.height;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ctx?.setTransform(dpr,0,0,dpr,0,0);
  }
  const observer=new ResizeObserver(resize);
  function ripple(scale=1) {
    const ring=document.createElement('div');
    Object.assign(ring.style,{position:'absolute',left:'50%',top:'49%',width:'80px',height:'80px',margin:'-40px',border:'1px solid '+plan.grade.color,borderRadius:'50%',zIndex:2,pointerEvents:'none'});
    stage.append(ring);
    const a=transition(ring,[{opacity:.8,transform:'scale(.1)'},{opacity:0,transform:`scale(${9*scale})`}],{duration:TIME.ripple});
    a.finished.then(()=>ring.remove(),()=>ring.remove());
  }
  function updateCountdown() {
    if(closed)return;
    const elapsed=performance.now()-finalAt,seconds=revealSecondsLeft(elapsed);
    if(seconds<=0)return;
    $('countdown').textContent=`자동으로 닫히기 ${seconds}초 전`;
    const next=TIME.autoClose-(seconds-1)*1000;
    countdownTimer=setTimeout(updateCountdown,Math.max(1,next-elapsed));
  }
  function showFinal(immediate=false) {
    if(final||closed)return;
    if(immediate){stopVisuals();sound?.stopSound();onSkip?.();}
    active=false;final=true;finalAt=performance.now();
    if(replay)$('roulette').hidden=true;
    dialog.dataset.final='true';dialog.dataset.elapsed=String(Math.round(finalAt-startedAt));
    for(const id of ['category-cue','grade-cue'])$(id).hidden=true;
    $('charge-core').style.opacity=0;$('beam').style.opacity=0;
    $('result-name').textContent=name;$('result-category').textContent=category;
    $('card-tier').textContent=plan.grade.en;$('card-bottom').textContent=plan.grade.name+' 카드';
    $('result-wrap').hidden=false;phase('result');
    if(!immediate){
      transition($('result-card'),[{opacity:0,transform:'translateY(55px) scale(.65) rotateY(-22deg)'},{opacity:1,transform:'translateY(-5px) scale(1.025) rotateY(2deg)',offset:.72},{opacity:1,transform:'translateY(0) scale(1) rotateY(0deg)'}],{duration:TIME.card});
      burst(tierId==='diamond'?190:tierId==='ruby'?125:80);ripple(1.3);
    }
    sound?.chime(tierId);
    $('help').hidden=true;$('close').hidden=false;$('close').focus({preventScroll:true});
    $('countdown').hidden=false;updateCountdown();
    autoClose=setTimeout(close,Math.max(0,TIME.autoClose-(performance.now()-finalAt)));
  }
  function close() {
    if(closed)return;closed=true;clearTimeout(autoClose);clearTimeout(countdownTimer);autoClose=0;countdownTimer=0;stopVisuals();sound?.stopSound();observer.disconnect();
    dialog.removeEventListener('click',advance);dialog.removeEventListener('cancel',cancel);
    dialog.removeEventListener('keydown',keydown);dialog.removeEventListener('close',nativeClose);
    dialog.close();resolveClosed();
  }
  function advance() {
    if(!final){showFinal(true);return;}
    if(performance.now()-finalAt>=TIME.closeGuard)close();
  }
  function cancel(event){event.preventDefault();advance();}
  function nativeClose(){if(!dialog.open)close();}
  function keydown(event){
    // Esc 기본 닫기를 막고 터치와 같은 두 단계로 처리한다.
    if(event.key==='Escape'){event.preventDefault();if(!event.repeat)advance();return;}
    if((event.key==='Enter'||event.key===' ')&&event.target!==$('close')){event.preventDefault();advance();}
  }
  async function replayRoulette() {
    const track=$('reel-track');
    track.replaceChildren(...rouletteRows(names).map(text=>Object.assign(document.createElement('div'),{className:'rv-reel-row',textContent:text})));
    phase('roulette');
    const start=performance.now();let previous=-1,fading=false;
    const tick=now=>{
      const elapsed=now-start,t=Math.min(1,elapsed/TIME.roulette);
      const index=60*(.8*t+.2*(1-Math.pow(1-t,3)));
      track.style.transform=`translateY(${-index*56}px)`;
      if(!fading&&elapsed>=plan.fadeAt){
        fading=true;$('roulette').style.opacity=0;
        transition($('roulette'),[{opacity:1,filter:'blur(0px)',transform:'scale(1)'},{opacity:0,filter:'blur(15px)',transform:'scale(.92) translateY(-12px)'}],{duration:Math.max(1,TIME.roulette-elapsed),easing:'ease-in-out'});
      }
      if(Math.floor(index)!==previous){
        previous=Math.floor(index);
        sound?.tone(140+previous*2,.035,'triangle',.016*Math.max(0,Math.min(1,(TIME.roulette-elapsed)/TIME.dissolve)));
      }
      if(t<1)reelFrame=requestAnimationFrame(tick);
    };
    reelFrame=requestAnimationFrame(tick);
    await pause(TIME.roulette);cancelAnimationFrame(reelFrame);reelFrame=0;$('roulette').hidden=true;
  }
  async function play() {
    try {
      if(replay)await replayRoulette();
      else {
        transition(dialog,[{opacity:0},{opacity:1}],{duration:TIME.dissolve,easing:'ease-in-out'});
        await pause(TIME.dissolve);
      }
      phase('charge');ensureFrame();$('charge-core').style.opacity=1;
      transition($('charge-core'),[{opacity:0,transform:'translate(-50%,-50%) scale(.1) rotate(45deg)'},{opacity:1,transform:'translate(-50%,-50%) scale(1) rotate(225deg)'}],{duration:TIME.core});sound?.tone(75,1.1,'sine',.07,210);
      await pause(TIME.charge);$('charge-core').style.opacity=0;
      if(category){
        $('category-text').textContent=category;$('category-cue').hidden=false;phase('category');
        transition($('category-cue'),[{opacity:0,filter:'blur(18px)',transform:'scale(1.45)'},{opacity:1,filter:'blur(0px)',transform:'scale(1)'}],{duration:TIME.categoryIn});burst(38);ripple(.8);sound?.tone(410,.45,'sine',.045);
        await pause(TIME.category);
        transition($('category-cue'),[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(1.25)',filter:'blur(12px)'}],{duration:TIME.categoryOut});
        await pause(TIME.categoryOut);$('category-cue').hidden=true;
      }
      const t=plan.grade;$('grade-en').textContent=t.en;$('grade-name').textContent=t.name;
      $('grade-whisper').textContent=tierId==='diamond'?'빛이 달라집니다. 조금만 더 기다려 주세요.':tierId==='ruby'?'붉은 빛이 심장처럼 울립니다.':'초록빛 속에서, 오늘의 한 장을 발견합니다.';
      $('grade-cue').hidden=false;phase('grade');ensureFrame();
      transition($('grade-cue'),[{opacity:0,transform:'scale(.8) translateY(12px)'},{opacity:1,transform:'scale(1) translateY(0)'}],{duration:TIME.gradeIn});ripple();sound?.tone(100,t.duration/1000,'sine',.075,360);
      await pause(t.duration*.55);ripple(t.power);if(tierId!=='emerald')burst(tierId==='diamond'?95:55);
      await pause(t.duration*.45);
      transition($('grade-cue'),[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(1.6)',filter:'blur(15px)'}],{duration:TIME.gradeOut});
      transition($('beam'),[{opacity:0,transform:'scaleY(.02) scaleX(1)'},{opacity:1,transform:'scaleY(1) scaleX(3)',offset:.55},{opacity:0,transform:'scaleY(1) scaleX(30)'}],{duration:TIME.beam});
      const intensity=tierId==='diamond'?.92:tierId==='ruby'?.6:.35;
      transition($('flash'),[{opacity:0},{opacity:intensity,offset:.15},{opacity:0}],{duration:TIME.flash});
      if(tierId!=='emerald')transition(stage,[{transform:'translateX(0)'},{transform:'translateX(-4px)',offset:.2},{transform:'translateX(4px)',offset:.4},{transform:'translateX(-2px)',offset:.6},{transform:'translateX(0)'}],{duration:TIME.shake});
      phase('reveal');await pause(TIME.beforeCard);showFinal();
    }catch(error){if(error!==cancelled){console.error(error);showFinal(true);}}
  }
  stage.dataset.tier=current.tier;stage.style.setProperty('--accent',plan.grade.color);stage.style.setProperty('--accent-rgb',plan.grade.rgb);
  $('grade-symbol').append(makeGem());$('card-gem').append(makeGem());
  dialog.dataset.final='false';delete dialog.dataset.elapsed;
  dialog.addEventListener('click',advance);dialog.addEventListener('cancel',cancel);dialog.addEventListener('keydown',keydown);dialog.addEventListener('close',nativeClose);
  dialog.showModal();dialog.focus({preventScroll:true});resize();observer.observe(stage);
  void play();return closedPromise;
}

/** 짧은 흐름은 카드 안에서만, 긴 흐름은 소멸 시작부터 창으로 이어진다. */
export async function playFirstPick(dialog, cardBack, input) {
  const plan = revealPlan(input.tierId, Boolean(input.category));
  const controller = new AbortController(), startedAt = performance.now();
  let overlay;
  const cleanup = await cardRoulette(cardBack, {
    ...input, plan, signal: controller.signal,
    onDissolve: () => { overlay = showFirstPick(dialog, { ...input, startedAt, onSkip: () => controller.abort() }); },
  });
  if (overlay) {
    try { await overlay; } finally { cleanup(); }
  }
  return cleanup;
}
