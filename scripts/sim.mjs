// 밸런스 확인용 자동 플레이 시뮬레이션: node scripts/sim.mjs [판 id] [초]
import { createGame, update, chooseOption } from '../web/src/logic.js';
import { autoPilot } from '../web/src/input.js';
import { CHARACTERS } from '../web/src/data.js';

const stage = process.argv[2] || 'reeds';
const meta = process.argv[3] ? JSON.parse(process.argv[3]) : {};
for (const c of CHARACTERS) {
  const g = createGame({ seed: 11, stage, character: c.id, meta });
  let maxE = 0;
  while (!g.over) {
    update(g, 1 / 30, autoPilot(g));
    while (g.choices) chooseOption(g, Math.floor(g.rng() * g.choices.length));
    maxE = Math.max(maxE, g.enemies.length);
  }
  console.log(`${c.id.padEnd(7)} ${g.won ? '깸 ' : '짐 '} ${g.t.toFixed(0).padStart(4)}초 처치 ${String(g.kills).padStart(5)} Lv ${String(g.player.level).padStart(2)} 최대 적 ${maxE} 보스 ${g.bossKilled ? 'O' : 'X'} ${g.weapons.map((w) => w.id + w.level).join(',')}`);
}
