// 새벽 등불지기 — 게임 데이터(캐릭터·무기·장신구·진화·판·적·영구 강화). 모두 이 게임만의 오리지널 설정.

export const MAX_WEAPONS = 6;
export const MAX_PASSIVES = 6;
export const WEAPON_MAX_LEVEL = 6;
export const PASSIVE_MAX_LEVEL = 5;

// 장신구(패시브): 레벨마다 효과가 쌓인다
export const PASSIVES = {
  wick:    { name: '긴 심지',   icon: '🕯️', desc: '무기 재사용 시간 -7%', stat: 'cooldown', per: -0.07 },
  brass:   { name: '놋쇠 테',   icon: '⭕', desc: '공격 범위 +10%', stat: 'area', per: 0.10 },
  bellows: { name: '풀무',      icon: '🔥', desc: '피해 +10%', stat: 'might', per: 0.10 },
  thread:  { name: '실타래',    icon: '🧶', desc: '지속 시간 +12%', stat: 'duration', per: 0.12 },
  honey:   { name: '꿀단지',    icon: '🍯', desc: '별가루 끌어당김 +25%', stat: 'magnet', per: 0.25 },
  bangle:  { name: '무쇠 팔찌', icon: '⛓️', desc: '받는 피해 -1', stat: 'armor', per: 1 },
  sandals: { name: '짚신',      icon: '👣', desc: '이동 속도 +8%', stat: 'speed', per: 0.08 },
  brush:   { name: '먹붓',      icon: '🖌️', desc: '발사 개수 +1 (2레벨까지)', stat: 'amount', per: 1, max: 2 },
  ricecake:{ name: '쑥떡',      icon: '🍡', desc: '최대 체력 +15%, 초당 회복 +0.3', stat: 'maxHp', per: 0.15 },
  pouch:   { name: '바람주머니',icon: '🎐', desc: '투사체 속도 +12%', stat: 'projSpeed', per: 0.12 },
};

