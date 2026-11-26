# REA 분석: VOID-SURVIVORS → 새벽 등불지기

## 1. 무엇을, 왜 분석했나

서바이버류(자동 공격, 몰려오는 무리, 경험치 보석, 레벨업 셋 중 하나, 시간 제한, 보스) 웹 게임을 새로 만들기 전에,
같은 장르의 작은 순수 JS 게임 하나를 REA(rea-agents 6.8.0)로 정적 분석해 **적 생성·충돌·업그레이드 구조**가
어떻게 짜여 있는지 확인했다. 코드는 옮기지 않았고, 동작 방식만 참고해 새로 썼다. 이름·세계관·캐릭터·그림은 모두 새로 만든 것이다.

## 2. 분석 대상 고르기

| 후보 | 판단 |
|---|---|
| Poncle/vampire-survivors-localisation | 번역 도구 — 게임 코드 아님 |
| leinstay/fury-survivors, hayeon9826/lion-world-phaser | Phaser 3 엔진 위 — 엔진 코드가 섞여 장르 규칙만 보기 어려움 |
| Joa-a/Shadow-Survival, tiny-ai-ops/Survivors-Like | 단일 HTML·작은 예제, 라이선스 확인이 덜 분명 |
| **Amrendra-gupta/VOID-SURVIVORS** | **MIT**, 순수 JS(의존성 0) 한 파일 `script.js`(29 KB), 자동 사격·웨이브·경험치 구슬·레벨업 셋 중 하나·저장 → **주 대상** |

### 받은 범위(shallow clone, 빌드·설치·실행 없음)

| 대상 | 커밋 | 라이선스 | 받은 파일 |
|---|---|---|---|
| Amrendra-gupta/VOID-SURVIVORS | `1e53cf9280ac` | MIT (Copyright (c) 2026 Amrendra Gupta) | `script.js` `index.html` `style.css` `README.md` `LICENSE` (5개, 그림·소리 파일 없음) |

## 3. REA 실행 기록

다시 돌리기: `bash docs/rea/scripts/run-rea.sh <작업 폴더>` (결과 요약은 `docs/rea/scripts/facts.py` 가 `evidence/` 에 쓴다).
모든 명령은 `nice -n 10 npx -y rea-agents@6.8.0 …` 로 돌렸고 종료 코드는 모두 0.

| # | 명령 | 대상 | 초 | 결과 |
|---|---|---|---|---|
| 1 | import-reference-source | 저장소 전체 | 1.7 | 파일 5개(CSS·HTML·JS·MD), 관계 0, 파싱 실패 0 |
| 2 | import-reference-source `--detail summary --outline-depth 3` | 같음 | 1.7 | 2.2 KB 요약 → `evidence/reference-source.summary.json` |
| 3 | analyze-javascript-application | `script.js` | 3.9 | 파싱 실패 0, AST 5,529, 의미 그래프 노드 2,967(식 2,123·호출 지점 320·속성 칸 184·함수 90), 관계 1,936, unknown 1,489, 함수 90개 중 이름 있음 73, 모듈 0 |
| 4–5 | inspect-analysis-view (summary·modules) | 앱 분석 결과 | 2.3–2.4 | 요약·모듈 참조 보기(9–11 KB) → `evidence/app-analysis.summary.json` 에 재정리 |
| 6 | trace-application-feature | 모듈 `script.js` 양방향 | 2.1 | 씨앗 2, 노드 7·간선 6, 관찰 10·추론 2 |
| 7–13 | trace-javascript-semantics (callers) | `updateSystems` `fireWeapon` `getThreeOptions` `apply` `determineEnemyType` `getSpawnInterval` `spawnEnemy` | 2.0–2.4 | 7개 모두 함수는 찾았지만(`found`) 호출자 관계 0 — 아래 한계 1 |
| 14–20 | trace-javascript-semantics (속성 영향) | `xp` `xpNeeded` `projCount` `critChance` `spawnTimer` `wave` `hp` | 2.0–2.5 | 모두 `ambiguous`. 읽기·쓰기 위치는 잡힘(아래 4절) |

각 실행의 출력 크기·SHA-256 은 `evidence/rea-runs.json`, 추적 요약(상태·씨앗·노드 위치)은 `evidence/trace-summaries.json`.

## 4. REA 가 알려 준 구조

- **한 파일, 클래스 9개**: 함수 목록(`app-analysis.summary.json` functions)에서 `SaveManager`(29행)·`AudioManager`(57)·`Player`(153)·`Enemy`(235)·`Projectile`(293)·`XpOrb`(323)·`Particle`·`FloatingText`·`UpgradeManager`(427)·`WaveManager`(460)·`Game`(496) 순서가 드러난다. 모듈 관계는 0(전역 스크립트).
- **적 생성**: `spawnTimer` 추적 — 628행에서 누적(`write`), 629행에서 `getSpawnInterval()` 과 비교, 631행에서 되돌림. `wave` 추적 — 471행(웨이브 넘김), 477·481·486·487행(생성 간격·체력 배율·종류 고르기)이 모두 웨이브 번호 하나를 읽는다. `spawnEnemy`(740행)는 화면 네 변 중 하나 바깥에서 낸다(직접 읽어 확인).
- **경험치·레벨업**: `xp`·`xpNeeded` 추적 — 684행(구슬 주울 때 더함), 760–763행(`checkLevelUp`: 넘으면 빼고 필요량에 1.4 를 곱함). `getThreeOptions`(441행)는 업그레이드 7개를 섞어 앞 셋을 고르고, `apply`(446행)가 id 별로 능력치를 바꾼다.
- **충돌**: `hp` 추적 — 649·650행(적이 플레이어에 닿음), 660·667행(투사체가 적에 맞음). 직접 읽어 보면 `updateSystems`(611행) 안에서 **적 배열 × 투사체 배열을 모두 짝지어 거리 비교**(공간 분할 없음).
- **발사**: `projCount`·`critChance` 추적 — 업그레이드(454·455행)가 쓰고 `fireWeapon`(704행) 721–730행이 읽는다. 가장 가까운 적 하나를 겨냥해 여러 발을 부채꼴로 쏜다.
- **저장**: `SaveManager` 가 localStorage 를 try/catch 로 감싸 최고 기록·누적 처치만 저장(영구 강화 없음).

