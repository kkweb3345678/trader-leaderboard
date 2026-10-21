import {buildTokenIndex,selectTokens,parseState,stateURL,PAGE_SIZE,total} from './tokens-data.js?v=1';
export const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>n===null?'未提供':globalThis.ResearchMoney.format(n);
const integer=n=>n===null?'未提供':n.toLocaleString('zh-TW');
const time=value=>new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
const tradeTime=value=>value&&Number.isFinite(new Date(value*1000).getTime())?time(value*1000):'來源未提供';
const tone=n=>n===null||n===0?'zero':n<0?'negative':'positive';
export function aggregateHTML(metric,count=false){
  const note=metric.overflow?'合計超出顯示範圍':metric.missing?`缺 ${metric.missing} 項，僅加總已知值`:'';
  return `${esc(metric.overflow?'無法安全加總':(count?integer:money)(metric.value))}${note?`<small class="tokens-partial">${esc(note)}</small>`:''}`;
}
export function tokenRow(t,state){
  return `<tr><td><a class="token-name-link" data-token="${esc(t.address)}" href="${esc(stateURL({...state,token:t.address}))}" aria-label="查看 ${esc(t.symbol)} 的交易錢包，合約 ${esc(t.address)}"><span class="token-monogram" aria-hidden="true">${esc([...t.symbol].slice(0,2).join(''))}</span><span class="token-label"><strong>${esc(t.symbol)}</strong><small>${esc(t.address.slice(0,6)+'…'+t.address.slice(-5))}</small></span><span aria-hidden="true">→</span></a></td><td data-label="交易錢包">${integer(t.wallet_count)} <span class="tokens-partial">個已收錄地址</span></td><td data-label="買入金額 · USD">${aggregateHTML(t.aggregate.buy_usd)}</td><td data-label="賣出金額 · USD">${aggregateHTML(t.aggregate.sell_usd)}</td><td data-label="買賣次數">${aggregateHTML(t.aggregate.trades,true)}</td></tr>`;
}
export function walletCard(w){
  const metric=(title,value,style='')=>`<div><dt>${title}</dt><dd class="${style}">${esc(money(value))}</dd></div>`;
  return `<li class="token-wallet"><div class="token-wallet-head"><div><strong>${esc(w.wallet_address)}</strong><small>選樣榜單交易量第 ${w.sample_volume_rank} 名 · 僅本批樣本</small></div><a href="https://solscan.io/account/${encodeURIComponent(w.wallet_address)}" target="_blank" rel="noopener noreferrer" aria-label="在 Solscan 查看錢包 ${esc(w.wallet_address)}">Solscan ↗</a></div><dl class="token-wallet-metrics">${metric(`買入 · ${esc(integer(w.buy_count))}${w.buy_count===null?'':' 次'}`,w.buy_usd)}${metric(`賣出 · ${esc(integer(w.sell_count))}${w.sell_count===null?'':' 次'}`,w.sell_usd)}${metric('已實現損益',w.realized_usd,tone(w.realized_usd))}${metric('未實現損益',w.unrealized_usd,tone(w.unrealized_usd))}</dl><div class="token-wallet-foot"><span>來源快照 ${time(w.snapshot_date)}（台北）<br>此幣最近交易 ${tradeTime(w.last_trade_unix_time)}${w.last_trade_unix_time?'（台北）':''}</span><a href="./index.html?view=leaderboard&amp;tab=week&amp;sort=volume&amp;q=${encodeURIComponent(w.wallet_address)}">到排行榜看這個地址 →</a></div></li>`;
}
export function detailMarkup(t,state,order='amount'){
  if(!t)return `<a class="token-back" data-token="" href="${esc(stateURL({...state,token:null}))}">← 返回幣種清單</a><div class="tokens-empty"><h2 id="token-detail-title" tabindex="-1">這期未收錄此合約</h2><p>可能是連結有誤，或這個幣種已不在最新快照中；不代表沒有人交易。</p></div>`;
  const get=w=>order==='amount'?total([w.buy_usd,w.sell_usd]).value:w[order];
  const wallets=[...t.wallets].sort((a,b)=>{const x=get(a),y=get(b);return (x===null?(y===null?0:1):y===null?-1:y-x)||a.wallet_address.localeCompare(b.wallet_address);});
  const stat=(label,value)=>`<div><dt>${label}</dt><dd>${value}</dd></div>`;
  return `<a class="token-back" data-token="" href="${esc(stateURL({...state,token:null}))}">← 返回幣種清單</a><div class="token-detail-heading"><div><p>幣種交易 / SOLANA · 近七日查詢窗口</p><h2 id="token-detail-title" tabindex="-1">${esc(t.symbol)}</h2><a class="token-contract" href="https://solscan.io/token/${encodeURIComponent(t.address)}" target="_blank" rel="noopener noreferrer">${esc(t.address)} ↗</a>${t.symbols.length>1?`<p>同一合約在來源也標示為：${t.symbols.map(esc).join('、')}</p>`:''}</div><button type="button" class="button" id="token-share">複製此幣種連結</button></div><p id="token-share-status" class="token-copy-status" role="status"></p><div id="token-share-fallback" class="token-share-fallback" hidden><label for="token-share-url">手動複製幣種連結</label><div><input id="token-share-url" readonly type="text" autocomplete="off"><button id="token-share-close" class="button" type="button">完成</button></div></div><dl class="token-detail-stats">${stat('已收錄交易錢包',integer(t.wallet_count)+' 個')}${stat('買入已知合計 · USD',aggregateHTML(t.aggregate.buy_usd))}${stat('賣出已知合計 · USD',aggregateHTML(t.aggregate.sell_usd))}${stat('買賣已知次數',aggregateHTML(t.aggregate.trades,true))}</dl><div class="tokens-section-heading"><div><h2>哪些錢包交易過？</h2><p>各地址分別列出買賣；沒有收錄不代表沒有交易。</p></div><label class="token-detail-order">錢包排序<select id="token-wallet-order"><option value="amount"${order==='amount'?' selected':''}>買賣金額</option><option value="buy_usd"${order==='buy_usd'?' selected':''}>買入金額</option><option value="sell_usd"${order==='sell_usd'?' selected':''}>賣出金額</option><option value="realized_usd"${order==='realized_usd'?' selected':''}>已實現損益</option></select></label></div><ol class="token-wallet-list">${wallets.map(walletCard).join('')}</ol>`;
}

