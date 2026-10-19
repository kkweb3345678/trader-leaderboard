import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateContent,parseRoute,sanitizeProgress,selectLessons,safeUrl,escapeHtml,readCatalogState,catalogHref,lessonHref} from './learn.js';
import {renderBlocks,calculateSpot,gradeQuiz} from './learn-render.js';
import {renderWidget} from './learn-widgets.js';
const data=JSON.parse(await readFile(new URL('./learn-content.json',import.meta.url),'utf8'));
test('Published learning paths and remaining reference links resolve',async()=>{
  assert.equal(validateContent(data),data);
  const broken=structuredClone(data);broken.paths[0].lessons.push('missing');assert.throws(()=>validateContent(broken));
  for(const lesson of data.lessons) for(const source of [...lesson.sources,lesson.tool]) {
    assert.equal(safeUrl(source.url),source.url);
    if(source.url.startsWith('./')) await readFile(new URL(source.url.split(/[?#]/)[0],import.meta.url));
  }
});
test('Search includes section content and composes with category and path ordering',()=>{
  const results=selectLessons(data,{query:'PnL 已實現',category:'本站指南'});
  assert.ok(results.length>0);assert.ok(results.every(l=>l.category==='本站指南'));
  assert.ok(selectLessons(data,{query:'Permit'}).some(l=>l.id==='security'));
  assert.deepEqual(selectLessons(data,{path:'start'}).map(l=>l.id),data.paths[0].lessons);
  assert.deepEqual(selectLessons(data,{query:'doesnotexist'}),[]);
});

test('Reading links retain a shareable catalog and return to the selected article',()=>{
  const filter={query:'PnL 已實現',category:'本站指南',path:null};
  const article=new URL(lessonHref('read-pnl',null,filter),'https://example.test/');
  const returnURL=new URL(catalogHref(readCatalogState(article.search,data),'read-pnl'),article);
  assert.deepEqual(readCatalogState(returnURL.search,data),filter);
  assert.equal(returnURL.searchParams.get('from'),'read-pnl');
  assert.equal(returnURL.pathname,'/learn.html');assert.equal(returnURL.hash,'#catalog');
  const path={query:'',category:'',path:'start'};
  const pathArticle=new URL(lessonHref('crypto-basics','start',path),article);
  assert.deepEqual(readCatalogState(pathArticle.search,data),path);
  assert.deepEqual(parseRoute(pathArticle.hash,data),{view:'lesson',id:'crypto-basics',path:'start'});
  assert.deepEqual(readCatalogState('?q=Permit&category=unknown&path=missing',data),{query:'Permit',category:'',path:null});
  assert.equal(readCatalogState('?q='+encodeURIComponent('字'.repeat(201)),data).query.length,200);
  const hostile=new URL(catalogHref({query:'\"<&>#',category:'',path:null}),article);
  assert.equal(readCatalogState(hostile.search,data).query,'\"<&>#');
  assert.equal(hostile.hash,'#catalog');
});
test('Deep links, missing lessons, paths and section anchors are unambiguous',()=>{
  assert.deepEqual(parseRoute('#lesson/crypto-basics?path=start&section=1',data),{view:'lesson',id:'crypto-basics',path:'start'});
  assert.equal(parseRoute('#lesson/missing',data).view,'missing');
  assert.equal(parseRoute('#path/missing',data).view,'missing');
  assert.deepEqual(parseRoute('#lesson/read-pnl?path=missing',data),{view:'lesson',id:'read-pnl',path:null});
  assert.equal(parseRoute('#lesson/read-pnl?path=start',data).path,null);
});
test('Saved progress drops unknown IDs and duplicate completions',()=>{
  assert.deepEqual(sanitizeProgress({done:['crypto-basics','missing','crypto-basics',42],last:'missing'},data),{done:['crypto-basics'],last:null});
  assert.deepEqual(sanitizeProgress(null,data),{done:[],last:null});
  assert.deepEqual(sanitizeProgress({done:'wallet-basics',last:'read-pnl'},data),{done:[],last:'read-pnl'});
});
test('Content links and text cannot introduce executable markup',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,test','//evil.test','./../test','./a/%2e%2e/b','./a/%','https://user:pass@host.test','http://test']) assert.equal(safeUrl(url),'#catalog');
  assert.equal(escapeHtml('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;');
});
test('Standalone learning navigation cannot be intercepted as a leaderboard view',async()=>{
  const shell=await readFile(new URL('./shell.js',import.meta.url),'utf8');
  assert.match(shell,/\['wallets','referral','learn'(?:,'[a-z]+')*\]/);
  const versions=[];
  for(const page of ['index.html','wallets.html','referral.html','learn.html','tokens.html']) {
    const html=await readFile(new URL(page,import.meta.url),'utf8');
    const script=html.match(/src="(\.\/shell\.js\?v=[^"]+)"/);assert.ok(script);
    versions.push(script[1]);
  }
  assert.equal(new Set(versions).size,1,'All pages load the same product navigation version');
});
const walk=nodes=>(nodes||[]).flatMap(n=>typeof n==='object'?[n,...walk(n.children)]:[]);
test('Authorized migration covers all 16 chapters and 131 sections with rendered content',async()=>{
  const manifest=JSON.parse(await readFile(new URL('./learn-migration.json',import.meta.url),'utf8'));
  assert.equal(manifest.chapters.length,16);assert.equal(manifest.chapters.reduce((sum,c)=>sum+c.source_sections,0),131);
  assert.equal(data.lessons.filter(l=>l.chapter).length,16);
  for(const chapter of manifest.chapters){
    const l=data.lessons.find(l=>l.id===chapter.target_id);
    assert.equal(l.sections.length,chapter.source_sections);assert.equal(chapter.source_sections,chapter.target_sections);
    for(const s of l.sections)assert.ok(renderBlocks(s.blocks,k=>renderWidget(k,data)).length>25,`${l.id}: ${s.title}`);
  }
  const json=JSON.stringify(data);assert.doesNotMatch(json,/BFSADLNM|I1GN6RMJ|0x496d22b3|partner\.bybit|debot\.ai\/r\//);
});
test('All migrated internal links resolve to real chapters and section indices',()=>{
  for(const l of data.lessons)for(const url of [l.tool.url,...l.sections.flatMap(s=>walk(s.blocks).filter(n=>n.tag==='a').map(n=>n.href))]){
    assert.equal(safeUrl(url),url);
    if(!url.startsWith('#lesson/'))continue;
    const route=parseRoute(url,data),target=data.lessons.find(l=>l.id===route.id);assert.ok(target,url);
    const section=new URLSearchParams(url.split('?')[1]||'').get('section');
    if(section!==null)assert.ok(Number(section)<target.sections.length,url);
  }
});
test('Rich prose preserves semantic tables, lists and links but cannot execute source markup',()=>{
  const html=renderBlocks([{tag:'p',children:['<script>x</script>',{tag:'a',href:'javascript:alert(1)',children:['link']}]},{tag:'script',children:['alert(1)']},{tag:'img',children:[]}]);
  assert.match(html,/&lt;script&gt;/);assert.match(html,/href="#catalog"/);assert.doesNotMatch(html,/<script|<img|javascript:/);
  const all=data.lessons.flatMap(l=>l.sections.flatMap(s=>walk(s.blocks)));
  // Counts independently compared against the authorized source snapshot.
  assert.equal(all.filter(n=>n.tag==='table').length,9);assert.equal(all.filter(n=>n.tag==='li').length,35);assert.equal(all.filter(n=>n.tag==='tr').length,99);
  const glossary=data.lessons.find(l=>l.id==='glossary');assert.equal(glossary.sections.flatMap(s=>walk(s.blocks)).filter(n=>n.tag==='tr').length,56);
  for(const n of all.filter(n=>n.widget))assert.ok(renderWidget(n.widget,data).length>100,n.widget);
});
test('All original diagrams exist and have accessible descriptions',async()=>{
  const illustrations=data.lessons.map(l=>l.illustration).filter(Boolean);assert.equal(illustrations.length,10);
  for(const img of illustrations){const svg=await readFile(new URL(`./assets/learn/${img.file}.svg`,import.meta.url),'utf8');assert.match(svg,/<title/);assert.match(svg,/<desc/);assert.ok(img.alt);assert.doesNotMatch(svg,/<image|<script/);}
});
test('Spot calculator handles gain, loss, zero sale, fees and grouped input',()=>{
  assert.deepEqual(calculateSpot({buy:'100',sell:'120',amount:'1,000',fees:'5'}),{quantity:10,proceeds:1200,net:195,percent:19.5});
  assert.equal(calculateSpot({buy:100,sell:80,amount:1000,fees:5}).net,-205);
  assert.equal(calculateSpot({buy:100,sell:0,amount:1000,fees:0}).percent,-100);
  assert.equal(calculateSpot({buy:100,sell:100,amount:1000,fees:0}).net,0);
  for(const invalid of ['','NaN','Infinity','1e309','1,2','-1','100abc']) assert.throws(()=>calculateSpot({buy:invalid,sell:120,amount:1000,fees:0}));
  assert.throws(()=>calculateSpot({buy:0,sell:1,amount:10,fees:0}));
  assert.throws(()=>calculateSpot({buy:'0.00000000000000001',sell:'1000000000000000',amount:1000,fees:0}));
});
test('Quiz evaluates unanswered and wrong selections independently',()=>{
  const perfect=gradeQuiz(data.quiz,data.quiz.map(q=>q.answer));assert.ok(perfect.every(q=>q.correct&&q.answered));
  const wrong=gradeQuiz(data.quiz,data.quiz.map(q=>1-q.answer));assert.ok(wrong.every(q=>!q.correct&&q.answered));
  assert.ok(gradeQuiz(data.quiz,[]).every(q=>!q.correct&&!q.answered));
  for(const q of data.quiz)assert.ok(data.lessons.some(l=>l.id===q.lesson));
});