// 무기. kind 별 동작은 logic.js 의 fireWeapon 에서 처리한다.
// base: 1레벨 값, up: 레벨마다 더하는 값(2레벨부터). evo: 진화 조건(최대 레벨 + 장신구) → 진화 무기 id
export const WEAPONS = {
  lamp: {
    name: '등불 구슬', icon: '🏮', kind: 'bolt', desc: '가장 가까운 그을음에게 빛 구슬을 쏜다',
    base: { dmg: 12, cd: 0.7, amount: 1, speed: 420, pierce: 1, size: 7, life: 1.4 },
    up: [{ amount: 1 }, { dmg: 5 }, { cd: -0.1 }, { amount: 1 }, { pierce: 1, dmg: 5 }],
    evo: { passive: 'wick', into: 'halo' },
  },
  halo: {
    name: '해무리 구슬', icon: '☀️', kind: 'bolt', evolved: true, desc: '꿰뚫는 햇무리 구슬을 쉴 새 없이 쏜다',
    base: { dmg: 22, cd: 0.25, amount: 3, speed: 560, pierce: 6, size: 10, life: 1.6 }, up: [],
  },
  pine: {
    name: '솔잎 부채', icon: '🌲', kind: 'fan', desc: '바라보는 쪽으로 솔잎을 부채꼴로 뿌린다',
    base: { dmg: 8, cd: 1.3, amount: 3, speed: 380, pierce: 1, size: 5, life: 0.7, spread: 0.5 },
    up: [{ amount: 1 }, { dmg: 4 }, { amount: 1, spread: 0.1 }, { cd: -0.15 }, { pierce: 1, dmg: 4 }],
    evo: { passive: 'pouch', into: 'gale' },
  },
  gale: {
    name: '솔바람 폭풍', icon: '🌪️', kind: 'fan', evolved: true, desc: '사방으로 솔바람을 몰아친다',
    base: { dmg: 18, cd: 0.6, amount: 14, speed: 460, pierce: 4, size: 7, life: 0.9, spread: 6.28 }, up: [],
  },
  bell: {
    name: '새벽 종', icon: '🔔', kind: 'pulse', desc: '종을 울려 둘레의 그을음을 밀쳐낸다',
    base: { dmg: 12, cd: 2.2, radius: 90, knock: 160 },
    up: [{ radius: 15 }, { dmg: 6 }, { cd: -0.25 }, { radius: 15 }, { dmg: 8, knock: 60 }],
    evo: { passive: 'brass', into: 'greatbell' },
  },
  greatbell: {
    name: '큰 새벽종', icon: '🛎️', kind: 'pulse', evolved: true, desc: '넓게 울리는 큰 종소리, 맞은 그을음은 잠깐 멈춘다',
    base: { dmg: 30, cd: 1.1, radius: 190, knock: 260, stun: 0.6 }, up: [],
  },
  kite: {
    name: '종이연', icon: '🪁', kind: 'orbit', desc: '종이연이 둘레를 빙글빙글 돈다',
    base: { dmg: 9, cd: 3.0, amount: 2, radius: 80, size: 12, spin: 3.0, dur: 3.0 },
    up: [{ amount: 1 }, { dmg: 4 }, { dur: 0.6, radius: 10 }, { amount: 1 }, { dmg: 5, spin: 0.6 }],
    evo: { passive: 'thread', into: 'dragonkite' },
  },
  dragonkite: {
    name: '용꼬리 연', icon: '🐉', kind: 'orbit', evolved: true, desc: '내려앉지 않는 용꼬리 연 여섯 개',
    base: { dmg: 20, cd: 0.1, amount: 6, radius: 120, size: 16, spin: 3.8, dur: 99 }, up: [],
  },
  ember: {
    name: '숯불 단지', icon: '🫕', kind: 'lob', desc: '숯불 단지를 던져 바닥에 불씨를 남긴다',
    base: { dmg: 6, cd: 3.0, amount: 1, radius: 45, dur: 2.5, tick: 0.35 },
    up: [{ amount: 1 }, { radius: 10 }, { dmg: 3 }, { dur: 0.8 }, { amount: 1, dmg: 3 }],
    evo: { passive: 'bellows', into: 'goblinfire' },
  },
  goblinfire: {
    name: '도깨비 화로', icon: '🔥', kind: 'lob', evolved: true, desc: '불씨 자리가 커지며 플레이어를 따라온다',
    base: { dmg: 14, cd: 2.0, amount: 4, radius: 75, dur: 4, tick: 0.25, follow: 1 }, up: [],
  },
  firefly: {
    name: '반딧불', icon: '✨', kind: 'seeker', desc: '반딧불이 그을음을 쫓아가 부딪친다',
    base: { dmg: 11, cd: 1.6, amount: 2, speed: 260, pierce: 1, size: 6, life: 2.6, turn: 5 },
    up: [{ amount: 1 }, { dmg: 5 }, { cd: -0.2 }, { amount: 1 }, { dmg: 6, pierce: 1 }],
    evo: { passive: 'honey', into: 'galaxy' },
  },
  galaxy: {
    name: '반딧불 은하', icon: '🌌', kind: 'seeker', evolved: true, desc: '반딧불 떼가 끝없이 그을음을 쫓는다',
    base: { dmg: 20, cd: 0.45, amount: 4, speed: 320, pierce: 3, size: 8, life: 3.2, turn: 8 }, up: [],
  },
  poker: {
    name: '부지깽이', icon: '🥢', kind: 'sweep', desc: '앞뒤로 부지깽이를 크게 휘두른다',
    base: { dmg: 16, cd: 1.4, amount: 1, length: 120, width: 44 },
    up: [{ amount: 1 }, { dmg: 7 }, { length: 25 }, { cd: -0.15 }, { dmg: 9, width: 14 }],
    evo: { passive: 'bangle', into: 'fireporker' },
  },
  fireporker: {
    name: '불부지깽이', icon: '🪵', kind: 'sweep', evolved: true, desc: '휘두를 때마다 체력을 조금 되찾는다',
    base: { dmg: 36, cd: 0.8, amount: 2, length: 190, width: 70, lifesteal: 1 }, up: [],
  },
  charm: {
    name: '번개 부적', icon: '📜', kind: 'strike', desc: '화면 안 그을음에게 벼락을 떨어뜨린다',
    base: { dmg: 18, cd: 2.4, amount: 2, radius: 30 },
    up: [{ amount: 1 }, { dmg: 8 }, { radius: 12 }, { amount: 1 }, { cd: -0.3, dmg: 8 }],
    evo: { passive: 'brush', into: 'thunder' },
  },
  thunder: {
    name: '천둥 부적', icon: '⚡', kind: 'strike', evolved: true, desc: '벼락이 연달아 떨어지고 넓게 퍼진다',
    base: { dmg: 40, cd: 0.9, amount: 6, radius: 70 }, up: [],
  },
  salt: {
    name: '소금 바람', icon: '🧂', kind: 'bolt', desc: '사방 여덟 갈래로 소금을 흩뿌린다(진화 없음)',
    base: { dmg: 7, cd: 1.8, amount: 4, speed: 300, pierce: 2, size: 5, life: 0.8, ring: 1 },
    up: [{ amount: 2 }, { dmg: 3 }, { amount: 2 }, { cd: -0.25 }, { dmg: 4, pierce: 1 }],
  },
};

