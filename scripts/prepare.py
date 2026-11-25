"""Build Alpha123's original Global UI with the JSON and SP changes."""

import argparse
import json
import re
import shutil
from hashlib import sha256
from pathlib import Path
from zipfile import ZipFile


ASSETS = "https://alpha123.github.io/uma-tools/"
BASE_PATH = 'new URL(".",document.baseURI).pathname.replace(/\\/$/,"")'
POINTER = 'globalThis.UmaFork'
ROUTES = ('index.html', 'compare/index.html', 'skills/index.html', 'stamina/index.html')
SUMMARY_CSS = '''
.horseAptitudes.fork-compact-aptitudes{grid-template-columns:repeat(2,minmax(0,1fr)) minmax(0,.68fr);grid-template-areas:"surface distance rank" "strategy style rank" "sp rating context";gap:8px 12px;margin:0 16px}
.horseAptitudes.fork-compact-aptitudes>.fork-aptitude{background:white;border:2px solid #e0d6cc;justify-content:initial;min-width:0}
.fork-surface{grid-area:surface}.fork-distance{grid-area:distance}.fork-strategy{grid-area:strategy}.fork-style{grid-area:style}
.horseAptitudes.fork-compact-aptitudes>.fork-live-rank{grid-area:rank;align-self:stretch;position:relative;align-items:center;justify-content:center;background:none;border:0;padding:0;height:auto;min-height:0}
.fork-live-rank>img{position:absolute;inset:0;margin:auto;max-width:100%;height:100%;max-height:5.2em;object-fit:contain;width:auto}
.fork-compact-aptitudes>output{background:linear-gradient(#a8e305,#61ae16) padding-box,linear-gradient(#addb3c,#558f18) border-box;border:2px solid transparent;border-radius:36px;box-shadow:0 3px #b4b2c0;color:#fff;padding:.28em .2em;text-align:center;font-weight:700;font-size:1em;line-height:1.3;min-width:0;white-space:nowrap}
.fork-sp-summary{grid-area:sp}.fork-rating-summary{grid-area:rating}
.horseAptitudes.fork-compact-aptitudes>.fork-race-context{grid-area:context;justify-content:center;flex-wrap:wrap;gap:3px;background:none;border:0;padding:0;height:auto;font-size:.88em;min-width:0}
.horseAptitudes.fork-compact-aptitudes>.fork-race-context>input{width:calc(2ch + 12px);font-size:1em;margin:0;text-align:center}
.fork-race-context>img{height:1.5em;width:auto;max-width:48%;object-fit:contain;cursor:pointer}
.horseSkillHeader.fork-compact-skills-title{margin:8px auto 12px;width:calc(100% - 32px)}
@media (orientation:portrait){.horseAptitudes.fork-compact-aptitudes{gap:8px 8px;margin:0 12px}.fork-compact-aptitudes>output{font-size:.88em}.horseAptitudes.fork-compact-aptitudes>.fork-race-context{font-size:.77em}}
'''


def replace_once(text, anchor, replacement):
    if text.count(anchor) != 1:
        raise ValueError(f"Upstream integration anchor changed: {anchor[:105]}")
    return text.replace(anchor, replacement, 1)


def match_once(text, pattern):
    matches = list(re.finditer(pattern, text))
    if len(matches) != 1:
        raise ValueError(f"Upstream integration pattern changed: {pattern[:105]}")
    return matches[0]


