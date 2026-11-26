// 새벽 등불지기 — 화면 흐름(메뉴·판·레벨업·결과)과 게임 고리
import { CHARACTERS, STAGES, WEAPONS, PASSIVES, META_UPGRADES, ENEMIES, metaCost } from './data.js';
import { createGame, update, chooseOption, rerollChoices, runReward, spawnEnemy, weaponStats, addXp } from './logic.js';
import { render } from './render.js';
import { Input, autoPilot } from './input.js';
import { loadSave, writeSave, buyUpgrade, refundAll, unlockChar, stageOpen, applyRun } from './meta.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const AUTO = params.has('auto');
const BENCH = Number(params.get('bench') || 0);

const canvas = $('game');
const ctx = canvas.getContext('2d', { alpha: false });
const input = new Input(canvas, $('stick'), $('knob'));
let save = loadSave();
let sel = { char: params.get('char') || save.lastChar || 'sodam', stage: params.get('stage') || save.lastStage || 'reeds' };
let game = null;
let paused = false;
let shake = 0;
let W = 0, H = 0, dpr = 1;
const perf = { fps: 0, frames: 0, worst: 0, samples: [], work: [] };

// ───────── 소리(짧은 합성음) ─────────
let actx = null;
function beep(freq, dur = 0.08, type = 'square', vol = 0.04) {
  if (!save.settings.sound || AUTO) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), gn = actx.createGain();
    o.type = type; o.frequency.value = freq;
    gn.gain.setValueAtTime(vol, actx.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(gn).connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur);
  } catch { /* 소리 없이 계속 */ }
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  if (game) game.view = { w: W, h: H };
}
window.addEventListener('resize', resize);
resize();

// ───────── 화면 전환 ─────────
const screens = ['title', 'select', 'shop', 'help', 'levelup', 'pause', 'result'];
function show(id) {
  for (const s of screens) $(s).hidden = s !== id;
  $('hud').hidden = !(id === null || id === 'levelup' || id === 'pause');
  const first = id && $(id).querySelector('button:not([disabled])');
  if (first && !AUTO) first.focus({ preventScroll: true });
}

function persist() { writeSave(save); }

function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

function renderTitle() {
  $('purse').textContent = `가진 엽전 ${save.coins} · 판 ${save.runs}번 · 그을음 ${save.kills}마리 물리침`;
}

function renderSelect() {
  const cl = $('charList'); cl.innerHTML = '';
  for (const c of CHARACTERS) {
    const own = save.chars.includes(c.id);
    const b = document.createElement('button');
    b.className = 'card' + (sel.char === c.id ? ' on' : '');
    const W0 = WEAPONS[c.weapon];
    b.innerHTML = `<span class="nm" style="color:${c.color}">${c.name}</span><small>${c.title}</small><small>${W0.icon} ${W0.name}</small><small>${c.bonusText}</small>` +
      (own ? '' : `<small>🔒 엽전 ${c.cost}로 데려오기</small>`);
    b.onclick = () => {
      if (!own) { if (unlockChar(save, c.id)) { persist(); beep(660); } else { toast(`엽전이 ${c.cost - save.coins}개 모자라요`); return; } }
      sel.char = c.id; renderSelect();
    };
    cl.appendChild(b);
  }
  const sl = $('stageList'); sl.innerHTML = '';
  for (const s of STAGES) {
    const open = stageOpen(save, s);
    const b = document.createElement('button');
    b.className = 'card' + (sel.stage === s.id ? ' on' : '');
    b.disabled = !open;
    const best = save.best[s.id];
    b.innerHTML = `<span class="nm">${s.name}</span><small>${s.desc}</small><small>새벽까지 ${fmtTime(s.duration)} · 우두머리 ${ENEMIES[s.boss].name}</small>` +
      (open ? (save.cleared.includes(s.id) ? '<small>☀️ 깸</small>' : best ? `<small>최고 ${fmtTime(best.time)} 버팀</small>` : '') : '<small>🔒 앞 판을 깨면 열림</small>');
    b.onclick = () => { sel.stage = s.id; renderSelect(); };
    sl.appendChild(b);
  }
  if (!save.chars.includes(sel.char)) sel.char = 'sodam';
  const st = STAGES.find((s) => s.id === sel.stage);
  if (!st || !stageOpen(save, st)) sel.stage = 'reeds';
}

