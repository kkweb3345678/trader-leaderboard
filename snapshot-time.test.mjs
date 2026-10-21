import test from 'node:test';
import assert from 'node:assert/strict';
import './snapshot-time.js';
import {compareSnapshots} from './home-data.js';
const state=(source,now,mode='full')=>globalThis.SnapshotTime.state(source,mode,Date.parse(now));
test('daily source waits for 08:00 Taipei without pretending that workflow failed',()=>{
  const source='2026-10-16T10:52:49+08:00';
  assert.equal(state(source,'2026-10-17T07:59:59+08:00').pending,false);
  const pending=state(source,'2026-10-17T08:00:00+08:00');
  assert.equal(pending.pending,true);assert.equal(pending.expected,'2026-10-17T00:00:00.000Z');
  // ICU versions may format the date/time separator as a thin space.
  assert.match(pending.message,/2026\/10\/17\s+08:00/);assert.match(pending.message,/排程可能延遲/);assert.ok(!pending.message.includes('失敗'));
  assert.equal(state('2026-10-17T10:52:49+08:00','2026-10-17T11:00:00+08:00').pending,false);
});
test('flash slots use 02, 14 and 20 Taipei including midnight and year rollover',()=>{
  const source='2026-10-17T04:27:26+08:00';
  assert.equal(state(source,'2026-10-17T13:59:59+08:00','flash').pending,false);
  assert.equal(state(source,'2026-10-17T14:00:00+08:00','flash').pending,true);
  assert.equal(state(source,'2026-10-17T20:00:00+08:00','flash').expected,'2026-10-17T12:00:00.000Z');
  assert.equal(state('2026-12-31T20:30:00+08:00','2027-01-01T01:59:00+08:00','flash').pending,false);
  assert.equal(state('2026-12-31T20:30:00+08:00','2027-01-01T02:00:00+08:00','flash').pending,true);
});
test('timestamps are source based, timezone stable and missing times are never healthy',()=>{
  const a=state('2026-10-16T20:27:26Z','2026-10-17T05:00:00+08:00','flash');
  const b=state('2026-10-17T04:27:26+08:00','2026-10-16T21:00:00Z','flash');
  assert.deepEqual(a,b);assert.match(a.asOf,/^2026\/10\/17\s+04:27$/);
  assert.equal(state(undefined,'2026-10-17T05:00:00Z').valid,false);
});

test('future or timezone-free source times cannot claim the latest slot is covered',()=>{
  assert.equal(state('2099-10-17T10:43:10+08:00','2026-10-17T15:00:00+08:00').valid,false);
  assert.equal(state('2026-10-17T10:43:10','2026-10-17T15:00:00+08:00').valid,false);
  assert.equal(state('2026-10-17T15:00:30+08:00','2026-10-17T15:00:00+08:00').valid,true);
});
test('rank movement reports shared composition separately from 97 new sample members',()=>{
  const chars='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const address=i=>'A'.repeat(30)+chars[Math.floor(i/58)]+chars[i%58];
  const rows=start=>Array.from({length:100},(_,i)=>({address:address(start+i),realized:100-i,pnl:100-i,trades:1}));
  const previous={full:true,stamp:'2026-10-15T02:00:00Z',data:{today:rows(0)}};
  const current={full:true,stamp:'2026-10-16T02:00:00Z',data:{today:rows(97)}};
  const pair=compareSnapshots(current,previous);
  assert.equal(pair.commonCount,3);assert.equal(pair.newcomers.length,97);
  assert.ok(pair.old.has(pair.biggest.row.address));assert.equal(pair.biggest.previousRank,98);assert.equal(pair.biggest.rank,1);
});
