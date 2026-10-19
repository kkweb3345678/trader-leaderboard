import {readFile,writeFile} from 'node:fs/promises';
import {escapeHtml as e,renderBlocks,safeUrl,external} from '../learn-render.js';
import {renderWidget} from '../learn-widgets.js';
import {leaderboardCTA} from '../learning-bridge.js';
import {glossary} from '../home-tools-data.js';
const root=new URL('../',import.meta.url);
const base='https://kkweb3345678.github.io/trader-leaderboard/';
const modified=process.argv[2];
if(!/^\d{4}-\d{2}-\d{2}$/.test(modified||'')) throw new Error('Usage: node scripts/build-seo.mjs YYYY-MM-DD (actual publication date)');
const data=JSON.parse(await readFile(new URL('learn-content.json',root),'utf8'));
const org={'@type':'Organization','@id':base+'#organization',name:'落袋研究室',url:base,logo:base+'assets/brand.svg',sameAs:['https://x.com/kkweb3345678']};
const chapterURL=item=>base+'learn-'+item.id+'.html';
const article=item=>({'@type':'Article','@id':chapterURL(item)+'#article',headline:item.title,description:item.description,inLanguage:'zh-TW',mainEntityOfPage:chapterURL(item),url:chapterURL(item),image:[base+'assets/social/home.png'],author:{'@type':'Organization',name:data.editor,url:base},publisher:{'@id':base+'#organization'},dateModified:data.reviewed_at});
const jsonLD=objects=>`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':objects}).replaceAll('<','\\u003c')}</script>`;
const pages=[
 {file:'index.html',title:'鏈上觀察與 Web3 工具｜落袋研究室',description:'落袋研究室：查看鏈上錢包排行榜、比較 Web3 錢包與交易所返佣，從白話課程、試算與詞典理解公開資料。',ogTitle:'鏈上數據、工具比較與學習資源｜落袋研究室',ogDescription:'看懂鏈上數據，找到適合你的工具。公開來源・非託管・逐項標示。',schema:[org,{'@type':'WebSite','@id':base+'#website',url:base,name:'落袋研究室',inLanguage:'zh-TW',publisher:{'@id':base+'#organization'}}]},
 {file:'wallets.html',title:'Web3 錢包比較｜落袋研究室',description:'Web3 錢包比較：查看內建兌換費率、公鏈與硬體支援，自訂比較欄位，點開官方來源與資料說明。'},
 {file:'tokens.html',title:'幣種交易明細｜落袋研究室',description:'從幣種查看哪些已收錄 Solana 錢包交易過，比較近七日買賣金額、次數與損益。按合約分開整理，清楚標示樣本範圍與來源時間。'},
 {file:'referral.html',title:'交易所返佣比較｜落袋研究室',description:'交易所返佣比較：整理現貨、合約返佣與適用門檻，逐家標示官方來源、基準日與待查證資訊，並揭露個人邀請連結。'},
 {file:'learn.html',title:'Web3 新手學習中心｜落袋研究室',description:'Web3 新手學習中心：從加密貨幣、錢包安全到鏈上資料閱讀，用繁體中文課程、圖解與練習逐章理解。',schema:[org,{'@type':'Course','@id':base+'learn.html#course',name:'Web3 入門與鏈上資料閱讀',description:'從加密貨幣基礎、錢包安全到鏈上資料閱讀的繁體中文自學內容。',inLanguage:'zh-TW',url:base+'learn.html',provider:{'@id':base+'#organization'},hasPart:data.lessons.map(item=>({'@type':'Article',headline:item.title,url:chapterURL(item)}))}]},
 {file:'privacy.html',title:'隱私說明｜落袋研究室',description:'了解落袋研究室如何使用 Google Analytics 瀏覽統計、本機閱讀進度與偏好，以及如何管理 Cookie 與外部邀請連結。'}
];
function metadata(page){
 const url=base+page.file,title=page.ogTitle||page.title,description=page.ogDescription||page.description;
 return `<!-- site-metadata:start -->
  <title>${e(page.title)}</title>
  <meta name="description" content="${e(page.description)}">
  <link rel="canonical" href="${url}">
  <link rel="alternate" hreflang="zh-TW" href="${url}">
  <meta property="og:type" content="${page.article?'article':'website'}">
  <meta property="og:locale" content="zh_TW">
  <meta property="og:site_name" content="落袋研究室">
  <meta property="og:title" content="${e(title)}">
  <meta property="og:description" content="${e(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${base}assets/social/home.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="落袋研究室 · 公開來源・非託管・逐項標示">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@kkweb3345678">
  <meta name="twitter:title" content="${e(title)}">
  <meta name="twitter:description" content="${e(description)}">
  <meta name="twitter:image" content="${base}assets/social/home.png">
  <meta name="twitter:image:alt" content="落袋研究室 · 公開來源・非託管・逐項標示">
  ${page.schema?jsonLD(page.schema):''}
  <!-- site-metadata:end -->`;
}
function enhance(html,page){
 html=html.replace(/\s*<!-- site-metadata:start -->[\s\S]*?<!-- site-metadata:end -->/g,'')
  .replace(/\s*<title>[\s\S]*?<\/title>/g,'')
  .replace(/\s*<meta\s+(?:name="(?:description|twitter:[^"]+)"|property="og:[^"]+")[^>]*>/g,'')
  .replace(/\s*<link\s+rel="(?:canonical|alternate)"[^>]*>/g,'');
 html=html.replace('</head>',`  ${metadata(page)}\n</head>`);
 if(!html.includes('src="./analytics.js'))html=html.replace('<meta charset="UTF-8">','<meta charset="UTF-8">\n  <script src="./analytics.js?v=1" defer></script>');
 if(!html.includes('href="./site-info.css'))html=html.replace('</head>','  <link rel="stylesheet" href="./site-info.css?v=1">\n</head>');
 if(!html.includes('href="./product-refinement.css'))html=html.replace('</head>','  <link rel="stylesheet" href="./product-refinement.css?v=polish-1">\n</head>');
 if(!html.includes('class="site-privacy-link"')) html=html.replace(/(<footer\b[\s\S]*?)(<\/footer>)/,(all,body,end)=>body+'<a class="site-privacy-link" href="./privacy.html">隱私說明</a>'+end);
 return html.replace(/[ \t]+$/gm,'');
}
const link=item=>'./learn-'+item.id+'.html';
function staticReader(item){
 const figure=item.illustration?`<figure class="learn-diagram"><img src="./assets/learn/${e(item.illustration.file)}.svg" width="600" height="${item.illustration.height||448}" alt="${e(item.illustration.alt)}"><figcaption>${e(item.illustration.caption)} · 落袋研究室原創製圖</figcaption></figure>`:'';
 const index=data.lessons.indexOf(item),prev=data.lessons[index-1],next=data.lessons[index+1];
 return `<nav class="learn-breadcrumb" aria-label="閱讀位置"><a href="./learn.html#catalog">學習中心</a><span aria-hidden="true">/</span><span>${e(item.category)}</span></nav>
 <div class="learn-reader-grid"><aside class="learn-sidebar"><h2>閱讀目錄</h2><nav aria-label="章節目錄">${data.lessons.map((l,i)=>`<a href="${link(l)}"${l.id===item.id?' aria-current="page"':''}><span>${String(i+1).padStart(2,'0')}</span><span>${e(l.title)}</span></a>`).join('')}</nav></aside>
 <article class="learn-reader-article"><header class="learn-reader-heading"><p class="learn-eyebrow">${e(item.category)} / FIELD NOTES</p><h1 tabindex="-1">${e(item.title)}</h1><p>${e(item.description)}</p><div class="learn-reader-meta"><span>${e(data.editor)} 編輯整理</span><span>校閱 <time datetime="${data.reviewed_at}">${data.reviewed_at}</time></span></div></header>
 <aside class="learn-takeaway"><strong>先記住這件事</strong><p>${e(item.takeaway)}</p></aside>${figure}
 <details class="learn-contents"><summary>這篇會讀到</summary><ul>${item.sections.map((s,i)=>`<li><a href="#lesson-section-${i}">${e(s.title)}</a></li>`).join('')}</ul></details>
 ${item.sections.map((s,i)=>`<section class="learn-article-section" id="lesson-section-${i}"><h2>${e(s.title)}</h2><div class="learn-prose">${s.blocks?renderBlocks(s.blocks,k=>renderWidget(k,data)):s.paragraphs.map(p=>`<p>${e(p)}</p>`).join('')}</div></section>`).join('')}
 <aside class="learn-practice"><h2>讀完，試著做一件事</h2><p>${e(item.practice)}</p><a href="${e(safeUrl(item.tool.url))}"${external(item.tool.url)}>${e(item.tool.label)} →</a></aside>
 ${item.sources.length?`<section class="learn-sources"><h2>來源與延伸閱讀</h2>${item.sources.map(s=>`<a href="${e(safeUrl(s.url))}"${external(s.url)}><span>${e(s.title)}</span><span aria-hidden="true">↗</span></a>`).join('')}</section>`:''}
 ${leaderboardCTA}<nav class="learn-pagination" aria-label="上一篇與下一篇"><a href="${prev?link(prev):'./learn.html#catalog'}"><small>← ${prev?'上一篇':'學習目錄'}</small>${prev?e(prev.title):'回到學習中心'}</a><a href="${next?link(next):'./learn.html#catalog'}"><small>${next?'下一篇':'學習目錄'} →</small>${next?e(next.title):'回到學習中心'}</a></nav></article></div>`.replace(/href="#lesson\/([a-z0-9-]+)(?:\?section=(\d+))?"/g,(_,id,section)=>`href="./learn-${id}.html${section===undefined?'':'#lesson-section-'+section}"`);
}
for(const page of pages){
 let html=await readFile(new URL(page.file,root),'utf8');
 html=html.replace('href="./site-info.css?v=1"','href="./site-info.css?v=2"');
 if(page.file==='index.html') html=html.replace(/<!-- glossary:start -->[\s\S]*?<!-- glossary:end -->/,`<!-- glossary:start -->${glossary.map((item,i)=>`<details data-term="${e(item.term)}"${i===0?' open':''}><summary>${e(item.term)}</summary><p>${e(item.meaning)}</p></details>`).join('')}<!-- glossary:end -->`);
 if(page.file==='learn.html'){
  html=html.replace(/src="\.\/learn\.js\?v=\d+"/, 'src="./learn.js?v=6"');
  html=html.replace(/<div id="learn-cards" class="learn-cards">[\s\S]*?<\/div><div id="learn-empty"/,`<div id="learn-cards" class="learn-cards">${data.lessons.map(l=>`<a class="learn-card" href="${link(l)}"><div><h3>${e(l.title)}</h3><p>${e(l.description)}</p></div></a>`).join('')}</div><div id="learn-empty"`);
  html=html.replace('<section id="learn-home" hidden>','<section id="learn-home">');
  html=html.replace(/<noscript>[\s\S]*?<\/noscript>/,`<noscript><style>#learn-loading,.learn-progress-strip,.learn-search,.learn-filter-row{display:none}</style><p>文章內容可直接閱讀；搜尋、測驗與閱讀進度需要 JavaScript。</p></noscript>`);
 }
 await writeFile(new URL(page.file,root),enhance(html,page));
}
const template=await readFile(new URL('learn.html',root),'utf8');
for(const item of data.lessons){
 const page={file:'learn-'+item.id+'.html',title:item.title+'｜Web3 學習中心・落袋研究室',description:item.description,article:true,schema:[org,article(item)]};
 let html=template.replace('<body class="learn-page">',`<body class="learn-page" data-initial-lesson="${item.id}">`)
  .replace('<div id="learn-loading" role="status">','<div id="learn-loading" role="status" hidden>')
  .replace('<section id="learn-home">','<section id="learn-home" hidden>')
  .replace('<section id="learn-reader" hidden></section>',`<section id="learn-reader">${staticReader(item)}</section>`);
 await writeFile(new URL(page.file,root),enhance(html,page));
 pages.push(page);
}
await writeFile(new URL('sitemap.xml',root),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p=>`  <url><loc>${base+p.file}</loc><lastmod>${modified}</lastmod></url>`).join('\n')}\n</urlset>\n`);
await writeFile(new URL('robots.txt',root),`User-agent: *\nAllow: /\n\nSitemap: ${base}sitemap.xml\n`);
let missing=await readFile(new URL('privacy.html',root),'utf8');
missing=missing.replace(/<main\b[\s\S]*?<\/main>/,`<main class="shell product-main info-page" id="main-content"><p class="page-eyebrow">404 / 找不到頁面</p><h1>這一頁，可能搬家了。</h1><p class="info-lede">連結可能已更新，或網址少了一個字。先回到熟悉的地方，繼續找你想看的資料。</p><div class="info-actions"><a class="button primary" href="${base}index.html">回到首頁 →</a><a class="button" href="${base}learn.html">前往學習中心</a></div></main>`)
 .replace('<head>',`<head>\n  <base href="${base}">\n  <meta name="robots" content="noindex">`);
await writeFile(new URL('404.html',root),enhance(missing,{file:'404.html',title:'找不到頁面｜落袋研究室',description:'連結可能已更新，回到落袋研究室首頁或 Web3 學習中心，繼續找你想看的資料。'}));
let demo=await readFile(new URL('v3-demo.html',root),'utf8');
if(!demo.includes('name="robots"')) demo=demo.replace('<head>','<head>\n<meta name="robots" content="noindex">');
await writeFile(new URL('v3-demo.html',root),enhance(demo,{file:'v3-demo.html',title:'首頁視覺打樣｜落袋研究室',description:'落袋研究室首頁視覺打樣，正式資料請以前往排行榜後顯示的來源與時間為準。'}));
console.log(JSON.stringify({pages:pages.length,lessons:data.lessons.length,lastmod:modified}));