def integrate_bundle(bundle):
    # Build from the exact browser bundle Alpha123 ships. The paired source
    # changes below provide the readable equivalent and fail on drift as well.
    io = match_once(bundle,
                    r"function (\w+)\(\)\{window\.navigator\.clipboard\.writeText\(JSON\.stringify"
                    r"\((\w+)\((\w+)\(\)\)\)\),document\.activeElement\.blur\(\)\}"
                    r"async function (\w+)\(\)\{let (\w+)=await navigator\.clipboard\.readText"
                    r"\(\)\.then\(JSON\.parse\);\5\.hasOwnProperty\(\"outfitId\"\)&&"
                    r"\5\.hasOwnProperty\(\"skills\"\)&&(\w+)\((\w+)\(\5\)\)")
    _, serialize, current, paste, _, update, deserialize = io.groups()
    copy_json = f'JSON.stringify({serialize}({current}()))'
    clipboard = io[0].replace(copy_json, f'{POINTER}.stringify({serialize}({current}()))', 1)
    clipboard = clipboard.replace('.then(JSON.parse)', f'.then({POINTER}.parse)', 1)
    bundle = replace_once(bundle, io[0], clipboard)
    item = match_once(bundle, rf'(\w+)\("li",null,\1\("button",\{{onClick:{paste}\}},"Paste from clipboard"\)\)')
    h = item[1]
    menu = (
        item[0] + f',{h}("li",null,{h}("button",{{onClick:()=>{POINTER}.importFile'
        f'(value=>{update}({deserialize}(value)))}},"Import JSON")),'
        f'{h}("li",null,{h}("button",{{onClick:()=>{POINTER}.exportFile({serialize}({current}()))}},"Export JSON"))'
    )
    bundle = replace_once(bundle, item[0], menu)
    header = match_once(bundle, r'(\w+)\("div",\{class:"horseSkillHeader"\},\w+\.skillHeader\|\|\1\(\w+,\{id:"skillheader"\}\)\)')
    h = header[1]
    label = (
        f',{h}("output",{{class:"fork-sp",title:"Total base skill points including prerequisites"}},'
        f'{POINTER}.summary({current}().skills.values())))'
    )
    bundle = replace_once(bundle, header[0], header[0][:-1] + label)
    bundle = replace_once(bundle, '("/uma-tools/umalator-global",', '(' + BASE_PATH + ',')
    telemetry = match_once(bundle, r'\b(\w+)\(\);try\{window\.parent&&window\.parent\.location\.hostname')
    bundle = replace_once(bundle, telemetry[0], 'try{window.parent&&window.parent.location.hostname')
    return localize(bundle)


def localize(text):
    return (text.replace('/uma-tools/icons', ASSETS + 'icons')
            .replace('/uma-tools/fonts', ASSETS + 'fonts')
            .replace('/uma-tools/courseimages', ASSETS + 'courseimages')
            .replace('/uma-tools/vendor', ASSETS + 'vendor')
            .replace('../vendor/opencv.js', ASSETS + 'vendor/opencv.js'))


def integrate_autosave(bundle):
    serializers = match_once(bundle, rf'{re.escape(POINTER)}\.exportFile\((\w+)\(build\),')
    loader = match_once(bundle,
        r'function (\w+)\(\)\{window\.location\.hash&&(\w+)\(window\.location\.hash\.slice\(1\)\)'
        r'\.then\((\w+)=>\{(\w+)\.setState\(Object\.assign\(\{\},\4\.ref\.current\.state,\3\)\),(\w+)\(!\w+\)\}\)\}'
        r'return (\w+)\(function\(\)\{\1\(\),window\.addEventListener\("hashchange",\1\)\},\[\]\),')
    _, decode, _, state, remount, effect = loader.groups()
    deserialize = match_once(bundle,
        rf'{re.escape(POINTER)}\.importFile\(value=>\w+\((\w+)\(value\)\)\)')[1]
    defaults = match_once(bundle, r'chartMode:"all",chartSkills:null\}\)\),\[\w+,\w+\]=\w+\(!1\);')
    bundle = replace_once(bundle, defaults[0], defaults[0].replace('chartSkills:null}',
        f'chartSkills:null,...{POINTER}.restoreDraft({deserialize})}}'))
    chart = match_once(bundle, r'(\w+)=\w+\((\w+)\.chartSkills\),\[(\w+),(\w+)\]=\w+\(\1\|\|\[\]\),\[\w+,\w+\]=(\w+)\(\2\.chartMode\)')
    loaded, optics, skills, set_skills, lens = chart.groups()
    bundle = replace_once(bundle, chart[0], f'[{loaded},{set_skills}]={lens}({optics}.chartSkills),'
        f'{skills}={loaded}||[],{chart[0].split("||[]),",1)[1]}')
    return replace_once(bundle, loader[0],
        f'return {effect}(()=>{POINTER}.watchDraft({state},{serializers[1]},{decode},'
        f'loaded=>{{{state}.setState({{...{state}.ref.current.state,...loaded}});{remount}(key=>!key)}}),[]),')


