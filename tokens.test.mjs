import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import './money-format.js';
import {buildTokenIndex,total,parseState,stateURL,selectTokens} from './tokens-data.js';
import {aggregateHTML,tokenRow,detailMarkup} from './tokens.js';
const date='2026-10-17T01:00:00Z',now=Date.parse(date),mint='Z'.repeat(32);
const token=(address=mint,symbol='COIN')=>({address,symbol,last_trade_unix_time:null,buy_count:1,sell_count:0,buy_usd:25,sell_usd:0,realized_usd:-3,unrealized_usd:null});
const sample=()=>({schema_version:1,source:'Birdeye',chain:'solana',selection:'week_sample_volume_top10',updated_at:date,source_updated_at:date,parameters:{duration:'7d',pnl_method:'wac',position_scope:'duration_only',limit:100,offset:0,sort_by:'last_trade',sort_type:'desc'},wallets:[...'ABCDEFGHJK'].map((a,i)=>({address:a.repeat(32),snapshot_date:date,sample_volume_rank:i+1,sample_volume_usd:100-i,reported_unique_tokens:1,coverage:'source_page',tokens:[token()]}))});
test('published rows reconcile by exact mint with independent wallet and amount sums',()=>{
  const data=JSON.parse(readFileSync(new URL('./wallet-trades.json',import.meta.url),'utf8'));
  const index=buildTokenIndex(data,Date.parse(data.updated_at));
  const raw=data.wallets.flatMap(w=>w.tokens.filter(t=>['buy_count','sell_count','buy_usd','sell_usd'].some(k=>t[k]>0)).map(t=>({...t,wallet:w.address})));
  assert.equal(index.tokens.length,new Set(raw.map(t=>t.address)).size);
  assert.equal(index.tokens.reduce((n,t)=>n+t.wallet_count,0),raw.length);
  for(const t of index.tokens){
    const rows=raw.filter(r=>r.address===t.address);
    assert.equal(t.wallet_count,new Set(rows.map(r=>r.wallet)).size);
    for(const key of ['buy_usd','sell_usd','buy_count','sell_count','realized_usd','unrealized_usd']){
      const values=rows.map(r=>r[key]).filter(v=>v!==null),expected=values.reduce((n,v)=>n+v,0);
      assert.equal(t.aggregate[key].missing,rows.length-values.length);
      if(!values.length)assert.equal(t.aggregate[key].value,null);
      else assert.ok(Math.abs(t.aggregate[key].value-expected)<=Math.max(1,Math.abs(expected))*1e-12);
    }
  }
});
test('same symbols on different or case-sensitive contracts stay separate; aliases share one mint',()=>{
  const data=sample();data.wallets[1].tokens[0]=token('z'.repeat(32));data.wallets[2].tokens[0].symbol='ALIAS';
  const {tokens}=buildTokenIndex(data,now);assert.equal(tokens.length,2);
  const shared=tokens.find(t=>t.address===mint);assert.equal(shared.wallet_count,9);assert.deepEqual(shared.symbols,['COIN','ALIAS']);
  assert.equal(selectTokens(tokens,parseState('?q=alias')).total,1);
});
test('only evidence of activity is counted; missing metrics remain unknown, zero stays zero',()=>{
  const data=sample();data.wallets[0].tokens[0]={...token(),buy_count:null,buy_usd:null};
  data.wallets[1].tokens[0].buy_usd=null;
  const index=buildTokenIndex(data,now),t=index.tokens[0];
  assert.equal(index.omitted,1);assert.equal(index.walletCount,9);assert.equal(t.aggregate.buy_usd.value,200);assert.equal(t.aggregate.buy_usd.missing,1);
  assert.equal(t.aggregate.sell_usd.value,0);assert.equal(t.aggregate.unrealized_usd.value,null);
  assert.match(aggregateHTML(t.aggregate.buy_usd),/缺 1 項/);assert.match(aggregateHTML(t.aggregate.sell_usd),/\$0\.00/);assert.match(aggregateHTML(t.aggregate.unrealized_usd),/未提供/);
});
test('unsafe aggregate amounts fail explicitly, without changing safe individual values',()=>{
  const metric=total([Number.MAX_SAFE_INTEGER,1]);assert.equal(metric.value,null);assert.equal(metric.overflow,true);
  assert.match(aggregateHTML(metric),/無法安全加總/);assert.equal(total([null,0]).value,0);
});
test('search, pagination and sorting are stable and do not mutate the dataset',()=>{
  const data=sample();data.wallets[0].tokens=[...'LMNPQRSTUVWXYZabcdefghijkm'].map((c,i)=>({...token(c.repeat(32),'Coin'+i),buy_usd:i,last_trade_unix_time:i}));data.wallets[0].reported_unique_tokens=data.wallets[0].tokens.length;
  const {tokens}=buildTokenIndex(data,now),original=tokens.map(t=>t.address);
  const shared=selectTokens(tokens,parseState('?shared=1'));assert.equal(shared.total,1);assert.equal(shared.rows[0].address,mint);
  const result=selectTokens(tokens,parseState('?sort=buys&page=999'));assert.equal(result.page,result.pages);assert.ok(result.rows.length<20);
  const sorted=selectTokens(tokens,parseState('?sort=recent'));assert.equal(sorted.rows[0].last_trade,25);
  assert.equal(selectTokens(tokens,parseState('?q=COIN1')).total,11);assert.equal(selectTokens(tokens,parseState('?q=no_such_token')).total,0);
  assert.deepEqual(tokens.map(t=>t.address),original);
});
test('deep links round-trip filters; invalid query values are bounded',()=>{
  const state={q:'x & y',sort:'buys',page:2,shared:true,token:mint};assert.deepEqual(parseState(stateURL(state).split('?')[1]),state);
  assert.deepEqual(parseState('?sort=__proto__&page=-2&token=%3Cscript%3E'),{q:'',sort:'wallets',page:1,shared:false,token:'invalid'});
  assert.equal(parseState('?q='+'a'.repeat(250)).q.length,200);
});
test('symbols are escaped in table and detail; source and complete wallet addresses stay available',()=>{
  const data=sample();data.wallets[0].tokens[0].symbol='<img onerror=alert(1)>';
  const t=buildTokenIndex(data,now).tokens[0],state=parseState('');
  for(const html of [tokenRow(t,state),detailMarkup(t,state)]){assert.ok(!html.includes('<img'));assert.match(html,/&lt;img/);}
  const detail=detailMarkup(t,state);assert.ok(detail.includes('A'.repeat(32)));assert.match(detail,/選樣榜單交易量/);assert.match(detail,/未提供/);assert.match(detail,/來源快照/);
  assert.match(detailMarkup(undefined,state),/不代表沒有人交易/);
});
test('new page is a standalone route, present in SEO and loading a shared shell',()=>{
  const shell=readFileSync(new URL('./shell.js',import.meta.url),'utf8');
  assert.match(shell,/key:'tokens'/);assert.match(shell,/\['wallets','referral','learn','tokens'\]/);
  const page=readFileSync(new URL('./tokens.html',import.meta.url),'utf8');assert.match(page,/<script\b[^>]*\bsrc="\.\/shell\.js\?v=[A-Za-z0-9_-]+"[^>]*><\/script>/);assert.match(page,/不是代幣數量/);
});