## 5. 기능 비교와 새벽 등불지기의 구현

| 기능 | VOID-SURVIVORS 방식 | 새벽 등불지기 | 상태 |
|---|---|---|---|
| 적 생성 | 웨이브 번호로 간격·체력·종류 결정, 화면 네 변 바깥 | 판마다 `[시작초, 종류, 초당 수]` 표, 플레이어 둘레 원 바깥, 시간 배율, 너무 먼 적은 앞쪽으로 옮김, 최대 900 | 구현 |
| 충돌 | 적 × 투사체 전수 비교 | **공간 격자**(64px 칸, 계수 정렬로 매 프레임 재구성) — 투사체·궤도·장판·휘두르기·적끼리 밀기 모두 격자 질의 | 구현 |
| 경험치 | 구슬 120px 안이면 끌려옴, 필요량 ×1.4 | 별가루 3단계(1·5·25), 끌어당김 반경(장신구·영구 강화), 350개 넘으면 먼 것을 하나로 모음, 필요량은 구간별 일차식 | 구현 |
| 레벨업 | 7개 중 무작위 셋, 같은 것 계속 쌓기 | 무기 8종+장신구 10종 중 **가중치** 셋(가진 것 우선), 무기 6칸·장신구 6칸·최대 단계, 다 차면 주먹밥·엽전, 다시 뽑기 | 구현 |
| 무기 | 자동 사격 1종(발 수·치명타 업그레이드) | 9종(구슬·부채꼴·종 파동·궤도 연·숯불 장판·유도 반딧불·휘두르기·벼락·사방 소금) | 구현 |
| 무기 진화 | 없음 | 최대 단계 + 짝 장신구 + **복주머니**(큰 그을음·보스) → 진화 무기 8종 | 구현(새로 설계) |
| 시간 제한·보스 | 끝없는 웨이브, 6웨이브부터 드문 보스 | 판마다 새벽까지 5·6·7분, 마지막 1분에 우두머리(돌진), 새벽이면 깸 | 구현 |
| 판 | 하나 | 3판(갈대 들판·안개 저수지·잠든 종탑), 앞 판을 깨야 열림 | 구현 |
| 캐릭터 | 하나 | 5명(시작 무기·능력 보너스 다름, 2명은 엽전으로) | 구현 |
| 영구 진행 | 최고 기록만 저장 | 엽전으로 영구 강화 10종, 되돌리기, 캐릭터 데려오기, 판별 기록 | 구현 |
| 입력 | 키보드 | 키보드·터치 가상 조이스틱·게임패드(메뉴 이동 포함) | 구현 |
| 치명타 | 확률 2배 피해 | 없음 | 보류 |
| 합성 효과음 | Web Audio 로 매번 합성 | 짧은 합성음 몇 개(끌 수 있음) | 구현(간단) |
| 웨이브 표시·점수 | 웨이브 번호·점수 | 남은 시간·처치 수·엽전 | 바꿈 |
| 장애물·지형 | 없음 | 없음 | 보류 |

## 6. REA 의 한계(이번 분석에서 본 것)

1. **클래스 메서드 호출을 잇지 못함**: `this.fireWeapon()`·`this.waves.getSpawnInterval()` 처럼 `this` 를 거친 호출은 호출자 추적 7개 모두 관계 0. 누가 부르는지는 코드를 직접 읽어 확인했다.
2. **속성 흐름은 후보로만**: 속성 추적 7개 모두 `ambiguous`. 같은 이름 속성(`hp` 는 플레이어·적 둘 다)을 구분하지 못한다.
3. **모듈 기준 기능 추적은 한 파일 앱에서 의미가 적음**: 노드 7개로 끝나 기능 단위로 좁혀지지 않음.
4. **수치·정책은 보이지 않음**: ×1.4 필요량, 120px 끌어당김, 45초 웨이브 같은 값은 관계만 보이고 값은 직접 읽어야 했다.
5. **실행하지 않는 정적 분석**: 손맛·밀도·프레임 시간은 알 수 없다 — 새벽 등불지기는 자체 시뮬레이션(`scripts/sim.mjs`)과 헤드리스 스모크로 확인.
6. 결과 원본(앱 분석 4.8 MB)은 저장소에 넣지 않고 크기·SHA-256 만 남겼다. 결과 안의 로컬 경로는 `<target>` 으로 바꿨다.

## 7. 검증

- 단위 시험 `npm test`: 22개(공간 격자 = 전수 비교, 충돌 함수, 투사체 처치·꿰뚫기, 접촉 피해·무적·방어, 레벨업·연속 레벨업·다시 뽑기, 선택지 칸 제한, 진화·복주머니, 무기 17종 피해, 보스 시각·새벽 승리, 부활, 적 500마리 로직 시간, 90초 자동 플레이, 저장·영구 강화).
- 헤드리스 스모크 `npm run test:e2e`: 휴대폰 첫 화면·가로 넘침·터치 조이스틱 이동·레벨업 화면, 30초 자동 플레이, 적 500마리 프레임 측정.
