// SPDX-License-Identifier: GPL-3.0-or-later
(() => {
  'use strict';
  const {skills} = globalThis.UmaForkData;
  const themeKey = 'umalator-global-sp.theme';
  let darkTheme = false;
  try { darkTheme = globalThis.localStorage?.getItem(themeKey) === 'dark'; } catch {}
  function applyTheme() {
    globalThis.document?.documentElement.setAttribute('data-fork-theme', darkTheme ? 'dark' : 'light');
  }
  function darkMode() { return darkTheme; }
  function setDarkMode(enabled) {
    darkTheme = Boolean(enabled);
    applyTheme();
    try { globalThis.localStorage?.setItem(themeKey, darkTheme ? 'dark' : 'light'); } catch {}
  }
  applyTheme();
  const groups = new Map();
  const costs = new Map();
  for (const [id, skill] of Object.entries(skills)) {
    const group = groups.get(skill.groupId) ?? [];
    group.push(id);
    groups.set(skill.groupId, group);
  }
  const negative = id => skills[id].iconId.endsWith('4');
  for (const group of groups.values()) {
    group.sort((a, b) => Number(negative(a)) - Number(negative(b)) ||
      skills[a].rarity - skills[b].rarity || Number(b) - Number(a));
    let runningCost = 0;
    for (const id of group) {
      const base = skills[id].baseCost;
      if (!negative(id)) runningCost += base;
      costs.set(id, negative(id) ? base : runningCost);
    }
  }

  function total(ids) {
    const byGroup = new Map();
    for (const id of ids) {
      if (!Object.hasOwn(skills, id)) continue;
      const group = skills[id].groupId;
      byGroup.set(group, Math.max(byGroup.get(group) ?? 0, costs.get(id)));
    }
    return [...byGroup.values()].reduce((sum, cost) => sum + cost, 0);
  }

  function summary(ids) {
    const selected = [...ids];
    const partial = selected.some(id => !Object.hasOwn(skills, id));
    return `${total(selected).toLocaleString('en-US')}${partial ? '+' : ''}`;
  }

  function rating(build, scoreUma, course) {
    const aptitudes = [...(build.aptitudes ?? ['S', 'S', 'S', 'S', 'A', 'A', 'A', 'A', 'A', 'A'])];
    if (course) {
      const strategies = ['Nige', 'Senkou', 'Sasi', 'Oikomi'];
      const strategy = strategies.indexOf(build.strategy === 'Oonige' ? 'Nige' : build.strategy);
      if (strategy >= 0) aptitudes[4 + strategy] = build.strategyAptitude;
      aptitudes[course.distanceType - 1] = build.distanceAptitude;
      aptitudes[7 + course.surface] = build.surfaceAptitude;
    }
    return scoreUma({...build, aptitudes});
  }

  function formatRating(value) {
    return Number.isFinite(value) ? value.toLocaleString('en-US') : 'Unavailable';
  }

  function rankIndex(value, thresholds) {
    if (!Number.isFinite(value) || value < 0) return null;
    const index = thresholds.findIndex(threshold => threshold > value);
    return index >= 0 ? index : null;
  }

  function filename(name, value) {
    const slug = (name ?? '').normalize('NFKD').replace(/\p{Mark}/gu, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return `${slug || 'uma'}_${Number.isFinite(value) ? value : 'rating_unavailable'}.json`;
  }

  function parse(text) {
    const source = JSON.parse(text.replace(/^\uFEFF/, ''));
    if (!source || typeof source !== 'object' || !Array.isArray(source.skills) ||
        !Object.hasOwn(source, 'outfitId')) {
      throw new Error('Choose an individual Uma build JSON from Kachi or Alpha123.');
    }
    const build = {
      aptitudes: ['S', 'S', 'S', 'S', 'A', 'A', 'A', 'A', 'A', 'A'],
      ...source, outfitId: String(source.outfitId), skills: source.skills.map(String),
    };
    build.starCount = source.starCount ?? 5;
    build.uniqueLv = source.uniqueLv ?? (build.starCount % 3 + Math.floor(build.starCount / 3));
    for (const stat of ['speed', 'stamina', 'power', 'guts', 'wisdom']) {
      if (!Number.isInteger(build[stat]) || build[stat] < 1) throw new Error(`Invalid ${stat}.`);
    }
    if (!['Nige', 'Senkou', 'Sasi', 'Oikomi', 'Oonige'].includes(build.strategy)) {
      throw new Error('Invalid running strategy.');
    }
    const grade = value => typeof value === 'string' && /^[SABCDEFG]$/.test(value);
    for (const field of ['distanceAptitude', 'surfaceAptitude', 'strategyAptitude']) {
      if (!grade(build[field])) throw new Error(`Invalid ${field}.`);
    }
    if (!Array.isArray(build.aptitudes) || build.aptitudes.length !== 10 || !build.aptitudes.every(grade)) {
      throw new Error('Invalid aptitude list.');
    }
    if (!/^(\d{6})?$/.test(build.outfitId)) throw new Error('Invalid outfit ID.');
    const unsupported = build.skills.filter(id => !Object.hasOwn(skills, id));
    if (unsupported.length) throw new Error(`Skills unavailable in this Alpha123 update: ${[...new Set(unsupported)].join(', ')}.`);
    const policies = new Map(Object.entries(build.samplePolicies ?? {}));
    for (const [id, pos] of Object.entries(build.forcedSkillPositions ?? {})) {
      if (!Number.isFinite(pos) || pos < 0) throw new Error(`Invalid forced position for skill ${id}.`);
      policies.set(id, {policy: 'fixed', pos});
    }
    for (const [id, spec] of policies) {
      if (!spec || !['immediate', 'fixed', 'random', 'straight-random', 'all-corner-random', 'log-normal', 'erlang'].includes(spec.policy) ||
          (spec.policy === 'fixed' && (!Number.isFinite(spec.pos) || spec.pos < 0))) {
        throw new Error(`Invalid activation policy for skill ${id}.`);
      }
    }
    delete build.forcedSkillPositions;
    build.samplePolicies = Object.fromEntries(policies);
    return build;
  }

  function stringify(build) {
    const {aptitudes, ...exportedBuild} = build;
    const forcedSkillPositions = Object.fromEntries(Object.entries(build.samplePolicies ?? {})
      .filter(([, sample]) => sample.policy === 'fixed')
      .map(([id, sample]) => [id, sample.pos]));
    return JSON.stringify({...exportedBuild, forcedSkillPositions}, null, 2) + '\n';
  }

  function importFile(apply) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        if (file.size > 1024 * 1024) throw new Error('Choose a JSON file under 1 MB.');
        apply(parse(await file.text()));
      } catch (error) {
        window.alert(`Could not import build. ${error.message}`);
      }
    }, {once: true});
    input.click();
  }

  function exportFile(build, name, value) {
    const url = URL.createObjectURL(new Blob([stringify(build)], {type: 'application/json'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename(name, value);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const draftKey = 'umalator-global-sp:session:v1';
  const draftFields = [
    'courseId', 'racedef', 'nsamples', 'seed', 'usePosKeep', 'useCompeteTop',
    'useIntChecks', 'useShowHp', 'displayedRun', 'chartMode', 'chartSkills',
  ];
  const draftRunners = ['uma1', 'uma2', 'debufUma'];

  function draftFieldsFrom(state) {
    return Object.fromEntries(draftFields.filter(key => Object.hasOwn(state, key))
      .map(key => [key, state[key]]));
  }

  function restoreDraft(deserialize) {
    try {
      const saved = JSON.parse(window.localStorage.getItem(draftKey));
      if (!saved) return {};
      const restored = draftFieldsFrom(saved);
      for (const key of draftRunners) restored[key] = deserialize(parse(JSON.stringify(saved[key])));
      restored.hintLevels = new Map(saved.hintLevels);
      return restored;
    } catch {
      return {};
    }
  }

  function watchDraft(state, serialize, hash, loadHash) {
    let loading = false;
    let generation = 0;
    let lastSaved;
    const save = next => {
      if (loading) return;
      try {
        const draft = draftFieldsFrom(next);
        for (const key of draftRunners) draft[key] = serialize(next[key]);
        draft.hintLevels = [...next.hintLevels];
        const text = JSON.stringify(draft);
        if (text !== lastSaved) {
          window.localStorage.setItem(draftKey, text);
          lastSaved = text;
        }
      } catch {
        // The simulator still works when browser storage is disabled or full.
      }
    };
    const onHashChange = async () => {
      const value = window.location.hash;
      if (!value || value === '#') return;
      loading = true;
      const request = ++generation;
      try {
        const loaded = await hash(value.slice(1));
        if (request === generation && window.location.hash === value) {
          loadHash(loaded);
          window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
        }
      } catch {
        // An unreadable share link leaves the current draft available.
      } finally {
        if (request === generation) {
          loading = false;
          save(state.ref.current.state);
        }
      }
    };
    const listeners = state.ref.current.listeners;
    listeners.add(save);
    window.addEventListener('hashchange', onHashChange);
    onHashChange();
    return () => {
      generation++;
      listeners.delete(save);
      window.removeEventListener('hashchange', onHashChange);
    };
  }

  globalThis.UmaFork = Object.freeze({total, summary, rating, formatRating, rankIndex, filename, parse, stringify, importFile, exportFile, restoreDraft, watchDraft, darkMode, setDarkMode});
})();
