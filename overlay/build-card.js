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
    1: {label:'NORMAL', bg:'#e9ecf5', edge:'#9ea9c6'},
    2: {label:'RARE', bg:'#ffe6a0', edge:'#d7972b'},
    3: {label:'UNIQUE', bg:'#d8f0e7', edge:'#73b5a0'},
    4: {label:'UNIQUE', bg:'#d8f0e7', edge:'#73b5a0'},
    5: {label:'UNIQUE', bg:'#d8f0e7', edge:'#73b5a0'},
    6: {label:'EVOLVED', bg:'#f3d9ed', edge:'#be7aa8'},
  };
  const WIDTH = 1200, PAD = 40, CARD_W = 554, ROW_HEIGHT = 94, SKILLS_TOP = 738;
  // Same stat grade scale and icons already used by the planner's stat inputs.
  function statRank(value) {
    const n=Number(value);
    if(!Number.isFinite(n) || n<0) return null;
    return n>2000?Math.min(98+Math.floor((n-2001)/125)*25+Math.floor((n-1)%125/5),297):
      n>1200?Math.min(18+Math.floor((n-1200)/100)*10+Math.floor(n/10)%10,97):
      n>=1150?17:n>=1100?16:n>=400?8+Math.floor((n-400)/100):Math.floor(n/50);
  }
  const statIcon = n => n===null?null:ASSETS+'statusrank/utx_ico_statusrank_'+String(n).padStart(2,'0')+'.png';
  const aptitudeIcon = grade => /^[SABCDEFG]$/.test(grade ?? '')?
    ASSETS+'utx_ico_statusrank_'+String(7-'SABCDEFG'.indexOf(grade)).padStart(2,'0')+'.png':null;

  function createCardData(build, options = {}) {
    const ids = Array.isArray(build.skills) ? build.skills.map(String) : [...build.skills.values()].map(String);
    const course = options.course;
    const style=STYLES[build.strategy] || build.strategy || 'Unassigned';
    const aptitudes = [...(build.aptitudes ?? Array(10).fill('-'))];
    const distanceIndex=course?.distanceType-1, surfaceIndex=course?.surface-1;
    const styleIndex=['Nige','Senkou','Sasi','Oikomi'].indexOf(build.strategy==='Oonige'?'Nige':build.strategy);
    if(distanceIndex>=0 && distanceIndex<4) aptitudes[distanceIndex]=build.distanceAptitude;
    if(surfaceIndex>=0 && surfaceIndex<2) aptitudes[8+surfaceIndex]=build.surfaceAptitude;
    if(styleIndex>=0) aptitudes[4+styleIndex]=build.strategyAptitude;
    const group=(label,names,start,active)=>({label,entries:names.map((name,i)=>{
      const grade=aptitudes[start+i] ?? '-'; return {name,grade,icon:aptitudeIcon(grade),selected:i===active};
    })});
    const listed = ids.map(id => {
      const skill = skills[id] ?? {};
      const rarity = RARITIES[skill.rarity] ?? RARITIES[1];
      const isInherited=id.startsWith('9');
      const isUnique=!isInherited && [3,4,5].includes(skill.rarity);
      return {id, name:skill.name || 'Skill ' + id, ...(isInherited?RARITIES[1]:rarity), order:skill.order ?? 0,
        level:isUnique?build.uniqueLv ?? 1:null,
        icon:skill.iconId ? ASSETS + 'skill/utx_ico_skill_' + skill.iconId + '.png' : null};
    }).sort((a,b) => a.order-b.order || Number(a.id)-Number(b.id));
    const stars = Math.max(1, Math.min(5, Math.trunc(Number(build.starCount) || 5)));
    return {
      name:options.name || 'Unassigned Umamusume', epithet:options.epithet || 'Custom planned build',
      portrait:build.outfitId ? options.portrait : null, stars, uniqueLv:build.uniqueLv ?? 1,
      rating:options.rating, rank:options.rank == null ? null : ASSETS + 'rank/utx_txt_rank_' + options.rank + '.png',
      stats:STAT_KEYS.map((key,i) => ({name:STAT_NAMES[i], value:build[key], color:STAT_COLORS[i],icon:statIcon(statRank(build[key]))})),
      groups:[group('Track',['Turf','Dirt'],8,surfaceIndex),
        group('Distance',['Sprint','Mile','Medium','Long'],0,distanceIndex),
        group('Style',['Front','Pace','Late','End'],4,styleIndex)],
      style, mood:MOODS[Number(build.mood)+2] || 'Normal',
      course:course ? (course.surface === 2 ? 'Dirt' : 'Turf') + ' · ' + (course.distance ?? '—') + ' m' : 'No course selected',
      sp:summary(ids), skills:listed, filename:filename(options.name, options.rating).replace(/\.json$/, '.png'),
    };
  }

  function cardHeight(data) {
    return SKILLS_TOP + Math.max(1, Math.ceil(data.skills.length/2))*ROW_HEIGHT + 76;
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
    // Original race-club character card, using only planner-supported values.
    rounded(c,PAD,PAD,1120,72,18,'#378342');
    center(c,'Planned Umamusume Details',600,76,36,'#ffffff',800,1040);
    rounded(c,PAD,124,1120,205,18,'#234b38');
    rounded(c,PAD+14,135,205,182,20,'#f1f5e8');
    if (!drawImageFit(c,images.get(data.portrait),PAD+24,140,185,172)) {
      center(c,'UMA',PAD+116,227,39,'#69856e',800);
    }
    write(c,data.epithet,PAD+243,167,28,'#d2e7d2',600,595);
    write(c,data.name,PAD+243,217,48,'#ffffff',800,595);
    write(c,'\u2605'.repeat(data.stars)+'\u2606'.repeat(5-data.stars),PAD+243,272,36,'#f2d186',700,250);
    write(c,'Mood: '+data.mood,PAD+505,273,23,'#e2ebdf',600,260);
    rounded(c,910,135,230,182,18,'#f6f8ef');
    const drawn=drawImageFit(c,images.get(data.rank),928,142,194,108);
    if (!drawn) center(c,'RATING',1025,193,25,'#658270',700);
    center(c,formatRating(data.rating),1025,284,38,'#204633',800,190);

    const statWidth=224;
    rounded(c,PAD,345,1120,116,15,'#ffffff','#c8dcc8');
    data.stats.forEach((stat,i)=>{
      const x=PAD+i*statWidth;
      rounded(c,x+3,349,statWidth-6,35,10,stat.color);
      center(c,stat.name,x+statWidth/2,366,23,'#ffffff',700,statWidth-18);
      const hasIcon=drawImageFit(c,images.get(stat.icon),x+10,389,70,66);
      const value=Number.isFinite(stat.value)?stat.value.toLocaleString('en-US'):stat.value;
      if(hasIcon) write(c,value,x+85,422,38,'#192b25',800,statWidth-95);
      else center(c,value,x+statWidth/2,422,40,'#192b25',800,statWidth-30);
      if(i>0){c.fillStyle='#c8dcc8';c.fillRect(x,390,1,60);}
    });
    data.groups.forEach((group,i)=>{
      const y=477+i*64;
      write(c,group.label,PAD+12,y+27,28,'#355242',800,160);
      group.entries.forEach((entry,j)=>{
        const x=PAD+184+j*234, w=222;
        rounded(c,x,y,w,54,10,entry.selected?'#e1ecd5':'#f0f4ec',entry.selected?'#78a15e':'#dbe5d9');
        write(c,entry.name,x+14,y+27,25,'#395548',700,w-67);
        if(!drawImageFit(c,images.get(entry.icon),x+w-54,y+6,46,42))
          center(c,entry.grade,x+w-31,y+27,30,'#365e43',800);
      });
    });
    rounded(c,PAD,671,1120,55,12,'#e1ebdc');
    write(c,'SKILL COUNT : '+data.skills.length,PAD+16,698,26,'#234b38',800);
    c.textAlign='right'; write(c,'TOTAL SP  '+data.sp,1144,698,25,'#234b38',800); c.textAlign='left';
    if (!data.skills.length) {
      rounded(c,PAD,SKILLS_TOP,1120,80,13,'#edf2ea','#dbe5d9');
      center(c,'No skills selected',600,SKILLS_TOP+40,25,'#687c70',600);
    }
    for (let i=0;i<data.skills.length;i++) {
      const skill=data.skills[i], x=PAD+(i%2)*(CARD_W+12), y=SKILLS_TOP+Math.floor(i/2)*ROW_HEIGHT;
      rounded(c,x,y+4,CARD_W,82,12,'#c8d0c6');
      rounded(c,x,y,CARD_W,82,12,skill.bg,skill.edge);
      if (!drawImageFit(c,images.get(skill.icon),x+12,y+11,60,60)) center(c,'?',x+42,y+41,28,skill.edge,800);
      const nameWidth=CARD_W-(skill.level!=null?184:100);
      c.font='700 26px system-ui, sans-serif';
      if (c.measureText(skill.name).width > nameWidth) {
        wrapName(c,skill.name,x+87,y+41,nameWidth);
      } else write(c,skill.name,x+87,y+41,26,'#26372f',700,nameWidth);
      if(skill.level!=null){
        rounded(c,x+CARD_W-87,y+19,73,44,9,'#ffffff');
        center(c,'Lv. '+skill.level,x+CARD_W-50.5,y+41,22,'#234b38',800,65);
      }
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
      const urls=[...new Set([data.portrait,data.rank,...data.stats.map(s=>s.icon),...data.groups.flatMap(g=>g.entries.map(a=>a.icon)),...data.skills.map(s=>s.icon)].filter(Boolean))];
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
