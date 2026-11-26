import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpatialGrid, circleHit, rectCircleHit } from '../web/src/grid.js';
import {
  createGame, update, addXp, chooseOption, candidateOptions, rollChoices, openChest, evolvable,
  spawnEnemy, weaponStats, addPassive, addWeapon, damageEnemy, mulberry32, runReward, rerollChoices,
} from '../web/src/logic.js';
import { WEAPONS, PASSIVES, CHARACTERS, STAGES, BASE_WEAPON_IDS, MAX_WEAPONS, WEAPON_MAX_LEVEL, xpForLevel } from '../web/src/data.js';
import { autoPilot } from '../web/src/input.js';

const quiet = (o = {}) => createGame({ seed: 7, noSpawn: true, ...o });

test('데이터: 캐릭터 3명 이상, 무기 8종 이상(진화 전), 판 3개 이상, 진화 짝이 모두 있다', () => {
  assert.ok(CHARACTERS.length >= 3);
  assert.ok(BASE_WEAPON_IDS.length >= 8);
  assert.ok(STAGES.length >= 3);
  for (const id of BASE_WEAPON_IDS) {
    const evo = WEAPONS[id].evo;
    if (!evo) continue;
    assert.ok(PASSIVES[evo.passive], `${id} 짝 장신구`);
    assert.ok(WEAPONS[evo.into]?.evolved, `${id} 진화 무기`);
  }
  for (const c of CHARACTERS) assert.ok(WEAPONS[c.weapon]);
  for (const s of STAGES) assert.ok(s.waves[0][0] === 0 && s.duration > 60);
});

test('공간 격자: 질의 결과가 전수 비교와 같다', () => {
  const rnd = mulberry32(3);
  const pts = Array.from({ length: 1500 }, () => ({ x: (rnd() - 0.5) * 3000, y: (rnd() - 0.5) * 3000 }));
  const grid = new SpatialGrid(64, 56, 56, 16);
  grid.build(pts, pts.length, 0, 0);
  for (let q = 0; q < 50; q++) {
    const x = (rnd() - 0.5) * 2000, y = (rnd() - 0.5) * 2000, r = 20 + rnd() * 150;
    const got = new Set();
    grid.query(x, y, r, (i) => { if (Math.hypot(pts[i].x - x, pts[i].y - y) <= r) got.add(i); return false; });
    const want = new Set(pts.map((p, i) => [p, i]).filter(([p]) => Math.hypot(p.x - x, p.y - y) <= r && Math.abs(p.x) < 1792 && Math.abs(p.y) < 1792).map(([, i]) => i));
    assert.deepEqual([...got].sort(), [...want].sort());
  }
});

test('충돌 함수: 원·회전 사각형', () => {
  assert.ok(circleHit(0, 0, 5, 9, 0, 5));
  assert.ok(!circleHit(0, 0, 5, 11, 0, 5));
  assert.ok(rectCircleHit(0, 0, 0, 100, 20, 45, 0, 3));
  assert.ok(!rectCircleHit(0, 0, 0, 100, 20, 0, 30, 3));
  assert.ok(rectCircleHit(0, 0, Math.PI / 2, 100, 20, 0, 45, 3));
});

test('투사체가 적을 맞혀 쓰러뜨리면 별가루가 떨어지고 처치 수가 오른다', () => {
  const g = quiet();
  const e = spawnEnemy(g, 'soot', 120, 0);
  e.hp = 5;
  for (let i = 0; i < 90 && g.kills === 0; i++) update(g, 1 / 30);
  assert.equal(g.kills, 1);
  assert.equal(g.enemies.length, 0);
  assert.ok(g.gems.length >= 1);
});

test('꿰뚫기: 한 발이 일렬의 적 여럿을 맞힌다', () => {
  const g = quiet();
  g.weapons[0].level = WEAPON_MAX_LEVEL; // 등불 구슬 꿰뚫기 2
  g.weapons[0].id = 'halo'; g.weapons[0].level = 1; // 꿰뚫기 6
  for (let i = 0; i < 5; i++) { const e = spawnEnemy(g, 'soot', 100 + i * 25, 0); e.hp = e.maxHp = 1e6; e.speed = 0; }
  g.weapons[0].timer = 0;
  for (let i = 0; i < 20; i++) update(g, 1 / 60);
  const hit = g.enemies.filter((e) => e.hp < 1e6).length;
  assert.ok(hit >= 4, `맞은 적 ${hit}`);
});

