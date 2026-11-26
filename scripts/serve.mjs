// 개발용 정적 서버: node scripts/serve.mjs [포트]
import { startServer } from '../tests/e2e/server.mjs';
const srv = await startServer(Number(process.argv[2] || 8650));
console.log(`새벽 등불지기: ${srv.url}`);
