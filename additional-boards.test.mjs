import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readBoardSnapshot,rankRows,rowMarkup,formatStamp} from './additional-boards.js';

const baseline=JSON.parse(fs.readFileSync(new URL('./data.json',import.meta.url)));
const flash=JSON.parse(fs.readFileSync(new URL('./today-flash.json',import.meta.url)));
const baseRow={address:'0x'+'a'.repeat(40),realized:20,pnl:100,unrealized:80,trades:1,volume:400};

test('legacy full snapshot without Base remains valid and unchanged',()=>{
  const old={...baseline};delete old.base_today;
  const before=JSON.stringify(old);
  assert.equal(readBoardSnapshot(old,'base').status,'pending');
  assert.equal(JSON.stringify(old),before);
});
test('Base rows use EVM addresses and Basescan; Solana flash uses Solscan',()=>{
  const data={...baseline,base_today:[baseRow]};
  assert.equal(readBoardSnapshot(data,'base').status,'ready');
  assert.match(rowMarkup(baseRow,0,'base'),/https:\/\/basescan.org\/address\/0x/);
  assert.equal(readBoardSnapshot(flash,'flash').rows.length,20);
  assert.match(rowMarkup(flash.today[0],0,'flash'),/https:\/\/solscan.io\/account\//);
  assert.throws(()=>readBoardSnapshot({...data,base_today:flash.today},'base'));
});
test('Base address case duplicates, invalid metrics and missing flash period are rejected',()=>{
  const data={...baseline,base_today:[baseRow,{...baseRow,address:'0x'+'A'.repeat(40)}]};
  assert.throws(()=>readBoardSnapshot(data,'base'));
  for(const field of ['pnl','realized','volume','trades']) assert.throws(()=>readBoardSnapshot({...baseline,base_today:[{...baseRow,[field]:'<script>'}]},'base'));
  assert.throws(()=>readBoardSnapshot({...flash,today:null},'flash'));
});
test('Base short samples show actual count without padding or claiming twenty rows',()=>{
  for(const count of [1,13,20]) {
    const rows=Array.from({length:count},(_,i)=>({...baseRow,address:'0x'+i.toString(16).padStart(40,'0')}));
    const snapshot=readBoardSnapshot({...baseline,base_today:rows},'base');
    assert.equal(snapshot.rows.length,count);
    assert.equal(snapshot.status,'ready');
    if(count<20) assert.ok(snapshot.sampleNotice.includes(`來源回傳 ${count} 筆`));
    else assert.equal(snapshot.sampleNotice,'');
    assert.equal(snapshot.updatedAt,baseline.updated_at);
  }
  assert.equal(readBoardSnapshot({...baseline,base_today:[]},'base').sampleNotice,'');
});
test('empty arrays are distinct from pending; missing values are never converted to zero',()=>{
  assert.equal(readBoardSnapshot({...baseline,base_today:[]},'base').status,'empty');
  const row={...baseRow,realized:null};
  assert.equal(readBoardSnapshot({...baseline,base_today:[row]},'base').status,'ready');
  assert.match(rowMarkup(row,0,'base'),/來源未提供/);
});
test('sorting is isolated, stable on ties and missing values sort last',()=>{
  const rows=[{...baseRow,realized:null},{...baseRow,address:'0x'+'b'.repeat(40),realized:30,pnl:10},{...baseRow,address:'0x'+'c'.repeat(40),realized:30,pnl:20}];
  const before=JSON.stringify(rows);
  assert.deepEqual(rankRows(rows).map(r=>r.address),[rows[2].address,rows[1].address,rows[0].address]);
  assert.deepEqual(rankRows(rows,'pnl').map(r=>r.address),[rows[0].address,rows[2].address,rows[1].address]);
  assert.equal(JSON.stringify(rows),before);
});
test('source timestamp is displayed in Taipei regardless of source UTC offset',()=>{
  assert.match(formatStamp('2026-10-15T06:55:12Z'),/14:55:12/);
  assert.match(formatStamp('2026-10-15T06:55:12Z'),/台北/);
  assert.throws(()=>readBoardSnapshot({...flash,updated_at:'2026-10-15 14:00:00'},'flash'));
  assert.throws(()=>readBoardSnapshot({...flash,updated_at:'2099-10-17T10:43:10+08:00'},'flash'));
  assert.throws(()=>readBoardSnapshot({...baseline,updated_at:'2099-10-17T10:43:10+08:00'},'base'));
});
