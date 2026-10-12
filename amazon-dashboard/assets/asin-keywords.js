const state = {
  staticData: window.ASIN_KEYWORD_DATA || { asins: {} },
  rows: [],
  xydc: null,
  asin: '',
  loading: false
};

const els = {
  asinInput: document.getElementById('asinInput'),
  searchButton: document.getElementById('searchButton'),
  demoButton: document.getElementById('demoButton'),
  statusLine: document.getElementById('statusLine'),
  xydcStatusLine: document.getElementById('xydcStatusLine'),
  summaryGrid: document.getElementById('summaryGrid'),
  keywordBuckets: document.getElementById('keywordBuckets'),
  resultMeta: document.getElementById('resultMeta'),
  siteFilter: document.getElementById('siteFilter'),
  layoutFilter: document.getElementById('layoutFilter'),
  keywordRows: document.getElementById('keywordRows'),
  copySuggestions: document.getElementById('copySuggestions'),
  adSuggestions: document.getElementById('adSuggestions'),
  xydcMeta: document.getElementById('xydcMeta'),
  xydcRows: document.getElementById('xydcRows'),
  xydcDebug: document.getElementById('xydcDebug')
};

const hasBackendApi = isLocalHost() || Boolean(window.ASIN_KEYWORD_API_BASE);
const apiBase = window.ASIN_KEYWORD_API_BASE || '';

init();

function init() {
  els.searchButton.addEventListener('click', runSearch);
  els.asinInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') runSearch();
  });
  els.demoButton.addEventListener('click', () => {
    const sample = firstSampleAsin();
    if (sample) {
      els.asinInput.value = sample;
      runSearch();
    }
  });
  els.siteFilter.addEventListener('change', render);
  els.layoutFilter.addEventListener('change', render);
  renderEmpty();
}

async function runSearch() {
  const asin = normalizeAsin(els.asinInput.value);
  if (!asin) {
    setStatus('请输入 ASIN。', 'warn');
    return;
  }

  state.asin = asin;
  state.loading = true;
  state.xydc = null;
  setStatus(`正在查询 ${asin} ... 本地全量模式可能需要 1-2 分钟。`);
  setXydcStatus('西柚洞察：正在尝试补充查询...');
  renderEmpty('查询中...');

  try {
    const [apiRows, xydcPayload] = await Promise.all([
      hasBackendApi ? fetchFromLocalApi(asin).catch(() => null) : Promise.resolve(null),
      hasBackendApi
        ? fetchXydcSupplement(asin).catch((error) => ({ status: 'unavailable', rows: [], message: error.message }))
        : Promise.resolve({
          status: 'static',
          rows: [],
          message: '线上静态版不会直连西柚洞察；需要后端代理后可启用实时补充。'
        }),
    ]);
    const localRows = Array.isArray(apiRows) ? apiRows : [];
    state.xydc = xydcPayload;
    state.rows = localRows.length ? localRows : rowsFromStaticData(asin);
    setStatus(apiRows?.length
      ? `已从本地 ABA 原始 CSV 查询 ${asin}。`
      : `未连接本地全量 API，已使用 GitHub 静态数据查询 ${asin}。`);
    setXydcStatus(xydcStatusText(xydcPayload));
  } catch (error) {
    state.rows = rowsFromStaticData(asin);
    setStatus(`本地 API 不可用，已使用静态数据。${state.rows.length ? '' : '该 ASIN 暂无静态记录。'}`);
    setXydcStatus('西柚洞察：未完成补充查询。');
  } finally {
    state.loading = false;
    render();
  }
}

async function fetchFromLocalApi(asin) {
  const response = await fetch(`${apiBase}/api/asin-keywords?asin=${encodeURIComponent(asin)}`);
  if (!response.ok) throw new Error('Local API unavailable');
  const payload = await response.json();
  return Array.isArray(payload.rows) ? payload.rows : [];
}

