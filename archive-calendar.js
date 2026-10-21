// Display-only calendar. A source day is available only after reading a complete archive.
import {dayKey} from './home-data.js?v=5';
export function archiveCalendar(files,loaded,now=Date.now()) {
  const today=dayKey(now),end=Date.parse(today+'T12:00:00+08:00');
  return Array.from({length:7},(_,i)=>{
    const date=dayKey(end-(6-i)*86400000);
    const known=files?.filter(f=>dayKey(f.stamp)===date)||[];
    const verified=loaded.filter(f=>dayKey(f.stamp)===date);
    const complete=verified.filter(f=>f.full).sort((a,b)=>Date.parse(b.stamp)-Date.parse(a.stamp))[0];
    if(complete)return {date,status:'available',path:complete.path,stamp:complete.stamp};
    if(!files||known.some(f=>!verified.some(s=>s.path===f.path)))return {date,status:'unknown'};
    return {date,status:known.length?'incomplete':'missing'};
  });
}
