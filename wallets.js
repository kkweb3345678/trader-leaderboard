'use strict';
(() => {
  window.ResearchShell.mount({active:'wallets'});
  const $ = id => document.getElementById(id);
  const gradeLabels = {A:'官方一手', B:'權威第三方', C:'一般第三方'};
  const walletLogoFiles = {
    metamask:'metamask.png',bitget:'bitget.png',okx:'okx.png',binance:'binance.png',
    phantom:'phantom.png',rabby:'rabby.png',trust:'trust.png',tokenpocket:'tokenpocket.png',imtoken:'imtoken.png'
  };
  const fallbackHints = {
    solana:'查看是否支援 Solana；不同裝置與功能請展開確認。',
    bridge:'查看內建或整合的跨鏈橋與服務提供方式。',
    staking:'查看內建質押或接入的協議，展開確認限制。',
    hardware:'查看硬體品牌與連線方式；觀察模式不等於直接連接簽名。',
    opensource:'查看開源範圍；部分模組公開不代表整個 App 開源。',
    key_mgmt:'查看助記詞、登入、密鑰管理與恢復方式。'
  };
  const shortHints = {
    swap_fee:'換幣時被抽多少',chains:'各家口徑可能不同',key_mgmt:'私鑰與登入怎麼管理',hardware:'能接哪些硬體',
    btc:'是否支援 Bitcoin',solana:'是否支援 Solana',bridge:'跨鏈如何完成',staking:'可用哪些質押功能',
    opensource:'程式公開到什麼範圍',audit:'審計範圍與公開報告',incidents:'事件範圍請展開確認',rewards:'當期資格與時效'
  };
  let data, tier = 'mainstream', sortKey = null, direction = 1;
  const columnStorageKey = 'research-wallet-columns-v1';
  let visibleKeys = [], collapsedKeys = [];
  const dimensionGroups = {
    default:['swap_fee','chains','key_mgmt','hardware'],
    all:null,
    cost:['swap_fee','chains','btc','solana','bridge'],
    use:['staking','hardware','key_mgmt','rewards'],
    security:['opensource','audit','incidents']
  };
  function orderedDimensions() {
    const first = dimensionGroups.default;
    return [...first.map(key => data.dimensions.find(dim => dim.key === key)).filter(Boolean),...data.dimensions.filter(dim => !first.includes(dim.key))];
  }
  function presetKeys(preset) {return dimensionGroups[preset] || data.dimensions.map(dim => dim.key);}
  function restoreColumns() {
    let saved;
    try {saved = JSON.parse(localStorage.getItem(columnStorageKey));} catch (_) {}
    const valid = Array.isArray(saved) ? data.dimensions.map(dim => dim.key).filter(key => saved.includes(key)) : [];
    visibleKeys = valid.length ? valid : presetKeys('default').filter(key => data.dimensions.some(dim => dim.key === key));
    if (!visibleKeys.length) visibleKeys = data.dimensions.map(dim => dim.key);
  }
  function columnPreset() {
    return Object.keys(dimensionGroups).find(preset => {
      const keys = presetKeys(preset);return keys.length === visibleKeys.length && keys.every(key => visibleKeys.includes(key));
    }) || 'custom';
  }
  function applyDimensionGroup() {
    for (const cell of $('wallet-table').querySelectorAll('[data-key]')) cell.hidden = !visibleKeys.includes(cell.dataset.key);
    $('dimension-group').value = columnPreset();
    $('columns-count').textContent = `${visibleKeys.length} / ${data.dimensions.length}`;
    const all = visibleKeys.length === data.dimensions.length;
    $('expand-columns').textContent = all ? '收合欄位 −' : `展開全部 ${data.dimensions.length} 個維度 ＋`;
    $('expand-columns').setAttribute('aria-expanded',String(all));
    updatePan();
  }
  function setColumns(keys) {
    const valid = data.dimensions.map(dim => dim.key).filter(key => keys.includes(key));
    if (!valid.length) return;
    if (valid.length === data.dimensions.length && visibleKeys.length < valid.length) collapsedKeys = [...visibleKeys];
    visibleKeys = valid;
    try {localStorage.setItem(columnStorageKey,JSON.stringify(visibleKeys));} catch (_) {}
    $('table-scroll').scrollLeft = 0;
    if (sortKey && !visibleKeys.includes(sortKey)) {sortKey = null;direction = 1;render();}
    else applyDimensionGroup();
  }
  function updateColumnDraft() {
    const count = $('column-options').querySelectorAll('input:checked').length;
    $('column-selection-count').textContent = `已選 ${count} / ${data.dimensions.length} 欄`;
    $('column-error').textContent = count ? '' : '請至少保留一個比較欄位。';
    $('columns-apply').disabled = !count;
  }
  function setColumnDraft(keys) {
    for (const input of $('column-options').querySelectorAll('input')) input.checked = keys.includes(input.value);
    updateColumnDraft();
  }
  function buildColumnPicker() {
    $('column-options').replaceChildren();
    const groups = [['cost','費用與公鏈'],['use','使用與管理'],['security','安全與紀錄']];
    const groupedKeys = groups.flatMap(([key]) => dimensionGroups[key]);
    if (data.dimensions.some(dim => !groupedKeys.includes(dim.key))) groups.push(['other','其他欄位']);
    for (const [group,label] of groups) {
      const fieldset = node('fieldset');fieldset.append(node('legend',label));
      const grid = node('div',undefined,'column-option-grid');
      for (const dim of data.dimensions.filter(dim => group === 'other' ? !groupedKeys.includes(dim.key) : dimensionGroups[group].includes(dim.key))) {
        const option = node('label');const input = node('input');input.type = 'checkbox';input.value = dim.key;
        option.append(input,node('span',dim.label));grid.append(option);
      }
      fieldset.append(grid);$('column-options').append(fieldset);
    }
    setColumnDraft(visibleKeys);
  }
  function openColumnPicker() {
    if (!data) return;
    setColumnDraft(visibleKeys);$('column-dialog').showModal();
  }
  function updatePan() {
    const scroll = $('table-scroll');
    document.querySelector('.table-pan').hidden = scroll.scrollWidth <= scroll.clientWidth + 1;
    $('pan-left').disabled = scroll.scrollLeft <= 1;
    $('pan-right').disabled = scroll.scrollLeft + scroll.clientWidth >= scroll.scrollWidth - 1;
  }
  const collator = new Intl.Collator('zh-Hant', {numeric:true});
  function node(tag, text, cls) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (cls) element.className = cls;
    return element;
  }
  function isUnknown(value) {return /官網未揭露|待查證/.test(value.d);}
  function numericValue(value, key) {
    if (['audit','incidents','rewards','key_mgmt','opensource'].includes(key)) return null;
    const text = value.d.trim();
    if (key === 'swap_fee') {
      if (/目前不收/.test(text)) return 0;
      const range = text.match(/^(\d+(?:\.\d+)?)%[–—-](\d+(?:\.\d+)?)%/);
      if (range) return Number(range[2]);
      const fee = text.match(/^(\d+(?:\.\d+)?)%/);
      return fee ? Number(fee[1]) : null;
    }
    const number = text.match(/^(\d+(?:\.\d+)?)\+?(?:\s*(?:款|家|份報告|選項))?$/);
    return number ? Number(number[1]) : null;
  }
  function compareWallets(a,b) {
    if (!sortKey) return 0;
    const av = a.values[sortKey], bv = b.values[sortKey];
    if (isUnknown(av) !== isUnknown(bv)) return isUnknown(av) ? 1 : -1;
    const an = numericValue(av,sortKey), bn = numericValue(bv,sortKey);
    // Numeric and textual groups stay separate, giving a transitive sort for mixed columns.
    if ((an === null) !== (bn === null)) return an === null ? 1 : -1;
    const order = an !== null ? an-bn : collator.compare(av.d,bv.d);
    return direction*order || collator.compare(a.name,b.name);
  }
  function buildHeader() {
    const row = node('tr');
    const name = node('th','錢包');name.scope = 'col';row.append(name);
    for (const dim of orderedDimensions()) {
      const th = node('th');th.scope = 'col';th.dataset.key = dim.key;
      const button = node('button',undefined,'sort-button');button.type = 'button';
      button.append(node('span',dim.label),node('span','↕','sort-arrow'));
      button.addEventListener('click',() => {
        direction = sortKey === dim.key ? -direction : 1;sortKey = dim.key;render();
      });
      const hint = dim.hint || fallbackHints[dim.key] || '展開查看公開資料與適用範圍。';
      const help = node('details',undefined,'dim-help');const summary = node('summary',shortHints[dim.key] || '查看欄位說明');summary.title = hint;
      summary.setAttribute('aria-label',`${dim.label}：欄位說明`);
      help.append(summary,node('p',hint));th.append(button,help);row.append(th);
    }
    $('wallet-head').replaceChildren(row);
  }
  function render() {
    const wallets = data.wallets.filter(w => tier === 'all' || w.tier === 1).slice().sort(compareWallets);
    const fragment = document.createDocumentFragment();
    for (const wallet of wallets) {
      const row = node('tr');row.dataset.wallet = wallet.id;
      const heading = node('th');heading.scope = 'row';heading.id = 'wallet-'+wallet.id;
      const name = node('a');name.href = '#wallet-'+wallet.id;
      const identity = node('span');identity.append(node('strong',wallet.name),node('small',`Tier ${wallet.tier}${wallet.alias ? ' · '+wallet.alias : ''}`));
      const mark = node('span',wallet.name.slice(0,1),'wallet-logo wallet-logo-fallback');mark.setAttribute('aria-hidden','true');
      if (walletLogoFiles[wallet.id]) {
        const image = node('img');image.src = './assets/wallets/'+walletLogoFiles[wallet.id];image.alt = '';image.width = 32;image.height = 32;image.decoding = 'async';
        image.addEventListener('error',() => {mark.replaceChildren(document.createTextNode(wallet.name.slice(0,1)));mark.classList.add('wallet-logo-fallback');},{once:true});
        mark.replaceChildren(image);mark.classList.remove('wallet-logo-fallback');
      }
      name.append(mark,identity);heading.append(name);row.append(heading);
      for (const dim of orderedDimensions()) {
        const value = wallet.values[dim.key];const cell = node('td');cell.dataset.key = dim.key;
        const details = node('details',undefined,'wallet-cell'+(isUnknown(value) ? ' unknown' : ''));
        const summary = node('summary');summary.setAttribute('aria-label',`${wallet.name}，${dim.label}：${value.d}，展開詳細說明`);
        const grade = node('span',value.g,'grade grade-'+value.g.toLowerCase());grade.title = gradeLabels[value.g];grade.setAttribute('aria-label',gradeLabels[value.g]);
        const plus = node('span','+','cell-expand');plus.setAttribute('aria-hidden','true');
        summary.append(node('span',value.d,'cell-display'+(/^[\d]/.test(value.d) ? ' numeric' : '')),grade,plus);
        details.append(summary,node('p',value.t || '附件未提供補充說明；請以顯示值為準。'));
        if (isUnknown(value)) details.append(node('p',`來源 ${value.g} · ${gradeLabels[value.g]}`,'unknown-source'));
        cell.append(details);row.append(cell);
      }
      fragment.append(row);
    }
    $('wallet-rows').replaceChildren(fragment);
    for (const th of $('wallet-head').querySelectorAll('[data-key]')) {
      const active = th.dataset.key === sortKey;
      if (active) th.setAttribute('aria-sort',direction === 1 ? 'ascending' : 'descending');else th.removeAttribute('aria-sort');
      th.querySelector('.sort-arrow').textContent = active ? (direction === 1 ? '↑' : '↓') : '↕';
      th.querySelector('button').setAttribute('aria-label',`${th.querySelector('button span').textContent}，點擊${active && direction === 1 ? '降冪' : '升冪'}排序`);
    }
    $('result-count').textContent = `顯示 ${wallets.length} / ${data.wallets.length} 個錢包`;
    $('sort-status').textContent = sortKey ? `${data.dimensions.find(d => d.key === sortKey).label} · ${direction === 1 ? '升冪' : '降冪'}${['incidents','audit'].includes(sortKey) ? '（文字排序，非安全排名）' : ''}` : '依資料順序顯示';
    applyDimensionGroup();
  }
  function recommend(form) {
    const experience = form.get('experience'), chain = form.get('chain'), hardware = form.get('hardware');
    const candidates = data.wallets.filter(wallet => {
      const values = wallet.values;
      if (chain !== 'evm' && values[chain].d !== '是') return false;
      // Every supplied wallet explicitly lists Ethereum / ETH / EVM in its own data.
      if (chain === 'evm' && !Object.values(values).some(v => /\bETH\b|Ethereum|EVM/.test(v.d+' '+v.t))) return false;
      if (hardware === 'yes' && (/^無|未揭露|待查證/.test(values.hardware.d) || !values.hardware.d)) return false;
      return true;
    }).map(wallet => {
      const values = wallet.values;
      const easierLogin = /社交登入|Google|Apple|MPC/.test(values.key_mgmt.d+' '+values.key_mgmt.t);
      const fullyOpen = /^是/.test(values.opensource.d);
      const score = (experience === 'new' ? (easierLogin ? 3 : 0) : (fullyOpen ? 3 : 0)) + (wallet.tier === 1 ? 1 : 0);
      const parts = [chain === 'evm' ? '附件列有 Ethereum／EVM 使用方式' : `支援 ${chain === 'solana' ? 'Solana' : 'Bitcoin'}`];
      if (experience === 'new' && easierLogin) parts.push(`密鑰／登入方式為「${values.key_mgmt.d}」`);
      else if (experience === 'advanced' && fullyOpen) parts.push(`開源欄標示「${values.opensource.d}」`);
      else parts.push(`密鑰方式為「${values.key_mgmt.d}」`);
      if (hardware === 'yes') parts.push(`硬體支援標示「${values.hardware.d}」，請確認型號與平台`);
      return {wallet,score,reason:parts.join('；')+'。'};
    }).sort((a,b) => b.score-a.score || data.wallets.indexOf(a.wallet)-data.wallets.indexOf(b.wallet)).slice(0,2);
    const result = $('quiz-results');result.replaceChildren();
    if (!candidates.length) {result.append(node('p','目前附件沒有符合所有條件的錢包，請調整需求或查閱對照表。'));return;}
    result.append(node('p','可以先研究這些錢包：','muted'));
    for (const {wallet,reason} of candidates) {
      const article = node('article',undefined,'recommendation');const link = node('a','到表格查看完整資料 →');link.href = '#wallet-'+wallet.id;
      link.addEventListener('click',() => {
        tier = 'all';updateTier();render();
        $('table-scroll').scrollLeft = 0;
      });
      article.append(node('h3',wallet.name),node('p',reason),link);result.append(article);
    }
  }
  function updateTier() {for (const button of document.querySelectorAll('[data-tier]')) button.setAttribute('aria-pressed',String(button.dataset.tier === tier));}
  // Presentation-only step state; recommend() retains the existing matching rules.
  const quizSteps = [...$('quiz-form').querySelectorAll('.quiz-step')];
  let quizStep = 0;
  function showQuizStep(step,focus=false) {
    quizStep = step;
    const complete = step === quizSteps.length;
    quizSteps.forEach((fieldset,index) => {fieldset.hidden = index !== step;});
    $('quiz-results').hidden = !complete;
    $('quiz-error').hidden = true;
    $('quiz-back').hidden = step === 0;
    $('quiz-back').textContent = complete ? '← 修改答案' : '← 上一題';
    $('quiz-next').hidden = step >= quizSteps.length - 1;
    $('recommend').hidden = step !== quizSteps.length - 1;
    $('quiz-reset').hidden = !complete;
    $('quiz-progress-label').textContent = complete ? '配對完成' : `第 ${step+1} 題 / 共 ${quizSteps.length} 題`;
    $('quiz-progress').max = quizSteps.length;
    $('quiz-progress').value = complete ? quizSteps.length : step+1;
    if (focus) (complete ? $('quiz-results') : quizSteps[step].querySelector('legend')).focus();
  }
  function answerSelected() {
    if (quizSteps[quizStep]?.querySelector('input:checked')) return true;
    $('quiz-error').hidden = false;
    quizSteps[quizStep]?.querySelector('input').focus();
    return false;
  }
  function nextQuestion() {if (data && answerSelected()) showQuizStep(quizStep+1,true);}
  $('quiz-next').addEventListener('click',nextQuestion);
  $('quiz-back').addEventListener('click',() => showQuizStep(Math.max(0,quizStep-1),true));
  $('quiz-form').addEventListener('change',() => {$('quiz-error').hidden = true;});
  $('quiz-link').textContent = `先做 ${quizSteps.length} 題小測驗 →`;
  $('quiz-description').textContent = `回答 ${quizSteps.length} 個問題，用公開功能做規則式配對。不做安全評分或排名。`;
  document.querySelectorAll('[data-section-label]').forEach((label,index) => {label.textContent = `${String(index+1).padStart(2,'0')} — ${label.dataset.sectionLabel}`;});
  showQuizStep(0);
  function validate(raw) {
    if (!raw || !Array.isArray(raw.wallets) || !raw.wallets.length || !Array.isArray(raw.dimensions) || !raw.dimensions.length || !/^\d{4}-\d{2}-\d{2}$/.test(raw.updated_at) || typeof raw.disclaimer !== 'string' || typeof raw.baseline_note !== 'string') throw Error('資料結構不完整');
    const keys = raw.dimensions.map(d => d.key), ids = raw.wallets.map(w => w.id);
    if (new Set(keys).size !== keys.length || new Set(ids).size !== ids.length || raw.dimensions.some(d => typeof d.label !== 'string' || typeof d.hint !== 'string')) throw Error('欄位不完整或重複');
    if (raw.wallets.some(w => !/^[a-z][a-z0-9-]*$/.test(w.id) || typeof w.name !== 'string' || typeof w.alias !== 'string' || ![1,2].includes(w.tier) || keys.some(key => !w.values?.[key] || typeof w.values[key].d !== 'string' || typeof w.values[key].t !== 'string' || !gradeLabels[w.values[key].g]))) throw Error('錢包欄位不完整');
    return raw;
  }
  async function load() {
    $('load-error').hidden = true;$('table-scroll').setAttribute('aria-busy','true');
    try {
      const response = await fetch('./wallets.json', {cache:'no-cache', signal:AbortSignal.timeout(12000)});
      if (!response.ok) throw Error('HTTP '+response.status);
      data = validate(await response.json());
      window.ResearchShell.setSourceDate(data.updated_at,'資料基準');
      $('baseline').textContent = data.updated_at;$('baseline').dateTime = data.updated_at;
      $('footer-baseline').textContent = data.updated_at;$('footer-baseline').dateTime = data.updated_at;
      $('wallet-total').textContent = data.wallets.length;$('dimension-total').textContent = data.dimensions.length;
      $('coverage').textContent = `${data.wallets.length} 款 Web3 錢包 × ${data.dimensions.length} 個維度。公開來源，逐項標示。不做安全排名，只把資料攤開給你看。`;
      const tiers = [...new Set(data.wallets.map(w => w.tier))].sort();
      document.querySelector('[data-tier="mainstream"]').textContent = `Tier ${tiers[0]} 主流（${data.wallets.filter(w => w.tier === tiers[0]).length}）`;
      document.querySelector('[data-tier="all"]').textContent = `全部（${data.wallets.length}）`;
      $('baseline-note').textContent = data.baseline_note;$('disclaimer').textContent = data.disclaimer;
      restoreColumns();buildColumnPicker();buildHeader();render();
      for (const button of document.querySelectorAll('[data-tier], #recommend, #quiz-next, #expand-columns, #customize-columns, #dimension-group')) button.disabled = false;
    } catch (error) {
      $('load-error').hidden = false;$('result-count').textContent = '尚未載入資料';
      $('load-error').querySelector('p').textContent = '資料暫時無法讀取或格式不完整，請重新讀取。';
    } finally {$('table-scroll').setAttribute('aria-busy','false');}
  }
  for (const button of document.querySelectorAll('[data-tier]')) button.addEventListener('click',() => {tier = button.dataset.tier;updateTier();render();});
  $('quiz-form').addEventListener('submit',event => {
    event.preventDefault();if (!data || quizStep === quizSteps.length) return;
    if (quizStep < quizSteps.length-1) {nextQuestion();return;}
    const missing = quizSteps.findIndex(step => !step.querySelector('input:checked'));
    if (missing !== -1) {showQuizStep(missing);answerSelected();return;}
    recommend(new FormData(event.target));showQuizStep(quizSteps.length,true);
  });
  $('quiz-form').addEventListener('reset',() => {queueMicrotask(() => {$('quiz-results').replaceChildren();showQuizStep(0,true);});});
  $('retry').addEventListener('click',load);
  $('dimension-group').addEventListener('change',() => {
    if (!data) return;
    const preset = $('dimension-group').value;
    if (preset === 'custom') {$('dimension-group').value = columnPreset();openColumnPicker();}
    else setColumns(presetKeys(preset));
  });
  $('customize-columns').addEventListener('click',openColumnPicker);
  $('expand-columns').addEventListener('click',() => {
    if (!data) return;
    if (visibleKeys.length === data.dimensions.length) setColumns(collapsedKeys.length ? collapsedKeys : presetKeys('default'));
    else {collapsedKeys = [...visibleKeys];setColumns(presetKeys('all'));}
  });
  $('column-options').addEventListener('change',updateColumnDraft);
  $('columns-all').addEventListener('click',() => setColumnDraft(presetKeys('all')));
  $('columns-default').addEventListener('click',() => setColumnDraft(presetKeys('default')));
  for (const id of ['column-close','column-cancel']) $(id).addEventListener('click',() => $('column-dialog').close());
  $('column-form').addEventListener('submit',event => {
    event.preventDefault();
    const keys = [...$('column-options').querySelectorAll('input:checked')].map(input => input.value);
    if (!keys.length) return;
    setColumns(keys);$('column-dialog').close();
  });
  for (const [id,sign] of [['pan-left',-1],['pan-right',1]]) $(id).addEventListener('click',() => {
    $('table-scroll').scrollBy({left:sign*Math.max(180,$('table-scroll').clientWidth*.65),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  });
  $('table-scroll').addEventListener('scroll',updatePan,{passive:true});
  window.addEventListener('resize',updatePan);
  load();
})();