async function fetchXydcSupplement(asin) {
  const response = await fetch(`${apiBase}/api/xydc-keywords?asin=${encodeURIComponent(asin)}&marketplace=US`);
  if (!response.ok) throw new Error('XYDC API unavailable');
  return response.json();
}

function rowsFromStaticData(asin) {
  return state.staticData.asins?.[asin]?.rows || [];
}

function render() {
  const rows = filteredRows();
  renderSiteFilter();
  renderSummary(rows);
  renderKeywordBuckets(rows);
  renderTable(rows);
  renderSuggestions(rows);
  renderXydc();
  els.resultMeta.textContent = state.asin
    ? `${state.asin}：${state.rows.length} 个来源关键词，当前显示 ${rows.length} 个`
    : '等待查询';
}

function renderXydc() {
  const payload = state.xydc;
  if (!payload) {
    els.xydcMeta.textContent = '用于补充 ABA 没命中的 ASIN：自然排名、广告排名、流量词等。';
    els.xydcRows.innerHTML = '<tr><td colspan="7" class="empty">等待查询</td></tr>';
    els.xydcDebug.textContent = '等待查询';
    return;
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  els.xydcMeta.textContent = payload.message || `西柚洞察：${rows.length} 条补充关键词`;
  els.xydcRows.innerHTML = rows.length
    ? rows.slice(0, 200).map((row) => `
      <tr>
        <td>${escapeHtml(row.term || '-')}</td>
        <td>${escapeHtml(row.searchVolume || '-')}</td>
        <td>${escapeHtml(formatMaybePercent(row.trafficShare))}</td>
        <td>${escapeHtml(row.organicRank || '-')}</td>
        <td>${escapeHtml(row.adRank || '-')}</td>
        <td>${escapeHtml(formatAdState(row.ad))}</td>
        <td>${escapeHtml(row.source || '西柚洞察')}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="7" class="empty">暂无可展示的西柚补充词。可展开调试信息查看工具状态。</td></tr>';

  els.xydcDebug.textContent = JSON.stringify({
    status: payload.status,
    message: payload.message,
    tool: payload.tool,
    attempts: payload.attempts,
    tools: payload.tools,
    rawText: payload.rawText,
  }, null, 2);
}

function renderSiteFilter() {
  const current = els.siteFilter.value;
  const sites = [...new Set(state.rows.map((row) => row.site).filter(Boolean))].sort();
  els.siteFilter.innerHTML = '<option value="">全部站点</option>' + sites.map((site) => (
    `<option value="${escapeHtml(site)}">${escapeHtml(site)}</option>`
  )).join('');
  els.siteFilter.value = sites.includes(current) ? current : '';
}

function renderSummary(rows) {
  const sites = new Set(rows.map((row) => row.site).filter(Boolean)).size;
  const bestRank = min(rows.map((row) => number(row.rank)).filter(Boolean));
  const avgShare = average(rows.map((row) => number(row.clickShare)).filter(Boolean));
  const copyCount = rows.filter((row) => row.layout === '文案+广告').length;
  const adCount = rows.filter((row) => row.layout !== '谨慎观察').length;
  const metrics = [
    ['关键词数', rows.length || '-'],
    ['覆盖站点', sites || '-'],
    ['最好搜索排名', bestRank || '-'],
    ['平均点击份额', avgShare ? `${avgShare.toFixed(2)}%` : '-'],
    ['可布局词', `${copyCount} / ${adCount}`]
  ];
  els.summaryGrid.innerHTML = metrics.map(([label, value]) => (
    `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`
  )).join('');
}

function renderKeywordBuckets(rows) {
  const xydcRows = Array.isArray(state.xydc?.rows) ? state.xydc.rows : [];
  const adRows = xydcRows.filter((row) => row.adRank || row.ad === true || row.ad === 'true' || row.ad === 1 || row.ad === '1');
  const organicRows = xydcRows.filter((row) => row.organicRank);
  const sourceRows = rows.filter((row) => number(row.clickShare) > 0);
  const copyRows = rows.filter((row) => row.layout === '文案+广告');
  const testRows = rows.filter((row) => row.layout === '广告测试');
  const riskyRows = rows.filter((row) => row.layout === '谨慎观察' || row.competition === '高');
  const stealRows = rows.filter((row) => row.layout !== '谨慎观察' && number(row.rank) > 300 && number(row.clickShare) < 35);

  const buckets = [
    {
      title: '流量来源词',
      meta: 'ABA 点击来源',
      rows: sourceRows,
      terms: topTerms(sourceRows, 10),
    },
    {
      title: '自然排名词',
      meta: '西柚自然位',
      rows: organicRows,
      terms: xydcTerms(organicRows, 10),
    },
    {
      title: '广告投放词',
      meta: '西柚广告位',
      rows: adRows,
      terms: xydcTerms(adRows, 10),
    },
    {
      title: '可抢竞品词',
      meta: '低/中竞争机会',
      rows: stealRows,
      terms: topTerms(stealRows, 10),
    },
    {
      title: '文案必布局词',
      meta: '标题/五点/A+',
      rows: copyRows,
      terms: topTerms(copyRows, 10),
    },
    {
      title: '广告测试词',
      meta: '精准/词组测试',
      rows: testRows,
      terms: topTerms(testRows, 10),
    },
    {
      title: '高竞争慎入词',
      meta: '先观察或低预算',
      rows: riskyRows,
      terms: topTerms(riskyRows, 10),
    },
  ];

  els.keywordBuckets.innerHTML = buckets.map((bucket) => `
    <article class="bucket-card">
      <div class="bucket-head">
        <div>
          <h3>${escapeHtml(bucket.title)}</h3>
          <p>${escapeHtml(bucket.meta)}</p>
        </div>
        <strong>${bucket.rows.length || '-'}</strong>
      </div>
      <div class="mini-tags">
        ${bucket.terms.length
          ? bucket.terms.map((term) => `<span>${escapeHtml(term)}</span>`).join('')
          : '<em>暂无数据</em>'}
      </div>
    </article>
  `).join('');
}

function renderTable(rows) {
  if (!rows.length) {
    const message = state.asin
      ? `${state.asin} 在当前 ABA 数据中没有命中。可能原因：没有进入任一关键词的点击前三商品、站点/周次不在当前数据范围内，或需要卖家精灵/Helium 10/前台排名采集补充。`
      : '没有找到记录。可启动本地服务查全量 CSV，或先生成静态索引。';
    els.keywordRows.innerHTML = `<tr><td colspan="9" class="empty">${escapeHtml(message)}</td></tr>`;
    return;
  }

  els.keywordRows.innerHTML = rows.slice(0, 300).map((row) => `
    <tr>
      <td>${escapeHtml(row.site || '-')}</td>
      <td>${escapeHtml(row.term || '-')}</td>
      <td>${formatRank(row.rank)}</td>
      <td>${escapeHtml(row.position || '-')}</td>
      <td>${formatPercentNumber(row.clickShare)}</td>
      <td>${formatPercentNumber(row.conversionShare)}</td>
      <td>${riskBadge(row.competition || '-')}</td>
      <td>${layoutBadge(row.layout || '-')}</td>
      <td><div class="asin-stack">${(row.competitors || []).map(escapeHtml).join('<br>') || '-'}</div></td>
    </tr>
  `).join('');
}

function renderSuggestions(rows) {
  const copyTerms = topTerms(rows.filter((row) => row.layout === '文案+广告'), 16);
  const adTerms = topTerms(rows.filter((row) => row.layout !== '谨慎观察'), 16);
  els.copySuggestions.innerHTML = copyTerms.length
    ? copyTerms.map((term) => `<span class="tag">${escapeHtml(term)}</span>`).join('')
    : '<p class="empty">暂无文案布局词。</p>';
  els.adSuggestions.innerHTML = adTerms.length
    ? adTerms.map((term) => `<span class="tag">${escapeHtml(term)}</span>`).join('')
    : '<p class="empty">暂无广告布局词。</p>';
}

function renderEmpty(text = '输入 ASIN 后开始查询') {
  els.summaryGrid.innerHTML = '';
  els.resultMeta.textContent = text;
  els.keywordRows.innerHTML = `<tr><td colspan="9" class="empty">${escapeHtml(text)}</td></tr>`;
  els.copySuggestions.innerHTML = '<p class="empty">等待查询</p>';
  els.adSuggestions.innerHTML = '<p class="empty">等待查询</p>';
  if (els.xydcRows) {
    els.xydcRows.innerHTML = '<tr><td colspan="7" class="empty">等待查询</td></tr>';
    els.xydcMeta.textContent = '用于补充 ABA 没命中的 ASIN：自然排名、广告排名、流量词等。';
    els.xydcDebug.textContent = '等待查询';
  }
}

function filteredRows() {
  const site = els.siteFilter.value;
  const layout = els.layoutFilter.value;
  return state.rows
    .filter((row) => !site || row.site === site)
    .filter((row) => !layout || row.layout === layout)
    .sort((a, b) => number(a.rank) - number(b.rank) || number(b.clickShare) - number(a.clickShare));
}

function topTerms(rows, limit) {
  const seen = new Set();
  const terms = [];
  for (const row of rows) {
    const key = normalizeTerm(row.term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    terms.push(row.term);
    if (terms.length >= limit) break;
  }
  return terms;
}

function xydcTerms(rows, limit) {
  const seen = new Set();
  const terms = [];
  for (const row of rows) {
    const term = row.term || row.keyword;
    const key = normalizeTerm(term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
    if (terms.length >= limit) break;
  }
  return terms;
}

function firstSampleAsin() {
  return Object.keys(state.staticData.asins || {})[0] || 'B0DPSJP47V';
}

function normalizeAsin(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeTerm(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function riskBadge(value) {
  const cls = value === '低' ? 'good' : value === '中' ? 'warn' : 'risk';
  return `<span class="badge ${cls}">${escapeHtml(value)}</span>`;
}

function layoutBadge(value) {
  const cls = value === '文案+广告' ? 'good' : value === '广告测试' ? 'warn' : 'risk';
  return `<span class="badge ${cls}">${escapeHtml(value)}</span>`;
}

function formatRank(value) {
  return number(value) ? number(value).toLocaleString('en-US') : '-';
}

function formatPercentNumber(value) {
  return number(value) ? `${number(value).toFixed(2)}%` : '-';
}

function formatMaybePercent(value) {
  if (value === undefined || value === null || value === '') return '-';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return numeric > 0 && numeric <= 1 ? `${(numeric * 100).toFixed(2)}%` : `${numeric}%`;
}

function formatAdState(value) {
  if (value === true || value === 'true' || value === 1 || value === '1') return '广告';
  if (value === false || value === 'false' || value === 0 || value === '0') return '自然/未知';
  return value || '-';
}

function min(values) {
  return values.length ? Math.min(...values) : 0;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function number(value) {
  return Number(value) || 0;
}

function setStatus(text) {
  els.statusLine.textContent = text;
}

function setXydcStatus(text) {
  els.xydcStatusLine.textContent = text;
}

function xydcStatusText(payload) {
  if (!payload) return '西柚洞察：未返回数据。';
  if (payload.status === 'static') return `西柚洞察：${payload.message}`;
  if (payload.status === 'ok') return `西柚洞察：已返回 ${payload.rows?.length || 0} 条补充数据。`;
  return `西柚洞察：${payload.message || payload.status || '暂无补充数据'}`;
}

function isLocalHost() {
  return ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
