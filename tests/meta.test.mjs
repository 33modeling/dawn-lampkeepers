import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSave, writeSave, buyUpgrade, refundAll, unlockChar, stageOpen, applyRun, defaultSave, SAVE_KEY } from '../web/src/meta.js';
import { STAGES, META_UPGRADES, metaCost } from '../web/src/data.js';

const memStore = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };

test('저장: 없거나 깨지거나 막혀 있으면 기본값', () => {
  assert.deepEqual(loadSave(memStore()), defaultSave());
  const s = memStore(); s.setItem(SAVE_KEY, '{망가짐');
  assert.deepEqual(loadSave(s), defaultSave());
  const bad = { getItem() { throw new Error('막힘'); }, setItem() { throw new Error('막힘'); } };
  assert.deepEqual(loadSave(bad), defaultSave());
  assert.equal(writeSave(defaultSave(), bad), false);
});

test('저장 왕복과 영구 강화 사기·되돌리기', () => {
  const st = memStore();
  const s = defaultSave();
  s.coins = 1000;
  assert.ok(buyUpgrade(s, 'might'));
  assert.ok(buyUpgrade(s, 'might'));
  const up = META_UPGRADES.find((u) => u.id === 'might');
  assert.equal(s.coins, 1000 - metaCost(up, 0) - metaCost(up, 1));
  writeSave(s, st);
  const back = loadSave(st);
  assert.equal(back.upgrades.might, 2);
  refundAll(back);
  assert.equal(back.coins, 1000);
  assert.deepEqual(back.upgrades, {});
  const poor = defaultSave();
  assert.ok(!buyUpgrade(poor, 'might'));
});

test('캐릭터 데려오기와 판 열림', () => {
  const s = defaultSave();
  assert.ok(!unlockChar(s, 'darae'));
  s.coins = 500;
  assert.ok(unlockChar(s, 'darae'));
  assert.ok(s.chars.includes('darae'));
  assert.ok(stageOpen(s, STAGES[0]));
  assert.ok(!stageOpen(s, STAGES[1]));
  applyRun(s, { stageId: 'reeds', won: true, time: 300, kills: 900, reward: 120, level: 30 });
  assert.ok(stageOpen(s, STAGES[1]));
  assert.ok(!stageOpen(s, STAGES[2]));
  assert.equal(s.best.reeds.kills, 900);
});