def integrate_rating_bundle(bundle):
    score = match_once(bundle, r'(\w+)=-1;if\((\w+)\.showScore\)\{let (\w+)=(\w+)\(\2\.state\);\1=(\w+)\(\(\)=>(\w+)\(\3\),\[\3\]\)\}')
    value, props, _, getter, memo, calculate = score.groups()
    snapshot = f'{getter}({props}.state)'
    course = f'{props}.course'
    live_score = f'{POINTER}.rating(forkBuild,{calculate},{course})'
    bundle = replace_once(bundle, score[0],
        f'{value}=-1,forkBuild={snapshot},forkRating={memo}(()=>{props}.compareSummary?{live_score}:'
        f'{props}.showScore?{calculate}(forkBuild):-1,[forkBuild,{props}.compareSummary,{props}.showScore,{course}]);'
        f'{value}={props}.showScore?forkRating:-1;')
    header = match_once(bundle, rf'(\w+)\("div",\{{class:"horseSkillHeader"\}},({props}\.skillHeader\|\|\1\(\w+,\{{id:"skillheader"\}}\)),(\1\("output",\{{class:"fork-sp",title:"[^"]+"\}},{re.escape(POINTER)}\.summary\(\w+\(\)\.skills\.values\(\)\)\))\)')
    h, title, old_sp = header.groups()
    rank_thresholds = match_once(bundle, r'(\w+)\.findIndex\(\w+=>\w+>\w+\.score\)')[1]
    # Capture the actual upstream editor controls and reuse them without changing
    # their state lenses or keyboard behavior. Only the layout is replaced.
    control = rf'{h}\("div",null,{h}\("span",null,{h}\(\w+,\{{id:"select\.(?:surfaceaptitude|distanceaptitude|strategy|strategyaptitude)"\}}\)\),{h}\(\w+,\{{[as]:[^,]+,tabindex:\w+\(\)\}}\)\)'
    mood = rf'{h}\("div",null,({h}\(\w+,\{{m:{props}\.state\.mood,tabindex:\w+\(\)\}}\))\)'
    popularity = rf'{h}\("div",null,({h}\(\w+,\{{p:{props}\.state\.popularity,tabindex:\w+\(\)\}}\))\)'
    apt = match_once(bundle, rf'case"simulation":return {h}\("div",\{{class:"horseAptitudes"\}},({control}),({control}),{mood},({control}),({control}),{popularity}\);case"full":')
    surface, distance, mood_ui, strategy, style, popularity_ui = apt.groups()
    controls = [item.replace(f'{h}("div",null,', f'{h}("div",{{class:"fork-aptitude fork-{area}"}},', 1)
                for item, area in zip((surface, distance, strategy, style), ('surface', 'distance', 'strategy', 'style'))]
    rank = f'{POINTER}.rankIndex(forkRating,{rank_thresholds})'
    rank_badge = (f'{h}("div",{{class:"fork-live-rank"}},{rank}===null?{h}("span",null,"—"):'
                  f'{h}("img",{{src:`{ASSETS}icons/rank/utx_txt_rank_${{{rank}}}.png`,alt:"Live rank",title:"Rank for "+{POINTER}.formatRating(forkRating)}}))')
    sp = f'{h}("output",{{class:"fork-sp-summary",title:"Total base skill points including prerequisites"}},"SP : "+{POINTER}.summary(forkBuild.skills.values()))'
    rating = f'{h}("output",{{class:"fork-rating-summary"}},"Rating : "+{POINTER}.formatRating(forkRating))'
    context = f'{h}("div",{{class:"fork-race-context"}},{popularity_ui},{mood_ui})'
    compact = f'{h}("div",{{class:"horseAptitudes fork-compact-aptitudes"}},'+','.join([*controls,rank_badge,sp,rating,context])+')'
    bundle = replace_once(bundle, apt[0], apt[0].replace('case"simulation":return ', f'case"simulation":return {props}.compareSummary?{compact}:', 1))
    bundle = replace_once(bundle, header[0],
        f'{h}("div",{{class:{props}.compareSummary?"horseSkillHeader fork-compact-skills-title":"horseSkillHeader"}},'
        f'{props}.compareSummary?{title}:[{title},{old_sp[:-1]}+" SP")])')
    catalog = match_once(bundle, r'Object\.keys\((\w+)\)\.flatMap\((\w+)=>Object\.keys\(\1\[\2\]\.outfits\)\)')[1]
    export = match_once(bundle, rf'{re.escape(POINTER)}\.exportFile\((\w+)\((\w+)\(\)\)\)')
    serialize, current = export.groups()
    bundle = replace_once(bundle, export[0],
        f'{{const build={current}();{POINTER}.exportFile({serialize}(build),'
        f'{catalog}[build.outfitId.slice(0,4)]?.name[1],'
        f'{POINTER}.rating(build,{calculate},{course}));}}')
    for slot in ('uma1', 'uma2', 'debufUma'):
        editor = match_once(bundle, rf'state:\w+\.{slot},aptitudesMode:"simulation",course:\w+,showPolicyEd:!0,tabstart:')
        bundle = replace_once(bundle, editor[0], editor[0].replace('tabstart:', 'compareSummary:!0,tabstart:'))
    return bundle


