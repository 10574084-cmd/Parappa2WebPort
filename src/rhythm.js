const KEYS = ['j', 'k', 'l'];
export const DEMO_BPM = 96;
export const NOTE_TRAVEL = 1.65;
export const HIT_WINDOW = 0.19;

export function makeDemoChart(bpm = DEMO_BPM, bars = 12, offsetMs = 0) {
  const safeBpm = Math.max(60, Math.min(220, Number(bpm) || DEMO_BPM));
  const safeBars = Math.max(1, Math.min(256, Math.floor(Number(bars) || 1)));
  const beat = 60 / safeBpm;
  const start = 2 + (Number(offsetMs) || 0) / 1000;
  const pattern = [0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 1, 2, 0, 2, 1, 0];
  const notes = [];
  for (let i = 0; i < safeBars * 4; i++) {
    if (i % 8 === 6) continue;
    const time = start + i * beat;
    if (time < 0) continue;
    notes.push({ id: notes.length, time, lane: pattern[i % pattern.length], judged: false, visible: false });
  }
  return { bpm: safeBpm, beat, notes, duration: Math.max(0, start) + safeBars * 4 * beat + 2 };
}

export function makeSongChart(bpm, duration, offsetMs = 0) {
  const safeBpm = Math.max(60, Math.min(220, Number(bpm) || DEMO_BPM));
  const beat = 60 / safeBpm;
  const safeDuration = Math.max(1, Number(duration) || 1);
  const bars = Math.max(1, Math.ceil(Math.max(0, safeDuration - 4) / (beat * 4)));
  const chart = makeDemoChart(safeBpm, bars, offsetMs);
  chart.duration = safeDuration;
  chart.notes = chart.notes.filter(note => note.time <= safeDuration - 0.05);
  return chart;
}

export class RhythmSession {
  constructor(chart, callbacks = {}) {
    this.chart = chart;
    this.callbacks = callbacks;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.judged = 0;
    this.active = false;
    this.startedAt = 0;
  }

  start(now = 0) {
    this.score = this.combo = this.maxCombo = this.judged = 0;
    for (const note of this.chart.notes) { note.judged = false; note.visible = false; }
    this.startedAt = now;
    this.active = this.chart.notes.length > 0;
    this.callbacks.onUpdate?.(this.snapshot());
  }

  update(songTime) {
    if (!this.active) return;
    for (const note of this.chart.notes) {
      if (note.judged) continue;
      const delta = note.time - songTime;
      if (!note.visible && delta <= NOTE_TRAVEL && delta >= -HIT_WINDOW) {
        note.visible = true;
        this.callbacks.onNoteShow?.(note);
      }
      if (delta < -HIT_WINDOW) {
        note.judged = true;
        this.judged++;
        this.combo = 0;
        this.callbacks.onJudgement?.('MISS', note);
        this.callbacks.onUpdate?.(this.snapshot());
      }
    }
    if (this.judged >= this.chart.notes.length) this.active = false;
  }

  hit(lane, songTime) {
    if (!this.active) return null;
    const candidates = this.chart.notes.filter(note => !note.judged && note.lane === lane && Math.abs(note.time - songTime) <= HIT_WINDOW);
    if (!candidates.length) {
      this.callbacks.onJudgement?.('EMPTY', { lane });
      return { grade: 'EMPTY', points: 0 };
    }
    const note = candidates.reduce((a, b) => Math.abs(a.time - songTime) <= Math.abs(b.time - songTime) ? a : b);
    const error = Math.abs(note.time - songTime);
    const grade = error <= 0.065 ? 'PERFECT' : error <= 0.12 ? 'GREAT' : 'GOOD';
    const base = grade === 'PERFECT' ? 1000 : grade === 'GREAT' ? 700 : 400;
    const points = base + Math.min(this.combo, 100) * 5;
    note.judged = true;
    this.judged++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score += points;
    this.callbacks.onJudgement?.(grade, note);
    this.callbacks.onUpdate?.(this.snapshot());
    if (this.judged >= this.chart.notes.length) this.active = false;
    return { grade, points, error };
  }

  snapshot() {
    return { score: this.score, combo: this.combo, maxCombo: this.maxCombo, judged: this.judged, total: this.chart.notes.length };
  }
  stop() { this.active = false; }
}

export function laneForKey(key) {
  const index = KEYS.indexOf(String(key).toLowerCase());
  return index < 0 ? null : index;
}
