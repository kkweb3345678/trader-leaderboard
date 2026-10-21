import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {archiveCalendar} from './archive-calendar.js';
import {snapshotFiles,readArchive} from './home-data.js';
const now=Date.parse('2026-10-21T12:00:00+08:00');
const a={stamp:'2026-10-20T16:05:00Z',path:'one',full:true};
test('calendar uses Taipei source days across UTC midnight and always has seven slots',()=>{
  const days=archiveCalendar([a],[a],now);
  assert.equal(days.length,7);assert.equal(days[0].date,'2026-10-15');assert.equal(days[6].date,'2026-10-21');
  assert.equal(days[6].status,'available');assert.equal(days[5].status,'missing');
});
test('unread index or failed archive reads stay unknown; partial is never complete',()=>{
  assert.ok(archiveCalendar(null,[],now).every(d=>d.status==='unknown'));
  assert.equal(archiveCalendar([a],[],now).at(-1).status,'unknown');
  assert.equal(archiveCalendar([a],[{...a,full:false}],now).at(-1).status,'incomplete');
  assert.ok(archiveCalendar([],[],now).every(d=>d.status==='missing'));
});
test('same-day corrections count once and link the latest complete source',()=>{
  const b={...a,stamp:'2026-10-21T03:00:00Z',path:'two'},c={...b,stamp:'2026-10-21T03:01:00Z',path:'partial',full:false};
  const days=archiveCalendar([a,b,c],[a,b,c],now);
  assert.equal(days.filter(d=>d.status==='available').length,1);assert.equal(days.at(-1).path,'two');
});
test('old archives cannot fill recent missing days; window handles year boundary',()=>{
  const old={...a,stamp:'2026-09-21T00:00:00Z'};
  assert.ok(archiveCalendar([old],[old],now).every(d=>d.status==='missing'));
  const days=archiveCalendar([],[],Date.parse('2026-12-31T16:01:00Z'));
  assert.equal(days[0].date,'2026-12-26');assert.equal(days.at(-1).date,'2027-01-01');
});
test('real committed archive dates match calendar without supplementing absent days',()=>{
  const files=snapshotFiles(readdirSync(new URL('./snapshots/',import.meta.url)).map(p=>'snapshots/'+p),now);
  const loaded=files.map(f=>readArchive(JSON.parse(readFileSync(new URL(f.path,import.meta.url))),f));
  const days=archiveCalendar(files,loaded,now);
  assert.equal(days.find(d=>d.date==='2026-10-19').status,'missing');
  assert.equal(days.filter(d=>d.status==='available').length,6);
});