export const BASE_WEAPON_IDS = Object.keys(WEAPONS).filter((id) => !WEAPONS[id].evolved);

// 캐릭터(등불지기들)
export const CHARACTERS = [
  { id: 'sodam', name: '소담', title: '등잔지기 아이', weapon: 'lamp', color: '#f6c453', bonus: { maxHp: 0.2 }, bonusText: '최대 체력 +20%', cost: 0 },
  { id: 'haesol', name: '해솔', title: '솔숲 목수', weapon: 'pine', color: '#7fc97f', bonus: { speed: 0.12 }, bonusText: '이동 속도 +12%', cost: 0 },
  { id: 'mir', name: '미르', title: '종탑 종지기', weapon: 'bell', color: '#8fb3ff', bonus: { area: 0.15 }, bonusText: '공격 범위 +15%', cost: 0 },
  { id: 'darae', name: '다래', title: '연 날리는 소녀', weapon: 'kite', color: '#ff8fb1', bonus: { magnet: 0.5, duration: 0.1 }, bonusText: '끌어당김 +50%, 지속 +10%', cost: 120 },
  { id: 'dol', name: '돌쇠', title: '숯가마 일꾼', weapon: 'poker', color: '#d08a5a', bonus: { armor: 1, might: 0.1 }, bonusText: '방어 +1, 피해 +10%', cost: 250 },
];

// 적 종류. hp·dmg 는 판 배율과 시간 배율을 곱한다
export const ENEMIES = {
  soot:    { name: '그을음 방울', r: 11, hp: 5,  speed: 62, dmg: 6,  xp: 1, color: '#3b3355', eye: '#ffde7a' },
  leafbat: { name: '박쥐잎',     r: 10, hp: 4,  speed: 105, dmg: 5, xp: 1, color: '#4b5d3a', eye: '#ff9a62', wobble: 1 },
  scare:   { name: '허수 그림자', r: 16, hp: 40, speed: 48, dmg: 10, xp: 5, color: '#2b2a3a', eye: '#ff6b6b' },
  mistgob: { name: '안개 도깨비', r: 13, hp: 12, speed: 70, dmg: 8,  xp: 2, color: '#5b6b8a', eye: '#bff3ff' },
  frog:    { name: '개굴 그림자', r: 12, hp: 10, speed: 90, dmg: 7,  xp: 2, color: '#2f4a46', eye: '#e6ff7a', hop: 1 },
  lantern: { name: '꺼진 초롱',  r: 14, hp: 30, speed: 55, dmg: 11, xp: 5, color: '#5a3a2a', eye: '#ffb35c' },
  moth:    { name: '재나방',     r: 11, hp: 14, speed: 110, dmg: 8, xp: 3, color: '#6a5f5a', eye: '#fff', wobble: 1 },
  gargoyl: { name: '돌 해태 그림자', r: 20, hp: 70, speed: 42, dmg: 16, xp: 10, color: '#3a3a44', eye: '#ff4d6d' },
  // 엘리트·보스
  elite:   { name: '큰 그을음',   r: 26, hp: 400, speed: 55, dmg: 15, xp: 30, color: '#1d1930', eye: '#ffd24d', elite: 1 },
  crow:    { name: '밤까마귀 대장', r: 40, hp: 2500, speed: 70, dmg: 22, xp: 200, color: '#141221', eye: '#ff3355', boss: 1 },
  serpent: { name: '늪 이무기',   r: 44, hp: 5500, speed: 75, dmg: 26, xp: 300, color: '#173030', eye: '#9dff6a', boss: 1 },
  gloom:   { name: '그믐 주인',   r: 52, hp: 10000, speed: 80, dmg: 32, xp: 500, color: '#0b0712', eye: '#c08bff', boss: 1 },
};

