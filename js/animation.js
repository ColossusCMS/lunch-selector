// 룰렛 연출: 감속 회전, 폭죽, 순차 페이드 인.
import { rouletteRows } from './reveal-plan.js?v=419ee43b2143';

const CONFETTI_COLORS = ['#e8590c', '#2f9e44', '#fcc419', '#4c6ef5', '#be4bdb', '#f03e3e'];

export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 카드 뒷면의 세로 룰렛. 취소 시 프레임·타이머·소멸 효과를 함께 정리한다. */
export function cardRoulette(host, { names, plan, sound, onDissolve, signal }) {
  const viewport = document.createElement('div'), track = document.createElement('div');
  viewport.className = 'card-reel'; track.className = 'card-reel-track';
  viewport.setAttribute('aria-hidden', 'true'); viewport.append(track);
  host.querySelector('.back-inner').append(viewport); host.classList.add('reeling');
  const finishIndex = plan.long ? 60 : 55, rowHeight = 44;
  const rows = rouletteRows(names);
  const makeRows = values => track.replaceChildren(...values.map(text => Object.assign(document.createElement('div'), { className: 'card-reel-row', textContent: text })));
  makeRows(rows);
  let frame = 0, fade, questionFade, finishTimer, dissolveTimer, holdTimer, settled = false;
  const startedAt = performance.now(); let previous = -1;
  let resolveDone;
  const done = new Promise(resolve => { resolveDone = resolve; });
  function stop() {
    if (settled) return;
    settled = true; cancelAnimationFrame(frame);
    clearTimeout(finishTimer); clearTimeout(dissolveTimer); clearTimeout(holdTimer);
    fade?.cancel(); signal?.removeEventListener('abort', stop); resolveDone(cleanup);
  }
  function cleanup() { stop(); questionFade?.cancel(); viewport.remove(); host.classList.remove('reeling', 'questioning'); }
  const tick = now => {
    const elapsed = now - startedAt, t = Math.min(1, elapsed / plan.reelDuration);
    const progress = plan.long ? .8*t + .2*(1-Math.pow(1-t,3)) : 1-Math.pow(1-t,3);
    const index = finishIndex * progress;
    track.style.transform = `translateY(${-index*rowHeight}px)`;
    if (Math.floor(index) !== previous) {
      previous = Math.floor(index);
      const volume = .016*Math.max(0,Math.min(1,(plan.reelEnd-elapsed)/plan.fadeDuration));
      sound?.tone(140+previous*2,.035,'triangle',volume);
    }
    if (t < 1) frame = requestAnimationFrame(tick);
  };
  signal?.addEventListener('abort', stop, { once: true });
  if (signal?.aborted) stop();
  else {
    frame = requestAnimationFrame(tick);
    dissolveTimer = setTimeout(() => {
      viewport.style.opacity = '0';
      fade = viewport.animate([{ opacity:1,filter:'blur(0px)',transform:'scale(1)' },{ opacity:0,filter:'blur(15px)',transform:'scale(.92) translateY(-12px)' }],{ duration:plan.fadeDuration,easing:'ease-in-out' });
      if (plan.overlay) onDissolve();
    }, plan.fadeAt);
    finishTimer = setTimeout(() => {
      cancelAnimationFrame(frame);
      if (plan.long) stop();
      else {
        viewport.hidden = true;
        const question = host.querySelector('.spin-name');
        question.textContent = '?'; host.classList.add('questioning');
        questionFade = question.animate([{ opacity:0 },{ opacity:1 }],{ duration:plan.questionIn,easing:'ease-out' });
        sound?.tone(330,.5,'sine',.04);
        holdTimer = setTimeout(stop, plan.questionIn + plan.hold);
      }
    }, plan.reelEnd);
  }
  return done;
}

/**
 * 화면 전체 위에서 꽃가루가 쏟아진다.
 * @param {number} [count]
 */
export function burstConfetti(count = 120) {
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.animationDuration = `${2 + Math.random() * 1.2}s`;
    piece.style.animationDelay = `${Math.random() * 0.5}s`;
    piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 200}px`);
    piece.style.setProperty('--spin', `${360 + Math.random() * 720}deg`);
    layer.appendChild(piece);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 3800);
}

/**
 * els에 .show를 gap 간격으로 붙인다 (CSS가 페이드 인 처리).
 * @param {HTMLElement[]} els
 * @param {number} [gap]
 * @returns {Promise<void>}
 */
export async function revealInOrder(els, gap = 350) {
  for (const el of els) {
    await new Promise((r) => setTimeout(r, gap));
    el.classList.add('show');
  }
}