def readable_rating_changes(horse, app):
    score = match_once(horse, r'let score = -1;\s+if \(props\.showScore\) \{[^}]+\}')
    horse = replace_once(horse, score[0], f'''const build = useGetter(props.state);
	const rating = useMemo(() => props.compareSummary ? {POINTER}.rating(build, scoreUma, props.course)
		: props.showScore ? scoreUma(build) : -1, [build, props.compareSummary, props.showScore, props.course]);
	const score = props.showScore ? rating : -1;''')
    export = f'{POINTER}.exportFile(serializeUma(uma_GetCurrent()))'
    horse = replace_once(horse, export, f'''{{
                                            const current = uma_GetCurrent();
                                            {POINTER}.exportFile(serializeUma(current),
                                                umas[current.outfitId.slice(0, 4)]?.name[1],
                                                {POINTER}.rating(current, scoreUma, props.course));
                                        }}''')
    head = match_once(horse, r'<div class="horseSkillHeader">[\s\S]+?</output>\s*</div>')
    horse = replace_once(horse, head[0], f'''<div class={{props.compareSummary ? "horseSkillHeader fork-compact-skills-title" : "horseSkillHeader"}}>
					{{props.skillHeader || <Text id="skillheader" />}}
					{{!props.compareSummary && <output class="fork-sp" title="Total base skill points including prerequisites">{{{POINTER}.summary(build.skills.values())}} SP</output>}}
				</div>''')
    sim = match_once(horse, r"case 'simulation':\s+return \(")[0]
    horse = replace_once(horse, sim, f'''case 'simulation':
            if (props.compareSummary) {{
                const rank = {POINTER}.rankIndex(rating, RankThresholds);
                return (
                    <div class="horseAptitudes fork-compact-aptitudes">
                        <div class="fork-aptitude fork-surface"><span><Text id="select.surfaceaptitude" /></span><AptitudeSelect a={{props.state.surfaceAptitude}} tabindex={{tabnext()}} /></div>
                        <div class="fork-aptitude fork-distance"><span><Text id="select.distanceaptitude" /></span><AptitudeSelect a={{props.state.distanceAptitude}} tabindex={{tabnext()}} /></div>
                        <div class="fork-aptitude fork-strategy"><span><Text id="select.strategy" /></span><StrategySelect s={{l_strategy}} tabindex={{tabnext()}} /></div>
                        <div class="fork-aptitude fork-style"><span><Text id="select.strategyaptitude" /></span><AptitudeSelect a={{props.state.strategyAptitude}} tabindex={{tabnext()}} /></div>
                        <div class="fork-live-rank">{{rank === null ? <span>—</span> : <img src={{`/uma-tools/icons/rank/utx_txt_rank_${{rank}}.png`}} alt="Live rank" title={{"Rank for " + {POINTER}.formatRating(rating)}} />}}</div>
                        <output class="fork-sp-summary" title="Total base skill points including prerequisites">SP : {{{POINTER}.summary(build.skills.values())}}</output>
                        <output class="fork-rating-summary">Rating : {{{POINTER}.formatRating(rating)}}</output>
                        <div class="fork-race-context"><PopularitySelect p={{props.state.popularity}} tabindex={{tabnext()}} /><MoodSelect m={{props.state.mood}} tabindex={{tabnext()}} /></div>
                    </div>
                );
            }}
			return (''')
    for slot in ('uma1', 'uma2', 'debufUma'):
        anchor = f'state={{O.{slot}}} aptitudesMode="simulation" course={{course}}'
        app = replace_once(app, anchor, anchor + ' compareSummary={true}')
    return horse, app