function renderShop() {
  $('shopPurse').textContent = `가진 엽전 ${save.coins}`;
  const l = $('shopList'); l.innerHTML = '';
  for (const up of META_UPGRADES) {
    const lv = save.upgrades[up.id] || 0;
    const b = document.createElement('button');
    b.className = 'card';
    const maxed = lv >= up.max;
    const cost = metaCost(up, lv);
    b.disabled = maxed || save.coins < cost;
    b.innerHTML = `<span class="nm">${up.name}</span><small>${up.desc}</small><small>${'●'.repeat(lv)}${'○'.repeat(up.max - lv)}</small><small>${maxed ? '다 올림' : `엽전 ${cost}`}</small>`;
    b.onclick = () => { if (buyUpgrade(save, up.id)) { persist(); beep(700); renderShop(); } };
    l.appendChild(b);
  }
}

function renderHelp() {
  const e = $('evoList'); e.innerHTML = '';
  for (const [id, w] of Object.entries(WEAPONS)) {
    if (!w.evo) continue;
    const P = PASSIVES[w.evo.passive], T = WEAPONS[w.evo.into];
    const d = document.createElement('div');
    d.textContent = `${w.icon} ${w.name} 6단계 + ${P.icon} ${P.name} → ${T.icon} ${T.name}`;
    e.appendChild(d);
  }
}

let toastT = 0;
function toast(msg, sec = 1.8) { $('toast').textContent = msg; $('toast').hidden = false; toastT = sec; }

// ───────── 판 시작·끝 ─────────
function startRun() {
  save.lastChar = sel.char; save.lastStage = sel.stage; persist();
  const dur = params.get('dur') ? Number(params.get('dur')) : undefined;
  game = createGame({ stage: sel.stage, character: sel.char, meta: save.upgrades, seed: Number(params.get('seed')) || (Date.now() & 0xffff), duration: dur, viewW: W, viewH: H, noSpawn: BENCH > 0 });
  if (BENCH) {
    const types = ['soot', 'leafbat', 'mistgob', 'frog', 'moth'];
    for (let i = 0; i < BENCH; i++) {
      const a = (i / BENCH) * Math.PI * 2 * 7, r = 120 + (i % 60) * 9;
      const e = spawnEnemy(game, types[i % types.length], Math.cos(a) * r, Math.sin(a) * r);
      e.hp = e.maxHp = 1e9;
    }
    game.player.inv = 1e9;
  }
  window.__lamp.game = game;
  paused = false;
  input.reset();
  perf.samples = []; perf.work = []; perf.worst = 0;
  show(null);
  renderSlots();
  last = performance.now();
}

function endRun() {
  const g = game;
  const reward = runReward(g);
  applyRun(save, { stageId: g.stage.id, won: g.won, time: g.t, kills: g.kills, reward, level: g.player.level });
  persist();
  $('resTitle').textContent = g.won ? '☀️ 새벽이 왔다!' : '등불이 꺼졌다…';
  const nextStage = STAGES.find((s) => s.requires === g.stage.id);
  $('resBody').innerHTML = `<p>${g.stage.name} · ${g.char.name}</p><p>버틴 시간 ${fmtTime(g.t)} · 레벨 ${g.player.level}</p><p>물리친 그을음 ${g.kills}마리${g.bossKilled ? ' · 우두머리 물리침' : ''}</p>` +
    `<p class="purse">엽전 +${reward} (모두 ${save.coins})</p>` + (g.won && nextStage ? `<p>새 판 열림: ${nextStage.name}</p>` : '');
  show('result');
  beep(g.won ? 880 : 180, 0.4, 'triangle', 0.06);
}

function renderSlots() {
  const s = $('slots'); s.innerHTML = '';
  for (const w of game.weapons) {
    const sp = document.createElement('span');
    const W0 = WEAPONS[w.id];
    if (W0.evolved) sp.className = 'evo';
    sp.textContent = `${W0.icon}${W0.evolved ? '★' : w.level}`;
    sp.title = W0.name;
    s.appendChild(sp);
  }
  for (const p of game.passives) {
    const sp = document.createElement('span');
    sp.textContent = `${PASSIVES[p.id].icon}${p.level}`;
    sp.title = PASSIVES[p.id].name;
    s.appendChild(sp);
  }
}

function describe(o) {
  if (o.type === 'weapon') {
    const W0 = WEAPONS[o.id];
    if (o.level === 1) return { ic: W0.icon, nm: W0.name, tag: '새 무기', desc: W0.desc };
    const prev = weaponStats(o.id, o.level - 1), next = weaponStats(o.id, o.level);
    const names = { dmg: '피해', cd: '재사용', amount: '개수', pierce: '꿰뚫기', radius: '범위', length: '길이', width: '폭', dur: '지속', spin: '회전', knock: '밀치기', spread: '퍼짐', speed: '속도', size: '크기', tick: '간격' };
    const diff = Object.keys(next).filter((k) => next[k] !== prev[k] && names[k]).map((k) => `${names[k]} ${+(next[k] - prev[k]).toFixed(2) > 0 ? '+' : ''}${+(next[k] - prev[k]).toFixed(2)}`);
    return { ic: W0.icon, nm: W0.name, tag: `${o.level}단계`, desc: diff.join(', ') || W0.desc };
  }
  if (o.type === 'passive') {
    const P = PASSIVES[o.id];
    return { ic: P.icon, nm: P.name, tag: o.level === 1 ? '새 장신구' : `${o.level}단계`, desc: P.desc };
  }
  if (o.type === 'heal') return { ic: '🍙', nm: '주먹밥', tag: '', desc: '체력 30 회복' };
  return { ic: '🪙', nm: '엽전 꾸러미', tag: '', desc: '엽전 20' };
}

