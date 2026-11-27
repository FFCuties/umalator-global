"""Build Alpha123's original Global UI with the JSON and SP changes."""

import argparse
import json
import re
import shutil
from hashlib import sha256
from html import escape
from os import environ
from pathlib import Path
from zipfile import ZipFile


ASSETS = "https://alpha123.github.io/uma-tools/"
BASE_PATH = 'new URL(".",document.baseURI).pathname.replace(/\\/$/,"")'
POINTER = 'globalThis.UmaFork'
ROUTES = ('index.html', 'compare/index.html', 'skills/index.html', 'stamina/index.html')
SUMMARY_CSS = '''
.horseAptitudes.fork-compact-aptitudes{grid-template-columns:repeat(2,minmax(0,1fr)) minmax(0,.60fr);grid-template-areas:"surface distance rank" "strategy style rank" "sp rating context";gap:8px 12px;margin:0 16px}
.horseAptitudes.fork-compact-aptitudes>.fork-aptitude{background:white;border:2px solid #e0d6cc;justify-content:initial;min-width:0}
.fork-surface{grid-area:surface}.fork-distance{grid-area:distance}.fork-strategy{grid-area:strategy}.fork-style{grid-area:style}
.horseAptitudes.fork-compact-aptitudes>.fork-live-rank{grid-area:rank;align-self:stretch;position:relative;align-items:center;justify-content:center;background:none;border:0;padding:0;height:auto;min-height:0}
.fork-live-rank>img{position:absolute;inset:0;margin:auto;max-width:calc(100% - 8px);height:calc(100% - 2px);max-height:5.4em;object-fit:contain;width:auto}
.fork-compact-aptitudes>output{background:linear-gradient(#a8e305,#61ae16) padding-box,linear-gradient(#addb3c,#558f18) border-box;border:2px solid transparent;border-radius:36px;box-shadow:0 3px #b4b2c0;color:#fff;padding:.28em .2em;text-align:center;font-weight:700;font-size:1em;line-height:1.3;min-width:0;white-space:nowrap}
.fork-sp-summary{grid-area:sp}.fork-rating-summary{grid-area:rating}
.horseAptitudes.fork-compact-aptitudes>.fork-race-context{grid-area:context;align-self:stretch;align-items:center;justify-content:center;background:none;border:0;padding:0;height:auto;font-size:1em;min-width:0}
.horseAptitudes>div.fork-legacy-mood{grid-column:3;grid-row:1/span 2;align-self:stretch;justify-content:center;background:none;border:0;padding:0;height:auto}
.fork-race-context>img,.horseAptitudes>div.fork-legacy-mood>img{height:1.75em;width:auto;max-width:90%;object-fit:contain;cursor:pointer}
.horseSkillHeader.fork-compact-skills-title{margin:8px auto 12px;width:calc(100% - 32px)}
#sidebar>.fork-about{font-size:.8em;line-height:1.5;margin:12px 0 4px;color:#50606a;max-width:170px}
.fork-about>summary{cursor:pointer;width:fit-content}
.fork-about-links{display:flex;flex-direction:column;gap:3px;margin-top:5px;padding-left:12px}
html[data-fork-theme="dark"] #sidebar>.fork-about{color:var(--fork-muted)}
.fork-card-dialog{width:min(820px,92vw);max-height:88dvh;box-sizing:border-box;padding:18px;border:1px solid #b3c9b1;border-radius:16px;background:#fafbf7;color:#234b38;font:600 16px system-ui,sans-serif}
.fork-card-dialog[open]{display:flex;flex-direction:column;gap:12px}
.fork-card-dialog::backdrop{background:rgba(14,23,18,.72)}
.fork-card-dialog h2{margin:0;font-size:1.3rem}
.fork-card-scroll{flex:1;min-height:0;overflow:auto;background:#e9efe5;border-radius:8px;padding:6px;text-align:center}
.fork-card-scroll img{display:block;width:100%;height:auto}
.fork-card-actions{display:flex;gap:12px;justify-content:flex-end;flex-wrap:wrap}
.fork-card-actions :is(a,button){border-radius:8px;padding:9px 17px;font:inherit;cursor:pointer;text-decoration:none}
.fork-card-download{background:#366b45;border:1px solid #2c5938;color:white}
.fork-card-close{background:#edf2e9;color:#234b38;border:1px solid #b3c9b1}
html[data-fork-theme="dark"] .fork-card-dialog{background:var(--fork-panel);color:var(--fork-text);border-color:var(--fork-border)}
html[data-fork-theme="dark"] .fork-card-scroll{background:var(--fork-bg)}
html[data-fork-theme="dark"] .fork-card-close{background:var(--fork-control);color:var(--fork-text);border-color:var(--fork-outline)}
html[data-fork-theme="dark"] .fork-card-download{background:var(--fork-green);color:var(--fork-text);border-color:#527746}
@media (orientation:portrait){.horseAptitudes.fork-compact-aptitudes{gap:8px 8px;margin:0 12px}.fork-compact-aptitudes>output{font-size:.88em}.fork-race-context>img,.horseAptitudes>div.fork-legacy-mood>img{height:1.6em}}
'''

