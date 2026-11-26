// 헤드리스 브라우저 스모크: 첫 화면, 30초 자동 플레이, 적 500마리 프레임 측정, 휴대폰 화면 가로 넘침
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { startServer } from './server.mjs';
import { launch, watchErrors } from './browser.mjs';

let srv, browser;
const SHOTS = process.env.SHOTS_DIR || 'shots';
before(async () => { srv = await startServer(0); browser = await launch(); mkdirSync(SHOTS, { recursive: true }); });
after(async () => { await browser?.close(); srv?.close(); });

test('첫 화면이 뜨고 메뉴 단추가 44px 이상, 가로 넘침 없음(휴대폰)', async (t) => {
  if (!browser) return t.skip('playwright 없음');
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errors = watchErrors(page);
  await page.goto(srv.url);
  await page.waitForSelector('#title:not([hidden])');
  await page.screenshot({ path: `${SHOTS}/title-mobile.png` });
  const r = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, w: innerWidth,
    small: [...document.querySelectorAll('#title button')].filter((b) => b.getBoundingClientRect().height < 44).length,
  }));
  assert.ok(r.sw <= r.w, `가로 ${r.sw} > ${r.w}`);
  assert.equal(r.small, 0);
  await page.click('#toSelect');
  await page.waitForSelector('#select:not([hidden])');
  const sw = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  assert.ok(sw);
  await page.screenshot({ path: `${SHOTS}/select-mobile.png` });
  // 출발 → 터치로 조금 움직이기 → 레벨업 화면 기다리지 않고 멈춤
  await page.click('#startRun');
  await page.waitForFunction(() => window.__lamp.game && window.__lamp.game.t > 0.5);
  const x0 = await page.evaluate(() => window.__lamp.game.player.x);
  await page.mouse.move(200, 500); await page.mouse.down(); await page.mouse.move(300, 500, { steps: 5 });
  await page.waitForTimeout(700);
  await page.mouse.up();
  const x1 = await page.evaluate(() => window.__lamp.game.player.x);
  assert.ok(x1 > x0 + 20, `터치 조이스틱 이동 ${x0} → ${x1}`);
  // 레벨업 화면: 선택지 셋, 누르면 닫히고 무기·장신구가 늘어난다
  await page.evaluate(() => window.__lamp.giveXp(5));
  await page.waitForSelector('#levelup:not([hidden])');
  assert.equal(await page.locator('#choices button').count(), 3);
  await page.screenshot({ path: `${SHOTS}/levelup-mobile.png` });
  const before = await page.evaluate(() => { const g = window.__lamp.game; return g.weapons.reduce((a, w) => a + w.level, 0) + g.passives.length; });
  await page.locator('#choices button').first().click();
  await page.waitForSelector('#levelup', { state: 'hidden' });
  const afterN = await page.evaluate(() => { const g = window.__lamp.game; return g.weapons.reduce((a, w) => a + w.level, 0) + g.passives.length; });
  assert.equal(afterN, before + 1);
  assert.deepEqual(errors, []);
  await page.close();
});

test('30초 자동 플레이: 오류 없이 시간이 흐르고 그을음을 물리치며 레벨이 오른다', async (t) => {
  if (!browser) return t.skip('playwright 없음');
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  const errors = watchErrors(page);
  await page.goto(srv.url + '?auto=1&seed=5&char=mir');
  await page.waitForFunction(() => window.__lamp?.game);
  await page.waitForTimeout(30000);
  const s = await page.evaluate(() => { const g = window.__lamp.game; return { t: g.t, kills: g.kills, level: g.player.level, over: g.over, enemies: g.enemies.length, weapons: g.weapons.length, fps: window.__lamp.frameStats() }; });
  await page.screenshot({ path: `${SHOTS}/autoplay-30s.png` });
  console.log('  자동 플레이', JSON.stringify(s));
  assert.ok(s.t > 20, `게임 시간 ${s.t}`);
  assert.ok(s.kills > 10, `처치 ${s.kills}`);
  assert.ok(s.level >= 3, `레벨 ${s.level}`);
  assert.deepEqual(errors, []);
  await page.close();
});

test('적 500마리 프레임 시간 측정', async (t) => {
  if (!browser) return t.skip('playwright 없음');
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  const errors = watchErrors(page);
  await page.goto(srv.url + '?bench=500&seed=3');
  await page.waitForFunction(() => window.__lamp?.game);
  await page.evaluate(() => { window.__lamp.game.player.inv = 1e9; });
  await page.waitForTimeout(6000);
  const s = await page.evaluate(() => ({ enemies: window.__lamp.game.enemies.length, ...window.__lamp.frameStats() }));
  await page.screenshot({ path: `${SHOTS}/bench-500.png` });
  console.log('  500마리', JSON.stringify(s));
  assert.equal(s.enemies, 500);
  assert.ok(s.n > 30, '프레임이 돈다');
  assert.deepEqual(errors, []);
  await page.close();
});
