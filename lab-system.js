// Shared visual presentation only. No API requests or data writes.
(() => {
  const sourceLabel=value=>{
    if(typeof value!=='string')return '';
    if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value.replaceAll('-','/');
    if(!/T.*(?:Z|[+-]\d\d:\d\d)$/.test(value)||!Number.isFinite(Date.parse(value)))return '';
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));
    const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}`;
  };
  const sections=[
    ['.home-intro','00','RESEARCH DESK'],['.home-directory','01','EXPLORE'],['#swipe','02','SAMPLE NOTES'],
    ['#home-module-trend','03','SNAPSHOT ARCHIVE'],['#custom','04','YOUR WORKSPACE'],['#feed','05','WATCHLIST'],
    ['#board','00','LEADERBOARD'],['#leaderboard-view .board-heading','01','SOLANA'],['#flash-board','02','INTRADAY'],['#base-board','03','BASE'],
    ['.wallet-hero .wallet-wrap','00','WALLET RESEARCH'],['#comparison.comparison-section','01','COMPARISON'],['#quiz .wallet-wrap','02','FIND YOUR WALLET'],
    ['.referral-hero','00','EXCHANGE RESEARCH'],['#referral-comparison','01','REFERRAL PROGRAMS'],['#referral-method','02','READ THE CONDITIONS'],
    ['.learn-hero','00','LEARNING DESK'],['.learn-path-section','01','READING PATHS'],['#catalog','02','LIBRARY'],
    ['.learn-reader-heading','00','FIELD GUIDE'],['.tokens-hero','00','TOKEN RESEARCH'],['#tokens-overview','01','TOKEN INDEX'],['#token-detail','02','WALLET ACTIVITY'],
    ['#wallet-compare','00','WALLET COMPARISON'],['#research-view','00','RESEARCH NOTES'],['#guide-view','00','METHODOLOGY'],['#home-tools','00','RESEARCH TOOLS'],['main.info-page','00','INFORMATION']
  ];
  function decorate(){
    for(const [selector,number,label] of sections)document.querySelectorAll(selector).forEach(el=>{
      if(!el.querySelector(':scope > .lab-section-label')){
        el.classList.add('lab-section');
        const heading=document.createElement('div');heading.className='lab-section-label';heading.setAttribute('aria-hidden','true');
        heading.innerHTML=`<span>${number}</span><i></i><small>${label}</small>`;
        const ghost=document.createElement('span');ghost.className='lab-ghost';ghost.textContent=number;ghost.setAttribute('aria-hidden','true');
        el.prepend(heading);el.append(ghost);
      }
    });
    document.querySelectorAll('.learn-article-section').forEach((el,i)=>{
      if(el.querySelector(':scope > .lab-section-label'))return;
      const no=String(i+1).padStart(2,'0');el.classList.add('lab-section');
      const mark=document.createElement('div');mark.className='lab-section-label';mark.setAttribute('aria-hidden','true');mark.innerHTML=`<span>${no}</span><i></i><small>CHAPTER</small>`;el.prepend(mark);
      const ghost=document.createElement('span');ghost.className='lab-ghost';ghost.setAttribute('aria-hidden','true');ghost.textContent=no;el.append(ghost);
    });
    for(const [selector,label] of [['tbody tr','查看'],['.button.primary,.directory-main,.referral-invite-button','開啟'],['.learn-card,.learn-path,a[href*="learn-"],a[href*="#lesson/"]','閱讀']])
      document.querySelectorAll(selector).forEach(el=>{if(!el.dataset.cursor)el.dataset.cursor=label;});
  }
  function setSource(detail){
    const el=document.getElementById('lab-source');if(!el)return;
    const dates=[...new Set((Array.isArray(detail?.value)?detail.value:[detail?.value]).map(sourceLabel).filter(Boolean))].sort();
    el.textContent=dates.length?`${detail.label||'資料更新'} ${dates[0]}${dates.length>1?'–'+dates.at(-1):''}`:'資料時間尚未載入';
    el.title=dates.length?'此為來源時間／基準日（台北），不是即時行情。':'待來源成功載入後顯示，不以目前時間代替。';
  }
  function start(){
    const bar=document.querySelector('.topbar-inner');if(!bar)return;
    const status=document.createElement('div');status.className='lab-status';status.innerHTML='<span class="lab-live" title="LIVE 指頁面時鐘；資料依標示快照更新。"><i aria-hidden="true"></i>LIVE <span class="sr-only">頁面時鐘，非即時行情</span></span><time id="lab-clock" aria-label="台北目前時間"></time><span id="lab-source">資料時間尚未載入</span>';
    bar.append(status);
    const tick=()=>{const now=new Date(),clock=document.getElementById('lab-clock');clock.dateTime=now.toISOString();clock.textContent='TPE '+now.toLocaleTimeString('en-GB',{timeZone:'Asia/Taipei',hourCycle:'h23'});};
    let timer;const runClock=()=>{clearInterval(timer);if(!document.hidden){tick();timer=setInterval(tick,1000);}};runClock();document.addEventListener('visibilitychange',runClock);
    document.addEventListener('research:source',event=>setSource(event.detail));
    document.addEventListener('leaderboard:loaded',event=>setSource({value:event.detail.updated_at,label:'榜單更新'}));
    if(window.ResearchShell?.source)setSource(window.ResearchShell.source);
    else if(typeof DATA!=='undefined'&&DATA)setSource({value:DATA.updated_at,label:'榜單更新'});
    else {
      const stamp=document.querySelector('.learn-reader-meta time[datetime],main.info-page time[datetime]');
      if(stamp)setSource({value:stamp.dateTime,label:'內容校閱'});
      else if(document.querySelector('main.info-page')){
        const source=document.getElementById('lab-source');source.textContent='本頁無動態資料';source.title='這是靜態說明頁，無行情更新時間。';
      }
    }
    decorate();
    // Only child changes in the content area; no observer on the second-by-second clock.
    let scheduled=false;const main=document.querySelector('main');
    new MutationObserver(records=>{if(records.every(r=>[...r.addedNodes,...r.removedNodes].every(n=>n.nodeType===3||n.classList?.contains('lab-section-label')||n.classList?.contains('lab-ghost'))))return;
      if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;decorate();});}
    }).observe(main||document.body,{childList:true,subtree:true});
    startCursor();
  }
  function startCursor(){
    const fine=matchMedia('(hover: hover) and (pointer: fine)'),touch=matchMedia('(any-pointer: coarse)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let dispose=()=>{};
    const refresh=()=>{
      dispose();if(!fine.matches||touch.matches||reduced.matches||navigator.maxTouchPoints>0)return;
      const ring=document.createElement('div');ring.id='lab-cursor';ring.setAttribute('aria-hidden','true');ring.hidden=true;
      const label=document.createElement('span');ring.append(label);document.body.append(ring);
      let x=0,y=0,tx=0,ty=0,frame=0;
      const stop=()=>{cancelAnimationFrame(frame);frame=0;ring.hidden=true;};
      const animate=()=>{x+=(tx-x)*.32;y+=(ty-y)*.32;ring.style.transform=`translate3d(${x}px,${y}px,0)`;
        frame=Math.abs(tx-x)+Math.abs(ty-y)>.2?requestAnimationFrame(animate):0;};
      const move=event=>{if(event.pointerType!=='mouse')return;tx=event.clientX;ty=event.clientY;
        if(ring.hidden){x=tx;y=ty;ring.hidden=false;}
        const target=event.target.closest('[data-cursor]');label.textContent=target?.dataset.cursor||'';ring.classList.toggle('is-active',!!target);
        if(!frame)frame=requestAnimationFrame(animate);};
      const keyboard=event=>{if(event.key==='Tab')stop();};
      document.addEventListener('pointermove',move,{passive:true});document.documentElement.addEventListener('pointerleave',stop);
      document.addEventListener('keydown',keyboard);window.addEventListener('blur',stop);document.addEventListener('visibilitychange',stop);
      dispose=()=>{stop();ring.remove();document.removeEventListener('pointermove',move);document.documentElement.removeEventListener('pointerleave',stop);document.removeEventListener('keydown',keyboard);window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',stop);};
    };
    for(const query of [fine,touch,reduced])query.addEventListener('change',refresh);refresh();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
