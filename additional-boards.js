// Independent, read-only boards. Never alter app.js DATA, periods, filters or rendering.
import './money-format.js?v=1';
const BOARDS = {
  flash: {file:'today-flash.json',field:'today',chain:'solana',title:'盤中快榜',label:'03 — 盤中觀察',
    badge:'SOLANA',cadence:'盤中更新',schedule:'每日 02:00／14:00／20:00（台北）',
    description:'以這份盤中快照的單日樣本，觀察已實現收益。',pending:'盤中快榜尚未發布',
    explorer:'https://solscan.io/account/',explorerName:'Solscan'},
  base: {file:'data.json',field:'base_today',chain:'base',title:'Base 每日榜',label:'04 — 跨鏈觀察',
    badge:'BASE',cadence:'每日更新',schedule:'每日 08:00（台北）',
    description:'換一條鏈，沿用同樣的觀察方式。',pending:'Base 榜單尚未發布',
    explorer:'https://basescan.org/address/',explorerName:'Basescan'}
};
const FIELDS = ['pnl','realized','unrealized','volume','trades'];
const NAMES = {realized:'已實現收益',pnl:'總損益'};
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const value = (row,key) => Number.isFinite(row[key]) && typeof row[key] === 'number' ? row[key] : null;
const integer = new Intl.NumberFormat('en-US');
const amount = n => globalThis.ResearchMoney.format(n);
const tone = n => n === null ? 'unknown' : n < 0 ? 'negative' : n > 0 ? 'positive' : 'zero';

export function readBoardSnapshot(data,kind) {
  const config = BOARDS[kind];
  if (!config || !data || data.source !== 'Birdeye' || data.chain !== 'solana' ||
      typeof data.updated_at !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(data.updated_at) ||
      !Number.isFinite(Date.parse(data.updated_at)) || Date.parse(data.updated_at)>Date.now()+60000) throw new Error('Invalid snapshot metadata');
  if (kind === 'base' && !Object.hasOwn(data,'base_today')) return {status:'pending',rows:[],updatedAt:null};
  const rows = data[config.field];
  if (!Array.isArray(rows) || rows.length > 20) throw new Error('Invalid board rows');
  const addresses = new Set();
  const pattern = kind === 'base' ? /^0x[0-9a-fA-F]{40}$/ : /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  for (const row of rows) {
    if (!row || typeof row.address !== 'string' || !pattern.test(row.address)) throw new Error('Invalid address');
    const address = kind === 'base' ? row.address.toLowerCase() : row.address;
    if (addresses.has(address)) throw new Error('Duplicate address');
    addresses.add(address);
    for (const key of FIELDS) if (row[key] != null && value(row,key) === null) throw new Error('Invalid metric');
    if (value(row,'trades') !== null && (!Number.isSafeInteger(row.trades) || row.trades < 0)) throw new Error('Invalid trades');
    if (value(row,'volume') !== null && row.volume < 0) throw new Error('Invalid volume');
  }
  return {status:rows.length ? 'ready' : 'empty',rows,updatedAt:data.updated_at,
    sampleNotice:kind === 'base' && rows.length > 0 && rows.length < 20
      ? `本批來源回傳 ${rows.length} 筆，未達 20 筆上限；依實收樣本呈現，名次僅供本批比較。` : ''};
}

export function rankRows(rows,key='realized') {
  const compare = (a,b,field) => {
    const x = value(a,field), y = value(b,field);
    return x === null ? (y === null ? 0 : 1) : y === null ? -1 : y-x;
  };
  return [...rows].sort((a,b)=>compare(a,b,key) || compare(a,b,key === 'realized' ? 'pnl' : 'realized') || a.address.localeCompare(b.address));
}

export function formatStamp(stamp) {
  return new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(stamp))+'（台北）';
}