def readable_changes(read, destination):
    horse = read('components/HorseDef.tsx').decode()
    horse = replace_once(horse, 'JSON.stringify(serializeUma(uma_GetCurrent()))',
                         f'{POINTER}.stringify(serializeUma(uma_GetCurrent()))')
    horse = replace_once(horse, 'navigator.clipboard.readText().then(JSON.parse)',
                         f'navigator.clipboard.readText().then({POINTER}.parse)')
    menu = '<li><button onClick={clipbdPaste}>Paste from clipboard</button></li>'
    horse = replace_once(horse, menu, menu + f'''
                                        <li><button onClick={{() => {POINTER}.importFile(value => setUma(deserializeUma(value)))}}>Import JSON</button></li>
                                        <li><button onClick={{() => {POINTER}.exportFile(serializeUma(uma_GetCurrent()))}}>Export JSON</button></li>''')
    title = '{props.skillHeader || <Text id="skillheader" />}'
    horse = replace_once(horse, title, title + f'''
                    <output class="fork-sp" title="Total base skill points including prerequisites">{{
                        {POINTER}.summary(uma_GetCurrent().skills.values())
                    }}</output>''')
    app = read('umalator/app.tsx').decode()
    app = replace_once(app, "'/uma-tools/umalator-global'", BASE_PATH)
    app = replace_once(app, 'initTelemetry();', '// The fork does not initialize upstream analytics.')
    horse, app = readable_rating_changes(horse, app)
    app = readable_autosave(app)
    for name, content in [('components/HorseDef.tsx', horse), ('umalator/app.tsx', app)]:
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(localize(content), encoding='utf-8')


def readable_autosave(app):
    chart = match_once(app, r'const loadedChartSkills = useGetter\(O\.chartSkills\);\s+const \[chartSkills, setChartSkills\] = useState\(loadedChartSkills \|\| \[\]\);')
    app = replace_once(app, chart[0], 'const [loadedChartSkills, setChartSkills] = useLens(O.chartSkills);\n'
        '\tconst chartSkills = loadedChartSkills || [];')
    defaults = match_once(app, r"chartMode: 'all',\s+chartSkills: null\s+\}\)\);")
    app = replace_once(app, defaults[0], defaults[0].replace('chartSkills: null',
        f'chartSkills: null,\n\t\t...{POINTER}.restoreDraft(deserializeUma)'))
    loader = match_once(app, r'function loadState\(\) \{[\s\S]+?window\.addEventListener\(\'hashchange\', loadState\);\s+\}, \[\]\);')
    return replace_once(app, loader[0], f'''useEffect(() => {POINTER}.watchDraft(state, serializeUma, deserialize, loaded => {{
		state.setState({{...state.ref.current.state, ...loaded}});
		setKey(key => !key);
	}}), []);''')


