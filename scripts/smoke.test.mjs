import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const read = name => readFileSync(new URL(`../dist/${name}`, import.meta.url), 'utf8');
const realm = {};
runInNewContext(read('skill-catalog.js'), realm);
runInNewContext(read('build-io.js'), realm);
const {UmaFork: io, UmaForkData: {skills, upcomingSkills}} = realm;
const white = Object.keys(skills).find(id => skills[id].baseCost > 0 &&
  skills[id].rarity === 1 && !skills[id].iconId.endsWith('4') && skills[String(+id + 1)]?.groupId === skills[id].groupId &&
  skills[String(+id + 1)].rarity === 1 && !skills[String(+id + 1)].iconId.endsWith('4'));
const lower = String(+white + 1);
const kachi = {
  outfitId: '', speed: 1200, stamina: 1200, power: 800, guts: 400, wisdom: 400,
  strategy: 'Senkou', distanceAptitude: 'S', surfaceAptitude: 'A', strategyAptitude: 'A',
  mood: 2, skills: [], forcedSkillPositions: {},
};

test('Kachi build fields round-trip and forced positions become engine policies', () => {
  const fixture = {...kachi, skills: [white], forcedSkillPositions: {[white]: 240.5}};
  const imported = io.parse(JSON.stringify(fixture));
  assert.equal(imported.samplePolicies[white].policy, 'fixed');
  assert.equal(imported.samplePolicies[white].pos, 240.5);
  const result = JSON.parse(io.stringify(imported));
  assert.equal(Object.hasOwn(result, 'aptitudes'), false);
  for (const key of Object.keys(fixture)) assert.deepEqual(result[key], fixture[key]);
  assert.throws(() => io.parse(JSON.stringify({...kachi, skills: ['99999999']})), /Skills unavailable/);
});

test('total skill points count each upgrade chain once', () => {
  const expected = skills[white].baseCost + skills[lower].baseCost;
  assert.ok(expected > 0);
  assert.equal(io.total([white, lower, white]), expected);
  assert.match(io.summary([white, '99999999']), /\+$/);
});

test('rating uses the current comparison aptitudes without modifying the saved build', () => {
  const build = {...kachi, aptitudes: Array(10).fill('B')};
  let rated;
  const score = io.rating(build, value => { rated = value; return 22765; }, {distanceType: 2, surface: 1});
  assert.deepEqual(Array.from(rated.aptitudes), ['B', 'S', 'B', 'B', 'B', 'A', 'B', 'B', 'A', 'B']);
  assert.deepEqual(build.aptitudes, Array(10).fill('B'));
  assert.equal(io.formatRating(score), '22,765');
  assert.equal(io.rankIndex(299, [300, 600, Infinity]), 0);
  assert.equal(io.rankIndex(300, [300, 600, Infinity]), 1);
  assert.equal(io.rankIndex(NaN, [300, Infinity]), null);
  assert.equal(io.rankIndex(-1, [300, Infinity]), null);
  assert.equal(io.filename('Taiki Shuttle', score), 'taiki_shuttle_22765.json');
  assert.equal(io.filename('T.M. Opera O', score), 't_m_opera_o_22765.json');
  assert.equal(io.filename('', score), 'uma_22765.json');
});

test('compact editor preserves the four aptitude controls, then live rank, SP, rating and race context', () => {
  const bundle = read('bundle.js');
  const start = bundle.indexOf('class:"horseAptitudes fork-compact-aptitudes"');
  const end = bundle.indexOf('class:"horseAptitudes"', start);
  assert.ok(start >= 0 && end > start);
  const compact = bundle.slice(start, end);
  const ordered = ['fork-surface','fork-distance','fork-strategy','fork-style','fork-live-rank','fork-sp-summary','fork-rating-summary','fork-race-context','state.popularity','state.mood'];
  let previous = -1;
  for (const marker of ordered) {
    const next = compact.indexOf(marker);
    assert.ok(next > previous, marker);
    previous = next;
  }
  const rankVariable = compact.match(/UmaFork\.rankIndex\(forkRating,(\w+)\)/)?.[1];
  assert.ok(rankVariable);
  const literal = bundle.match(new RegExp(`\\b${rankVariable}=Object\\.freeze\\((\\[[^\\]]+\\])\\)`))?.[1];
  assert.ok(literal);
  const thresholds = runInNewContext(literal);
  assert.equal(io.rankIndex(27153, thresholds), 34);
  assert.equal(io.rankIndex(27299, thresholds), 34);
  assert.equal(io.rankIndex(27300, thresholds), 35);
  assert.match(compact, /icons\/rank\/utx_txt_rank_\$\{globalThis\.UmaFork\.rankIndex\(forkRating,\w+\)\}\.png/);
  assert.match(read('bundle.css'), /grid-template-areas:"surface distance rank" "strategy style rank" "sp rating context"/);
  assert.match(bundle, /horseSkillHeader fork-compact-skills-title/);
});

