'use strict';

// One product shell for every workspace. Apply the theme before the first paint.
window.ResearchShell = (() => {
  const themeKey = 'trader-leaderboard-theme';
  let choice = null;
  try {const stored = localStorage.getItem(themeKey);if (['light','dark'].includes(stored)) choice = stored;} catch (_) {}
  const routes = [
    {key:'home',label:'首頁',icon:'home'},
    {key:'leaderboard',label:'排行榜',icon:'board'},
    {key:'tokens',label:'幣種交易',icon:'token'},
    {key:'compare',label:'交易員對比',compact:'交易對比',icon:'compare'},
    {key:'wallets',label:'Web3 錢包',compact:'Web3錢包',icon:'wallet'},
    {key:'referral',label:'返佣對照',icon:'referral'},
    {key:'learn',label:'學習中心',icon:'book'},
    {key:'research',label:'每週研究',icon:'note'},
    {key:'guide',label:'資料說明',icon:'book'},
    {key:'tools',label:'試算與詞典',icon:'book'}
  ];
  function applyTheme() {
    const theme = choice || 'light';
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#0d1522' : '#ffffff';
    const button = document.getElementById('theme-toggle');
    if (button) {
      button.setAttribute('aria-pressed',String(theme === 'dark'));
      button.title = theme === 'dark' ? '切換至明亮模式' : '切換至深色模式';
      document.getElementById('theme-icon').setAttribute('href',theme === 'dark' ? '#i-sun' : '#i-moon');
    }
  }
  applyTheme();
  window.addEventListener('storage',event => {
    if (event.key !== themeKey && event.key !== null) return;
    choice = ['light','dark'].includes(event.newValue) ? event.newValue : null;applyTheme();
  });
  const icons = `  <svg class="svg-defs" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <symbol id="i-external" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4 10 14M10 4H4v16h16v-6"/></symbol>
    <symbol id="i-reload" viewBox="0 0 24 24"><path d="M20 6v6h-6M4 18v-6h6M5.8 7a8 8 0 0 1 13.6 2M4.6 15A8 8 0 0 0 18.2 17"/></symbol>
    <symbol id="i-down" viewBox="0 0 24 24"><path d="M12 5v14m-5-5 5 5 5-5"/></symbol>
    <symbol id="i-copy" viewBox="0 0 24 24"><path d="M8 8h12v12H8zM16 8V4H4v12h4"/></symbol>
    <symbol id="i-close" viewBox="0 0 24 24"><path d="m6 6 12 12M6 18 18 6"/></symbol>
    <symbol id="i-left" viewBox="0 0 24 24"><path d="m14 6-6 6 6 6"/></symbol>
    <symbol id="i-right" viewBox="0 0 24 24"><path d="m10 6 6 6-6 6"/></symbol>
    <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.01"/></symbol>
    <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></symbol>
    <symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 15.3A8.6 8.6 0 0 1 8.7 4a8.7 8.7 0 1 0 11.3 11.3Z"/></symbol>
    <symbol id="i-search" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></symbol>
    <symbol id="i-home" viewBox="0 0 24 24"><path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/></symbol>
    <symbol id="i-board" viewBox="0 0 24 24"><path d="M4 19h16M6 15v-4m6 4V5m6 10V8"/></symbol>
    <symbol id="i-token" viewBox="0 0 24 24"><circle cx="9" cy="9" r="6"/><path d="M15 7a6 6 0 1 1-8 8M7 9h4M9 7v4M14 15h3"/></symbol>
    <symbol id="i-referral" viewBox="0 0 24 24"><path d="m6 18 12-12"/><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/></symbol>
    <symbol id="i-more" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></symbol>
    <symbol id="i-compare" viewBox="0 0 24 24"><rect x="3" y="4" width="7" height="16" rx="2"/><rect x="14" y="4" width="7" height="16" rx="2"/><path d="M6 8h1m10 8h1"/></symbol>
    <symbol id="i-note" viewBox="0 0 24 24"><path d="M14 4H5v16h14v-9M11 13l1-4 6-6 3 3-6 6-4 1Z"/></symbol>
    <symbol id="i-book" viewBox="0 0 24 24"><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1m0-15c3-2 6-2 9-1v15c-3-1-6-1-9 1V5"/></symbol>
    <symbol id="i-wallet" viewBox="0 0 24 24"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></symbol>
  </svg>`;
  const svgIcon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const groups = [
    {key:'data',label:'鏈上數據',description:'觀察錢包與幣種交易，追蹤與比較',icon:'board',items:['leaderboard','tokens','compare','research']},
    {key:'compare-tools',label:'工具比較',description:'挑選錢包，看清交易所條件',icon:'wallet',items:['wallets','referral']},
    {key:'learning',label:'學習資源',description:'從基礎開始，讀懂數字',icon:'book',items:['learn','tools','guide']}
  ];
  let localNavigation=false;
  const routeLink=(key,label)=>{
    const route=routes.find(item=>item.key===key),standalone=['wallets','referral','learn','tokens'].includes(key);
    const href=standalone?'./'+key+'.html':key==='home'?'./index.html':'./index.html?view='+key;
    return `<a href="${href}" data-navkey="${key}"${localNavigation&&!standalone?` data-route="${key}"`:''}>${svgIcon(route.icon)}<span>${label||route.label}</span>${key==='compare'&&localNavigation?'<span class="nav-count" data-compare-count hidden></span>':''}</a>`;
  };
  function navigation(active,localRoutes,mobile=false) {
    localNavigation=localRoutes;
    if(mobile)return routeLink('home')+groups.map(group=>routeLink(group.items[0],group.label)).join('');
    return routeLink('home')+groups.map(group=>`<details class="nav-category" data-category="${group.key}"><summary>${group.label}<span class="nav-chevron" aria-hidden="true">⌄</span></summary><div class="nav-category-menu"><p>${group.description}</p>${group.items.map(key=>routeLink(key)).join('')}${group.key==='data'?'<a href="./index.html#feed">我的關注</a>':''}</div></details>`).join('');
  }
  function setActive(active) {
    const group=groups.find(item=>item.items.includes(active));
    document.querySelectorAll('[data-navkey]').forEach(link=>{
      const isMobile=!!link.closest('#mobile-navigation');
      const selected=link.dataset.navkey===active||(isMobile&&group?.items[0]===link.dataset.navkey);
      if(selected)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-category]').forEach(item=>item.classList.toggle('is-active',item.dataset.category===group?.key));
    const secondary=document.getElementById('section-navigation');
    const keys=group?.items||[];
    secondary.hidden=!group;
    // Keep nodes stable during data renders so keyboard focus is not lost.
    if(secondary.dataset.group!==group?.key){secondary.dataset.group=group?.key||'';secondary.innerHTML=group?`<div class="shell section-nav-inner"><span class="section-nav-label">${group.label}</span>${keys.map(key=>routeLink(key)).join('')}${group.key==='data'?'<a href="./index.html#feed">我的關注</a>':''}</div>`:'';}
    secondary.querySelectorAll('[data-navkey]').forEach(link=>{if(link.dataset.navkey===active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    // Reveal the current destination in the horizontal phone navigation without moving the page.
    const strip=secondary.querySelector('.section-nav-inner'),current=strip?.querySelector('[aria-current="page"]');
    if(strip&&current){const frame=strip.getBoundingClientRect(),item=current.getBoundingClientRect();
      if(item.left<frame.left)strip.scrollLeft+=item.left-frame.left-12;
      else if(item.right>frame.right)strip.scrollLeft+=item.right-frame.right+12;}
  }
  function mount({active,localRoutes=false}) {
    const root = document.getElementById('product-shell');
    root.innerHTML = icons + `<header class="topbar"><div class="shell topbar-inner">
      <div class="brand-group"><a class="brand" href="./index.html"${localRoutes ? ' data-route="home"' : ''} aria-label="落袋研究室首頁"><span class="brand-mark" aria-hidden="true">落</span><span>落袋研究室<small>ONCHAIN RESEARCH</small></span></a></div>
      <nav class="header-navigation product-navigation" aria-label="主要功能" id="header-navigation">${navigation(active,localRoutes)}</nav>
      <nav aria-label="頁面與顯示設定" class="nav-links">${active === 'wallets' ? '<a class="return-home" href="./index.html">回主站</a>' : ''}<button type="button" class="button icon-button theme-toggle" id="theme-toggle" aria-label="深色模式" aria-pressed="false"><svg class="icon" aria-hidden="true"><use id="theme-icon" href="#i-moon"/></svg></button></nav>
      </div></header><nav id="section-navigation" class="section-navigation" aria-label="同類功能" hidden></nav>`;
    const mobile = document.getElementById('mobile-navigation');
    mobile.innerHTML = navigation(active,localRoutes,true);
    const menus=[...root.querySelectorAll('.nav-category')];
    menus.forEach(menu=>menu.addEventListener('toggle',()=>{if(menu.open)menus.filter(other=>other!==menu).forEach(other=>other.open=false);}));
    document.addEventListener('click',event=>menus.forEach(menu=>{if(!menu.contains(event.target)||event.target.closest('a'))menu.open=false;}));
    document.addEventListener('focusin',event=>menus.forEach(menu=>{if(menu.open&&!menu.contains(event.target))menu.open=false;}));
    document.addEventListener('keydown',event=>{if(event.key==='Escape')menus.forEach(menu=>{if(menu.open){menu.open=false;menu.querySelector('summary').focus();}});});
    setActive(active);
    document.getElementById('theme-toggle').addEventListener('click',() => {
      choice = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try {localStorage.setItem(themeKey,choice);} catch (_) {}
      applyTheme();
    });
    applyTheme();
  }
  return {mount,setActive};
})();
