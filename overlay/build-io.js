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
    if (build.skillLevels) exportedBuild.aptitudes = aptitudes;
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

  function partnerEndpoint() {
    return document.querySelector('meta[name="partner-lookup-url"]')?.content;
  }

  async function lookupPartner(id, endpoint, signal, course) {
    if (!/^\d{9}$/.test(id)) throw new Error('Enter a 9-digit Global Partner ID.');
    const url = new URL(endpoint, document.baseURI);
    if (url.protocol !== 'https:' && url.origin !== location.origin) {
      throw new Error('Use an HTTPS Partner lookup URL.');
    }
    url.searchParams.set('partner_id', id);
    const response = await fetch(url, {signal, credentials: 'omit', cache: 'no-store', redirect: 'error'});
    if (response.status === 404 || response.status === 410) {
      throw new Error('Partner ID was not found or has expired.');
    }
    if (!response.ok) throw new Error(`Partner lookup failed (${response.status}).`);
    const {partner_id, veteran} = await response.json() ?? {};
    if (partner_id !== id) throw new Error('The lookup returned a different Partner ID.');
    if (!veteran || !Array.isArray(veteran.skill_array)) {
      throw new Error('The lookup did not return a full trained build.');
    }

    const integer = (value, field, min, max = Number.MAX_SAFE_INTEGER) => {
      if (!Number.isSafeInteger(value) || value < min || value > max) {
        throw new Error(`Invalid or missing ${field} in the trained build.`);
      }
      return value;
    };
    const gradeFields = [
      'distance_short', 'distance_mile', 'distance_middle', 'distance_long',
      'running_style_nige', 'running_style_senko', 'running_style_sashi', 'running_style_oikomi',
      'ground_turf', 'ground_dirt',
    ];
    const grades = gradeFields.map(field => integer(veteran[`proper_${field}`], field, 1, 8));
    const aptitudes = grades.map(grade => 'GFEDCBAS'[grade - 1]);
    const card = integer(veteran.card_id, 'card_id', 100001, 999999);
    const starCount = integer(veteran.rarity, 'rarity', 1, 5);
    const style = integer(veteran.running_style, 'running_style', 1, 4) - 1;
    const characterId = Math.floor(card / 100);
    const outfitNumber = integer(card % 100, 'outfit number', 1, 99);
    const uniqueBase = starCount > 2 ? 100000 : 10000;
    const uniqueId = String(uniqueBase + 10000 * (outfitNumber - 1) + 10 * (characterId % 1000) + 1);
    const skillIds = [];
    const skillLevels = {};
    for (const entry of veteran.skill_array) {
      const id = String(integer(entry?.skill_id, 'skill ID', 1));
      if (skillIds.includes(id)) throw new Error(`Duplicate learned skill ${id}.`);
      skillIds.push(id);
      if (entry.level != null) skillLevels[id] = integer(entry.level, `skill ${id} level`, 1);
    }
    const stats = Object.fromEntries(['speed', 'stamina', 'power', 'guts', 'wiz'].map(field => [
      field === 'wiz' ? 'wisdom' : field, integer(veteran[field], field, 1),
    ]));
    const distanceGrade = aptitudes.slice(0, 4)[course?.distanceType - 1];
    const surfaceGrade = aptitudes.slice(8)[course?.surface - 1];
    return parse(JSON.stringify({
      outfitId: String(card), characterId: String(characterId), starCount, ...stats,
      uniqueLv: integer(skillLevels[uniqueId], `unique skill ${uniqueId} level`, 1),
      aptitudes, skillLevels, skills: skillIds,
      strategy: ['Nige', 'Senkou', 'Sasi', 'Oikomi'][style], strategyAptitude: aptitudes[4 + style],
      distanceAptitude: distanceGrade ?? aptitudes[grades.indexOf(Math.max(...grades.slice(0, 4)))],
      surfaceAptitude: surfaceGrade ?? aptitudes[grades[9] > grades[8] ? 9 : 8], mood: 2, popularity: 1,
    }));
  }

  function importPartner(apply, course) {
    const endpoint = partnerEndpoint();
    if (!endpoint) return;
    const dialog = document.createElement('dialog');
    dialog.className = 'fork-card-dialog';
    dialog.setAttribute('aria-label', 'Import Partner ID');
    dialog.innerHTML = `<form>
      <label>Global Partner ID <input name="partnerId" inputmode="numeric" pattern="[0-9]{9}" maxlength="9" required></label>
      <p role="status"></p>
      <div class="fork-card-actions"><button type="button">Cancel</button><button type="submit">Import</button></div>
    </form>`;
    const form = dialog.querySelector('form');
    const status = dialog.querySelector('[role="status"]');
    const submit = dialog.querySelector('[type="submit"]');
    const controller = new AbortController();
    dialog.querySelector('[type="button"]').onclick = () => dialog.close();
    dialog.addEventListener('close', () => { controller.abort(); dialog.remove(); }, {once: true});
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (submit.disabled) return;
      submit.disabled = true;
      status.textContent = 'Looking up Partner ID.';
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]);
      try {
        const build = await lookupPartner(form.elements.partnerId.value, endpoint, signal, course);
        if (!dialog.open || controller.signal.aborted) return;
        apply(build);
        dialog.close();
      } catch (error) {
        status.textContent = error.name === 'TimeoutError' ? 'Partner lookup timed out. Try again.' : error.message;
      } finally {
        submit.disabled = false;
      }
    });
    document.body.append(dialog);
    dialog.showModal();
    form.elements.partnerId.focus();
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

  globalThis.UmaFork = Object.freeze({total, summary, rating, formatRating, rankIndex, filename, parse, stringify, importFile, exportFile, partnerEndpoint, lookupPartner, importPartner, restoreDraft, watchDraft, darkMode, setDarkMode});
})();
