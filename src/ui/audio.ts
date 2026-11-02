// 외부 음원 없이 Web Audio로 짧은 효과음을 합성한다. 첫 사용자 조작 이후에만 활성화.
export type Sfx = 'select' | 'action' | 'rescue' | 'result' | 'bump' | 'denied' | 'step';

export class AudioFx {
  private ctx: AudioContext | null = null;
  muted = false;

  constructor() {
    const unlock = () => {
      this.ensure();
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  play(kind: Sfx) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const seq: Record<Sfx, Array<[number, number, OscillatorType]>> = {
      select: [[660, 0.05, 'square']],
      step: [[220, 0.03, 'triangle']],
      bump: [[110, 0.05, 'square']],
      denied: [[180, 0.07, 'sawtooth'], [140, 0.08, 'sawtooth']],
      action: [[300, 0.05, 'square'], [200, 0.08, 'triangle']],
      rescue: [[523, 0.06, 'square'], [659, 0.06, 'square'], [784, 0.1, 'square']],
      result: [[392, 0.08, 'triangle'], [523, 0.08, 'triangle'], [659, 0.16, 'triangle']],
    };
    let t = this.ctx.currentTime;
    for (const [f, d, type] of seq[kind]) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g).connect(this.ctx.destination);
      o.start(t);
      o.stop(t + d + 0.02);
      t += d;
    }
  }
}
