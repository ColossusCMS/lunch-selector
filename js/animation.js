// 룰렛 연출: 감속 회전, 폭죽, 순차 페이드 인.

const CONFETTI_COLORS = ['#e8590c', '#2f9e44', '#fcc419', '#4c6ef5', '#be4bdb', '#f03e3e'];

export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * 이름을 빠르게 바꾸다 점점 느려지며 final에서 멈춘다.
 * @param {HTMLElement} el
 * @param {string[]} names
 * @param {string} final
 * @param {number} [duration]
 * @returns {Promise<void>}
 */
export function spinReel(el, names, final, duration = 2000) {
  el.classList.remove('done');
  return new Promise((resolve) => {
    const start = performance.now();
    let last = -Infinity;
    let index = Math.floor(Math.random() * names.length);
    const step = (now) => {
      const p = duration > 0 ? (now - start) / duration : 1;
      if (p >= 1) {
        el.textContent = final;
        el.classList.add('done');
        resolve();
        return;
      }
      if (now - last > 40 + 260 * p * p) {
        last = now;
        index = (index + 1) % names.length;
        el.textContent = names[index];
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/**
 * 화면 전체 위에서 꽃가루가 쏟아진다.
 * @param {number} [count]
 */
export function burstConfetti(count = 120) {
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
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
