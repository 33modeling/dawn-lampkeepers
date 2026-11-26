"""REA 결과 요약: 작업 폴더의 REA JSON 만 읽어 docs/rea/evidence/ 에 요약 파일을 쓴다.

남기는 것은 개수, 파일 경로·줄 번호, 식별자 이름(함수·속성), REA 관계 종류와 한계 문구뿐이다.
로컬 절대 경로는 <target>·<work> 로 바꾼다. 큰 원본 결과는 bytes·sha256 만 남긴다.
사용법: python3 -I facts.py <작업 폴더(work)> <evidence 폴더>
"""
import collections, json, os, re, sys

W, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
J = lambda f: json.load(open(os.path.join(W, f)))


def clean(s):
    return re.sub(r'/\S*?/target/void', '<target>', re.sub(r'/\S*?/work/', '<work>/', s))


def dump(name, obj):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=1)
        fh.write('\n')


def line(n):
    sr = (n.get('identity') or {}).get('source_range')
    return sr['start']['line'] if sr else None


runs = [json.loads(l) for l in open(os.path.join(W, 'runs.jsonl'))]
dump('rea-runs.json', {
    'tool': 'rea-agents 6.8.0 (npx, 전역 설치·MCP 설정·setup 없음, nice -n 10)',
    'target': {'repo': 'https://github.com/Amrendra-gupta/VOID-SURVIVORS', 'commit': '1e53cf9280ac073eddb1b7ab4da104c13d6c2952',
               'license': 'MIT', 'files': ['script.js', 'index.html', 'style.css', 'README.md', 'LICENSE']},
    'note': '큰 결과는 저장소에 넣지 않았다(bytes·sha256 만). scripts/run-rea.sh 로 다시 만들어 대조한다.',
    'runs': [{'label': r['label'], 'command': clean(r['cmd']), 'exit': r['exit'], 'seconds': r['seconds'],
              'output': {'file': r['out'], 'bytes': r['bytes'], 'sha256': r['sha256']}} for r in runs]})

ref = J('ref-source.summary.json')
dump('reference-source.summary.json', json.loads(clean(json.dumps({k: ref[k] for k in ref if k not in ('input_path',)}, ensure_ascii=False))))

a = J('app.json')['normalized_result']
sg = a['semantic_graph']
funcs = sorted({((n.get('properties') or {}).get('name'), line(n)) for n in sg['nodes'] if n['kind'] == 'function'}, key=lambda x: x[1] or 0)
slots = collections.Counter('.'.join((n.get('properties') or {}).get('property_path') or [])
                            for n in sg['nodes'] if (n.get('properties') or {}).get('property_path'))
dump('app-analysis.summary.json', {
    'statistics': a['statistics'],
    'node_kinds': dict(collections.Counter(n['kind'] for n in sg['nodes'])),
    'relations': len(sg['relations']), 'unknowns': len(sg['unknowns']),
    'functions': [{'name': f, 'line': l} for f, l in funcs],
    'top_property_paths': slots.most_common(60),
    'limitations': a['limitations'][:20]})

traces = {}
for r in runs:
    if not r['label'].startswith(('sem-', 'feature-')):
        continue
    t = J(r['out'])['normalized_result']
    labels = collections.Counter(f"{n.get('label')}@{line(n)}" for n in t.get('nodes', []))
    traces[r['label']] = {'status': t.get('status'), 'seed': t.get('seed'), 'summary': t.get('summary'),
                          'nodes': sorted(labels)[:40]}
dump('trace-summaries.json', traces)
print('evidence 4개 작성')
