// 빌드: web/ 을 검사(모듈 문법·참조 파일)한 뒤 dist/ 로 복사한다. 외부 패키지 없음.
import { cpSync, rmSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const web = join(root, 'web'), dist = join(root, 'dist');
const js = readdirSync(join(web, 'src')).filter((f) => f.endsWith('.js'));
for (const f of js) execFileSync(process.execPath, ['--check', join(web, 'src', f)]);
const html = readFileSync(join(web, 'index.html'), 'utf8');
for (const m of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)) {
  if (!existsSync(join(web, m[1]))) throw new Error(`없는 파일: ${m[1]}`);
}
for (const f of js) {
  for (const m of readFileSync(join(web, 'src', f), 'utf8').matchAll(/from '\.\/([^']+)'/g)) {
    if (!existsSync(join(web, 'src', m[1]))) throw new Error(`${f}: 없는 모듈 ${m[1]}`);
  }
}
rmSync(dist, { recursive: true, force: true });
cpSync(web, dist, { recursive: true });
console.log(`빌드 끝: 모듈 ${js.length}개 검사, dist/ 에 복사`);