function openLevelUp() {
  const g = game;
  $('luTitle').textContent = `레벨 ${g.player.level}! 하나를 고르세요`;
  const box = $('choices'); box.innerHTML = '';
  g.choices.forEach((o, i) => {
    const d = describe(o);
    const b = document.createElement('button');
    b.className = 'choice';
    // 진화 짝을 알려 준다
    const pairs = o.type === 'passive' && g.weapons.some((w) => WEAPONS[w.id].evo?.passive === o.id);
    const pairsW = o.type === 'weapon' && WEAPONS[o.id].evo && g.passives.some((p) => p.id === WEAPONS[o.id].evo.passive);
    if (pairs || pairsW) b.classList.add('evohint');
    b.innerHTML = `<span class="ic">${d.ic}</span><span class="nm">${i + 1}. ${d.nm}<em>${d.tag}</em></span><small>${d.desc}${pairs || pairsW ? ' · 진화 짝' : ''}</small>`;
    b.onclick = () => pick(i);
    box.appendChild(b);
  });
  $('reroll').textContent = `다시 뽑기 (${g.rerolls})`;
  $('reroll').hidden = g.rerolls <= 0;
  show('levelup');
  beep(520, 0.12, 'triangle');
}

function pick(i) {
  if (!game || !game.choices) return;
  chooseOption(game, i);
  renderSlots();
  if (game.choices) openLevelUp(); else { show(null); input.reset(); last = performance.now(); }
}

function setPause(on) {
  if (!game || game.over) return;
  paused = on;
  if (on) {
    $('pauseInfo').innerHTML = game.weapons.map((w) => `<p>${WEAPONS[w.id].icon} ${WEAPONS[w.id].name} ${WEAPONS[w.id].evolved ? '★' : w.level + '단계'}</p>`).join('') +
      game.passives.map((p) => `<p>${PASSIVES[p.id].icon} ${PASSIVES[p.id].name} ${p.level}단계</p>`).join('');
    $('soundBtn').textContent = save.settings.sound ? '소리 켬' : '소리 끔';
    show('pause');
  } else { show(null); input.reset(); last = performance.now(); }
}

// ───────── 단추 연결 ─────────
$('toSelect').onclick = () => { renderSelect(); show('select'); };
$('toShop').onclick = () => { renderShop(); show('shop'); };
$('toHelp').onclick = () => { renderHelp(); show('help'); };
$('selBack').onclick = $('shopBack').onclick = $('helpBack').onclick = () => { renderTitle(); show('title'); };
$('refund').onclick = () => { const n = refundAll(save); persist(); toast(`엽전 ${n}개를 돌려받았어요`); renderShop(); };
$('startRun').onclick = startRun;
$('again').onclick = startRun;
$('toMenu').onclick = () => { game = null; renderTitle(); show('title'); };
$('pauseBtn').onclick = () => setPause(true);
$('resume').onclick = () => setPause(false);
$('quit').onclick = () => { paused = false; game.over = true; endRun(); };
$('soundBtn').onclick = () => { save.settings.sound = !save.settings.sound; persist(); $('soundBtn').textContent = save.settings.sound ? '소리 켬' : '소리 끔'; };
$('reroll').onclick = () => { if (rerollChoices(game)) openLevelUp(); };

