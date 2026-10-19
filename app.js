'use strict';

// Read-only presentation of the existing snapshot. Never call the paid API here.
let DATA = null;
let TAB = 'today';
let SORT = 'realized';
let PAGE = 1;
let loading = false;
let refreshFailed = false;
let sortedCache = new Map();
let walletOpener = null;
let QUERY = '';
let LAYOUT = 'auto';
const PER = 10;
const PERIODS = { today: '單日', week: '近七日' };
const SORT_NAMES = { realized: '已實現收益', pnl: '總損益', volume: '交易量' };
const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const metric = (wallet, key) => typeof wallet[key] === 'number' && Number.isFinite(wallet[key]) ? wallet[key] : null;
const exactMoney = new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:6 });
const integer = new Intl.NumberFormat('en-US');
const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits:1 });
const precisePercent = new Intl.NumberFormat('en-US', { maximumFractionDigits:6 });
const fmt = n => globalThis.ResearchMoney.format(n);
const moneyHTML = n => esc(fmt(n)).replaceAll(',',',<wbr>');
const short = address => address.slice(0,6) + '…' + address.slice(-4);
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const tone = n => n === null ? 'unknown' : n === 0 ? 'zero' : n < 0 ? 'negative' : 'positive';
const paper = w => metric(w,'realized') !== null && metric(w,'pnl') !== null && Math.abs(w.realized) < 1 && w.pnl > 100000;
function ratio(w) {
  const pnl = metric(w,'pnl'), realized = metric(w,'realized');
  if (pnl === null || realized === null || pnl <= 0) return null;
  const value = realized / pnl * 100;
  return Number.isFinite(value) ? value : null;
}

function ratioLabel(value) {
  if (value === null) return '—';
  const atBoundary = (value !== 0 && Math.abs(value) < 0.05) || (value > 100 && value < 100.05);
  const formatted = (atBoundary ? precisePercent : percent).format(value);
  if (value !== 0 && Number(formatted.replaceAll(',','')) === 0) return value.toExponential(1)+'%';
  if (value > 100 && formatted === '100') return '>100%';
  return formatted+'%';
}

function ratioNote(w) {
  const value = ratio(w);
  if (metric(w,'pnl') === null || metric(w,'realized') === null) return '缺少損益欄位';
  if (w.pnl <= 0) return '總損益不為正，不適用';
  if (value === null) return '超出可顯示範圍';
  if (value > 100) return '已實現 > 總損益';
  if (value < 0) return '已實現為虧損';
  return '';
}

function ratioMarkup(w) {
  const value = ratio(w), note = ratioNote(w);
  return `<span class="ratio-value ${tone(value)}">${esc(ratioLabel(value))}</span>${note ? `<span class="ratio-note">${esc(note)}</span>` : ''}`;
}

function walletActions(w,period = TAB) {
  return `<span class="wallet-actions"><span class="wallet-avatar" aria-hidden="true">${esc(w.address.slice(0,2))}</span><button type="button" class="address-button" data-wallet="${esc(w.address)}" data-wallet-period="${esc(period)}" aria-haspopup="dialog" aria-label="查看交易幣種、持倉或複製錢包地址 ${esc(w.address)}">${esc(short(w.address))}${icon('copy')}</button><a class="explorer-link" href="https://solscan.io/account/${encodeURIComponent(w.address)}" target="_blank" rel="noopener noreferrer" aria-label="在 Solscan 查看錢包 ${esc(w.address)}">${icon('external')}</a></span>`;
}

// Preserve the existing descending order, secondary key, and address tie-break.
// Missing fields sort last; this does not recover zeros already created upstream.
function sorted(key = SORT, tab = TAB) {
  const cacheKey = tab+':'+key;
  if (!sortedCache.has(cacheKey)) {
    const secondary = key === 'realized' ? 'pnl' : 'realized';
    const compare = (a,b,field) => {
      const x = metric(a,field), y = metric(b,field);
      if (x === null) return y === null ? 0 : 1;
      if (y === null) return -1;
      return y-x;
    };
    sortedCache.set(cacheKey,[...DATA[tab]].sort((a,b) => compare(a,b,key) || compare(a,b,secondary) || a.address.localeCompare(b.address)));
  }
  return sortedCache.get(cacheKey);
}

