// SPDX-License-Identifier: GPL-3.0-or-later
(() => {
  'use strict';
  const ASSETS = 'https://alpha123.github.io/uma-tools/icons/';
  const {skills} = globalThis.UmaForkData;
  const {summary, formatRating, filename} = globalThis.UmaFork;
  const STAT_NAMES = ['Speed', 'Stamina', 'Power', 'Guts', 'Wit'];
  const STAT_KEYS = ['speed', 'stamina', 'power', 'guts', 'wisdom'];
  const STAT_COLORS = ['#247d6e', '#bb5c4d', '#a77b28', '#6d6b9e', '#376eaa'];
  const STYLES = {Nige:'Front Runner', Senkou:'Pace Chaser', Sasi:'Late Surger', Oikomi:'End Closer', Oonige:'Runaway'};
  const MOODS = ['Awful', 'Bad', 'Normal', 'Good', 'Great'];
  const RARITIES = {
    1: {label:'NORMAL', bg:'#ebf0f2', edge:'#7897a5'},
    2: {label:'RARE', bg:'#fcf1ce', edge:'#c59b43'},
    3: {label:'UNIQUE', bg:'#e9f0de', edge:'#8ba968'},
    4: {label:'UNIQUE', bg:'#e9f0de', edge:'#8ba968'},
    5: {label:'UNIQUE', bg:'#e9f0de', edge:'#8ba968'},
    6: {label:'EVOLVED', bg:'#f9e3ee', edge:'#c37b9d'},
  };
  const WIDTH = 1200, PAD = 40, CARD_W = 554, ROW_HEIGHT = 92;

  function createCardData(build, options = {}) {
    const ids = Array.isArray(build.skills) ? build.skills.map(String) : [...build.skills.values()].map(String);
    const aptitudes = [...(build.aptitudes ?? ['S','S','S','S','A','A','A','A','A','A'])];
    const style = build.strategy === 'Oonige' ? 'Nige' : build.strategy;
    const styleIndex = ['Nige','Senkou','Sasi','Oikomi'].indexOf(style);
    const course = options.course;
    const distanceIndex = course?.distanceType - 1;
    const surfaceIndex = course?.surface - 1;
    if (distanceIndex >= 0 && distanceIndex < 4) aptitudes[distanceIndex] = build.distanceAptitude;
    if (surfaceIndex >= 0 && surfaceIndex < 2) aptitudes[8 + surfaceIndex] = build.surfaceAptitude;
    if (styleIndex >= 0) aptitudes[4 + styleIndex] = build.strategyAptitude;
    const group = (label, names, start, selected) => ({
      label, entries: names.map((name, i) => ({name, grade: aptitudes[start+i] ?? '—', selected: i === selected}))
    });
    const listed = ids.map(id => {
      const skill = skills[id] ?? {};
      const rarity = RARITIES[skill.rarity] ?? RARITIES[1];
      return {id, name:skill.name || 'Skill ' + id, ...rarity, order:skill.order ?? 0,
        icon:skill.iconId ? ASSETS + 'skill/utx_ico_skill_' + skill.iconId + '.png' : null};
    }).sort((a,b) => a.order-b.order || Number(a.id)-Number(b.id));
    const stars = Math.max(1, Math.min(5, Math.trunc(Number(build.starCount) || 5)));
    return {
      name:options.name || 'Unassigned Umamusume', epithet:options.epithet || 'Custom planned build',
      portrait:build.outfitId ? options.portrait : null, stars, uniqueLv:build.uniqueLv ?? 1,
      rating:options.rating, rank:options.rank == null ? null : ASSETS + 'rank/utx_txt_rank_' + options.rank + '.png',
      stats:STAT_KEYS.map((key,i) => ({name:STAT_NAMES[i], value:build[key], color:STAT_COLORS[i]})),
      groups:[group('Surface',['Turf','Dirt'],8,surfaceIndex),group('Distance',['Sprint','Mile','Medium','Long'],0,distanceIndex),group('Running style',['Front','Pace','Late','End'],4,styleIndex)],
      style:STYLES[build.strategy] || build.strategy || 'Unassigned', mood:MOODS[Number(build.mood)+2] || 'Normal',
      course:course ? (course.surface === 2 ? 'Dirt' : 'Turf') + ' · ' + (course.distance ?? '—') + ' m' : 'No course selected',
      sp:summary(ids), skills:listed, filename:filename(options.name, options.rating).replace(/\.json$/, '.png'),
    };
  }

  function cardHeight(data) {
    return 758 + Math.max(1, Math.ceil(data.skills.length/2))*ROW_HEIGHT + 80;
  }

  function rounded(ctx, x, y, width, height, radius, color, stroke) {
    ctx.beginPath();
    ctx.roundRect(x,y,width,height,radius);
    ctx.fillStyle=color; ctx.fill();
    if (stroke) {ctx.lineWidth=2;ctx.strokeStyle=stroke;ctx.stroke();}
  }

  function write(ctx, value, x, y, size = 26, color='#21352a', weight=600, maxWidth) {
    ctx.fillStyle=color; ctx.textBaseline='middle'; ctx.font=weight+' '+size+'px system-ui, sans-serif';
    const text = String(value ?? '—');
    if (maxWidth) {
      while (ctx.measureText(text).width > maxWidth && size > 14) {
        size -= 1; ctx.font=weight+' '+size+'px system-ui, sans-serif';
      }
    }
    if (maxWidth) ctx.fillText(text,x,y,maxWidth); else ctx.fillText(text,x,y);
  }

  function center(ctx, value, x, y, size, color, weight, maxWidth) {
    ctx.textAlign='center'; write(ctx,value,x,y,size,color,weight,maxWidth); ctx.textAlign='left';
  }

  function wrapName(ctx, value, x, y, maxWidth) {
    const text=String(value);
    let size=24;
    while (size > 16) {
      ctx.font='600 '+size+'px system-ui, sans-serif';
      if (ctx.measureText(text).width <= maxWidth*1.9) break;
      --size;
    }
    const lines=[];
    let line='';
    for (const char of text) {
      if (line && ctx.measureText(line+char).width > maxWidth) {
        lines.push(line.trim()); line=char;
      } else line+=char;
    }
    if (line) lines.push(line.trim());
    // The font is reduced before wrapping so normal long skill names fit in two lines.
    const lineHeight = Math.min(27, 50/Math.max(1,lines.length));
    const fontSize = Math.min(size,lineHeight-2);
    for (let i=0;i<lines.length;i++) write(ctx,lines[i],x,y+(i-(lines.length-1)/2)*lineHeight,fontSize,'#26372f',600,maxWidth);
  }

  function drawImageFit(ctx, img, x, y, w, h) {
    if (!img) return false;
    const ratio = Math.min(w/img.naturalWidth, h/img.naturalHeight);
    const iw=img.naturalWidth*ratio, ih=img.naturalHeight*ratio;
    ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
    return true;
  }

  function renderCard(canvas, data, images = new Map()) {
    const logicalHeight=cardHeight(data), scale=Math.min(1, 16000/logicalHeight);
    canvas.width=Math.round(WIDTH*scale); canvas.height=Math.round(logicalHeight*scale);
    const c=canvas.getContext('2d'); if (!c) throw new Error('Canvas unavailable.');
    c.scale(scale,scale);
    c.fillStyle='#edf2e9'; c.fillRect(0,0,WIDTH,logicalHeight);
    rounded(c,20,20,1160,logicalHeight-40,36,'#fafbf7','#b3c9b1');
    // Original export design: a clean race-club card rather than a copy of an in-game screen.
    rounded(c,PAD,PAD,1120,220,22,'#234b38');
    c.fillStyle='#dbe8c6'; c.fillRect(PAD+19,PAD+16,6,188);
    rounded(c,PAD+32,68,154,164,24,'#f1f5e8');
    if (!drawImageFit(c,images.get(data.portrait),PAD+42,78,134,144)) {
      center(c,'UMA',PAD+109,148,39,'#69856e',800);
    }
    write(c,'PLANNED BUILD  /  UMALATOR GLOBAL',PAD+211,79,20,'#d1e5cd',700,680);
    write(c,data.epithet,PAD+211,118,27,'#c4d9c8',600,655);
    write(c,data.name,PAD+211,163,45,'#ffffff',800,650);
    write(c,'★'.repeat(data.stars)+'☆'.repeat(5-data.stars),PAD+211,211,34,'#f2d186',700,370);
    write(c,'Unique Lv. '+data.uniqueLv,PAD+428,213,23,'#e2ebdf',600,300);
    rounded(c,910,66,230,168,18,'#f6f8ef');
    const drawn=drawImageFit(c,images.get(data.rank),928,73,194,99);
    if (!drawn) center(c,'RATING',1025,120,25,'#658270',700);
    center(c,formatRating(data.rating),1025,199,38,'#204633',800,190);

    write(c,'PERFORMANCE',PAD,289,22,'#597765',800);
    const statWidth=214.4;
    data.stats.forEach((stat,i)=>{
      const x=PAD+i*(statWidth+12);
      rounded(c,x,313,statWidth,102,14,'#ffffff','#d9e5d8');
      c.fillStyle=stat.color; c.fillRect(x+12,326,5,76);
      write(c,stat.name,x+29,341,22,stat.color,700,statWidth-38);
      write(c,Number.isFinite(stat.value)?stat.value.toLocaleString('en-US'):stat.value,x+29,384,42,'#192b25',800,statWidth-40);
    });
    write(c,'APTITUDES',PAD,449,22,'#597765',800);
    data.groups.forEach((group,i)=>{
      const y=472+i*57;
      write(c,group.label,PAD+12,y+24,22,'#355242',700,165);
      const cellW=220;
      group.entries.forEach((entry,j)=>{
        const x=PAD+190+j*(cellW+12);
        rounded(c,x,y,cellW,48,10,entry.selected?'#e1ecd5':'#f0f4ec',entry.selected?'#78a15e':'#dbe5d9');
        write(c,entry.name,x+13,y+24,20,'#395548',600,cellW-60);
        rounded(c,x+cellW-46,y+6,36,36,9,'#365e43');
        center(c,entry.grade,x+cellW-28,y+24,25,'#fff',800);
      });
    });
    rounded(c,PAD,646,1120,52,12,'#e5eee1');
    write(c,data.style+'  •  '+data.course+'  •  Mood: '+data.mood,PAD+18,672,24,'#285039',700,1080);
    write(c,'SKILL COUNT : '+data.skills.length,PAD,730,25,'#234b38',800);
    c.textAlign='right'; write(c,'TOTAL SP  '+data.sp,1160,730,25,'#234b38',800); c.textAlign='left';
    if (!data.skills.length) {
      rounded(c,PAD,758,1120,74,13,'#edf2ea','#dbe5d9');
      center(c,'No skills selected',600,795,25,'#687c70',600);
    }
    for (let i=0;i<data.skills.length;i++) {
      const skill=data.skills[i], x=PAD+(i%2)*(CARD_W+12), y=758+Math.floor(i/2)*ROW_HEIGHT;
      rounded(c,x,y,CARD_W,79,12,skill.bg,skill.edge);
      c.fillStyle=skill.edge;c.fillRect(x+7,y+9,5,61);
      if (!drawImageFit(c,images.get(skill.icon),x+18,y+12,54,54)) center(c,'◆',x+45,y+39,28,skill.edge,800);
      // A wrapped second line keeps unusually long skill names readable.
      c.font='700 23px system-ui, sans-serif';
      if (c.measureText(skill.name).width > CARD_W-105) {
        wrapName(c,skill.name,x+87,y+31,CARD_W-105);
      } else write(c,skill.name,x+87,y+30,23,'#26372f',700,CARD_W-105);
      write(c,skill.id.startsWith('9')?'INHERITED':skill.label,x+87,y+63,15,'#52675a',800);
    }
    center(c,'PLANNING PREVIEW  •  NOT AN IN-GAME SCREENSHOT  •  UMALATOR GLOBAL',600,logicalHeight-40,18,'#587060',700,1120);
    return canvas;
  }

  async function loadImage(url) {
    if (!url) return null;
    return new Promise(resolve=>{
      const img=new Image(); let done=false;
      const settle=value=>{if(!done){done=true;clearTimeout(timer);resolve(value);}};
      const timer=setTimeout(()=>settle(null),5000);
      img.crossOrigin='anonymous'; img.onload=()=>settle(img); img.onerror=()=>settle(null); img.src=url;
    });
  }

  async function exportCharacterCard(build, options) {
    let dialog, objectUrl;
    try {
      const data=createCardData(build,options);
      dialog=document.createElement('dialog'); dialog.className='fork-card-dialog';
      const heading=document.createElement('h2'); heading.textContent='Export planned character'; heading.id='fork-card-title';
      dialog.setAttribute('aria-labelledby',heading.id);
      const close=document.createElement('button'); close.type='button'; close.textContent='Close'; close.className='fork-card-close';
      const actions=document.createElement('div'); actions.className='fork-card-actions';
      const status=document.createElement('p');status.textContent='Generating PNG…';status.setAttribute('role','status');
      const view=document.createElement('div');view.className='fork-card-scroll';view.append(status);
      actions.append(close);dialog.append(heading,view,actions);document.body.append(dialog);
      close.addEventListener('click',()=>dialog.close());
      dialog.addEventListener('close',()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);dialog.remove();},{once:true});
      dialog.showModal();
      const urls=[...new Set([data.portrait,data.rank,...data.skills.map(s=>s.icon)].filter(Boolean))];
      const loaded=await Promise.all(urls.map(async url=>[url,await loadImage(url)]));
      if (!dialog.open) return;
      const canvas=renderCard(document.createElement('canvas'),data,new Map(loaded));
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(v=>v?resolve(v):reject(new Error('PNG could not be generated.')),'image/png'));
      if (!dialog.open) return;
      objectUrl=URL.createObjectURL(blob);
      const preview=document.createElement('img');preview.src=objectUrl;preview.alt='Planned character card';
      view.replaceChildren(preview);
      const download=document.createElement('a');download.href=objectUrl;download.download=data.filename;
      download.textContent='Download PNG';download.className='fork-card-download';actions.prepend(download);
    } catch(error) {
      if (dialog?.open) {
        const status=dialog.querySelector('[role=status]');
        if(status) status.textContent='Could not export the character: '+error.message;
      } else {
        window.alert('Could not export the character: '+error.message);
      }
    }
  }

  globalThis.UmaForkCard=Object.freeze({createCardData,cardHeight,renderCard,exportCharacterCard});
})();