window.addEventListener('keydown', (e) => {
  if (!game || game.over) return;
  if (game.choices && /^Digit[1-4]$/.test(e.code)) { pick(Number(e.code.slice(5)) - 1); return; }
  if (game.choices && e.code === 'KeyR') { $('reroll').click(); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') setPause(!paused);
});
document.addEventListener('visibilitychange', () => { if (document.hidden && game && !game.over && !game.choices && !AUTO) setPause(true); });

// 게임패드: 메뉴에서는 D패드로 단추 사이를 옮기고 A 로 누른다
input.onPadButton = (b) => {
  if (game && !game.over && !game.choices && !paused) { if (b === 9) setPause(true); return; }
  const btns = [...document.querySelectorAll('section:not([hidden]) button:not([disabled]):not([hidden])')];
  if (!btns.length) return;
  let i = btns.indexOf(document.activeElement);
  if (b === 12 || b === 14) i = (i - 1 + btns.length) % btns.length;
  else if (b === 13 || b === 15) i = (i + 1) % btns.length;
  else if (b === 0) { (btns[i] || btns[0]).click(); return; }
  else if (b === 9 && paused) { setPause(false); return; }
  else return;
  btns[i].focus();
};

// ───────── 고리 ─────────
let last = performance.now();
let hudT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  if (dt > 0) {
    perf.fps = perf.fps ? perf.fps * 0.95 + (1 / dt) * 0.05 : 1 / dt;
    perf.frames++;
    if (game && !game.over && !paused && !game.choices) {
      perf.samples.push(dt * 1000);
      if (perf.samples.length > 600) perf.samples.shift();
    }
  }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').hidden = true; }
  if (!game) { input.pollPad(); return; }
  const w0 = performance.now();
  const live = !game.over && !paused && !game.choices;
  if (!game.over && !paused && !game.choices) {
    const v = AUTO ? autoPilot(game) : input.vector();
    // 큰 dt 는 잘게 나눠 돌린다(충돌 건너뜀 방지)
    let left = dt;
    while (left > 0 && !game.over && !game.choices) { const step = Math.min(left, 1 / 30); update(game, step, v); left -= step; }
    handleEvents();
    if (game.over) endRun();
  } else input.pollPad();
  if (game.choices && !game.over && $('levelup').hidden) {
    if (AUTO) { while (game.choices) chooseOption(game, 0); renderSlots(); } else openLevelUp();
  }
  if (shake > 0) shake = Math.max(0, shake - dt * 30);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render(ctx, game, W, H, { shake: save.settings.shake ? shake : 0 });
  if (live) { perf.work.push(performance.now() - w0); if (perf.work.length > 600) perf.work.shift(); }
  hudT -= dt;
  if (hudT <= 0) { hudT = 0.1; updateHud(); }
}

function handleEvents() {
  for (const ev of game.events) {
    if (ev.type === 'hurt') { shake = Math.min(10, shake + 5); beep(140, 0.06, 'sawtooth'); }
    else if (ev.type === 'boss') { toast(`⚠️ 우두머리 ${ENEMIES[ev.id].name} 나타남!`, 2.5); beep(110, 0.5, 'sawtooth', 0.06); }
    else if (ev.type === 'elite') toast('큰 그을음이 다가온다 — 복주머니를 떨어뜨린다', 2);
    else if (ev.type === 'chest') {
      const r = ev.result;
      if (r.type === 'evolve') toast(`✨ 진화! ${WEAPONS[r.from].name} → ${WEAPONS[r.to].name}`, 2.6);
      else if (r.type === 'upgrade') toast(`복주머니: ${WEAPONS[r.id].name} ${r.level}단계`);
      else toast(`복주머니: 엽전 ${r.amount}`);
      renderSlots(); beep(990, 0.2, 'triangle');
    } else if (ev.type === 'bossdown') toast('우두머리를 물리쳤다!', 2.2);
    else if (ev.type === 'revive') toast('수호 부적이 등불을 다시 밝혔다', 2);
    else if (ev.type === 'magnet') toast('자석 부적! 별가루가 모여든다');
  }
  game.events.length = 0;
}

function updateHud() {
  const g = game, p = g.player;
  $('xpfill').style.width = `${Math.min(100, (p.xp / p.xpNext) * 100)}%`;
  $('lvl').textContent = `Lv ${p.level}`;
  $('timer').textContent = `🌅 ${fmtTime(g.duration - g.t)}`;
  $('kills').textContent = `처치 ${g.kills}`;
  $('coins').textContent = `엽전 ${g.coins}`;
  const b = g.boss;
  $('bossbar').hidden = !b;
  if (b) { $('bossname').textContent = ENEMIES[b.type].name; $('bossfill').style.width = `${Math.max(0, (b.hp / b.maxHp) * 100)}%`; }
}

window.__lamp = {
  game: null, perf,
  start(opts = {}) { Object.assign(sel, opts); startRun(); },
  giveXp(n) { if (game) addXp(game, n); },
  frameStats() {
    const s = [...perf.samples].sort((a, b) => a - b);
    const avg = s.reduce((a, b) => a + b, 0) / (s.length || 1);
    const w = [...perf.work].sort((a, b) => a - b);
    const wavg = w.reduce((a, b) => a + b, 0) / (w.length || 1);
    return { n: s.length, avgMs: avg, p95Ms: s[Math.floor(s.length * 0.95)] || 0, fps: 1000 / (avg || 1), workAvgMs: wavg, workP95Ms: w[Math.floor(w.length * 0.95)] || 0 };
  },
};

renderTitle();
show('title');
if (AUTO || BENCH) startRun();
requestAnimationFrame(frame);