function observationStats() {
  const sample = sorted('pnl').filter(w => metric(w,'pnl') !== null).slice(0,10);
  return {
    sample,
    nearZero: sample.filter(w => metric(w,'realized') !== null && Math.abs(w.realized) < 1).length,
    unknown: sample.filter(w => metric(w,'realized') === null).length
  };
}

// Headline statistics always describe the entire selected-period sample.
// Missing realized values are explicitly excluded, never silently made zero.
function sampleStats(wallets) {
  const known = wallets.map(w => metric(w,'realized')).filter(value => value !== null);
  return {total:wallets.length, realized:known.length ? known.reduce((sum,value) => sum+value,0) : null, positive:known.filter(value => value > 0).length, missing:wallets.length-known.length};
}

function renderSampleCount() {
  const stats = sampleStats(DATA[TAB]);
  $('positive-count').textContent = integer.format(stats.positive);
}

function renderComparison() {
  $('observation-period').textContent = PERIODS[TAB];
  const {sample, nearZero, unknown} = observationStats();
  if (!sample.length) {
    $('observation').textContent = '本期尚無可比較的總損益資料。';
    $('comparison-wallet').innerHTML = '<p class="overline">同一錢包・總損益榜首</p><p class="secondary">沒有可顯示的錢包。</p>';
  } else {
    $('observation').innerHTML = `<span class="observation-number"><strong>${nearZero}</strong><span> / ${sample.length}</span></span><span class="observation-copy">總損益前 ${sample.length} 名中<br>已實現收益絕對值低於 $1${unknown ? `<small>另有 ${unknown} 筆已實現收益未提供</small>` : ''}</span>`;
    const top = sample[0];
    const pnl = metric(top,'pnl'), realized = metric(top,'realized'), r = ratio(top);
    $('comparison-wallet').innerHTML = `<div class="comparison-top"><p class="overline">同一錢包・總損益榜首</p>${walletActions(top)}</div><dl class="comparison-values"><div><dt>總損益</dt><dd class="${tone(pnl)}">${moneyHTML(pnl)}</dd></div><div><dt>已實現收益</dt><dd class="${tone(realized)}">${moneyHTML(realized)}</dd></div></dl><div class="comparison-ratio"><span>落袋比例${ratioNote(top) ? ' · '+esc(ratioNote(top)) : ''}</span><strong class="${tone(r)}">${esc(ratioLabel(r))}</strong></div>`;
  }
  const original = DATA.insight?.[TAB];
  $('source-insight').textContent = typeof original === 'string' && original.trim() ? original : '上游未提供本期解讀。';
}

function profitCell(w,key) {
  const value = metric(w,key);
  return `<td data-column="${key}" class="metric ${SORT === key ? 'current' : ''} ${key === 'volume' ? '' : tone(value)}" title="${value === null ? '快照未提供此數值' : '快照原始值 '+exactMoney.format(value)}">${esc(fmt(value))}</td>`;
}

function tableColumns(sort = SORT) {
  if (sort === 'volume') return ['rank','wallet','volume','trades','realized','pnl','ratio'];
  if (sort === 'pnl') return ['rank','wallet','pnl','realized','ratio','trades','volume'];
  return ['rank','wallet','realized','pnl','ratio','trades','volume'];
}

function renderTableLayout() {
  const focus = document.activeElement;
  for (const id of ['rank-columns','rank-head']) {
    const parent = $(id);
    for (const key of tableColumns()) parent.append(parent.querySelector(`[data-column="${key}"]`));
  }
  if (focus?.closest('#rank-head')) focus.focus({preventScroll:true});
}

