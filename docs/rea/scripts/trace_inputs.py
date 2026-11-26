"""REA 추적 입력 만들기: 저장한 분석 결과(app.json)만 읽어 trace-*-input.json 을 쓴다."""
import json, os, sys

os.chdir(sys.argv[1])
ev = json.load(open('app.json'))
sg = ev['normalized_result']['semantic_graph']


def fp(name):
    for n in sg['nodes']:
        if n['kind'] == 'function' and (n.get('properties') or {}).get('name') == name:
            for f in sg['fingerprints']:
                if f['function_node_id'] == n['node_id']:
                    return f['fingerprint_sha256']
    return None


json.dump({'application': ev, 'seed': {'kind': 'module', 'value': 'script.js', 'match': 'exact'}, 'direction': 'both'},
          open('trace-feature-script-input.json', 'w'))
semantic = {}
for fn in ('updateSystems', 'fireWeapon', 'getThreeOptions', 'apply', 'determineEnemyType', 'getSpawnInterval', 'spawnEnemy', 'levelUp'):
    f = fp(fn)
    if f:
        semantic[f'{fn}-callers'] = {'kind': 'function', 'fingerprint_sha256': f}, 'callers'
for prop in ('xp', 'xpNeeded', 'projCount', 'critChance', 'spawnTimer', 'wave', 'hp'):
    semantic[f'{prop}-property'] = {'kind': 'property', 'name': prop}, 'forward-influence'
for name, (seed, direction) in semantic.items():
    json.dump({'application': ev, 'query': {'seed': seed, 'direction': direction, 'include_ambiguous_dynamic_edges': True}},
              open(f'trace-semantics-{name}-input.json', 'w'))
json.dump(list(semantic), open('semantic-names.json', 'w'))
print('ok', list(semantic))