export function rowMarkup(row,index,kind) {
  const config = BOARDS[kind];
  const numericCell = key => `<td class="extra-number ${tone(value(row,key))}" title="${value(row,key) === null ? '來源未提供' : escape(row[key])+' USD'}">${escape(amount(value(row,key)))}</td>`;
  return `<tr><td class="extra-rank">${index+1}</td><td class="extra-wallet"><a href="${config.explorer+encodeURIComponent(row.address)}" target="_blank" rel="noopener noreferrer" title="${escape(row.address)}" aria-label="在 ${config.explorerName} 查看完整地址 ${escape(row.address)}">${escape(row.address.slice(0,6)+'…'+row.address.slice(-4))}${icon('external')}</a></td>${numericCell('realized')}${numericCell('pnl')}<td class="extra-number">${value(row,'trades') === null ? '—' : integer.format(row.trades)}</td><td class="extra-number">${escape(amount(value(row,'volume')))}</td></tr>`;
}

function mountBoard(kind) {
  const config = BOARDS[kind], root = document.getElementById(kind+'-board');
  if (!root) return null;
  root.innerHTML = `<p class="section-eyebrow">${config.label}</p>
    <div class="extra-heading"><div><div class="extra-title"><h2 id="${kind}-title">${config.title}</h2><span class="extra-chain">${config.badge}</span></div><p class="extra-description">${config.description}</p></div><span class="extra-cadence">${config.cadence}</span></div>
    <div class="extra-meta"><p>${config.schedule}<span class="extra-source">來源 Birdeye</span></p><button type="button" class="button quiet extra-refresh" aria-label="重新讀取${config.title}">${icon('reload')}<span>重新讀取</span></button></div>
    <p class="extra-stamp">最新可用快照 · 截至 <time>讀取中…</time></p>
    <p class="snapshot-wait extra-wait" hidden></p>
    <p class="extra-feedback" role="status" aria-live="polite" aria-atomic="true">正在讀取${config.title}…</p>
    <div class="extra-content" hidden>
      <div class="extra-context"><p>按總損益取樣 · 最多 20 筆 · <span class="extra-count"></span> · 金額為美元</p><p>點表頭切換排序 <span aria-hidden="true">↕</span></p></div>
      <p class="extra-description extra-sample-note" role="status" hidden></p>
      <p class="extra-scroll-hint">左右滑動查看完整欄位 <span aria-hidden="true">↔</span></p>
      <div class="extra-table-wrap" role="region" tabindex="0" aria-label="${config.title}，可左右捲動的表格">
        <table><caption class="sr-only"></caption><colgroup><col class="extra-col-rank"><col class="extra-col-wallet"><col class="extra-col-profit"><col class="extra-col-profit"><col class="extra-col-trades"><col class="extra-col-volume"></colgroup><thead><tr><th scope="col">排名</th><th scope="col">錢包</th><th scope="col" aria-sort="descending"><button type="button" data-extra-sort="realized">已實現收益${icon('down')}</button></th><th scope="col"><button type="button" data-extra-sort="pnl">總損益${icon('down')}</button></th><th scope="col">交易次數</th><th scope="col">成交量</th></tr></thead><tbody></tbody></table>
      </div>
      <div class="extra-bottom"><p class="extra-scope">只比較本批樣本，非全鏈排名；不套用主榜條件。</p><button class="button quiet extra-expand" type="button" aria-expanded="false" aria-controls="${kind}-rows"></button></div>
    </div>`;
  const $ = selector => root.querySelector(selector);
  $('tbody').id = kind+'-rows';
  let snapshot = null, sort = 'realized', expanded = false, busy = false;
  function updateTimeState() {
    const status=globalThis.SnapshotTime?.state(snapshot?.updatedAt,kind==='flash'?'flash':'full');
    $('.extra-wait').hidden=!status?.pending;$('.extra-wait').textContent=status?.message||'';
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateTimeState();});
  setInterval(updateTimeState,60000);
  function render() {
    updateTimeState();
    const ready = snapshot?.status === 'ready';
    $('.extra-content').hidden = !ready;
    $('.extra-sample-note').textContent = snapshot?.sampleNotice || '';
    $('.extra-sample-note').hidden = !snapshot?.sampleNotice;
    const time = $('time');
    if (snapshot?.updatedAt) {time.dateTime=snapshot.updatedAt;time.textContent=formatStamp(snapshot.updatedAt);}
    else {time.removeAttribute('datetime');time.textContent='尚未發布';}
    if (!ready) return;
    const rows = rankRows(snapshot.rows,sort), visible = expanded ? rows : rows.slice(0,5);
    $('tbody').innerHTML = visible.map((row,index)=>rowMarkup(row,index,kind)).join('');
    $('caption').textContent = `${config.title}，本批樣本依${NAMES[sort]}由高到低排序，金額為美元`;
    $('.extra-count').textContent = `顯示 ${visible.length} / ${rows.length} 個錢包`;
    for (const button of root.querySelectorAll('[data-extra-sort]')) {
      const active = button.dataset.extraSort === sort;
      if (active) button.closest('th').setAttribute('aria-sort','descending');
      else button.closest('th').removeAttribute('aria-sort');
      button.setAttribute('aria-label',`依${NAMES[button.dataset.extraSort]}由高到低排序`);
    }
    $('.extra-expand').hidden = rows.length <= 5;
    $('.extra-expand').setAttribute('aria-expanded',String(expanded));
    $('.extra-expand').textContent = expanded ? '收合榜單' : `查看全部 ${rows.length} 個錢包`;
  }
  async function refresh() {
    if (busy) return;
    busy=true;root.setAttribute('aria-busy','true');$('.extra-refresh').disabled=true;
    $('.extra-refresh span').textContent='讀取中…';
    $('.extra-feedback').textContent = snapshot ? '正在重新讀取，暫時保留上一份快照。' : `正在讀取${config.title}…`;
    const controller = new AbortController(), timeout = setTimeout(()=>controller.abort(),15000);
    try {
      const response = await fetch(config.file+'?t='+Date.now(),{cache:'no-store',signal:controller.signal});
      if (response.status === 404 && kind === 'flash' && !snapshot) snapshot={status:'pending',rows:[],updatedAt:null};
      else {
        if (!response.ok) throw new Error('Snapshot unavailable');
        const next = readBoardSnapshot(await response.json(),kind);
        if (snapshot?.status === 'ready' && (next.status === 'pending' || Date.parse(next.updatedAt) < Date.parse(snapshot.updatedAt))) throw new Error('Snapshot regressed');
        snapshot=next;
      }
      render();
      $('.extra-feedback').textContent = snapshot.status === 'pending' ? `${config.pending}。資料到齊後，重新讀取即可查看。` : snapshot.status === 'empty' ? '這份快照尚無錢包資料，可稍後重新讀取。' : `${config.title}已載入，依${NAMES[sort]}由高到低。`;
      $('.extra-feedback').classList.toggle('sr-only',snapshot.status === 'ready');
    } catch {
      $('.extra-feedback').classList.remove('sr-only');
      $('.extra-feedback').textContent = snapshot?.status === 'ready' ? '重新讀取失敗，保留上一份快照。請留意更新時間，稍後再試。' : '暫時無法讀取這份榜單。請稍後按「重新讀取」再試。';
      if (!snapshot) $('time').textContent='尚未取得';
    } finally {
      clearTimeout(timeout);busy=false;root.setAttribute('aria-busy','false');$('.extra-refresh').disabled=false;$('.extra-refresh span').textContent='重新讀取';
    }
  }
  $('.extra-refresh').addEventListener('click',refresh);
  $('.extra-expand').addEventListener('click',()=>{expanded=!expanded;render();});
  for (const button of root.querySelectorAll('[data-extra-sort]')) button.addEventListener('click',()=>{sort=button.dataset.extraSort;render();$('.extra-feedback').textContent=`${config.title}，依${NAMES[sort]}由高到低排序。`;});
  refresh();
  return refresh;
}

if (typeof document !== 'undefined') {
  const refreshers = ['flash','base'].map(mountBoard).filter(Boolean);
  document.getElementById('refresh')?.addEventListener('click',()=>refreshers.forEach(refresh=>refresh()));
}
