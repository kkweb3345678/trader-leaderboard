import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import vm from 'node:vm';
const read=file=>readFile(new URL(file,import.meta.url),'utf8');
const data=JSON.parse(await read('learn-content.json'));
const base='https://kkweb3345678.github.io/trader-leaderboard/';
test('Every sitemap URL exists, has its own canonical and complete source metadata',async()=>{
 const sitemap=await read('sitemap.xml');
 const urls=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
 assert.equal(urls.length,6+data.lessons.length);assert.equal(new Set(urls).size,urls.length);
 const titles=new Set();
 for(const url of urls){
  assert.ok(url.startsWith(base));assert.ok(!url.includes('#'));
  const html=await read(url.slice(base.length));
  assert.equal((html.match(/<link rel="canonical"/g)||[]).length,1);
  assert.ok(html.includes(`<link rel="canonical" href="${url}">`));
  assert.ok(html.includes(`hreflang="zh-TW" href="${url}"`));
  assert.equal((html.match(/<meta name="description"/g)||[]).length,1);
  for(const property of ['og:title','og:description','og:url','og:image']) assert.ok(html.includes(`property="${property}"`),url+property);
  for(const name of ['twitter:card','twitter:title','twitter:description','twitter:image']) assert.ok(html.includes(`name="${name}"`),url+name);
  titles.add(html.match(/<title>(.*?)<\/title>/)[1]);
  assert.equal((html.match(/src="\.\/analytics.js\?v=1"/g)||[]).length,1);
  assert.match(html,/<footer\b[\s\S]*?class="site-privacy-link"/);
 }
 assert.equal(titles.size,urls.length);
 assert.ok(!sitemap.includes('404.html'));assert.ok(!sitemap.includes('v3-demo.html'));
 assert.match(await read('robots.txt'),/User-agent: \*\nAllow: \/\n/);
 assert.ok((await read('robots.txt')).includes(base+'sitemap.xml'));
});
test('All lesson pages contain their complete article before JavaScript',async()=>{
 for(const lesson of data.lessons){
  const html=await read('learn-'+lesson.id+'.html');
  const reader=html.split('<section id="learn-reader">')[1].split('<noscript>')[0];
  assert.ok(reader);
  assert.equal((reader.match(/class="learn-article-section"/g)||[]).length,lesson.sections.length);
  assert.ok(html.includes(`data-initial-lesson="${lesson.id}"`));
  const graph=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];
  const article=graph.find(o=>o['@type']==='Article');
  assert.equal(article.headline,lesson.title);assert.equal(article.description,lesson.description);
  assert.equal(article.url,base+'learn-'+lesson.id+'.html');
  assert.equal(article.dateModified,data.reviewed_at);
 }
 const graph=JSON.parse((await read('index.html')).match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];
 assert.ok(graph.some(o=>o['@type']==='WebSite'));assert.ok(graph.some(o=>o['@type']==='Organization'));
 assert.match(await read('learn.html'),/"@type":"Course"/);
});
test('All published HTML uses the shared tag, while demo and 404 are noindex',async()=>{
 for(const file of (await readdir(new URL('./',import.meta.url))).filter(f=>f.endsWith('.html'))){
  const html=await read(file);
  if(/^google[a-f0-9]+\.html$/.test(file)){assert.equal(html.trim(),'google-site-verification: '+file);continue;}
  assert.match(html,/analytics\.js\?v=1/);
  if(['v3-demo.html','malilion-style-demo.html','404.html'].includes(file))assert.match(html,/name="robots" content="noindex"/);
 }
});
test('GA initializes once, omits query and referrer details, and skips local previews',async()=>{
 const source=await read('analytics.js');
 function setup(host){
  const scripts=[];const window={};
  const context=vm.createContext({window,location:{hostname:host,pathname:'/trader-leaderboard/referral.html',origin:'https://'+host},URL,Date,document:{referrer:'https://search.example/query?email=private@example.com',querySelector:()=>({href:base+'referral.html'}),createElement:()=>({}),head:{append:s=>scripts.push(s)}}});
  vm.runInContext(source,context);vm.runInContext(source,context);return {window,scripts};
 }
 const {window,scripts}=setup('kkweb3345678.github.io');
 assert.equal(scripts.length,1);assert.equal(window.dataLayer.length,2);
 const config=window.dataLayer[1];assert.equal(config[0],'config');assert.equal(config[1],'G-QRGMXDPV7V');
 assert.equal(config[2].page_location,base+'referral.html');assert.equal(config[2].page_referrer,'https://search.example/');
 assert.equal(config[2].allow_google_signals,false);assert.equal(config[2].allow_ad_personalization_signals,false);
 assert.equal(setup('127.0.0.1').scripts.length,0);
});
