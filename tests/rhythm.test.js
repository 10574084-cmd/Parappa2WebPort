import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDemoChart, RhythmSession, laneForKey } from '../src/rhythm.js';

test('demo chart uses requested tempo and offset', () => {
  const chart = makeDemoChart(120, 2, 125);
  assert.equal(chart.bpm, 120);
  assert.equal(chart.beat, 0.5);
  assert.equal(chart.notes[0].time, 2.125);
  assert.ok(chart.notes.length > 0);
});

test('perfect hit adds points and combo', () => {
  const chart = makeDemoChart(96, 1);
  const session = new RhythmSession(chart);
  session.start(0);
  const note = chart.notes[0];
  const result = session.hit(note.lane, note.time + 0.01);
  assert.equal(result.grade, 'PERFECT');
  assert.equal(session.combo, 1);
  assert.equal(session.score, 1000);
});

test('expired note becomes a miss and resets combo', () => {
  const chart = { bpm: 120, beat: 0.5, duration: 5, notes: [
    { id: 0, time: 1, lane: 0, judged: false, visible: false },
    { id: 1, time: 2, lane: 1, judged: false, visible: false }
  ] };
  const session = new RhythmSession(chart);
  session.start(0);
  session.combo = 4;
  session.update(1.25);
  assert.equal(chart.notes[0].judged, true);
  assert.equal(session.combo, 0);
  assert.equal(session.judged, 1);
});

test('keyboard mapping is case-insensitive', () => {
  assert.equal(laneForKey('j'), 0);
  assert.equal(laneForKey('K'), 1);
  assert.equal(laneForKey('l'), 2);
  assert.equal(laneForKey('x'), null);
});
