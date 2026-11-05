// 샘플과 같은 Web Audio 합성음. 클릭 처리 안에서만 생성·resume한다.
let audio = null;

export function createSound() {
  const voices = new Set();
  let context = null;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    context = audio;
    if (context.state === 'suspended') context.resume().catch(() => {});
  } catch { /* 소리를 못 써도 연출은 진행한다. */ }

  function stopSound() {
    voices.forEach(voice => { try { voice.stop(); } catch { /* 이미 끝난 음 */ } });
    voices.clear();
  }
  function tone(freq, duration = .15, shape = 'sine', gain = .045, end = null) {
    if (!context) return;
    try {
      const oscillator = context.createOscillator(), volume = context.createGain(), now = context.currentTime;
      oscillator.type = shape;
      oscillator.frequency.setValueAtTime(freq, now);
      if (end) oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
      volume.gain.setValueAtTime(0, now);
      volume.gain.linearRampToValueAtTime(gain, now + .01);
      volume.gain.exponentialRampToValueAtTime(.0001, now + duration);
      oscillator.connect(volume); volume.connect(context.destination);
      voices.add(oscillator);
      oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); volume.disconnect(); };
      oscillator.start(now); oscillator.stop(now + duration + .01);
    } catch { /* 지원하지 않는 환경에서도 결과는 표시한다. */ }
  }
  function chime(tier) {
    const frequencies = tier === 'diamond' ? [440, 554.37, 659.25, 880]
      : tier === 'ruby' ? [329.63, 440, 659.25] : [329.63, 493.88, 659.25];
    frequencies.forEach((freq, i) => tone(freq, .9, 'sine', .035 / (i + 1)));
  }
  return { tone, chime, stopSound };
}