if(typeof document!=='undefined'){
  const $=id=>document.getElementById(id);
  let snapshot=null,index=null,state=parseState(location.search),busy=false,walletOrder='amount';
  window.ResearchShell.mount({active:'tokens'});
  function sync(replace=true){history[replace?'replaceState':'pushState']({},'',stateURL(state));}
  function renderList(){
    const selection=selectTokens(index.tokens,state);state.page=selection.page;
    $('token-rows').innerHTML=selection.rows.map(t=>tokenRow(t,state)).join('');
    $('token-count').textContent=`顯示 ${selection.total?(selection.page-1)*PAGE_SIZE+1:0}–${(selection.page-1)*PAGE_SIZE+selection.rows.length} / ${selection.total} 個幣種${state.shared?' · 多錢包交易':''}`;
    $('tokens-page').textContent=`第 ${selection.page} / ${selection.pages} 頁`;
    $('tokens-prev').disabled=selection.page===1;$('tokens-next').disabled=selection.page===selection.pages;
    $('tokens-empty').hidden=selection.total>0;
    $('tokens-reset-filters').hidden=!state.q.trim()&&!state.shared;
    document.querySelector('.tokens-table-wrap').hidden=selection.total===0;
  }
  function render({focus=false}={}){
    if(!index)return;
    $('tokens-overview').hidden=!!state.token;$('token-detail').hidden=!state.token;
    $('token-search').value=state.q;$('token-sort').value=state.sort;$('token-shared').checked=state.shared;
    const t=index.tokens.find(t=>t.address===state.token);
    if(state.token){$('token-detail').innerHTML=detailMarkup(t,state,walletOrder);document.title=(t?t.symbol+' 交易錢包':'未收錄幣種')+'｜落袋研究室';}
    else{renderList();document.title='幣種交易明細｜落袋研究室';}
    if(focus){const target=$(state.token?'token-detail-title':'token-list-title');target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'instant'});}
  }
  function overview(){
    window.ResearchShell.setSourceDate(snapshot.updated_at,'明細整理');
    const limited=snapshot.wallets.filter(w=>w.coverage==='limited').length,discrepancy=snapshot.wallets.filter(w=>w.coverage==='count_mismatch').length;
    $('tokens-summary').innerHTML=`<div><dt>收錄幣種</dt><dd>${index.tokens.length}<small>依合約計算</small></dd></div><div><dt>交易錢包</dt><dd>${index.walletCount}<small>本批追蹤樣本</small></dd></div><div><dt>多錢包交易</dt><dd>${index.tokens.filter(t=>t.wallet_count>1).length}<small>至少兩個錢包</small></dd></div>`;
    const times=snapshot.wallets.map(w=>w.snapshot_date).sort((a,b)=>Date.parse(a)-Date.parse(b));
    const first=time(times[0]),last=time(times.at(-1));
    const range=first===last?first:first.split(' ')[0]===last.split(' ')[0]?first+'–'+last.split(' ').at(-1):first+'–'+last;
    $('tokens-updated').textContent=`明細來源 ${range}（台北） · 每日全量成功後更新`;
    $('tokens-source-detail').textContent=`選樣榜單：${time(snapshot.source_updated_at)}（台北）；明細整理完成：${time(snapshot.updated_at)}（台北）。本次 ${limited} 個錢包為部分幣種頁，${discrepancy} 個錢包的來源彙總與明細列數有差異。${index.omitted?`另有 ${index.omitted} 筆未提供正值交易次數或金額的明細，未列入本頁交易清單。`:''}`;
    const stale=Date.now()-Math.min(Date.parse(times[0]),Date.parse(snapshot.source_updated_at))>36*3600000;
    $('tokens-warning').hidden=!stale;$('tokens-warning').textContent=stale?'選樣榜單或明細來源已超過一天半；目前保留上一份可用快照，請依標示日期閱讀。':'';
  }
  async function load(){
    if(busy)return;busy=true;$('tokens-refresh').disabled=true;$('tokens-retry').disabled=true;$('tokens-error').hidden=true;
    $('tokens-refresh').textContent='讀取中…';$('tokens-refresh').setAttribute('aria-busy','true');
    $('tokens-overview').setAttribute('aria-busy','true');$('token-detail').setAttribute('aria-busy','true');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try{const response=await fetch('./wallet-trades.json?t='+Date.now(),{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error('load');const next=await response.json(),nextIndex=buildTokenIndex(next);snapshot=next;index=nextIndex;overview();render();}
    catch(_){if(index){$('tokens-warning').hidden=false;$('tokens-warning').textContent='重新讀取失敗，仍顯示上一份成功載入的快照；可稍後再試。';}else{$('tokens-error').hidden=false;$('tokens-updated').textContent='資料尚未載入';}}
    finally{clearTimeout(timer);busy=false;$('tokens-loading').hidden=true;$('tokens-refresh').disabled=false;$('tokens-retry').disabled=false;
      $('tokens-refresh').textContent='重新讀取資料';$('tokens-refresh').removeAttribute('aria-busy');
      $('tokens-overview').removeAttribute('aria-busy');$('token-detail').removeAttribute('aria-busy');}
  }
  function changeList(){state.q=$('token-search').value;state.sort=$('token-sort').value;state.shared=$('token-shared').checked;state.page=1;if(index)renderList();sync();}
  $('token-search').addEventListener('input',changeList);$('token-sort').addEventListener('change',changeList);$('token-shared').addEventListener('change',changeList);
  function clearFilters(){state={...state,q:'',shared:false,page:1};render();sync();$('token-search').focus({preventScroll:true});}
  $('tokens-clear').addEventListener('click',clearFilters);$('tokens-reset-filters').addEventListener('click',clearFilters);
  for(const [id,step] of [['tokens-prev',-1],['tokens-next',1]])$(id).addEventListener('click',()=>{state.page+=step;render({focus:true});sync();});
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[data-token]');
    if(link&&!event.defaultPrevented&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();state.token=link.dataset.token||null;walletOrder='amount';sync(false);render({focus:true});}
  });
  $('token-detail').addEventListener('change',event=>{if(event.target.id==='token-wallet-order'){walletOrder=event.target.value;render();$('token-wallet-order').focus({preventScroll:true});}});
  $('token-detail').addEventListener('click',async event=>{
    if(event.target.closest('#token-share-close')){$('token-share-fallback').hidden=true;$('token-share').focus();return;}
    const button=event.target.closest('#token-share');if(!button)return;
    const token=state.token,url=new URL(stateURL({...state,q:'',page:1,shared:false,sort:'wallets'}),location.href).href;
    const currentShare=()=>state.token===token&&$('token-share')===button;
    button.disabled=true;button.setAttribute('aria-busy','true');
    try{await navigator.clipboard.writeText(url);if(currentShare()){$('token-share-fallback').hidden=true;$('token-share-status').textContent='幣種頁面連結已複製。';}}
    catch(_){if(currentShare()){$('token-share-status').textContent='瀏覽器未允許複製，連結已選取，可手動複製。';$('token-share-fallback').hidden=false;$('token-share-url').value=url;$('token-share-url').focus();$('token-share-url').select();}}
    finally{if(currentShare()){button.disabled=false;button.removeAttribute('aria-busy');}}
  });
  window.addEventListener('popstate',()=>{state=parseState(location.search);walletOrder='amount';render({focus:true});});
  $('tokens-refresh').addEventListener('click',load);$('tokens-retry').addEventListener('click',load);
  load();
}