def bundled_object(source, anchor):
    """Locate one esbuild data literal without executing the published bundle."""
    if source.count(anchor) != 1:
        raise ValueError(f'Expected exactly one embedded data object: {anchor}')
    start = source.index(anchor)
    depth = 0
    quoted = escaped = False
    for end in range(start, len(source)):
        char = source[end]
        if quoted:
            if escaped:
                escaped = False
            elif char == '\\':
                escaped = True
            elif char == '"':
                quoted = False
        elif char == '"':
            quoted = True
        elif char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0:
                literal = source[start:end + 1]
                # esbuild emits bare property names in these JSON data literals.
                decoded = json.loads(re.sub(r'(?<=[{,])([A-Za-z]\w*):', r'"\1":', literal))
                return literal, decoded
    raise ValueError(f'Unterminated data object: {anchor}')


def add_upcoming_skills(read, bundle, worker, skills, meta):
    data_anchor = '{"100011":{alternatives:'
    meta_anchor = '{"100011":{baseCost:'
    jp_bundle = read('umalator/bundle.js').decode()
    jp_worker = read('umalator/simulator.worker.js').decode()
    _, jp_skills = bundled_object(jp_bundle, data_anchor)
    _, jp_worker_skills = bundled_object(jp_worker, data_anchor)
    if jp_skills != jp_worker_skills:
        raise ValueError('JP UI and engine skill data differ')
    jp_meta = json.loads(read('skill_meta.json'))
    names = json.loads(read('umalator-global/skillnames.json'))
    upcoming = sorted((set(jp_skills) - set(skills)) & set(jp_meta) & set(names), key=int)
    # Do not invent English names or overwrite skills already released in Global.
    upcoming = [sid for sid in upcoming if names[sid] and isinstance(names[sid][0], str) and names[sid][0].strip()]
    # The current upstream condition engine does not implement these conditions.
    # The first two affected evolutions and the shared random roll throw during comparison.
    unsupported_conditions = re.compile(r'\b(?:temptation_opponent_count_behind|random_lot_shared)\b')
    excluded = {sid: names[sid][0] for sid in upcoming if any(
        unsupported_conditions.search(alt['condition']) or unsupported_conditions.search(alt['precondition'])
        for alt in jp_skills[sid]['alternatives']
    )}
    upcoming = [sid for sid in upcoming if sid not in excluded]
    merged_skills = {**skills, **{sid: jp_skills[sid] for sid in upcoming}}
    merged_meta = {**meta, **{sid: jp_meta[sid] for sid in upcoming}}
    for label, source in [('UI', bundle), ('worker', worker)]:
        old_data, embedded = bundled_object(source, data_anchor)
        old_meta, embedded_meta = bundled_object(source, meta_anchor)
        if embedded != skills or embedded_meta != meta:
            raise ValueError(f'Global {label} skill data differs from upstream JSON')
        source = replace_once(source, old_data, json.dumps(merged_skills, ensure_ascii=True, separators=(',', ':')))
        source = replace_once(source, old_meta, json.dumps(merged_meta, ensure_ascii=True, separators=(',', ':')))
        if label == 'UI':
            bundle = source
        else:
            worker = source
    return bundle, worker, merged_skills, merged_meta, {sid: names[sid][0] for sid in upcoming}, excluded