DARK_MODE_CSS = '''
#sidebar>.fork-dark-mode-row{margin-bottom:6px}
/* Dark surfaces, readable foregrounds and independent focus indicators. */
html[data-fork-theme="dark"]{color-scheme:dark;--fork-bg:#14191e;--fork-panel:#20282f;--fork-control:#29343d;--fork-raised:#35434d;--fork-border:#465660;--fork-outline:#82949e;--fork-text:#e9eef2;--fork-muted:#b5c2cc;--fork-accent:#b1dd85;--fork-green:#3d6529;--fork-green-low:#2f4b21;--uma1-color:#80bfff;--uma2-color:#ff9999;background:var(--fork-bg);color:var(--fork-text)}
html[data-fork-theme="dark"] body{background:var(--fork-bg);color:var(--fork-text)}
html[data-fork-theme="dark"] a{color:#9acbff}
html[data-fork-theme="dark"] :is(.horseDef,#nonUmaPanes,#umaOverlay){background:var(--fork-panel);border-color:var(--fork-border);color:var(--fork-text)}
html[data-fork-theme="dark"] :is(.horseSkillListWrapper,#resultsPaneWrapper){background:#192126}
html[data-fork-theme="dark"] :is(.horseParams,.horseFullAptitudes>div,.horseAptitudes>div,.addSkillButton,.horseAptitudeSelect>ul,.umaSuggestion,.umaScore,.trackSelect>select,.presetSelect>select,.splitBtn>div>ul,.savedHorseTableWrapper,.basinnChartWrapper,.basinnChartPopover){background:var(--fork-control);border-color:var(--fork-border);color:var(--fork-text)}
html[data-fork-theme="dark"] :is(#infoTables>table,#infoTables caption,#resultsSummary>tbody td){background:var(--fork-control);border-color:var(--fork-border);color:var(--fork-text)}
html[data-fork-theme="dark"] .horseAptitudes.fork-compact-aptitudes>.fork-aptitude{background:var(--fork-control);border-color:var(--fork-outline);color:var(--fork-text)}
html[data-fork-theme="dark"] :is(.horseSkillPickerWrapper,.skillListButtonsRow){background:var(--fork-panel);color:var(--fork-text)}
html[data-fork-theme="dark"] .horseAptitudes.fork-compact-aptitudes>:is(.fork-live-rank,.fork-race-context),html[data-fork-theme="dark"] .horseAptitudes:not(.fork-compact-aptitudes)>div:nth-child(3n),html[data-fork-theme="dark"] .horseFullAptitudes>div:nth-child(5n+1){background:transparent;border:0;color:var(--fork-text)}
html[data-fork-theme="dark"] :is(.umaEpithet>span,.umaSelectInput,.horseParam>input,.horseAptitudes>div:last-child>input,.ocrUpload,.groundSelect,.stacalcPane,.reqStamCalc>input,.savedHorseTable,.basinnChart){color:var(--fork-text)}
html[data-fork-theme="dark"] :is(#resultsHelp,#resultsSummary>tfoot th,#infoTables>table th,#swapUmas){color:var(--fork-text)}
html[data-fork-theme="dark"] .racetrackName{color:var(--fork-text);-webkit-text-stroke:0;text-shadow:none}
html[data-fork-theme="dark"] :is(.umaTab:not(.selected),.modeBtn:not(.modeBtnActive),.btnType2,.splitBtn.btnType2>div,.savedHorseTable th,.basinnChart th){background:linear-gradient(var(--fork-raised),var(--fork-control));color:var(--fork-text);border-color:var(--fork-border);outline-color:var(--fork-border)}
html[data-fork-theme="dark"] #copyUmaButtons>div{background:var(--fork-control);border-color:var(--fork-outline)}
html[data-fork-theme="dark"] :is(.horseDefHeader,.umaTab.selected,.modeBtn.modeBtnActive,.btnType1,.splitBtn.btnType1>div,.horseSkillHeader,.fork-compact-aptitudes>output,.horseParamHeader){background:linear-gradient(var(--fork-green),var(--fork-green-low));color:var(--fork-text);border-color:#527746;outline-color:#527746;box-shadow:none;text-shadow:none}
html[data-fork-theme="dark"] #expandBtn{background:var(--fork-green);border-color:#527746}
html[data-fork-theme="dark"] .selected>#expandBtn{background:var(--fork-control);border-color:var(--fork-outline)}
html[data-fork-theme="dark"] :is(.umaSuggestion:nth-child(2n),.presetSelect>legend){background:var(--fork-raised);color:var(--fork-text)}
html[data-fork-theme="dark"] :is(.umaSuggestion.selected,.umaSuggestion:hover,.horseAptitudeSelect li:hover){background:#265f93;color:#fff}
html[data-fork-theme="dark"] :is(.savedHorseTable>tbody>tr.selected,.basinnChart tr.selected){background:var(--fork-green);color:var(--fork-text)}
html[data-fork-theme="dark"] .presetSelect>legend:after{border-top-color:var(--fork-raised)}
/* Remove original light drop shadows, thick outlines and brown chevrons. */
html[data-fork-theme="dark"] :is(.skill,.stdBtn,.pillBtn,.circleBtn,.splitBtn:active){box-shadow:0 2px 3px #0c1015aa}
html[data-fork-theme="dark"] #modeBar{box-shadow:none;margin-bottom:0}
html[data-fork-theme="dark"] :is(.horseAptitudeSelect>span,.savedHorseTableSortedAsc span,.savedHorseTableSortedDesc span,.basinnChartSortedAsc span,.basinnChartSortedDesc span)::after{border-color:var(--fork-muted)}
html[data-fork-theme="dark"] :is(#copyUmaButtons>div,.selected>#expandBtn)::after{border-color:var(--fork-text)}
html[data-fork-theme="dark"] :is(.savedHorseTable .columnHeader,.basinnChart .columnHeader,.splitBtn>div>ul>li:empty){border-bottom-color:var(--fork-border)}
html[data-fork-theme="dark"] #infoTables tbody{border-bottom-color:var(--fork-border)}
html[data-fork-theme="dark"] #infoTables>.uma1>caption>div{background:#2b547b;color:var(--fork-text)}
html[data-fork-theme="dark"] #infoTables>.uma1>caption>div:after{border-color:#2b547b transparent transparent transparent}
html[data-fork-theme="dark"] #infoTables>.uma2>caption>div{background:#713a43;color:var(--fork-text)}
html[data-fork-theme="dark"] #infoTables>.uma2>caption>div:after{border-color:#713a43 transparent transparent transparent}
html[data-fork-theme="dark"] .horseParamHeader>span{text-shadow:none}
html[data-fork-theme="dark"] .horseParam{border-left-color:#526849}
html[data-fork-theme="dark"] .ocrUpload>:first-child{border-color:var(--fork-muted);border-image:none}
html[data-fork-theme="dark"] .basinnChartWrapper.dirty{border-color:#ce9b54}
/* Native form controls and focus-visible rings. */
html[data-fork-theme="dark"] :is(.filterSearch,.savedHorseTable input),html[data-fork-theme="dark"] #sidebar input[type=number]{background:var(--fork-control);color:var(--fork-text);border:1px solid var(--fork-outline);border-radius:4px}
html[data-fork-theme="dark"] input::placeholder{color:var(--fork-muted);opacity:1}
html[data-fork-theme="dark"] :is(.trackSelect>select,.presetSelect>select,.umaSuggestions,.horseAptitudeSelect>ul){border-color:var(--fork-outline)}
html[data-fork-theme="dark"] fieldset{border-color:var(--fork-border)}
html[data-fork-theme="dark"] :is(input,button,select,a,[tabindex]):focus-visible{outline:2px solid var(--fork-accent);outline-offset:2px}
html[data-fork-theme="dark"] input:is([type=checkbox],[type=radio]){accent-color:#82b94f}
html[data-fork-theme="dark"] .hintbtn.hintDown{background:var(--fork-raised);outline-color:var(--fork-outline)}
html[data-fork-theme="dark"] .hintbtn.hintDown:before,html[data-fork-theme="dark"] .hintDown .hintbtnDummyBackground{background:var(--fork-raised)}
html[data-fork-theme="dark"] .hintDown .hintbtnText{color:var(--fork-text)}
html[data-fork-theme="dark"] .hintbtn.hintUp,html[data-fork-theme="dark"] .hintbtn.hintUp:before,html[data-fork-theme="dark"] .hintUp .hintbtnDummyBackground{background:var(--fork-green);outline-color:#527746}
html[data-fork-theme="dark"] .hintLevel{color:#ffcc87}
html[data-fork-theme="dark"] .onoff:not(:checked){background:var(--fork-raised);border-color:var(--fork-outline)}
html[data-fork-theme="dark"] .onoff:checked{background:var(--fork-green);border-color:#527746}
html[data-fork-theme="dark"] .onoff:before,html[data-fork-theme="dark"] .onoff:checked:before{color:var(--fork-text);text-shadow:none}
html[data-fork-theme="dark"] .onoff:after{background:#83949d;border-color:var(--fork-border)}
html[data-fork-theme="dark"] :is(.skill-white,.skill-gold,.skill-pink,.skill-unique){color:var(--fork-text)}
html[data-fork-theme="dark"] .skill-white{background:linear-gradient(90deg,#35434d,#26323c) padding-box,linear-gradient(90deg,#52636e,#465660) border-box}
html[data-fork-theme="dark"] .skill-gold{background:linear-gradient(90deg,#6b5020,#483715) padding-box,linear-gradient(90deg,#a38a43,#80652b) border-box}
html[data-fork-theme="dark"] .skill-pink{background:linear-gradient(90deg,#67364f,#48273d) padding-box,linear-gradient(90deg,#a66a8d,#8a4e70) border-box}
html[data-fork-theme="dark"] .skill-unique{background:linear-gradient(90deg,#365d48,#374b69,#5b3c66) padding-box,linear-gradient(90deg,#648c7d,#7086ad,#9b71a3) border-box}
html[data-fork-theme="dark"] :is(.skillName,.skillLv>label,.skillLv>input,.skillDismiss,.skillDetails,.skillActivationEditor>select,.skillActivationParams>input[type=number]){color:var(--fork-text);-webkit-text-stroke:0;text-shadow:none}
html[data-fork-theme="dark"] .filterButton{background:var(--fork-raised);color:var(--fork-text);-webkit-text-stroke:0;box-shadow:none;border:1px solid var(--fork-border)}
html[data-fork-theme="dark"] .filterButton.active{background:var(--fork-green);color:var(--fork-text);border-color:#527746}
/* Charts retain meaningful hues but use muted dark fills and bright labels. */
html[data-fork-theme="dark"] #midPane svg text:not([fill]){fill:var(--fork-text)}
html[data-fork-theme="dark"] .racetrackView svg :is(.sectionText,.distanceMarker,.slopePer,.mouseoverText){fill:var(--fork-text);stroke:var(--fork-bg);stroke-width:2px;paint-order:stroke}
html[data-fork-theme="dark"] .hasResults .racetrackView>svg text:not(.mouseoverText){filter:none}
html[data-fork-theme="dark"] .racetrackView svg text[fill="rgb(107,145,173)"]{fill:var(--fork-muted)}
html[data-fork-theme="dark"] .racetrackView svg [stroke="rgb(121,64,22)"]{stroke:var(--fork-muted)}
html[data-fork-theme="dark"] #midPane svg :is([stroke="black"],[stroke="#000"],[stroke="currentColor"]){stroke:var(--fork-muted)}
html[data-fork-theme="dark"] #midPane svg :is([stroke*="42, 119, 197"],[stroke*="42,119,197"],[stroke="#2a77c5"]){stroke:var(--uma1-color)}
html[data-fork-theme="dark"] #midPane svg :is([stroke*="197, 42, 42"],[stroke*="197,42,42"],[stroke="#c52a2a"]){stroke:var(--uma2-color)}
html[data-fork-theme="dark"] #midPane svg :is([fill*="rgb(42, 119, 197)"],[fill*="rgb(42,119,197)"],[fill="#2a77c5"]){fill:var(--uma1-color)}
html[data-fork-theme="dark"] #midPane svg :is([fill*="rgb(197, 42, 42)"],[fill*="rgb(197,42,42)"],[fill="#c52a2a"]){fill:var(--uma2-color)}
html[data-fork-theme="dark"] #rtMouseOverBox>text{stroke:var(--fork-bg)}
@media(orientation:portrait){#sidebar>.fork-dark-mode-row{flex-basis:100%;margin-bottom:6px}#sidebar>#run{margin-top:20px}}
'''

