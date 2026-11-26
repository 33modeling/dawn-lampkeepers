// Playwright 불러오기: 설치하지 않고 PLAYWRIGHT_MODULE(다른 곳의 node_modules/playwright/index.mjs)이나 이 레포의 node_modules 를 쓴다.
// 브라우저 판이 안 맞으면 BROWSER_EXECUTABLE 로 실행 파일을 직접 준다. 없으면 시험을 건너뛴다. GPU 는 쓰지 않는다.
export async function launch() {
  try {
    const mod = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
    const pw = mod.chromium ? mod : mod.default;
    const exe = process.env.BROWSER_EXECUTABLE;
    return await pw.chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--disable-gpu', '--mute-audio'] });
  } catch {
    return null;
  }
}
export function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}
