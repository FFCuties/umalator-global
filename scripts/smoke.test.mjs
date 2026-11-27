import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';
import assert from 'node:assert/strict';

const read = name => readFileSync(new URL(`../dist/${name}`, import.meta.url), 'utf8');
const realm = {};
runInNewContext(read('skill-catalog.js'), realm);
runInNewContext(read('build-io.js'), realm);
runInNewContext(read('build-card.js'), realm);
const {UmaFork: io, UmaForkData: {skills, upcomingSkills, upcomingUmas}} = realm;
const white = Object.keys(skills).find(id => skills[id].baseCost > 0 &&
  skills[id].rarity === 1 && !skills[id].iconId.endsWith('4') && skills[String(+id + 1)]?.groupId === skills[id].groupId &&
  skills[String(+id + 1)].rarity === 1 && !skills[String(+id + 1)].iconId.endsWith('4'));
const lower = String(+white + 1);
const kachi = {
  outfitId: '', speed: 1200, stamina: 1200, power: 800, guts: 400, wisdom: 400,
  strategy: 'Senkou', distanceAptitude: 'S', surfaceAptitude: 'A', strategyAptitude: 'A',
  mood: 2, skills: [], forcedSkillPositions: {},
};

test('dark mode is opt-in, updates the root theme and persists across reloads', () => {
  const saved = new Map();
  const boot = () => {
    const attributes = new Map();
    const browser = {
      localStorage: {getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value)},
      document: {documentElement: {setAttribute: (key, value) => attributes.set(key, value)}},
    };
    runInNewContext(read('skill-catalog.js'), browser);
    runInNewContext(read('build-io.js'), browser);
    return {io: browser.UmaFork, attributes};
  };
  const first = boot();
  assert.equal(first.io.darkMode(), false);
  assert.equal(first.attributes.get('data-fork-theme'), 'light');
  first.io.setDarkMode(true);
  assert.equal(first.attributes.get('data-fork-theme'), 'dark');
  const reopened = boot();
  assert.equal(reopened.io.darkMode(), true);
  assert.equal(reopened.attributes.get('data-fork-theme'), 'dark');
  reopened.io.setDarkMode(false);
  assert.equal(boot().io.darkMode(), false);
  const bundle = read('bundle.js');
  const hp = bundle.indexOf('id:"showhp"');
  const dark = bundle.indexOf('id:"fork-dark-mode"', hp);
  const run = bundle.indexOf('id:"run"', hp);
  assert.ok(hp >= 0 && hp < dark && dark < run);
  assert.match(bundle, /defaultChecked:globalThis\.UmaFork\.darkMode\(\),onChange:e=>globalThis\.UmaFork\.setDarkMode\(e\.currentTarget\.checked\)/);
  assert.match(read('bundle.css'), /#sidebar>\.fork-dark-mode-row\{margin-bottom:6px\}/);
  assert.match(read('bundle.css'), /html\[data-fork-theme="dark"\]\{color-scheme:dark/);
});

test('dark theme contrast, chart colors, and removal of legacy white frames', () => {
  const css = read('bundle.css');
  const theme = css.match(/html\[data-fork-theme="dark"\]\{([^}]+)\}/)?.[1];
  assert.ok(theme);
  const tokens = Object.fromEntries([...theme.matchAll(/(--[\w-]+):(#\w{6})/g)].map(([, name, value]) => [name, value]));
  function luminance(hex) {
    const rgb = hex.slice(1).match(/../g).map(x => parseInt(x, 16)/255).map(x => x <= 0.04045 ? x/12.92 : ((x+0.055)/1.055)**2.4);
    return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
  }
  const ratio = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  for (const bg of ['--fork-bg','--fork-panel','--fork-control','--fork-raised','--fork-green','--fork-green-low']) {
    assert.ok(ratio(tokens['--fork-text'],tokens[bg]) >= 4.5, bg);
  }
  assert.ok(ratio(tokens['--fork-muted'],tokens['--fork-control']) >= 4.5);
  assert.ok(ratio(tokens['--fork-outline'],tokens['--fork-control']) >= 3);
  assert.ok(ratio(tokens['--fork-accent'],tokens['--fork-control']) >= 3);
  for (const fill of ['#374c21','#3f3548','#514021','#594825','#214943','#294f49','#343e47','#253d54','#2f465e','#58432c','#614a34','#245246','#514d25','#56344b','#633850','#29343d']) {
    assert.ok(ratio(tokens['--fork-text'],fill) >= 4.5, fill);
    assert.ok(css.includes(`fill:${fill}`), fill);
  }
  assert.match(css, /#modeBar\{box-shadow:none/);
  assert.match(css, /\.hasResults \.racetrackView>svg text:not\(\.mouseoverText\)\{filter:none\}/);
  assert.match(css, /input::placeholder\{color:var\(--fork-muted\);opacity:1\}/);
  assert.match(css, /\.skill,\.stdBtn,\.pillBtn,\.circleBtn,\.splitBtn:active\)\{box-shadow:0 2px 3px #0c1015aa\}/);
});

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

test('new builds default to five stars while explicit imported star counts are retained', () => {
  const defaults = read('bundle.js').match(/\{outfitId:"",starCount:5,[^{}]+?uniqueLv:3,mood:2,popularity:1\}/);
  assert.ok(defaults);
  assert.doesNotMatch(read('bundle.js'), /(\w+)=Math\.max\(\1,\w+\.rarity\)/);
  const imported = io.parse(JSON.stringify(kachi));
  assert.equal(imported.starCount, 5);
  assert.equal(imported.uniqueLv, 3);
  const saved = io.parse(JSON.stringify({...kachi, starCount: 2, uniqueLv: 2}));
  assert.equal(saved.starCount, 2);
  assert.equal(saved.uniqueLv, 2);
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

test('compact editor preserves aptitude controls and centers mood beneath live rank without popularity controls', () => {
  const bundle = read('bundle.js');
  const start = bundle.indexOf('class:"horseAptitudes fork-compact-aptitudes"');
  const end = bundle.indexOf('class:"horseAptitudes"', start);
  assert.ok(start >= 0 && end > start);
  const compact = bundle.slice(start, end);
  const ordered = ['fork-surface','fork-distance','fork-strategy','fork-style','fork-live-rank','fork-sp-summary','fork-rating-summary','fork-race-context','state.mood'];
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
  assert.doesNotMatch(bundle, /state\.popularity,tabindex:/);
  assert.match(bundle, /class:"fork-legacy-mood"/);
  assert.match(read('bundle.css'), /grid-template-areas:"surface distance rank" "strategy style rank" "sp rating context"/);
  assert.match(read('bundle.css'), /fork-race-context\{grid-area:context;align-self:stretch;align-items:center;justify-content:center/);
  assert.match(bundle, /horseSkillHeader fork-compact-skills-title/);
  assert.match(bundle, /compareSummary\?"Skill count : "\+forkBuild\.skills\.size/);
});

test('all original modes load the integrated bundle and the engine worker is present', () => {
  for (const route of ['index.html', 'compare/index.html', 'skills/index.html', 'stamina/index.html']) {
    assert.match(read(route), /skill-catalog\.js[\s\S]+build-io\.js[\s\S]+build-card\.js[\s\S]+bundle\.js/);
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

test('camera exports the current planned character to a complete, scalable card', () => {
  const card = realm.UmaForkCard;
  const selected = [white, lower];
  const build = {...kachi, starCount:5, uniqueLv:3, outfitId:'100101', skills:selected, mood:2, aptitudes:Array(10).fill('S')};
  const data = card.createCardData(build, {name:'Special Week', epithet:'[Special Dreamer]', rating:27153, rank:34, defaultAptitudes:[2,5,7,7,1,7,7,5,7,1], course:{surface:2,distance:1600,distanceType:2}});
  assert.equal(data.name, 'Special Week');
  assert.equal(data.stars, 5);
  assert.equal(data.filename, 'special_week_27153.png');
  assert.equal(data.skills.length, selected.length);
  assert.ok(data.skills.every(s => s.name === skills[s.id].name && s.icon));
  assert.equal(data.groups[0].entries[1].grade, build.surfaceAptitude);
  assert.equal(data.groups[1].entries[1].grade, build.distanceAptitude);
  assert.equal(data.groups[2].entries[1].grade, build.strategyAptitude);
  assert.deepEqual(Array.from(data.groups[0].entries, a=>a.grade), ['A','A']);
  assert.deepEqual(Array.from(data.groups[1].entries, a=>a.grade), ['F','S','A','A']);
  assert.deepEqual(Array.from(data.groups[2].entries, a=>a.grade), ['G','A','A','C']);
  assert.deepEqual(build.aptitudes, Array(10).fill('S'));
  assert.deepEqual(Array.from(data.groups, g=>g.label), ['Track','Distance','Style']);
  assert.deepEqual(Array.from(data.groups, g=>g.entries.length), [2,4,4]);
  assert.ok(data.stats.every(s=>s.icon.includes('/statusrank/')));
  assert.match(data.groups[0].entries[1].icon, /utx_ico_statusrank_06\.png$/);
  assert.equal(data.sp, io.summary(selected));
  const text = [], fonts = [], colors = [], stops = [];
  const ctx = {beginPath(){},roundRect(){},fill(){},stroke(){},fillRect(){},scale(){},drawImage(){},createLinearGradient(){return {addColorStop(_,color){stops.push(color);}};},measureText(s){return {width:String(s).length*12};},fillText(s){text.push(s);fonts.push(this.font);colors.push(this.fillStyle);}};
  const canvas = {getContext(){return ctx;}};
  card.renderCard(canvas,data);
  assert.equal(canvas.width, 1200);
  assert.equal(canvas.height, card.cardHeight(data));
  assert.ok(text.includes(data.name) && text.includes('SKILL COUNT : 2'));
  assert.ok(text.includes('Planned Umamusume Details'));
  assert.ok(!text.some(line=>line.includes('NOT AN IN-GAME SCREENSHOT')));
  assert.ok(data.skills.every(skill => text.includes(skill.name)));
  assert.ok(fonts.every(font=>font.includes('Inter')));
  assert.ok(colors.includes('#794016'));
  assert.ok(stops.includes('#99db44') && stops.includes('#d2d1e7'));
  assert.ok(card.cardHeight({...data,skills:Array.from({length:30},()=>data.skills[0])})>canvas.height);
  assert.match(read('bundle.js'), /title:"Export character image"[\s\S]{0,520}UmaForkCard\.exportCharacterCard\(build,/);
  assert.match(read('bundle.js'), /defaultAptitudes:info\?\.outfits\[build\.outfitId\]\?\.aptitudes/);
  assert.match(read('bundle.js'), /Read from screenshot \(OCR\)/);
});

test('source attribution is available in the collapsed sidebar About / Source section, not the page footer', () => {
  const bundle = read('bundle.js');
  assert.match(bundle, /\w+\("details",\{class:"fork-about"\},\w+\("summary",null,"About \/ Source"\)/);
  assert.ok(bundle.includes(`https://github.com/alpha123/uma-tools/tree/${realm.UmaForkData.revision}`));
  assert.match(bundle, /href:"source-changes\/"\},"Source changes"/);
  assert.match(bundle, /href:"LICENSE"\},"GPL-3.0"/);
  for (const route of ['index.html', 'compare/index.html', 'skills/index.html', 'stamina/index.html']) {
    assert.doesNotMatch(read(route), /Alpha123 Global fork/);
  }
  assert.ok(read('LICENSE').includes('GNU GENERAL PUBLIC LICENSE'));
});

test('upcoming skills are available for import, scoring and simulation', () => {
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

test('JP outfits retain their unique skills through build import and export', () => {
  const bundle = read('bundle.js');
  const roster = JSON.parse(bundle.match(/\{"1001":\{"name":.*?\}(?=;(?:var |function ))/s)[0]);
  const names = JSON.parse(bundle.match(/\{"1000011":\[.*?\}(?=;(?:var |function ))/s)[0]);
  assert.ok(Object.keys(upcomingUmas).length > 0);
  assert.equal(roster['1001'].outfits['100101'].epithet, '[Special Dreamer]');
  assert.ok(Object.values(roster).some(uma => Object.keys(uma.outfits).length > 1));
  for (const [outfitId, ids] of Object.entries(upcomingUmas)) {
    const uma = roster[outfitId.slice(0, 4)];
    const outfit = uma.outfits[outfitId];
    assert.match(outfit.epithet, / · JP$/);
    assert.ok(uma.name[1].trim(), outfitId);
    assert.equal(outfit.aptitudes.length, 10, outfitId);
    assert.ok(outfit.strategy >= 1 && outfit.strategy <= 4, outfitId);
    assert.equal(ids.length, outfit.rarity < 3 ? 2 : 1, outfitId);
    for (const [index, id] of ids.entries()) {
      assert.equal(names[id][0], skills[id].name, outfitId);
      const build = io.parse(JSON.stringify({...kachi, outfitId, starCount: index ? outfit.rarity : 5, skills:[id]}));
      const roundTrip = io.parse(io.stringify(build));
      assert.equal(roundTrip.outfitId, outfitId);
      assert.deepEqual(Array.from(roundTrip.skills), [id]);
    }
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
  const outfitForSkill = new Map(Object.entries(upcomingUmas).flatMap(
    ([outfitId, ids]) => ids.map((id, index) => [id, {outfitId, starCount:index ? 2 : 5}])));
  for (const [id, name] of Object.entries(upcomingSkills)) {
    response = null;
    receive({data:{msg:'compare',data:{nsamples:2,course,
      racedef:{groundCondition:3,weather:1,season:4,time:2,grade:100,skillId:'',orderRange:null,numUmas:9},
      uma1:{...build,...outfitForSkill.get(id),skills:new Map([[skills[id].groupId,id]])},uma2:build,
      options:{seed:2615953739,usePosKeep:true,useCompeteTop:true,useIntChecks:false}}}});
    assert.equal(response?.results?.results?.length, 2, `${id}: ${name}`);
    assert.ok(response.results.results.every(Number.isFinite), `${id}: ${name}`);
  }
});