# Presentation attributes are stable in upstream's RaceTrack component. Keep
# semantic band hues and only change their visual appearance in dark mode.
DARK_CHART_PALETTE = {
    '211,243,68': '#374c21', '140,170,10': '#66874a',
    '239,229,241': '#3f3548', '163,106,175': '#735b89',
    '234,207,147': '#514021', '229,196,120': '#594825',
    '82,195,184': '#214943', '116,206,198': '#294f49',
    '191,143,37': '#947844', '175,132,33': '#816a3a',
    '42,123,115': '#487f76', '50,142,134': '#548e85',
    '232,232,232': '#343e47', '139,139,139': '#687782',
    '209,235,255': '#253d54', '185,224,255': '#2f465e',
    '23,154,255': '#527fa8', '9,146,254': '#4c75a0',
    '255,216,185': '#58432c', '254,228,209': '#614a34',
    '254,117,9': '#a77946', '250,121,27': '#99683c',
    '0,154,111': '#245246', '0,92,66': '#478574',
    '242,233,103': '#514d25', '190,179,16': '#86804c',
    '209,134,175': '#56344b', '149,56,107': '#89516f',
    '199,109,159': '#633850', '133,51,96': '#975e80',
    '228,235,240': '#29343d', '107,145,173': '#788995',
}
DARK_MODE_CSS += ''.join(
    f'\nhtml[data-fork-theme="dark"] .racetrackView svg :is(rect,polygon)[fill="rgb({rgb})"]{{fill:{color}}}'
    for rgb, color in DARK_CHART_PALETTE.items()
)


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
    defaults = match_once(bundle, r'\{outfitId:"",starCount:3,[^{}]+?uniqueLv:1,mood:2,popularity:1\}')
    bundle = replace_once(bundle, defaults[0], defaults[0].replace('starCount:3', 'starCount:5').replace('uniqueLv:1,', 'uniqueLv:3,'))
    selection = match_once(bundle, r'(\w+)=Math\.max\(\1,\w+\.rarity\)')
    bundle = replace_once(bundle, selection[0], f'{selection[1]}=5')
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
    header = match_once(bundle, r'(\w+)\("div",\{class:"horseSkillHeader"\},(\w+)\.skillHeader\|\|\1\(\w+,\{id:"skillheader"\}\)\)')
    h = item[1]
    menu = (
        item[0] + f',{h}("li",null,{h}("button",{{onClick:()=>{POINTER}.importFile'
        f'(value=>{update}({deserialize}(value)))}},"Import JSON")),'
        f'{POINTER}.partnerEndpoint()?{h}("li",null,{h}("button",{{onClick:()=>{POINTER}.importPartner'
        f'(value=>{update}({deserialize}(value)),{header[2]}.course)}},"Import Partner ID")):null,'
        f'{h}("li",null,{h}("button",{{onClick:()=>{POINTER}.exportFile({serialize}({current}()))}},"Export JSON"))'
    )
    bundle = replace_once(bundle, item[0], menu)
    h = header[1]
    label = (
        f',{h}("output",{{class:"fork-sp",title:"Total base skill points including prerequisites"}},'
        f'{POINTER}.summary({current}().skills.values())))'
    )
    bundle = replace_once(bundle, header[0], header[0][:-1] + label)
    bundle = replace_once(bundle, '("/uma-tools/umalator-global",', '(' + BASE_PATH + ',')
    telemetry = match_once(bundle, r'\b(\w+)\(\);try\{window\.parent&&window\.parent\.location\.hostname')
    bundle = replace_once(bundle, telemetry[0], 'try{window.parent&&window.parent.location.hostname')
    hp = match_once(bundle, r'(\w+)\("div",null,\1\("label",\{for:"showhp"\},\1\(\w+,\{id:"ui\.sidebar\.showhp"\}\)\),\1\("input",\{type:"checkbox",id:"showhp",checked:\w+,onClick:\w+\}\)\)')
    h = hp[1]
    dark = (f'{h}("div",{{class:"fork-dark-mode-row"}},{h}("label",{{for:"fork-dark-mode"}},"Dark mode"),'
            f'{h}("input",{{type:"checkbox",id:"fork-dark-mode",defaultChecked:{POINTER}.darkMode(),onChange:e=>{POINTER}.setDarkMode(e.currentTarget.checked)}}))')
    bundle = replace_once(bundle, hp[0], hp[0] + ',' + dark)
    search = match_once(bundle, r'(\w+)\.outfits\[(\w+)\]\+" "\+\1\.name\[1\]')
    bundle = replace_once(bundle, search[0],
                          f'{search[1]}.outfits[{search[2]}].epithet+" "+{search[1]}.name[1]+" "+{search[2]}')
    return localize(bundle)