function renderDisplayMode() {
  const active = LAYOUT === 'auto' ? (matchMedia('(max-width:700px)').matches ? 'cards' : 'table') : LAYOUT;
  $('results').dataset.layout = LAYOUT;
  document.querySelectorAll('button[data-layout]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.layout===active)));
}

function renderRows(all) {
  const base = (PAGE-1)*PER;
  const visible = all.slice(base,base+PER);
  const currentRanks = new Map(sorted().map((w,index) => [w.address,index+1]));
  const alternate = SORT === 'realized' ? 'pnl' : 'realized';
  const otherRanks = new Map(sorted(alternate).map((w,index) => [w.address,index+1]));
  const otherRank = w => `<span class="other-rank">${SORT_NAMES[alternate]}排名 <b>#${otherRanks.get(w.address)}</b></span>`;
  $('rows').innerHTML = visible.map((w,index) => {
    const rank = currentRanks.get(w.address);
    const cells = {
      rank:`<td data-column="rank" class="rank"><span class="rank-badge">${rank}</span></td>`,
      wallet:`<td data-column="wallet" class="wallet"><div class="wallet-row">${walletActions(w)}${selectionButton(w)}</div><div class="wallet-meta">${otherRank(w)}${paper(w) ? '<span class="paper">紙上富貴</span>' : ''}</div></td>`,
      realized:profitCell(w,'realized'),pnl:profitCell(w,'pnl'),volume:profitCell(w,'volume'),
      ratio:`<td data-column="ratio">${ratioMarkup(w)}</td>`,
      trades:`<td data-column="trades">${metric(w,'trades') === null ? '—' : integer.format(w.trades)}</td>`
    };
    return `<tr data-address="${esc(w.address)}" class="${rank <= 3 ? 'podium' : ''}">${tableColumns().map(key=>cells[key]).join('')}</tr>`;
  }).join('');
  $('cards').innerHTML = visible.map((w,index) => {
    const rank = currentRanks.get(w.address), primary = SORT, secondary = SORT === 'realized' ? 'pnl' : 'realized', extra = SORT === 'volume' ? 'pnl' : 'volume';
    return `<article class="card" data-address="${esc(w.address)}" aria-label="本批排名 ${rank}，錢包 ${esc(short(w.address))}"><div class="card-head"><div class="card-wallet"><span class="card-rank">${rank}</span>${walletActions(w)}</div></div><div class="card-profit-pair"><dl class="card-primary"><dt>${SORT_NAMES[primary]}${SORT === primary ? ' · 目前排序' : ''}</dt><dd class="metric ${SORT === primary ? 'current' : ''} ${primary === 'volume' ? '' : tone(metric(w,primary))}">${moneyHTML(metric(w,primary))}</dd></dl><dl class="card-secondary"><div><dt>${SORT_NAMES[secondary]}${SORT === secondary ? ' · 目前排序' : ''}</dt><dd class="metric ${SORT === secondary ? 'current' : ''} ${tone(metric(w,secondary))}">${moneyHTML(metric(w,secondary))}</dd></div></dl></div><div class="card-bottom"><div><span>落袋比例</span><div>${ratioMarkup(w)}</div></div><dl><dt>交易次數</dt><dd>${metric(w,'trades') === null ? '—' : integer.format(w.trades)}</dd></dl><dl><dt>${SORT_NAMES[extra]}</dt><dd>${moneyHTML(metric(w,extra))}</dd></dl></div><div class="card-other-rank">${otherRank(w)}${paper(w) ? '<span class="paper">紙上富貴</span>' : ''}</div></article>`;
  }).join('');
}

function renderPagination(total) {
  const pages = Math.max(1,Math.ceil(total/PER));
  const base = (PAGE-1)*PER;
  $('page-summary').innerHTML = `顯示 <strong>${total ? base+1 : 0}–${Math.min(base+PER,total)}</strong> / <strong>${total}</strong> 個錢包`;
  // Do not replace the select itself; preserve keyboard focus and open control state.
  if ($('page-select').options.length !== pages) {
    $('page-select').innerHTML = Array.from({length:pages},(_,index) => `<option value="${index+1}">${index+1}</option>`).join('');
  }
  $('page-select').value = String(PAGE);
  $('page-total').textContent = `/ ${pages} 頁`;
  $('prev-page').disabled = PAGE === 1;
  $('next-page').disabled = PAGE === pages;
}

function render(_animate = false, {syncURL = true} = {}) {
  if (!DATA) return;
  const sampleTotal = DATA[TAB].length;
  const filtered = sorted().filter(w => w.address.toLowerCase().includes(QUERY) && passesLab(w));
  const total = filtered.length;
  PAGE = Math.max(1,Math.min(PAGE,Math.max(1,Math.ceil(total/PER))));
  document.querySelectorAll('[data-period]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.period === TAB)));
  document.querySelectorAll('.sort-control [data-sort]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.sort === SORT)));
  const volumeView = SORT === 'volume';
  $('profit-sort-control').hidden = false;
  $('board-title').textContent = volumeView ? (TAB === 'week' ? '7 天交易量榜' : '單日交易量榜') : '錢包排行榜';
  $('rank-view-note').textContent = volumeView ? `${TAB === 'week' ? '本批樣本 7 天交易量排序' : '本批樣本內按交易量排序'}，非全鏈排名。點地址看交易幣種；每日摘要收錄近七日樣本交易量前十名。交易量不代表獲利。` : '已實現收益榜 · 預設看落袋損益，也可切換總損益排序。';
  for (const key of ['realized','pnl','volume']) {
    const th = $('th-'+key);
    if (SORT === key) th.setAttribute('aria-sort','descending');
    else th.removeAttribute('aria-sort');
  }
  $('result-summary').textContent = `${PERIODS[TAB]} · 本批 ${integer.format(sampleTotal)} 個錢包${QUERY || labEnabled() ? ' · 符合 '+integer.format(total)+' 個（保留原排名）' : ''}`;
  $('sort-context').textContent = SORT_NAMES[SORT]+'由高到低';
  $('table-caption').textContent = `${PERIODS[TAB]}本批錢包，依${SORT_NAMES[SORT]}由高到低排序`;
  renderSampleCount();
  renderComparison();
  renderTableLayout();
  renderDisplayMode();
  renderRows(filtered);
  renderPagination(total);
  // Mobile selection is next to the secondary rank, away from address copying.
  for (const card of $('cards').querySelectorAll('.card')) {
    const wallet = DATA[TAB].find(w => w.address === card.dataset.address);
    card.querySelector('.card-other-rank').insertAdjacentHTML('beforeend',selectionButton(wallet));
  }
  renderResearch();
  $('results').hidden = total === 0;
  $('state').hidden = total !== 0;
  if (!total) $('state').innerHTML = sampleTotal ? `<h3>沒有符合${labEnabled() ? '條件' : '地址'}的錢包</h3><p>篩選僅限本批資料；可放寬條件或清除搜尋。</p>${QUERY ? '<button class="button" type="button" data-clear-search>清除搜尋</button>' : ''}${labEnabled() ? '<button class="button" type="button" data-reset-lab>重設條件</button>' : ''}` : '<h3>本期尚無錢包資料</h3><p>可切換統計期間，或稍後重新讀取。</p>';
  $('comparison').setAttribute('aria-busy','false');
  renderProduct();
  if (syncURL) syncWorkspaceURL();
  announce(`${PERIODS[TAB]}，依${SORT_NAMES[SORT]}由高到低排序，第 ${PAGE} 頁，${QUERY || labEnabled() ? '篩選符合 ' : '共 '}${total} 個錢包。${refreshFailed ? '更新失敗，仍顯示上一份成功快照。' : ''}`);
  // Sorting and pagination are frequent actions: keep rows fully readable immediately.
  // Retain the first argument for existing research/home callers.
}

function announce(text) { $('announcement').textContent = text; }

function setQuery(value) {
  QUERY = value.trim().toLowerCase();
  PAGE = 1;
  render();
}

function setTab(tab) {
  if (!DATA || !Object.hasOwn(PERIODS,tab) || TAB === tab) return;
  TAB = tab; PAGE = 1; syncComparePeriod(); render(true);
}

function setSort(key) {
  if (!DATA || !Object.hasOwn(SORT_NAMES,key) || SORT === key) return;
  SORT = key; PAGE = 1; render(true);
  document.querySelector('#results .table-wrap').scrollTo({left:0,top:0,behavior:'instant'});
}

function setPage(page) {
  if (!DATA || !Number.isInteger(page)) return;
  const focus = document.activeElement;
  const scroll = window.scrollY;
  PAGE = page; render(true);
  if (matchMedia('(max-width:700px)').matches) {
    const heading=$('board-title');
    heading.tabIndex=-1;
    heading.focus({preventScroll:true});
    heading.scrollIntoView({block:'start',behavior:'instant'});
    return;
  }
  if (focus?.disabled && ['prev-page','next-page'].includes(focus.id)) $('page-select').focus({preventScroll:true});
  window.scrollTo({top:scroll,behavior:'instant'});
}

function validate(data) {
  if (!data || data.source !== 'Birdeye' || data.chain !== 'solana' || typeof data.updated_at !== 'string' || !Number.isFinite(Date.parse(data.updated_at)) || !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(data.updated_at) || Date.parse(data.updated_at)>Date.now()+60000) throw new Error('Invalid snapshot metadata');
  for (const tab of Object.keys(PERIODS)) {
    if (!Array.isArray(data[tab])) throw new Error('Missing period');
    const seen = new Set();
    for (const w of data[tab]) {
      if (!w || typeof w.address !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(w.address) || seen.has(w.address)) throw new Error('Invalid wallet address');
      seen.add(w.address);
      for (const field of ['pnl','realized','unrealized','volume','trades']) {
        if (w[field] != null && (typeof w[field] !== 'number' || !Number.isFinite(w[field]))) throw new Error('Invalid numeric metric');
      }
      if (metric(w,'trades') !== null && (!Number.isInteger(w.trades) || w.trades < 0)) throw new Error('Invalid trade count');
      if (metric(w,'volume') !== null && w.volume < 0) throw new Error('Invalid volume');
    }
  }
  return data;
}

function showLoadFailure() {
  if (DATA) {
    $('notice').hidden = false;
    $('notice').innerHTML = '<div><p>重新讀取失敗，保留上一份成功快照。</p><p>請留意上方快照時間，再稍後重試。</p></div><button type="button" class="button" data-retry>重新讀取</button>';
  } else {
    $('state').hidden = false;
    $('state').innerHTML = '<h3>暫時無法讀取資料</h3><p>請檢查連線，或稍後重試。尚未載入的資料不會先顯示成零。</p><button class="button" type="button" data-retry>重新讀取</button>';
    $('observation').textContent = '等待資料載入後顯示本期觀察。';
    $('comparison-wallet').innerHTML = '<p class="overline">同一錢包・總損益榜首</p><p class="secondary">目前無法取得比較數值。</p>';
    $('result-summary').textContent = '資料讀取失敗';
    $('updated').textContent = '尚未取得快照時間';
    $('home-latest-time').textContent = '尚未取得來源時間';
  }
  announce(DATA ? '重新讀取失敗，仍顯示上一份成功快照。' : '資料讀取失敗，可按重新讀取重試。');
}

function updateSnapshotTime() {
  if(!DATA)return;
  const status=SnapshotTime.state(DATA.updated_at);
  $('home-latest-time').textContent=status.asOf;$('home-latest-time').dateTime=DATA.updated_at;
  for(const id of ['snapshot-wait','home-snapshot-wait']) {$(id).hidden=!status.pending;$(id).textContent=status.message;}
}

async function loadData() {
  if (loading) return;
  loading = true;
  $('refresh').disabled = true;
  $('refresh-label').textContent = '讀取中…';
  for(const id of ['home-read-result','snapshot-read-result'])$(id).hidden=true;
  document.querySelectorAll('[data-retry]').forEach(button => button.disabled = true);
  $('comparison').setAttribute('aria-busy','true');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(),15000);
  try {
    const response = await fetch('data.json?t='+Date.now(),{signal:controller.signal,cache:'no-store'});
    if (!response.ok) throw new Error('HTTP '+response.status);
    const next = validate(await response.json());
    if(DATA && Date.parse(next.updated_at)<Date.parse(DATA.updated_at))throw new Error('Snapshot regressed');
    const previousTime=DATA?.updated_at;
    DATA = next;
    document.dispatchEvent(new CustomEvent('leaderboard:loaded',{detail:DATA}));
    sortedCache = new Map();
    restoreResearchShare();
    syncComparePeriod();
    refreshFailed = false;
    $('notice').hidden = true;
    updateSnapshotTime();
    for(const id of ['home-read-result','snapshot-read-result']) {$(id).hidden=!previousTime;$(id).textContent=previousTime?(previousTime===DATA.updated_at?'已重新讀取：最新公開檔仍截至 ':'已讀取新的公開快照，截至 ')+SnapshotTime.format(DATA.updated_at)+'（台北）。':'';}
    $('updated').dateTime = DATA.updated_at;
    $('updated').textContent = new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(DATA.updated_at))+'（台北）';
    for (const tab of Object.keys(PERIODS)) $('count-'+tab).textContent = DATA[tab].length;
    render(false,{syncURL:false});
  } catch (error) {
    refreshFailed = true;
    showLoadFailure();
  } finally {
    clearTimeout(timeout);
    loading = false;
    $('refresh').disabled = false;
    $('refresh-label').textContent = '重新讀取';
    document.querySelectorAll('[data-retry]').forEach(button => button.disabled = false);
    $('comparison').setAttribute('aria-busy','false');
    renderProduct();
    document.dispatchEvent(new CustomEvent('leaderboard:status',{detail:{failed:refreshFailed}}));
  }
}

function openWallet(address,opener,period = TAB) {
  if (!DATA || !Object.hasOwn(PERIODS,period) || !DATA[period].some(w => w.address === address)) return;
  walletOpener = opener;
  $('full-address').value = address;
  $('dialog-solscan').href = 'https://solscan.io/account/'+encodeURIComponent(address);
  $('copy-status').textContent = '';
  $('copy-status').className = 'copy-status';
  $('wallet-dialog').showModal();
  document.dispatchEvent(new CustomEvent('wallet:opened',{detail:{address,view:SORT === 'volume' ? 'trades' : 'holdings'}}));
}

async function copyAddress() {
  const button = $('copy-address');
  button.disabled = true;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText($('full-address').value);
    $('copy-status').textContent = '已複製完整錢包地址。';
    $('copy-status').className = 'copy-status success';
  } catch (error) {
    $('full-address').focus();
    $('full-address').select();
    $('copy-status').textContent = '無法自動複製，已選取地址，請使用系統的複製功能。';
    $('copy-status').className = 'copy-status';
  } finally { button.disabled = false; }
}

