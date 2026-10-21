import {DEFAULT_MODULES,isAddress,finite,escapeHTML as esc,shortAddress as short,signedMoney as money,timeLabel,dayKey,rankToday,readModules,readFollow,snapshotFiles,readArchive,compareSnapshots,followChange} from './home-data.js?v=5';
import {archiveCalendar} from './archive-calendar.js?v=1';

const $=id=>document.getElementById(id);
const getStored=key=>{try{return localStorage.getItem(key);}catch{return null;}};
let modules=readModules(getStored('lab_home_modules')),follow=readFollow(getStored('lab_follow'));
let data=null,pair=null,archiveDays=null,archiveStatus='loading',generation=0;
let calendarFiles=null,calendarLoaded=[];
const icon=name=>`<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const tone=value=>value>0?'positive':value<0?'negative':'zero';
function save(key,value) {
  try {localStorage.setItem(key,JSON.stringify(value));$('home-storage-note').hidden=true;} catch {$('home-storage-note').hidden=false;}
}
function followButton(address,label='關注這個錢包') {
  const on=follow.includes(address);
  return `<button type="button" class="home-follow${on?' is-on':''}" data-home-follow="${esc(address)}" aria-pressed="${on}" aria-label="${on?'取消關注':'關注'}錢包 ${esc(address)}">${on?'✓ 已關注':'＋ '+label}</button>`;
}
const addressLink=address=>`<a class="home-address" href="https://solscan.io/account/${encodeURIComponent(address)}" target="_blank" rel="noopener noreferrer" title="${esc(address)}">${esc(short(address))}${icon('external')}</a>`;
const emptyCard=(tag,heading,detail,symbol)=>`<article class="home-card"><p class="home-tag">${tag}</p><div class="home-avatar" aria-hidden="true">${symbol}</div><h3>${heading}</h3><p class="home-card-note">${detail}</p><a class="home-card-link" href="#board">看完整榜單 →</a></article>`;
function renderCards() {
  const expanded=$('home-cards').querySelector('.home-new-list');
  const listState={open:expanded?.open,scroll:expanded?.querySelector('div')?.scrollTop||0,rail:$('home-cards').scrollLeft};
  const leader=data && rankToday(data.today).find(w=>finite(w.realized));
  const star=leader?`<article class="home-card home-card-star"><p class="home-tag">最新單日樣本</p><div class="home-avatar" aria-hidden="true">${esc(leader.address.slice(0,2))}</div><h3>本批已實現收益榜首</h3><p class="home-card-value ${tone(leader.realized)}">${money(leader.realized)}</p><p class="home-card-note">本批已實現收益最高${finite(leader.trades)?` · 交易 ${leader.trades.toLocaleString('en-US')} 筆`:''}</p>${addressLink(leader.address)}${followButton(leader.address)}</article>`:emptyCard('最新單日樣本','數據累積中','取得有效的單日樣本後，顯示本批榜首。','—');
  let movement,newcomers;
  if (!pair) {
    const detail=archiveStatus==='error'?'歷史快照暫時無法讀取，可按下方重新讀取。':'需要可比較的完整快照，才計算排名變化。';
    movement=emptyCard('共有地址的名次變動','數據累積中',detail,'↗');
    newcomers=emptyCard('本次新進樣本','數據累積中',detail,'＋');
  } else {
    const gain=pair.biggest;
    movement=gain?`<article class="home-card"><p class="home-tag">共有地址的名次變動</p><div class="home-avatar home-avatar-soft" aria-hidden="true">↗</div><h3>本批樣本名次變動</h3><p class="home-card-value">${gain.previousRank} → ${gain.rank}</p><p class="home-card-note">兩批共有 ${pair.commonCount} / ${pair.current.length} 個地址；按各批已實現收益排序。樣本組成與統計窗口會變，不代表交易能力提升。</p>${addressLink(gain.row.address)}${followButton(gain.row.address)}</article>`:emptyCard('共有地址的名次變動','本次沒有名次上升','兩份快照共有的錢包，沒有名次上移。','↔');
    const count=pair.newcomers.length;
    const all=count>0&&pair.newcomers.every(w=>follow.includes(w.address));
    newcomers=`<article class="home-card"><p class="home-tag">本次新進樣本</p><div class="home-avatar home-avatar-soft" aria-hidden="true">＋</div><h3>${count?'留意這批新面孔。':'這次，都是熟面孔。'}</h3><p class="home-card-value">${count}<small> 個錢包</small></p><p class="home-card-note">最新 ${pair.current.length} 個樣本中，前次快照未收錄的地址；不代表歷史首次上榜。</p>${count?`<details class="home-new-list"><summary>查看這些地址</summary><div>${pair.newcomers.map(w=>`<div>${addressLink(w.address)}${followButton(w.address,'關注')}</div>`).join('')}</div></details><button class="home-follow${all?' is-on':''}" type="button" data-home-follow-new aria-pressed="${all}">${all?'✓ 已全部關注':'＋ 關注這批新錢包'}</button>`:'<a class="home-card-link" href="#board">看完整榜單 →</a>'}</article>`;
  }
  $('home-cards').innerHTML=star+movement+newcomers;
  const nextList=$('home-cards').querySelector('.home-new-list');
  if(nextList&&listState.open){nextList.open=true;nextList.querySelector('div').scrollTop=listState.scroll;}
  $('home-cards').scrollLeft=listState.rail;
  $('home-snapshot-note').innerHTML=pair?`排名變化與本次新進樣本：<a href="./${pair.previous.path}" target="_blank" rel="noopener">${timeLabel(pair.previous.stamp)}</a> → <a href="./${pair.latest.path}" target="_blank" rel="noopener">${timeLabel(pair.latest.stamp)}</a>。比較兩批樣本；組成與統計窗口可能不同，不代表能力進步或退步。`:'歷史比較就緒後顯示兩份來源時間；不以缺值推算變化。';
  updateScrollButtons();
}
function renderCurrent() {
  const rows=data?rankToday(data.today):[],leader=rows.find(w=>finite(w.realized));
  $('home-number').className='home-number '+tone(leader?.realized);
  $('home-number').innerHTML=leader?money(leader.realized):'<span class="skeleton" aria-hidden="true"></span><span class="sr-only">數據累積中</span>';
  $('home-number').setAttribute('aria-busy',String(!leader));
  if (data) {$('home-time').dateTime=data.updated_at;$('home-time').textContent='快照 '+timeLabel(data.updated_at);}
  $('home-leader-link').hidden=!leader;
  if (leader) {$('home-leader-link').textContent=short(leader.address)+' ↗';$('home-leader-link').href='https://solscan.io/account/'+leader.address;$('home-leader-link').title=leader.address;}
  $('home-top').innerHTML=rows.length?`<table><caption class="sr-only">單日已實現收益前 ${Math.min(rows.length,10)} 名</caption><thead><tr><th>錢包</th><th>已實現收益</th><th><span class="sr-only">關注</span></th></tr></thead><tbody>${rows.slice(0,10).map((w,i)=>`<tr><td><span class="home-mini-rank">${i+1}</span>${addressLink(w.address)}</td><td class="${tone(w.realized)}">${money(w.realized)}</td><td>${followButton(w.address,'關注')}</td></tr>`).join('')}</tbody></table>`:'<p class="home-muted">數據累積中，取得單日榜單後顯示。</p>';
}
function renderTrend() {
  const days=archiveCalendar(calendarFiles,calendarLoaded),count=days.filter(d=>d.status==='available').length;
  $('home-trend-state').innerHTML=`${calendarFiles?count:'—'}<small> / 7 天</small>`;
  $('home-trend-grid').innerHTML=days.map(d=>{
    const labels={available:'已存',missing:'缺',incomplete:'缺',unknown:'待核'};
    const reason={available:'完整快照，開啟原始封存',missing:'未找到這個資料日的封存，原因未確認',incomplete:'封存樣本未達完整快照條件',unknown:archiveStatus==='loading'?'正在讀取封存':'封存尚未讀取成功，不能判定缺失'}[d.status];
    const attrs=`class="archive-day is-${d.status}" data-cursor="${d.status==='available'?'快照':d.status==='unknown'?'待核':'缺失'}" title="${d.date} · ${reason}"`;
    return `<li>${d.path?`<a ${attrs} href="./${esc(d.path)}" target="_blank" rel="noopener" aria-label="${d.date} · ${reason}">${labels[d.status]}</a>`:`<span ${attrs} aria-label="${d.date} · ${reason}">${labels[d.status]}</span>`}<time datetime="${d.date}">${d.date.slice(5).replace('-','/')}</time></li>`;
  }).join('');
  const missing=days.filter(d=>['missing','incomplete'].includes(d.status)).map(d=>d.date.slice(5).replace('-','/'));
  const unknown=days.filter(d=>d.status==='unknown').length;
  $('home-trend-note').textContent=calendarFiles?`最近 7 個台北資料日，已核對 ${count} 天的完整封存。${missing.length?` ${missing.join('、')} 未找到完整快照；原因未確認，不補造。`:''}${unknown?' 部分封存尚未讀取成功，標「待核」，可重新讀取歷史。':''}`:archiveStatus==='error'?'暫時無法讀取封存清單，標「待核」，不判定缺失。請重新讀取歷史。':'正在核對真實封存；讀取前不判定有無快照。';
}
function renderFeed() {
  $('home-follow-count').textContent=follow.length?`${follow.length} 個已關注`:'';
  $('home-feed-caveat').hidden=!follow.length;
  if (!follow.length) {$('home-feed').innerHTML=`<div class="home-empty"><div class="home-empty-icon">${icon('wallet')}</div><h3>你還沒關注任何錢包</h3><p>在本批三卡點「關注」，這裡就會整理該錢包的快照變化。</p><a class="button primary" href="#swipe">到本批三卡，選個錢包 →</a><small>關注清單只存在這個瀏覽器，無須連接錢包。</small></div>`;return;}
  $('home-feed').innerHTML=follow.map(address=>{
    const change=followChange(address,pair);
    let what='數據累積中，等待可比較的快照。';
    if (change.status==='delta') what=`本期已實現收益較前次快照 <strong class="${tone(change.delta)}">${money(change.delta)}</strong>`;
    if (change.status==='new') what='本次新進樣本，前次未收錄，暫無可比差額。';
    if (change.status==='absent') what='最新完整快照未收錄此地址，暫無可比差額。';
    if (change.status==='missing') what='來源缺少收益數值，暫無可比差額。';
    return `<article class="home-feed-item"><div class="home-avatar" aria-hidden="true">${esc(address.slice(0,2))}</div><div class="home-feed-body">${addressLink(address)}${pair?`<time datetime="${pair.latest.stamp}">${timeLabel(pair.latest.stamp)}</time>`:''}<p>${what}</p></div>${followButton(address)}</article>`;
  }).join('');
}
function renderAll() {renderCurrent();renderCards();renderFeed();renderTrend();}
function syncModules() {
  for(const key of Object.keys(DEFAULT_MODULES)) {const input=document.querySelector(`[data-home-module="${key}"]`);input.checked=modules[key];$('home-module-'+key).hidden=!modules[key];}
  $('home-modules-empty').hidden=Object.values(modules).some(Boolean);
}
async function getJSON(url) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try {const response=await fetch(url,{signal:controller.signal,cache:'no-cache'});if (!response.ok) throw new Error('Unavailable');return await response.json();}finally{clearTimeout(timer);}
}
async function loadArchives() {
  if (!data) return;
  const token=++generation,cutoff=Date.parse(data.updated_at);
  archiveStatus='loading';$('home-history-retry').disabled=true;
  try {
    let paths;
    try {paths=(await getJSON('./snapshot-index.json')).files;if(!Array.isArray(paths)) throw new Error('Index unavailable');}
    catch {const directory=await getJSON('https://api.github.com/repos/kkweb3345678/trader-leaderboard/contents/snapshots?ref=main');if(!Array.isArray(directory)) throw new Error('Index unavailable');paths=directory.filter(f=>f.type==='file').map(f=>f.path);}
    const allFiles=snapshotFiles(paths),files=allFiles.filter(f=>Date.parse(f.stamp)<=cutoff),byDay=new Map();
    for (const entry of files) {const day=dayKey(entry.stamp);if(!byDay.has(day)) byDay.set(day,entry);}
    const recentDays=new Set(archiveCalendar([],[]).map(d=>d.date));
    const wanted=[...new Map([...files.slice(0,2),...[...byDay.values()].slice(0,7),...allFiles.filter(e=>recentDays.has(dayKey(e.stamp)))].map(e=>[e.path,e])).values()];
    const results=await Promise.allSettled(wanted.map(async entry=>readArchive(await getJSON('./'+entry.path),entry)));
    const loaded=results.filter(r=>r.status==='fulfilled').map(r=>r.value);
    if(token!==generation) return;
    calendarFiles=allFiles;calendarLoaded=loaded;
    const full=loaded.filter(s=>s.full&&Date.parse(s.stamp)<=cutoff).sort((a,b)=>Date.parse(b.stamp)-Date.parse(a.stamp));
    pair=compareSnapshots(full[0],full[1]);
    archiveDays=new Set(full.map(s=>dayKey(s.stamp))).size;
    archiveStatus=results.some(r=>r.status==='rejected')?'error':'ready';
  } catch {if(token!==generation)return;pair=null;archiveDays=null;calendarFiles=null;calendarLoaded=[];archiveStatus='error';}
  finally {if(token===generation){$('home-history-retry').disabled=false;renderCards();renderFeed();renderTrend();}}
}
function acceptData(next) {if(!next)return;data=next;pair=null;archiveDays=null;calendarFiles=null;calendarLoaded=[];archiveStatus='loading';renderAll();loadArchives();}
function updateScrollButtons() {
  const rail=$('home-cards');
  $('home-card-prev').disabled=rail.scrollLeft<2;
  $('home-card-next').disabled=rail.scrollLeft+rail.clientWidth>=rail.scrollWidth-2;
}
document.addEventListener('leaderboard:loaded',event=>acceptData(event.detail));
document.addEventListener('leaderboard:status',event=>{$('home-load-error').hidden=!event.detail.failed;if(event.detail.failed&&!data)$('home-time').textContent='暫時無法讀取快照，請重新讀取。';});
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-home-follow]'),group=event.target.closest('[data-home-follow-new]');
  if(!button&&!group)return;
  const address=button?.dataset.homeFollow;
  const focusKey=button?{address,container:button.closest('[id]')?.id}:null;
  if(button&&isAddress(address)) follow=follow.includes(address)?follow.filter(a=>a!==address):[...follow,address];
  if(group&&pair) {const addresses=pair.newcomers.map(w=>w.address),all=addresses.every(a=>follow.includes(a));follow=all?follow.filter(a=>!addresses.includes(a)):[...new Set([...follow,...addresses])];}
  save('lab_follow',follow);renderAll();
  const replacement=group?document.querySelector('[data-home-follow-new]'):document.getElementById(focusKey.container)?.querySelector(`[data-home-follow="${address}"]`);
  (replacement||$('home-feed-title')).focus({preventScroll:true});
  $('home-live').textContent=button?(follow.includes(address)?'已關注 '+short(address):'已取消關注 '+short(address)):'已更新這批新錢包的關注狀態。';
});
document.querySelectorAll('[data-home-module]').forEach(input=>input.addEventListener('change',()=>{modules[input.dataset.homeModule]=input.checked;save('lab_home_modules',modules);syncModules();}));
$('home-history-retry').addEventListener('click',loadArchives);
for (const [id,direction] of [['home-card-prev',-1],['home-card-next',1]]) $(id).addEventListener('click',()=>{$('home-cards').scrollBy({left:direction*($('home-cards').querySelector('.home-card')?.clientWidth+20||320),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
$('home-cards').addEventListener('scroll',updateScrollButtons,{passive:true});
window.addEventListener('resize',updateScrollButtons);
window.addEventListener('storage',event=>{if(event.key===null||event.key==='lab_follow')follow=readFollow(getStored('lab_follow'));if(event.key===null||event.key==='lab_home_modules')modules=readModules(getStored('lab_home_modules'));syncModules();renderAll();});
syncModules();renderAll();
// app.js may finish its initial request before this module is evaluated.
if(typeof DATA!=='undefined'&&DATA) acceptData(DATA);
