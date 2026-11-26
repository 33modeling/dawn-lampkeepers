#!/usr/bin/env bash
# 새벽 등불지기 REA 분석 다시 하기: 서바이버류 웹 게임 VOID-SURVIVORS(MIT)를 REA(rea-agents 6.8.0)로 정적 분석한다.
# 대상 코드는 내려받아 읽기만 한다(빌드·설치·실행 없음).
# 사용법: bash docs/rea/scripts/run-rea.sh <작업 폴더>   (Node 22, git, python3 필요)
set -euo pipefail
WORK=${1:?작업 폴더를 지정하세요}
HERE=$(cd "$(dirname "$0")" && pwd)
REA="nice -n 10 npx -y rea-agents@6.8.0"
T="$WORK/target/void"
if [ ! -d "$T" ]; then
  git init -q "$T"
  git -C "$T" remote add origin https://github.com/Amrendra-gupta/VOID-SURVIVORS.git
  git -C "$T" fetch -q --depth 1 origin 1e53cf9280ac073eddb1b7ab4da104c13d6c2952
  git -C "$T" checkout -q FETCH_HEAD
fi
mkdir -p "$WORK/work"; cd "$WORK/work"; rm -f runs.jsonl
rr() {  # rr <이름> <출력 파일> <명령...> : 시간·종료 코드·크기·SHA-256 을 runs.jsonl 에 남긴다
  local label=$1 out=$2; shift 2
  local start end code
  start=$(date +%s.%N)
  set +e; "$@" > "$out" 2> "${out%.json}.err"; code=$?; set -e
  end=$(date +%s.%N)
  python3 -I -c 'import json,sys,hashlib,os; p=sys.argv[5]; print(json.dumps({"label":sys.argv[1],"cmd":sys.argv[2],"exit":int(sys.argv[3]),"seconds":round(float(sys.argv[4]),1),"out":p,"bytes":os.path.getsize(p),"sha256":hashlib.sha256(open(p,"rb").read()).hexdigest()}, ensure_ascii=False))' \
    "$label" "$*" "$code" "$(echo "$end - $start" | bc)" "$out" >> runs.jsonl
  echo "[$label] exit=$code"
}
rr ref-void ref-source.json $REA import-reference-source "$T" --format json
rr ref-void-summary ref-source.summary.json $REA import-reference-source "$T" --detail summary --outline-depth 3 --format json
echo '["script.js"]' > selection.json
NODE_OPTIONS=--max-old-space-size=4096 rr app-void app.json $REA analyze-javascript-application "$T" \
  --source-paths-json "$PWD/selection.json" --max-semantic-nodes 300000 --max-semantic-unknowns 300000 --format json
E='{"kind":"evidence-file","path":"app.json"}'
echo "{\"source\":$E,\"view\":{\"kind\":\"summary\"}}" > view-summary.json
echo "{\"source\":$E,\"view\":{\"kind\":\"javascript\",\"collection\":\"modules\",\"projection\":\"references\",\"where\":{\"kind\":\"javascript-asset\"},\"offset\":0,\"limit\":64}}" > view-modules.json
for v in summary modules; do rr "view-$v" "app-$v-view.json" $REA inspect-analysis-view "view-$v.json" --format json; done
python3 -I "$HERE/trace_inputs.py" "$WORK/work"
rr feature-script trace-feature-script.json $REA trace-application-feature trace-feature-script-input.json --format json
for n in $(python3 -I -c 'import json;print(" ".join(json.load(open("semantic-names.json"))))'); do
  NODE_OPTIONS=--max-old-space-size=4096 rr "sem-$n" "trace-semantics-$n.json" $REA trace-javascript-semantics "trace-semantics-$n-input.json" --format json
done
python3 -I "$HERE/facts.py" "$WORK/work" "$HERE/../evidence"