def localize(text):
    return (text.replace('/uma-tools/icons', ASSETS + 'icons')
            .replace('/uma-tools/fonts', ASSETS + 'fonts')
            .replace('/uma-tools/courseimages', ASSETS + 'courseimages')
            .replace('/uma-tools/vendor', ASSETS + 'vendor')
            .replace('../vendor/opencv.js', ASSETS + 'vendor/opencv.js'))


def integrate_about(bundle, sha):
    last = match_once(bundle, r'(\w+)\("div",\{id:"extendedOptionsRow"\},\1\("div",null,\1\("label",\{for:"stacalcForceMaxSpurt"\},"Force full spurt"\),\1\("input",\{type:"checkbox",id:"stacalcForceMaxSpurt",checked:\w+,onClick:\w+\}\)\)\)')
    h = last[1]
    about = (f'{h}("details",{{class:"fork-about"}},{h}("summary",null,"About / Source"),'
             f'{h}("div",{{class:"fork-about-links"}},{h}("span",null,"Alpha123 Global fork"),'
             f'{h}("a",{{href:"https://github.com/alpha123/uma-tools/tree/{sha}"}},"Upstream {sha[:7]}"),'
             f'{h}("a",{{href:"source-changes/"}},"Source changes"),'
             f'{h}("a",{{href:"LICENSE"}},"GPL-3.0")))')
    return replace_once(bundle, last[0], last[0] + ',' + about)


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
    surface, distance, mood_ui, strategy, style, _popularity_ui = apt.groups()
    controls = [item.replace(f'{h}("div",null,', f'{h}("div",{{class:"fork-aptitude fork-{area}"}},', 1)
                for item, area in zip((surface, distance, strategy, style), ('surface', 'distance', 'strategy', 'style'))]
    rank = f'{POINTER}.rankIndex(forkRating,{rank_thresholds})'
    rank_badge = (f'{h}("div",{{class:"fork-live-rank"}},{rank}===null?{h}("span",null,"-"):'
                  f'{h}("img",{{src:`{ASSETS}icons/rank/utx_txt_rank_${{{rank}}}.png`,alt:"Live rank",title:"Rank for "+{POINTER}.formatRating(forkRating)}}))')
    sp = f'{h}("output",{{class:"fork-sp-summary",title:"Total base skill points including prerequisites"}},"SP : "+{POINTER}.summary(forkBuild.skills.values()))'
    rating = f'{h}("output",{{class:"fork-rating-summary"}},"Rating : "+{POINTER}.formatRating(forkRating))'
    context = f'{h}("div",{{class:"fork-race-context"}},{mood_ui})'
    compact = f'{h}("div",{{class:"horseAptitudes fork-compact-aptitudes"}},'+','.join([*controls,rank_badge,sp,rating,context])+')'
    fallback_mood = f'{h}("div",{{class:"fork-legacy-mood"}},{mood_ui})'
    fallback = f'{h}("div",{{class:"horseAptitudes"}},'+','.join([surface,distance,fallback_mood,strategy,style])+')'
    bundle = replace_once(bundle, apt[0], f'case"simulation":return {props}.compareSummary?{compact}:{fallback};case"full":')
    bundle = replace_once(bundle, header[0],
        f'{h}("div",{{class:{props}.compareSummary?"horseSkillHeader fork-compact-skills-title":"horseSkillHeader"}},'
        f'{props}.compareSummary?"Skill count : "+forkBuild.skills.size:[{props}.skillHeader||("Skill count : "+forkBuild.skills.size),{old_sp[:-1]}+" SP")])')
    catalog = match_once(bundle, r'Object\.keys\((\w+)\)\.flatMap\((\w+)=>Object\.keys\(\1\[\2\]\.outfits\)\)')[1]
    export = match_once(bundle, rf'{re.escape(POINTER)}\.exportFile\((\w+)\((\w+)\(\)\)\)')
    serialize, current = export.groups()
    bundle = replace_once(bundle, export[0],
        f'{{const build={current}();{POINTER}.exportFile({serialize}(build),'
        f'{catalog}[build.outfitId.slice(0,4)]?.name[1],'
        f'{POINTER}.rating(build,{calculate},{course}));}}')
    camera = match_once(bundle, r'(\w+)\(\w+,null,\1\("button",\{class:"circleBtn btnType2",title:\1\(\w+,\{id:"ocrtip"\}\),onClick:(\w+)\.bind\(null,!0\)\},"\\u\{1F4F7\}\\uFE0E"\)\)')
    open_ocr = camera[2]
    export_card = (f'{h}("button",{{class:"circleBtn btnType2",title:"Export character image","aria-label":"Export character image",onClick:e=>{{'
                   f'const build={current}(),info={catalog}[build.outfitId.slice(0,4)],rating={POINTER}.rating(build,{calculate},{course});'
                   f'globalThis.UmaForkCard.exportCharacterCard(build,{{name:info?.name[1],epithet:info?.outfits[build.outfitId]?.epithet,'
                   f'defaultAptitudes:info?.outfits[build.outfitId]?.aptitudes,'
                   f'portrait:e.currentTarget.closest(".horseDef")?.querySelector(".umaSelectorIconsBox>div>img")?.src,'
                   f'rating,rank:{POINTER}.rankIndex(rating,{rank_thresholds}),course:{course}}});}}}},"\\u{{1F4F7}}\\uFE0E")')
    bundle = replace_once(bundle, camera[0], export_card)
    json_menu = match_once(bundle, rf'{h}\("li",null,{h}\("button",\{{onClick:\(\)=>\{{const build={current}\(\);[^}}]+\}}\}},"Export JSON"\)\)')
    bundle = replace_once(bundle, json_menu[0], json_menu[0] + f',{props}.showOcr!==!1&&{h}("li",null,{h}("button",{{onClick:{open_ocr}.bind(null,!0)}},"Read from screenshot (OCR)"))')
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
    camera = match_once(horse, r'<Localizer><button class="circleBtn btnType2" title=\{<Text id="ocrtip" />\} onClick=\{setOcrOpen\.bind\(null, true\)\}>[^<]+</button></Localizer>')[0]
    horse = replace_once(horse, camera, f'''<button class="circleBtn btnType2" title="Export character image" aria-label="Export character image" onClick={{e => {{
                                const current = uma_GetCurrent(), info = umas[current.outfitId.slice(0, 4)];
                                const rating = {POINTER}.rating(current, scoreUma, props.course);
                                globalThis.UmaForkCard.exportCharacterCard(current, {{
                                    name: info?.name[1], epithet: info?.outfits[current.outfitId]?.epithet,
                                    defaultAptitudes: info?.outfits[current.outfitId]?.aptitudes,
                                    portrait: e.currentTarget.closest(".horseDef")?.querySelector(".umaSelectorIconsBox>div>img")?.src,
                                    rating, rank: {POINTER}.rankIndex(rating, RankThresholds), course: props.course
                                }});
                            }}}}>??&#xFE0E;</button>''')
    ocr_menu = '<li><button onClick={clipbdPaste}>Paste from clipboard</button></li>'
    horse = replace_once(horse, ocr_menu, ocr_menu + '\n                                        {props.showOcr !== false && <li><button onClick={setOcrOpen.bind(null, true)}>Read from screenshot (OCR)</button></li>}')
    head = match_once(horse, r'<div class="horseSkillHeader">[\s\S]+?</output>\s*</div>')
    horse = replace_once(horse, head[0], f'''<div class={{props.compareSummary ? "horseSkillHeader fork-compact-skills-title" : "horseSkillHeader"}}>
                    {{props.compareSummary ? "Skill count : " + build.skills.size : props.skillHeader || ("Skill count : " + build.skills.size)}}
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
                        <div class="fork-live-rank">{{rank === null ? <span>-</span> : <img src={{`/uma-tools/icons/rank/utx_txt_rank_${{rank}}.png`}} alt="Live rank" title={{"Rank for " + {POINTER}.formatRating(rating)}} />}}</div>
                        <output class="fork-sp-summary" title="Total base skill points including prerequisites">SP : {{{POINTER}.summary(build.skills.values())}}</output>
                        <output class="fork-rating-summary">Rating : {{{POINTER}.formatRating(rating)}}</output>
                        <div class="fork-race-context"><MoodSelect m={{props.state.mood}} tabindex={{tabnext()}} /></div>
                    </div>
                );
            }}
			return (''')
    horse = replace_once(horse, '<div><MoodSelect m={props.state.mood} tabindex={tabnext()} /></div>',
                         '<div class="fork-legacy-mood"><MoodSelect m={props.state.mood} tabindex={tabnext()} /></div>')
    horse = replace_once(horse, '<div><PopularitySelect p={props.state.popularity} tabindex={tabnext()} /></div>', '')
    for slot in ('uma1', 'uma2', 'debufUma'):
        anchor = f'state={{O.{slot}}} aptitudesMode="simulation" course={{course}}'
        app = replace_once(app, anchor, anchor + ' compareSummary={true}')
    return horse, app


