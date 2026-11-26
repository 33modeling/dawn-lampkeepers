// 영구 진행(엽전·영구 강화·캐릭터·판 열림·기록). localStorage 는 막혀 있을 수 있어 늘 try/catch.
import { META_UPGRADES, CHARACTERS, STAGES, metaCost } from './data.js';

export const SAVE_KEY = 'dawn-lampkeepers-v1';

export function defaultSave() {
  return { coins: 0, upgrades: {}, chars: CHARACTERS.filter((c) => !c.cost).map((c) => c.id), cleared: [], best: {}, runs: 0, kills: 0, settings: { sound: true, shake: true } };
}

export function loadSave(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const d = JSON.parse(raw);
    const s = { ...defaultSave(), ...d };
    s.settings = { ...defaultSave().settings, ...(d.settings || {}) };
    return s;
  } catch {
    return defaultSave();
  }
}

export function writeSave(save, storage = globalThis.localStorage) {
  try { storage?.setItem(SAVE_KEY, JSON.stringify(save)); return true; } catch { return false; }
}

export function buyUpgrade(save, id) {
  const up = META_UPGRADES.find((u) => u.id === id);
  if (!up) return false;
  const lv = save.upgrades[id] || 0;
  if (lv >= up.max) return false;
  const cost = metaCost(up, lv);
  if (save.coins < cost) return false;
  save.coins -= cost;
  save.upgrades[id] = lv + 1;
  return true;
}

export function refundAll(save) {
  let back = 0;
  for (const up of META_UPGRADES) {
    const lv = save.upgrades[up.id] || 0;
    for (let i = 0; i < lv; i++) back += metaCost(up, i);
  }
  save.coins += back;
  save.upgrades = {};
  return back;
}

export function unlockChar(save, id) {
  const c = CHARACTERS.find((x) => x.id === id);
  if (!c || save.chars.includes(id) || save.coins < c.cost) return false;
  save.coins -= c.cost;
  save.chars.push(id);
  return true;
}

export function stageOpen(save, stage) {
  return !stage.requires || save.cleared.includes(stage.requires);
}

// 판 결과 반영: 엽전·기록·깬 판
export function applyRun(save, { stageId, won, time, kills, reward, level }) {
  save.coins += reward;
  save.runs++;
  save.kills += kills;
  const b = save.best[stageId] || { time: 0, kills: 0, level: 0 };
  save.best[stageId] = { time: Math.max(b.time, Math.floor(time)), kills: Math.max(b.kills, kills), level: Math.max(b.level, level) };
  if (won && !save.cleared.includes(stageId)) save.cleared.push(stageId);
  return save;
}

export { STAGES };