// 판. waves: [시작초, 적 종류 목록, 초당 생성 수]. 마지막 1분에 보스, 새벽(duration)에 이기면 깸
export const STAGES = [
  {
    id: 'reeds', name: '갈대 들판', desc: '마을 앞 갈대밭. 그을음이 처음 몰려오는 곳', duration: 300, hpMul: 1, boss: 'crow',
    bg: { ground: '#1b2a24', dot: '#2c4436', line: '#35503f' },
    waves: [[0, ['soot'], 1.2], [40, ['soot', 'leafbat'], 2.2], [90, ['soot', 'leafbat', 'scare'], 3.2], [150, ['leafbat', 'scare', 'soot'], 6], [210, ['soot', 'leafbat', 'scare'], 7.5]],
    elites: [60, 120, 180],
  },
  {
    id: 'marsh', name: '안개 저수지', desc: '물안개가 낀 저수지 둑길. 그을음이 더 단단하다', duration: 360, hpMul: 1.25, boss: 'serpent',
    bg: { ground: '#17232e', dot: '#22374a', line: '#2b4560' },
    waves: [[0, ['soot', 'mistgob'], 2], [45, ['mistgob', 'frog'], 3], [110, ['frog', 'mistgob', 'lantern'], 4.5], [200, ['lantern', 'frog', 'leafbat'], 6], [270, ['mistgob', 'lantern', 'frog'], 7.5]],
    elites: [60, 130, 200, 260],
    requires: 'reeds',
  },
  {
    id: 'belfry', name: '잠든 종탑', desc: '새벽 종이 잠든 산마루 종탑. 그믐 주인이 기다린다', duration: 420, hpMul: 1.6, boss: 'gloom',
    bg: { ground: '#221a26', dot: '#33263a', line: '#3f2f48' },
    waves: [[0, ['moth', 'mistgob'], 3], [50, ['moth', 'lantern'], 4.5], [120, ['gargoyl', 'moth', 'lantern'], 5.5], [220, ['gargoyl', 'moth', 'frog'], 7], [300, ['gargoyl', 'lantern', 'moth', 'soot'], 9]],
    elites: [60, 140, 220, 300],
    requires: 'marsh',
  },
];

// 영구 강화(엽전으로 산다). 레벨마다 값 per 를 더한다
export const META_UPGRADES = [
  { id: 'might', name: '단단한 손', desc: '피해 +5%', per: 0.05, max: 5, cost: 30 },
  { id: 'maxHp', name: '든든한 밥', desc: '최대 체력 +10%', per: 0.10, max: 5, cost: 30 },
  { id: 'armor', name: '누빈 옷', desc: '받는 피해 -1', per: 1, max: 3, cost: 60 },
  { id: 'speed', name: '가벼운 발', desc: '이동 속도 +5%', per: 0.05, max: 3, cost: 40 },
  { id: 'magnet', name: '자석 돌', desc: '끌어당김 +15%', per: 0.15, max: 3, cost: 30 },
  { id: 'growth', name: '배움', desc: '경험치 +8%', per: 0.08, max: 5, cost: 45 },
  { id: 'greed', name: '알뜰', desc: '엽전 +10%', per: 0.10, max: 5, cost: 35 },
  { id: 'cooldown', name: '손놀림', desc: '재사용 시간 -3%', per: -0.03, max: 3, cost: 60 },
  { id: 'revive', name: '수호 부적', desc: '쓰러지면 한 번 다시 일어남', per: 1, max: 1, cost: 200 },
  { id: 'reroll', name: '새로 뽑기', desc: '판마다 선택지 다시 뽑기 +1', per: 1, max: 3, cost: 50 },
];

export function metaCost(up, level) {
  return Math.round(up.cost * (1 + level * 0.8));
}

// 레벨 n → n+1 에 필요한 경험치
export function xpForLevel(level) {
  if (level < 20) return 5 + (level - 1) * 6;
  if (level < 40) return 119 + (level - 20) * 9;
  return 299 + (level - 40) * 12;
}