test('all original modes load the integrated bundle and the engine worker is present', () => {
  for (const route of ['index.html', 'compare/index.html', 'skills/index.html', 'stamina/index.html']) {
    assert.match(read(route), /skill-catalog\.js[\s\S]+build-io\.js[\s\S]+bundle\.js/);
  }
  const bundle = read('bundle.js');
  for (const label of ['Save & load', 'Import JSON', 'Export JSON', 'Total base skill points including prerequisites']) {
    assert.ok(bundle.includes(label), label);
  }
  assert.match(bundle, /UmaFork\.importFile\(value=>\w+\(\w+\(value\)\)\)/);
  assert.match(bundle, /clipboard\.writeText\(globalThis\.UmaFork\.stringify\(\w+\(\w+\(\)\)\)\)/);
  assert.match(bundle, /clipboard\.readText\(\)\.then\(globalThis\.UmaFork\.parse\)/);
  assert.match(bundle, /UmaFork\.summary\(forkBuild\.skills\.values\(\)\)/);
  assert.match(bundle, /UmaFork\.formatRating\(forkRating\)/);
  for (const slot of ['uma1', 'uma2', 'debufUma']) {
    assert.match(bundle, new RegExp(`state:\\w+\\.${slot},aptitudesMode:"simulation",course:\\w+,showPolicyEd:!0,compareSummary:!0,tabstart:`));
  }
  assert.equal([...bundle.matchAll(/compareSummary:!0/g)].length, 3);
  assert.match(bundle, /new URL\("\.",document\.baseURI\)/);
  assert.match(read('simulator.worker.js'), /postMessage/);
});

test('upcoming English-named skills are available for import, scoring and simulation', () => {
  const bundle = read('bundle.js');
  const worker = read('simulator.worker.js');
  for (const [id, name] of Object.entries(upcomingSkills)) {
    assert.ok(name.trim(), id);
    assert.ok(skills[id], id);
    assert.ok(bundle.includes(`"${id}":{"alternatives":`), `UI: ${id}`);
    assert.ok(worker.includes(`"${id}":{"alternatives":`), `worker: ${id}`);
    assert.deepEqual(Array.from(io.parse(JSON.stringify({...kachi, skills: [id]})).skills), [id]);
    assert.ok(Number.isFinite(io.total([id])), id);
  }
});

test('every added skill can be simulated by the worker on a reference course', {timeout: 30000}, () => {
  const course = {corners:[{length:225,start:650},{length:224,start:875}],course:1,
    courseSetStatus:[1,2],distance:1600,distanceType:2,finishTimeMax:1080000,
    finishTimeMin:941000,laneMax:12500,raceTrackId:10006,
    slopes:[{length:200,slope:-10000,start:575},{length:250,slope:15000,start:1100}],
    straights:[{end:650,frontType:2,start:0},{end:1600,frontType:1,start:1099}],surface:2,turn:2};
  let receive, response;
  runInNewContext(read('simulator.worker.js'), {
    self:{addEventListener:(kind, callback)=>{if(kind==='message') receive=callback;}},
    postMessage:message=>{response=message;},
  }, {timeout:5000});
  const build = {...kachi, starCount:3,uniqueLv:1,popularity:1,
    aptitudes:['S','S','S','S','A','A','A','A','A','A'],skills:new Map(),samplePolicies:new Map()};
  for (const [id, name] of Object.entries(upcomingSkills)) {
    response = null;
    receive({data:{msg:'compare',data:{nsamples:2,course,
      racedef:{groundCondition:3,weather:1,season:4,time:2,grade:100,skillId:'',orderRange:null,numUmas:9},
      uma1:{...build,skills:new Map([[skills[id].groupId,id]])},uma2:build,
      options:{seed:2615953739,usePosKeep:true,useCompeteTop:true,useIntChecks:false}}}});
    assert.equal(response?.results?.results?.length, 2, `${id}: ${name}`);
    assert.ok(response.results.results.every(Number.isFinite), `${id}: ${name}`);
  }
});