test('적과 닿으면 체력이 줄고, 무적 시간 동안 또 깎이지 않으며, 방어가 피해를 줄인다', () => {
  const g = quiet();
  g.weapons.length = 0;
  const e = spawnEnemy(g, 'scare', 0, 0);
  e.speed = 0;
  const hp0 = g.player.hp;
  update(g, 1 / 60);
  const d1 = hp0 - g.player.hp;
  assert.equal(d1, e.dmg);
  update(g, 1 / 60);
  assert.equal(hp0 - g.player.hp, d1, '무적 시간');
  const g2 = quiet({ meta: { armor: 3 } });
  g2.weapons.length = 0;
  const e2 = spawnEnemy(g2, 'scare', 0, 0); e2.speed = 0;
  const h2 = g2.player.hp;
  update(g2, 1 / 60);
  assert.equal(h2 - g2.player.hp, e2.dmg - 3);
});

test('레벨업: 경험치가 차면 서로 다른 선택지 셋이 나오고 고르면 반영된다', () => {
  const g = quiet();
  addXp(g, xpForLevel(1));
  assert.equal(g.player.level, 2);
  assert.ok(g.choices && g.choices.length === 3);
  const keys = g.choices.map((o) => o.type + o.id);
  assert.equal(new Set(keys).size, 3);
  const o = g.choices[0];
  chooseOption(g, 0);
  assert.equal(g.choices, null);
  if (o.type === 'weapon') assert.equal(g.weapons.find((w) => w.id === o.id).level, o.level);
  else assert.equal(g.passives.find((p) => p.id === o.id).level, o.level);
  // 한꺼번에 여러 레벨
  addXp(g, xpForLevel(2) + xpForLevel(3) + 1);
  assert.equal(g.pending, 2);
  chooseOption(g, 0);
  assert.ok(g.choices, '두 번째 선택지');
  chooseOption(g, 1);
  assert.equal(g.pending, 0);
  assert.equal(g.choices, null);
});

test('레벨업 중에는 시간이 멈춘다, 다시 뽑기 횟수', () => {
  const g = quiet({ meta: { reroll: 1 } });
  addXp(g, 100);
  const t = g.t;
  update(g, 0.5);
  assert.equal(g.t, t);
  assert.ok(rerollChoices(g));
  assert.ok(!rerollChoices(g));
});

test('선택지 후보: 무기 칸이 차면 새 무기가 나오지 않고, 최대 단계는 빠진다', () => {
  const g = quiet();
  for (const id of BASE_WEAPON_IDS.slice(1, MAX_WEAPONS)) addWeapon(g, id);
  assert.equal(g.weapons.length, MAX_WEAPONS);
  assert.ok(!addWeapon(g, 'salt'));
  const c = candidateOptions(g);
  assert.ok(c.every((o) => !(o.type === 'weapon' && o.level === 1)));
  for (const w of g.weapons) w.level = WEAPON_MAX_LEVEL;
  assert.ok(candidateOptions(g).every((o) => o.type !== 'weapon'));
  // 다 차면 주먹밥·엽전
  for (const id of Object.keys(PASSIVES).slice(0, 6)) { addPassive(g, id); while (addPassive(g, id)); }
  assert.deepEqual(rollChoices(g).map((o) => o.type), ['heal', 'coins']);
});

test('진화: 최대 단계 무기 + 짝 장신구 + 복주머니 → 진화 무기', () => {
  const g = quiet();
  const w = g.weapons[0];
  assert.equal(w.id, 'lamp');
  w.level = WEAPON_MAX_LEVEL;
  assert.equal(evolvable(g).length, 0, '장신구 없으면 진화 못 함');
  let r = openChest(g);
  assert.equal(r.type, 'coins');
  addPassive(g, 'wick');
  assert.equal(evolvable(g).length, 1);
  r = openChest(g);
  assert.deepEqual(r, { type: 'evolve', from: 'lamp', to: 'halo' });
  assert.equal(w.id, 'halo');
  // 진화한 무기는 다시 새 무기로 나오지 않는다
  assert.ok(!candidateOptions(g).some((o) => o.id === 'lamp' || o.id === 'halo'));
});

test('진화 전 무기는 상자에서 한 단계 오른다', () => {
  const g = quiet();
  const r = openChest(g);
  assert.deepEqual(r, { type: 'upgrade', id: 'lamp', level: 2 });
});

test('복주머니 줍기로 진화가 일어난다(실제 고리)', () => {
  const g = quiet({ character: 'mir' });
  g.weapons[0].level = WEAPON_MAX_LEVEL;
  addPassive(g, 'brass');
  g.pickups.push({ kind: 'chest', x: 5, y: 0 });
  update(g, 1 / 60);
  assert.equal(g.weapons[0].id, 'greatbell');
});