def prepare(read, sha, dest, files):
    if not re.fullmatch(r'[0-9a-f]{40}', sha):
        raise ValueError("Expected a full Alpha123 commit SHA")
    base = 'umalator-global/'
    meta = json.loads(read(base + 'skill_meta.json'))
    skills = json.loads(read(base + 'skill_data.json'))
    bundle = integrate_autosave(integrate_rating_bundle(integrate_bundle(read(base + 'bundle.js').decode())))
    worker = read(base + 'simulator.worker.js').decode()
    bundle, worker, skills, meta, upcoming, excluded = add_upcoming_skills(read, bundle, worker, skills, meta)
    catalog = {'revision': sha, 'upcomingSkills': upcoming, 'excludedUpcomingSkills': excluded, 'skills': {
        key: {**meta[key], 'rarity': value['rarity']} for key, value in skills.items()
    }}
    if not skills or not all(f'"{id}":' in worker for id in skills):
        raise ValueError("Upstream worker and skill data have different skill IDs")
    print(f'Added {len(upcoming)} upcoming skills with Global English names; {len(excluded)} unsupported; {len(skills)} total')
    dest.mkdir(parents=True, exist_ok=True)
    (dest / 'bundle.js').write_text(bundle, encoding='utf-8')
    bundle_version = sha256(bundle.encode('utf-8')).hexdigest()[:12]
    (dest / 'simulator.worker.js').write_text(worker, encoding='utf-8')
    css = (localize(read(base + 'bundle.css').decode()) +
           '\n.fork-sp{margin-inline-start:.65em;white-space:nowrap;font-weight:600}\n' + SUMMARY_CSS).encode('utf-8')
    (dest / 'bundle.css').write_bytes(css)
    css_version = sha256(css).hexdigest()[:12]
    (dest / 'skill-catalog.js').write_text('globalThis.UmaForkData=' + json.dumps(catalog) + ';', encoding='utf-8')
    shutil.copyfile(files / 'overlay/build-io.js', dest / 'build-io.js')
    io_version = sha256((dest / 'build-io.js').read_bytes()).hexdigest()[:12]
    (dest / 'LICENSE').write_bytes(read('LICENSE'))
    readable_changes(read, dest / 'source-changes')
    for route in ROUTES:
        html = read(base + route).decode()
        html = replace_once(html, 'href="bundle.css"', f'href="bundle.css?v={css_version}"')
        html = replace_once(html, '<script src="bundle.js"></script>',
                            '<script src="skill-catalog.js"></script>\n'
                            f'\t\t<script src="build-io.js?v={io_version}"></script>\n'
                            f'\t\t<script src="bundle.js?v={bundle_version}"></script>')
        html = replace_once(html, '</body>',
                            f'<div style="margin:.6rem;font-size:.82rem">Alpha123 Global fork · '
                            f'<a href="https://github.com/alpha123/uma-tools/tree/{sha}">Upstream {sha[:7]}</a> · '
                            '<a href="source-changes/">Source changes</a> · <a href="LICENSE">GPL-3.0</a></div>\n\t</body>')
        target = dest / route
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(html, encoding='utf-8')
    shutil.copyfile(files / 'scripts/prepare.py', dest / 'source-changes/prepare.py')
    note = (f'<!doctype html><meta charset="utf-8"><title>Fork source changes</title>'
            f'<h1>Alpha123 Global fork source</h1><p>Changes dated 2026-11-21. GPL-3.0-or-later.</p>'
            f'<ul><li><a href="https://github.com/alpha123/uma-tools/tree/{sha}">Alpha123 source at {sha[:7]}</a></li>'
            '<li><a href="components/HorseDef.tsx">Modified runner editor</a></li>'
            '<li><a href="umalator/app.tsx">Modified app entry</a></li>'
            '<li><a href="../build-io.js">JSON compatibility and SP tracker</a></li>'
            '<li><a href="prepare.py">Build script</a></li></ul>')
    (dest / 'source-changes/index.html').write_text(note, encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('upstream', type=Path)
    parser.add_argument('--sha')
    parser.add_argument('--out', type=Path, default=Path('dist'))
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    if args.upstream.is_file():
        with ZipFile(args.upstream) as source:
            prefix = source.namelist()[0].split('/')[0]
            prepare(lambda name: source.read(f'{prefix}/{name}'), args.sha or source.comment.decode(), args.out, root)
    else:
        if not args.sha:
            parser.error('--sha is required for a checkout')
        prepare(lambda name: (args.upstream / name).read_bytes(), args.sha, args.out, root)


if __name__ == '__main__':
    main()
