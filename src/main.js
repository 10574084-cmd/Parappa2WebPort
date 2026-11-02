import { AudioClock } from './audio.js';
import { DEMO_BPM, makeDemoChart, makeSongChart, RhythmSession, laneForKey, NOTE_TRAVEL } from './rhythm.js';
import { StageRenderer } from './renderer.js';

const $ = id => document.getElementById(id);
const audio = new AudioClock($('audio'));
const renderer = new StageRenderer($('stage'), $('webglFallback'));
let chart = makeDemoChart();
let session = null;
let demoStart = 0;
let selectedFile = false;
let gamepadWasDown = [false, false, false];
let currentTrackDuration = chart.duration;
let finished = false;
const laneEls = Array.from(document.querySelectorAll('.lane'));

function showStatus(text, good = true) {
  $('statusText').textContent = text;
  $('statusDot').style.background = good ? 'var(--green)' : 'var(--yellow)';
}
function setJudgement(text) { $('judgement').textContent = text; }
function formatTime(seconds) {
  const value = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const m = Math.floor(value / 60), s = Math.floor(value % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
function updateScore(data) {
  $('score').textContent = String(data.score).padStart(6, '0');
  $('combo').textContent = String(data.combo);
}
function settings() {
  const bpm = Math.max(60, Math.min(220, Number($('bpmInput').value) || DEMO_BPM));
  const offset = Math.max(-500, Math.min(500, Number($('offsetInput').value) || 0));
  $('bpmInput').value = String(bpm);
  $('offsetInput').value = String(offset);
  $('bpmLabel').textContent = bpm + ' BPM';
  return { bpm, offset };
}
function renderNotes(songTime) {
  for (const lane of laneEls) lane.querySelector('.note-track').replaceChildren();
  if (!session) return;
  for (const noteData of chart.notes) {
    if (noteData.judged) continue;
    const delta = noteData.time - songTime;
    if (delta > NOTE_TRAVEL || delta < -0.2) continue;
    const note = document.createElement('i');
    note.className = 'note';
    const progress = 1 - delta / NOTE_TRAVEL;
    note.style.left = Math.max(0, Math.min(100, progress * 82)) + '%';
    laneEls[noteData.lane].querySelector('.note-track').append(note);
  }
}
function getSongTime() {
  return selectedFile ? audio.time : Math.max(0, (performance.now() - demoStart) / 1000);
}
function hit(laneIndex) {
  if (!session?.active || (selectedFile && !audio.playing)) return;
  session.hit(laneIndex, getSongTime());
  laneEls[laneIndex].classList.add('flash');
  setTimeout(() => laneEls[laneIndex].classList.remove('flash'), 90);
}
function finishSession() {
  if (finished) return;
  finished = true;
  if (selectedFile) audio.pause();
  $('startButton').disabled = false;
  $('stopButton').disabled = true;
  showStatus('SESSION COMPLETE');
  setJudgement('FINISH');
}
function resetSession() {
  audio.pause();
  session?.stop();
  session = null;
  finished = false;
  $('startButton').disabled = false;
  $('stopButton').disabled = true;
  $('progressBar').style.width = '0%';
  $('timeLabel').textContent = '00:00 / ' + formatTime(currentTrackDuration);
  setJudgement('READY');
  showStatus('ENGINE READY');
  renderNotes(0);
}
function createSession(nextChart) {
  chart = nextChart;
  session = new RhythmSession(chart, {
    onUpdate: updateScore,
    onJudgement: grade => setJudgement(grade)
  });
  finished = false;
  session.start(0);
}
function startDemo() {
  selectedFile = false;
  const config = settings();
  chart = makeDemoChart(config.bpm, 12, config.offset);
  currentTrackDuration = chart.duration;
  $('trackName').textContent = 'Built-in timing chart · ' + config.bpm + ' BPM';
  createSession(chart);
  demoStart = performance.now();
  $('startButton').disabled = true;
  $('stopButton').disabled = false;
  showStatus('DEMO RUNNING');
}
async function startSession() {
  try {
    if (!selectedFile) { startDemo(); return; }
    const config = settings();
    currentTrackDuration = audio.duration || 24;
    chart = makeSongChart(config.bpm, currentTrackDuration, config.offset);
    createSession(chart);
    await audio.play();
    $('startButton').disabled = true;
    $('stopButton').disabled = false;
    showStatus('TRACK PLAYING');
  } catch (error) {
    session?.stop();
    session = null;
    showStatus('AUDIO ERROR', false);
    setJudgement('ERROR');
    alert(error.message);
    $('startButton').disabled = false;
    $('stopButton').disabled = true;
  }
}
$('startButton').addEventListener('click', startSession);
$('stopButton').addEventListener('click', resetSession);
$('bpmInput').addEventListener('change', settings);
$('offsetInput').addEventListener('change', settings);
$('trackFile').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  resetSession();
  try {
    const meta = await audio.load(file);
    selectedFile = true;
    currentTrackDuration = meta.duration;
    $('trackName').textContent = meta.name;
    $('timeLabel').textContent = '00:00 / ' + formatTime(meta.duration);
    showStatus('AUDIO LOADED');
  } catch (error) {
    selectedFile = false;
    alert(error.message);
    showStatus('LOAD FAILED', false);
  }
});
window.addEventListener('keydown', event => {
  if (event.repeat || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  const laneIndex = laneForKey(event.key);
  if (laneIndex !== null) { event.preventDefault(); hit(laneIndex); }
});
laneEls.forEach((element, index) => element.addEventListener('pointerdown', () => hit(index)));
function pollGamepad() {
  const pads = navigator.getGamepads?.() || [];
  const pad = Array.from(pads).find(Boolean);
  if (!pad) { gamepadWasDown = [false, false, false]; return; }
  const buttons = [pad.buttons[0]?.pressed, pad.buttons[1]?.pressed, pad.buttons[2]?.pressed];
  buttons.forEach((down, index) => {
    if (down && !gamepadWasDown[index]) hit(index);
    gamepadWasDown[index] = !!down;
  });
}
function frame(now) {
  renderer.draw(now);
  pollGamepad();
  if (session?.active && !finished) {
    const time = getSongTime();
    session.update(time);
    renderNotes(time);
    $('progressBar').style.width = Math.min(100, currentTrackDuration ? time / currentTrackDuration * 100 : 0) + '%';
    $('timeLabel').textContent = formatTime(time) + ' / ' + formatTime(currentTrackDuration);
    if (!session.active || (selectedFile && audio.audio.ended) || (!selectedFile && time >= chart.duration)) finishSession();
  } else if (!session) {
    renderNotes(0);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.addEventListener('beforeunload', () => audio.dispose());