test('무기 레벨 수치는 단계마다 쌓인다', () => {
  const a = weaponStats('lamp', 1), b = weaponStats('lamp', 6);
  assert.equal(a.amount, 1);
  assert.equal(b.amount, 3);
  assert.ok(b.dmg > a.dmg && b.cd < a.cd);
});

test('모든 무기(진화 포함)가 적에게 피해를 준다', () => {
  for (const id of Object.keys(WEAPONS)) {
    const g = quiet();
    g.weapons[0] = { id, level: WEAPONS[id].evolved ? 1 : 3, timer: 0, active: 0, angle: 0, tickT: 0 };
    for (let i = 0; i < 30; i++) { const a = i * 0.7; const e = spawnEnemy(g, 'soot', Math.cos(a) * (40 + i * 6), Math.sin(a) * (40 + i * 6)); e.hp = e.maxHp = 1e6; e.speed = 0; }
    g.player.inv = 1e9;
    for (let i = 0; i < 300; i++) update(g, 1 / 60);
    assert.ok(g.damageDone > 0, `${id} 피해 ${g.damageDone}`);
  }
});

test('판: 마지막 1분에 우두머리, 새벽이 오면 깸', () => {
  const g = createGame({ seed: 2, stage: 'reeds', duration: 90 });
  g.player.inv = 1e9;
  let bossAt = null;
  for (let i = 0; i < 95 * 30 && !g.over; i++) {
    update(g, 1 / 30);
    while (g.choices) chooseOption(g, 0);
    if (g.bossSpawned && bossAt === null) bossAt = g.t;
  }
  assert.ok(bossAt !== null && Math.abs(bossAt - 72) < 1, `보스 ${bossAt}`); // 90 - 60*(90/300)
  assert.ok(g.over && g.won);
  assert.ok(runReward(g) >= 60);
});

test('체력이 0이 되면 끝, 수호 부적이 있으면 한 번 일어선다', () => {
  const g = quiet({ meta: { revive: 1 } });
  g.weapons.length = 0;
  g.player.hp = 1;
  const e = spawnEnemy(g, 'scare', 0, 0); e.speed = 0;
  update(g, 1 / 60);
  assert.ok(!g.over);
  assert.equal(g.player.hp, g.player.maxHp * 0.5);
  g.player.inv = 0; g.player.hp = 1;
  e.x = g.player.x; e.y = g.player.y; e.kx = e.ky = 0;
  update(g, 1 / 60);
  assert.ok(g.over && !g.won);
});

test('적 500마리 한 걸음 로직 시간(성능)', () => {
  const g = quiet();
  g.player.inv = 1e9;
  for (const id of ['pine', 'bell', 'kite', 'firefly', 'charm']) addWeapon(g, id);
  for (let i = 0; i < 500; i++) { const a = i * 2.399, r = 80 + Math.sqrt(i) * 25; const e = spawnEnemy(g, 'soot', Math.cos(a) * r, Math.sin(a) * r); e.hp = e.maxHp = 1e9; }
  for (let i = 0; i < 30; i++) update(g, 1 / 60);
  const t0 = performance.now();
  const N = 120;
  for (let i = 0; i < N; i++) update(g, 1 / 60);
  const ms = (performance.now() - t0) / N;
  assert.equal(g.enemies.length, 500);
  console.log(`  500마리 한 걸음 평균 ${ms.toFixed(2)}ms`);
  assert.ok(ms < 8, `${ms}ms`);
});

test('자동 플레이 90초: 숫자가 망가지지 않고 그을음을 물리친다', () => {
  const g = createGame({ seed: 11, stage: 'reeds', character: 'haesol' });
  for (let i = 0; i < 90 * 30 && !g.over; i++) {
    update(g, 1 / 30, autoPilot(g));
    while (g.choices) chooseOption(g, 0);
  }
  assert.ok(Number.isFinite(g.player.x) && Number.isFinite(g.player.hp));
  assert.ok(g.kills > 50, `처치 ${g.kills}`);
  assert.ok(g.player.level >= 4, `레벨 ${g.player.level}`);
});

test('피해 배율(풀무)이 피해에 곱해진다', () => {
  const g = quiet();
  const e = spawnEnemy(g, 'elite', 500, 500);
  const h = e.hp;
  damageEnemy(g, e, 10);
  addPassive(g, 'bellows');
  damageEnemy(g, e, 10);
  assert.ok(Math.abs((h - e.hp) - (10 + 11)) < 1e-9);
});