def readable_changes(read, destination, sha):
    horse = read('components/HorseDef.tsx').decode()
    horse = replace_once(horse, "u.outfits[id] + ' ' + u.name[1]",
                         "u.outfits[id].epithet + ' ' + u.name[1] + ' ' + id")
    horse = replace_once(horse, 'starCount = Math.max(starCount, u.rarity);', 'starCount = 5;')
    horse_types = read('components/HorseDefTypes.ts').decode()
    default_state = match_once(horse_types, r'export const DEFAULT_HORSE_STATE = \{[\s\S]+?\};')[0]
    horse_types = replace_once(horse_types, default_state, default_state.replace('starCount: 3,', 'starCount: 5,').replace('uniqueLv: 1,', 'uniqueLv: 3,'))
    horse = replace_once(horse, 'JSON.stringify(serializeUma(uma_GetCurrent()))',
                         f'{POINTER}.stringify(serializeUma(uma_GetCurrent()))')
    horse = replace_once(horse, 'navigator.clipboard.readText().then(JSON.parse)',
                         f'navigator.clipboard.readText().then({POINTER}.parse)')
    menu = '<li><button onClick={clipbdPaste}>Paste from clipboard</button></li>'
    horse = replace_once(horse, menu, menu + f'''
                                        <li><button onClick={{() => {POINTER}.importFile(value => setUma(deserializeUma(value)))}}>Import JSON</button></li>
                                        {{{POINTER}.partnerEndpoint() && <li><button onClick={{() => {POINTER}.importPartner(value => setUma(deserializeUma(value)), props.course)}}>Import Partner ID</button></li>}}
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
    hp = match_once(app, r'<div>\s*<label for="showhp">[\s\S]*?<input type="checkbox" id="showhp"[^>]+/>\s*</div>')
    app = replace_once(app, hp[0], hp[0] + f'''
                        <div class="fork-dark-mode-row">
                            <label for="fork-dark-mode">Dark mode</label>
                            <input type="checkbox" id="fork-dark-mode" defaultChecked={{{POINTER}.darkMode()}} onChange={{e => {POINTER}.setDarkMode(e.currentTarget.checked)}} />
                        </div>''')
    last = match_once(app, r'<input type="checkbox" id="stacalcForceMaxSpurt"[^>]+/>\s*</div>\s*</div>\s*\}')
    app = replace_once(app, last[0], last[0] + f'''
                        <details class="fork-about">
                            <summary>About / Source</summary>
                            <div class="fork-about-links">
                                <span>Alpha123 Global fork</span>
                                <a href="https://github.com/alpha123/uma-tools/tree/{sha}">Upstream {sha[:7]}</a>
                                <a href="source-changes/">Source changes</a>
                                <a href="LICENSE">GPL-3.0</a>
                            </div>
                        </details>''')
    for name, content in [('components/HorseDef.tsx', horse), ('components/HorseDefTypes.ts', horse_types), ('umalator/app.tsx', app)]:
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
    quote = None
    escaped = False
    for end in range(start, len(source)):
        char = source[end]
        if quote:
            if escaped:
                escaped = False
            elif char == '\\':
                escaped = True
            elif char == quote:
                quote = None
        elif char in '"`':
            quote = char
        elif char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0:
                literal = source[start:end + 1]
                # esbuild emits bare keys and JavaScript hex escapes in data literals.
                def normalize(match):
                    if match[1]:
                        return json.dumps(match[1]) + ':'
                    token = match[0]
                    if token.startswith('`'):
                        token = '"' + re.sub(r'\\. | " | [\r\n\t]', lambda char: {
                            r'\`': '`', r'\$': '$', '"': r'\"', '\r': r'\r', '\n': r'\n', '\t': r'\t',
                        }.get(char[0], char[0]), token[1:-1], flags=re.X) + '"'
                    return re.sub(r'\\(?:x([0-9a-fA-F]{2})|.)',
                                  lambda escape: r'\u00' + escape[1] if escape[1] else escape[0], token)

                decoded = json.loads(re.sub(r'"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`|(?<=[{,])([A-Za-z]\w*):',
                                            normalize, literal))
                return literal, decoded
    raise ValueError(f'Unterminated data object: {anchor}')


UMA_ANCHOR = '{"1001":{name:'
SKILL_NAMES_ANCHOR = '{"1000011":['


def unique_id(outfit_id, offset):
    return str(offset + 10000 * (int(outfit_id[-2:]) - 1) + 10 * int(outfit_id[1:-2]) + 1)


def add_upcoming_umas(read, bundle, unsupported):
    literal, roster = bundled_object(bundle, UMA_ANCHOR)
    if roster != json.loads(read('umalator-global/umas.json')):
        raise ValueError('Global UI roster differs from upstream JSON')
    _, icons = bundled_object(bundle, '{"1001":"chr_icon_1001"')
    jp_roster = json.loads(read('umas.json'))
    upcoming = {}
    excluded = {}
    required = set()
    related = set()
    for uma_id, uma in jp_roster.items():
        for outfit_id, outfit in uma['outfits'].items():
            if outfit_id in roster.get(uma_id, {}).get('outfits', {}):
                continue
            ids = [unique_id(outfit_id, 100000)]
            if outfit['rarity'] < 3:
                ids.append(unique_id(outfit_id, 10000))
            unavailable = [sid for sid in ids if sid in unsupported]
            if unavailable:
                excluded[outfit_id] = {'name': uma['name'][1], 'skills': unavailable}
                related.update(unavailable)
                continue
            if not icons.get(outfit_id) or not icons.get(uma_id):
                raise ValueError(f'Missing upstream character icon for {outfit_id}')
            character = roster.setdefault(uma_id, {'name': uma['name'], 'outfits': {}})
            character['outfits'][outfit_id] = {**outfit, 'epithet': f"{outfit['epithet']} � JP"}
            upcoming[outfit_id] = ids
            required.update(ids)
            related.update(outfit['awakenings'])
            related.add(unique_id(outfit_id, 900000))
    bundle = replace_once(bundle, literal, json.dumps(roster, ensure_ascii=True, separators=(',', ':')))
    return bundle, upcoming, excluded, required, related


def add_upcoming_data(read, bundle, worker, skills, meta):
    data_anchor = '{"100011":{alternatives:'
    meta_anchor = '{"100011":{baseCost:'
    jp_bundle = read('umalator/bundle.js').decode()
    jp_worker = read('umalator/simulator.worker.js').decode()
    _, jp_skills = bundled_object(jp_bundle, data_anchor)
    _, jp_worker_skills = bundled_object(jp_worker, data_anchor)
    if jp_skills != jp_worker_skills:
        raise ValueError('JP UI and engine skill data differ')
    # These conditions are absent from the current Global parser.
    unsupported_conditions = re.compile(
        r'\b(?:temptation_opponent_count_behind|random_lot_shared|is_used_skill_id_with_detail_one|is_goodstart)\b')
    unsupported = {sid for sid in set(jp_skills) - set(skills) if any(
        unsupported_conditions.search(alt['condition']) or unsupported_conditions.search(alt['precondition'])
        for alt in jp_skills[sid]['alternatives']
    )}
    bundle, outfits, excluded_outfits, required, related = add_upcoming_umas(read, bundle, unsupported)
    jp_meta = json.loads(read('skill_meta.json'))
    names_literal, names = bundled_object(bundle, SKILL_NAMES_ANCHOR)
    if names != json.loads(read('umalator-global/skillnames.json')):
        raise ValueError('Global UI skill names differ from upstream JSON')
    _, jp_names = bundled_object(jp_bundle, SKILL_NAMES_ANCHOR)
    eligible = (set(jp_skills) - set(skills)) & set(jp_meta)
    upcoming = sorted(eligible & (set(names) | required | related), key=int)
    for sid in upcoming:
        if not (names.get(sid) or [''])[0].strip():
            labels = jp_names.get(sid, [])
            names[sid] = [next((label for label in reversed(labels) if label.strip()), f'Skill {sid}')]
    excluded = {sid: names[sid][0] for sid in upcoming if sid in unsupported}
    upcoming = [sid for sid in upcoming if sid not in excluded]
    missing = required - (set(skills) | set(upcoming))
    if missing:
        raise ValueError(f'No Global simulation data for JP unique skills: {sorted(missing)}')
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
    bundle = replace_once(bundle, names_literal, json.dumps(names, ensure_ascii=True, separators=(',', ':')))
    catalog = {
        'upcomingUmas': outfits,
        'excludedUpcomingUmas': excluded_outfits,
        'upcomingSkills': {sid: names[sid][0] for sid in upcoming},
        'excludedUpcomingSkills': excluded,
        'skills': {
            sid: {**merged_meta[sid], 'rarity': skill['rarity'], 'name': (names.get(sid) or ['Skill ' + sid])[0]}
            for sid, skill in merged_skills.items()
        },
    }
    return bundle, worker, catalog


def prepare(read, sha, dest, files):
    if not re.fullmatch(r'[0-9a-f]{40}', sha):
        raise ValueError("Expected a full Alpha123 commit SHA")
    base = 'umalator-global/'
    meta = json.loads(read(base + 'skill_meta.json'))
    skills = json.loads(read(base + 'skill_data.json'))
    bundle = integrate_about(integrate_autosave(integrate_rating_bundle(integrate_bundle(read(base + 'bundle.js').decode()))), sha)
    worker = read(base + 'simulator.worker.js').decode()
    bundle, worker, data = add_upcoming_data(read, bundle, worker, skills, meta)
    catalog = {'revision': sha, **data}
    skills = data['skills']
    if not skills or not all(f'"{id}":' in worker for id in skills):
        raise ValueError("Upstream worker and skill data have different skill IDs")
    print(f"Added {len(data['upcomingUmas'])} JP outfits and {len(data['upcomingSkills'])} upcoming skills; "
          f"omitted {len(data['excludedUpcomingUmas'])} outfits and {len(data['excludedUpcomingSkills'])} skills "
          'with unsupported activation conditions')
    dest.mkdir(parents=True, exist_ok=True)
    worker_version = sha256(worker.encode('utf-8')).hexdigest()[:12]
    bundle = replace_once(bundle, 'new Worker("./simulator.worker.js")',
                          f'new Worker("./simulator.worker.js?v={worker_version}")')
    (dest / 'bundle.js').write_text(bundle, encoding='utf-8')
    bundle_version = sha256(bundle.encode('utf-8')).hexdigest()[:12]
    (dest / 'simulator.worker.js').write_text(worker, encoding='utf-8')
    css = (localize(read(base + 'bundle.css').decode()) +
           '\n.fork-sp{margin-inline-start:.65em;white-space:nowrap;font-weight:600}\n' + SUMMARY_CSS + DARK_MODE_CSS).encode('utf-8')
    (dest / 'bundle.css').write_bytes(css)
    css_version = sha256(css).hexdigest()[:12]
    catalog_js = 'globalThis.UmaForkData=' + json.dumps(catalog) + ';'
    (dest / 'skill-catalog.js').write_text(catalog_js, encoding='utf-8')
    catalog_version = sha256(catalog_js.encode('utf-8')).hexdigest()[:12]
    shutil.copyfile(files / 'overlay/build-io.js', dest / 'build-io.js')
    io_version = sha256((dest / 'build-io.js').read_bytes()).hexdigest()[:12]
    shutil.copyfile(files / 'overlay/build-card.js', dest / 'build-card.js')
    card_version = sha256((dest / 'build-card.js').read_bytes()).hexdigest()[:12]
    (dest / 'LICENSE').write_bytes(read('LICENSE'))
    readable_changes(read, dest / 'source-changes', sha)
    partner_url = environ.get('PARTNER_LOOKUP_URL', '').strip()
    for route in ROUTES:
        html = read(base + route).decode()
        if partner_url:
            html = replace_once(html, '</head>',
                                f'<meta name="partner-lookup-url" content="{escape(partner_url)}">\n</head>')
        html = replace_once(html, 'href="bundle.css"', f'href="bundle.css?v={css_version}"')
        html = replace_once(html, '<script src="bundle.js"></script>',
                            f'<script src="skill-catalog.js?v={catalog_version}"></script>\n'
                            f'\t\t<script src="build-io.js?v={io_version}"></script>\n'
                            f'\t\t<script src="build-card.js?v={card_version}"></script>\n'
                            f'\t\t<script src="bundle.js?v={bundle_version}"></script>')
        target = dest / route
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(html, encoding='utf-8')
    shutil.copyfile(files / 'scripts/prepare.py', dest / 'source-changes/prepare.py')
    note = (f'<!doctype html><meta charset="utf-8"><title>Fork source changes</title>'
            f'<h1>Alpha123 Global fork source</h1><p>Changes dated 2026-11-21. GPL-3.0-or-later.</p>'
            f'<ul><li><a href="https://github.com/alpha123/uma-tools/tree/{sha}">Alpha123 source at {sha[:7]}</a></li>'
            '<li><a href="components/HorseDef.tsx">Modified runner editor</a></li>'
            '<li><a href="components/HorseDefTypes.ts">Modified runner defaults</a></li>'
            '<li><a href="umalator/app.tsx">Modified app entry</a></li>'
            '<li><a href="../build-io.js">JSON compatibility and SP tracker</a></li>'
            '<li><a href="../build-card.js">Planned character PNG exporter</a></li>'
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
