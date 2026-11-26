# 새벽 등불지기 (Dawn Lampkeepers)

해가 뜨지 않는 긴 밤, 그을음 무리가 마을로 몰려옵니다. 등불지기가 되어 새벽 종이 울릴 때까지 버티는 서바이버류 웹 게임입니다.
움직이기만 하면 무기가 저절로 공격하고, 그을음이 떨어뜨린 별가루로 레벨을 올려 셋 중 하나를 고릅니다.

- Canvas 2D, 빌드 의존성 없음(`web/` 폴더만 정적으로 올리면 됨), 한국어 UI, 휴대폰 세로 화면 지원
- 조작: 키보드 WASD·방향키 / 휴대폰은 화면을 눌러 끄는 가상 조이스틱 / 게임패드 왼쪽 스틱. 레벨업은 1·2·3 키, Esc 로 멈춤
- 등불지기 5명(소담·해솔·미르·다래·돌쇠), 무기 9종 + 진화 무기 8종, 장신구 10종
- 판 3개: 갈대 들판(5분)·안개 저수지(6분)·잠든 종탑(7분). 마지막 1분에 우두머리, 새벽이 오면 깸
- 진화: 6단계 무기 + 짝 장신구를 갖고 복주머니(큰 그을음·우두머리가 떨어뜨림)를 열기
- 영구 강화: 엽전으로 10종 강화·캐릭터 데려오기, 진행은 이 기기(localStorage)에만 저장
- 성능: 공간 격자(계수 정렬)로 충돌·밀어내기, 적 500마리에서 60fps(헤드리스 측정 프레임당 작업 약 1ms)

## 실행

```sh
npm run serve     # http://127.0.0.1:8650/
npm test          # 단위 시험(충돌·레벨업·진화·저장 등)
npm run build     # 모듈 검사 후 dist/ 로 복사
npm run sim       # 자동 플레이 밸런스 시뮬레이션
```

헤드리스 스모크(30초 자동 플레이·적 500마리 측정)는 Playwright 가 필요합니다. 설치하지 않고 다른 곳의 것을 쓸 수 있습니다.

```sh
PLAYWRIGHT_MODULE=/경로/node_modules/playwright/index.mjs [BROWSER_EXECUTABLE=/경로/chrome-headless-shell] npm run test:e2e
```

주소 뒤에 `?auto=1` 을 붙이면 자동 플레이, `?bench=500` 은 적 500마리 측정 모드입니다.

## 참고

같은 장르의 MIT 게임 [VOID-SURVIVORS](https://github.com/Amrendra-gupta/VOID-SURVIVORS)를 REA 로 정적 분석해 구조만 참고했습니다(코드 복사 없음). 기록은 [`docs/rea/void-survivors-analysis.md`](docs/rea/void-survivors-analysis.md).
이름·세계관·캐릭터·그림은 모두 이 게임을 위해 새로 만들었습니다.

라이선스: MIT