document.querySelectorAll('[data-period]').forEach(button => button.addEventListener('click',() => setTab(button.dataset.period)));
document.querySelectorAll('[data-sort]').forEach(button => button.addEventListener('click',() => setSort(button.dataset.sort)));
document.querySelectorAll('button[data-layout]').forEach(button=>button.addEventListener('click',()=>{LAYOUT=button.dataset.layout;renderDisplayMode();syncWorkspaceURL();}));
matchMedia('(max-width:700px)').addEventListener('change',renderDisplayMode);
renderDisplayMode();
document.querySelectorAll('[data-method]').forEach(button => button.addEventListener('click',() => $('method-dialog').showModal()));
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click',() => $(button.dataset.close).close()));
document.addEventListener('click',event => {
  const opener = event.target.closest('[data-wallet]');
  if (opener) openWallet(opener.dataset.wallet,opener,opener.dataset.walletPeriod || TAB);
  if (event.target.closest('[data-retry]')) loadData();
  if (event.target.closest('[data-clear-search]')) {
    $('wallet-search').value = '';
    setQuery('');
    $('wallet-search').focus({preventScroll:true});
  }
});
$('wallet-dialog').addEventListener('close',() => {
  if (walletOpener?.isConnected) walletOpener.focus({preventScroll:true});
  else $('sort-realized').focus({preventScroll:true});
});
$('prev-page').addEventListener('click',() => setPage(PAGE-1));
$('next-page').addEventListener('click',() => setPage(PAGE+1));
$('page-select').addEventListener('change',event => setPage(Number(event.target.value)));
$('refresh').addEventListener('click',loadData);
$('copy-address').addEventListener('click',copyAddress);
$('wallet-search').addEventListener('input',event => setQuery(event.target.value));
initResearch();
initProduct();
loadData();

document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateSnapshotTime();});
setInterval(updateSnapshotTime,60000);
