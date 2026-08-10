const state = {
  data: window.AMAZON_DASHBOARD_DATA || { products: [], profitRows: [] },
  selectedSku: null,
  selectedCalcKey: null,
  query: '',
  calcValues: {}
};

const els = {
  exportedAt: document.getElementById('exportedAt'),
  searchInput: document.getElementById('searchInput'),
  productList: document.getElementById('productList'),
  productTitle: document.getElementById('productTitle'),
  productImage: document.getElementById('productImage'),
  skuValue: document.getElementById('skuValue'),
  asinValue: document.getElementById('asinValue'),
  fnskuValue: document.getElementById('fnskuValue'),
  brandValue: document.getElementById('brandValue'),
  categoryValue: document.getElementById('categoryValue'),
  supplierValue: document.getElementById('supplierValue'),
  metricsStrip: document.getElementById('metricsStrip'),
  productInfoGrid: document.getElementById('productInfoGrid'),
  calculatorSiteTabs: document.getElementById('calculatorSiteTabs'),
  calculatorInputs: document.getElementById('calculatorInputs'),
  calculatorResults: document.getElementById('calculatorResults'),
  profitTableBody: document.getElementById('profitTableBody'),
  deliveryRules: document.getElementById('deliveryRules'),
  refreshHint: document.getElementById('refreshHint')
};

init();

function init() {
  els.exportedAt.textContent = state.data.exportedAt ? `数据时间 ${formatDate(state.data.exportedAt)}` : '未导出数据';
  state.selectedSku = state.data.products[0]?.SKU || state.data.profitRows[0]?.SKU || null;

  els.searchInput.addEventListener('input', (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderProductList();
  });
  els.refreshHint.addEventListener('click', () => {
    alert('在项目目录运行：npm.cmd run feishu:export-dashboard，然后刷新本页面。');
  });
  render();
}

function render() {
  renderProductList();
  renderProductDetail();
}

function renderProductList() {
  const products = getFilteredProducts();
  els.productList.innerHTML = products.map((product) => {
    const active = product.SKU === state.selectedSku ? ' active' : '';
    return `<button type="button" class="product-item${active}" data-sku="${escapeHtml(product.SKU || '')}">
      <strong>${escapeHtml(field(product, '产品名') || product.SKU || '-')}</strong>
      <span>${escapeHtml(product.SKU || '-')}</span>
    </button>`;
  }).join('');

  els.productList.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedSku = button.dataset.sku;
      state.selectedCalcKey = null;
      state.calcValues = {};
      render();
    });
  });
}

function renderProductDetail() {
  const product = findProduct(state.selectedSku);
  const rows = state.data.profitRows.filter((row) => row.SKU === state.selectedSku);
  if (!product && !rows.length) return;

  const source = product || rows[0];
  els.productTitle.textContent = field(source, '产品名') || source.SKU || '未命名产品';
  els.productImage.src = field(source, '主图地址') || '';
  els.productImage.style.display = field(source, '主图地址') ? 'block' : 'none';
  els.skuValue.textContent = source.SKU || '-';
  els.asinValue.textContent = source.ASIN || '-';
  els.fnskuValue.textContent = source.FNSKU || '-';
  els.brandValue.textContent = source.Brand || '-';
  els.categoryValue.textContent = field(source, '分类') || '-';
  els.supplierValue.textContent = field(source, '供应商1') || field(source, '供应商') || '-';

  renderMetrics(rows);
  renderProductInfo(product, rows[0]);
  renderCalculator(rows);
  renderProfitTable(rows);
  renderRules(rows);
}

function renderMetrics(rows) {
  const bestAir = maxValue(rows, '空运利润率');
  const bestSea = maxValue(rows, '海运利润率');
  const bestRoi = Math.max(maxValue(rows, '空运投产比'), maxValue(rows, '海运投产比'));
  const metrics = [
    ['站点数', rows.length],
    ['最佳空运利润率', formatPercent(bestAir)],
    ['最佳海运利润率', formatPercent(bestSea)],
    ['最佳投产比', formatRatio(bestRoi)]
  ];
  els.metricsStrip.innerHTML = metrics.map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join('');
}

function renderProductInfo(product, row) {
  const source = { ...(row || {}), ...(product || {}) };
  const dimensionsCm = compactJoin([
    formatMeasure(field(source, '单品长cm'), 'cm'),
    formatMeasure(field(source, '单品宽cm'), 'cm'),
    formatMeasure(field(source, '单品高cm'), 'cm')
  ], ' x ');
  const dimensionsInch = compactJoin([
    formatMeasure(field(row, '单品长inch'), 'in'),
    formatMeasure(field(row, '单品宽inch'), 'in'),
    formatMeasure(field(row, '单品高inch'), 'in')
  ], ' x ');
  const cartonSize = compactJoin([
    formatMeasure(field(row, '整箱长cm'), 'cm'),
    formatMeasure(field(row, '整箱宽cm'), 'cm'),
    formatMeasure(field(row, '整箱高cm'), 'cm')
  ], ' x ');

  const items = [
    ['产品状态', field(source, '产品状态')],
    ['默认站点', field(source, '默认站点') || field(row, '上架站点')],
    ['单品尺寸', dimensionsCm || '-'],
    ['单品尺寸 inch', dimensionsInch || '-'],
    ['配送重量', weightPair(field(source, '配送重量kg') || field(row, '配送重量kg'), field(row, '配送重量lb'))],
    ['商品重量', weightPair(field(source, '商品重量kg') || field(row, '商品重量kg'), field(row, '商品重量lb'))],
    ['Amazon 体积重', weightPair(field(row, '亚马逊体积重量kg'), field(row, '亚马逊体积重量lb'))],
    ['核算单品重量', formatMeasure(field(row, '核算单品重量kg'), 'kg')],
    ['整箱尺寸', cartonSize || '-'],
    ['整箱数量', field(row, '整箱数量')],
    ['整箱重量', formatMeasure(field(row, '整箱重量kg'), 'kg')],
    ['出厂价', formatMoney(field(source, '出厂价(人民币)'), 'CNY')],
    ['附加项', field(source, '附加项')],
    ['附加金额', formatMoney(field(source, '附加金额(人民币)'), 'CNY')],
    ['尺码颜色选项', field(source, '尺码颜色选项')],
    ['供应商链接', linkValue(field(source, '供应商产品链接'))]
  ];
  els.productInfoGrid.innerHTML = items.map(([label, value]) => detailItem(label, value)).join('');
}

function renderCalculator(rows) {
  if (!rows.length) {
    els.calculatorSiteTabs.innerHTML = '';
    els.calculatorInputs.innerHTML = '<p class="empty-text">暂无站点利润数据</p>';
    els.calculatorResults.innerHTML = '';
    return;
  }

  const sorted = [...rows].sort((a, b) => siteOrder(field(a, '上架站点')) - siteOrder(field(b, '上架站点')));
  const activeRow = getActiveCalculatorRow(sorted);
  const key = calcKey(activeRow);
  els.calculatorSiteTabs.innerHTML = sorted.map((row) => {
    const rowKey = calcKey(row);
    return `<button type="button" class="site-tab${rowKey === key ? ' active' : ''}" data-calc-key="${escapeHtml(rowKey)}">${escapeHtml(field(row, '上架站点') || '-')}</button>`;
  }).join('');
  els.calculatorSiteTabs.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedCalcKey = button.dataset.calcKey;
      state.calcValues = {};
      renderCalculator(rows);
    });
  });

  const values = getCalculatorValues(activeRow);
  els.calculatorInputs.innerHTML = calculatorInputHtml(values);
  els.calculatorInputs.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', () => {
      state.calcValues[input.name] = input.value;
      updateCalculatorResults();
    });
  });
  updateCalculatorResults();
}

function getActiveCalculatorRow(rows) {
  if (state.selectedCalcKey) return rows.find((row) => calcKey(row) === state.selectedCalcKey) || rows[0];
  const recommended = rows.find((row) => field(row, '推荐方案'));
  state.selectedCalcKey = calcKey(recommended || rows[0]);
  return recommended || rows[0];
}

function getCalculatorValues(row) {
  const base = {
    currency: field(row, '币种'),
    exchangeRate: field(row, '汇率'),
    saleForeign: field(row, '售价(外币)'),
    commissionRate: field(row, '佣金率'),
    deliveryForeign: field(row, '配送费(外币)'),
    factoryRmb: field(row, '出厂价(人民币)'),
    extraRmb: field(row, '附加金额(人民币)'),
    calcWeightKg: field(row, '核算单品重量kg'),
    airRateRmbKg: field(row, '空运单价(人民币/kg)'),
    seaRateRmbKg: field(row, '海运单价(人民币/kg)'),
    airShippingRmb: field(row, '空运头程(人民币)'),
    seaShippingRmb: field(row, '海运头程(人民币)')
  };
  return { ...base, ...state.calcValues };
}

function calculatorInputHtml(values) {
  const groups = [
    ['收入参数', [
      ['saleForeign', `售价 ${values.currency || '外币'}`, '0.01'],
      ['exchangeRate', '汇率', '0.0001'],
      ['commissionRate', '佣金率', '0.001']
    ]],
    ['平台费用', [
      ['deliveryForeign', `配送费 ${values.currency || '外币'}`, '0.01']
    ]],
    ['采购与头程', [
      ['factoryRmb', '出厂价 ¥', '0.01'],
      ['extraRmb', '附加金额 ¥', '0.01'],
      ['calcWeightKg', '核算重量 kg', '0.001'],
      ['airRateRmbKg', '空运单价 ¥/kg', '0.01'],
      ['seaRateRmbKg', '海运单价 ¥/kg', '0.01'],
      ['airShippingRmb', '空运头程 ¥', '0.01'],
      ['seaShippingRmb', '海运头程 ¥', '0.01']
    ]]
  ];

  return groups.map(([title, inputs]) => `
    <section class="calc-group">
      <h4>${title}</h4>
      <div class="calc-group-grid">
        ${inputs.map(([name, label, step]) => `
          <label class="calc-field">
            <span>${label}</span>
            <input name="${name}" type="number" step="${step}" value="${escapeHtml(values[name] ?? '')}">
          </label>
        `).join('')}
      </div>
    </section>
  `).join('');
}

function updateCalculatorResults() {
  const values = {};
  els.calculatorInputs.querySelectorAll('input').forEach((input) => {
    values[input.name] = input.value;
  });
  const result = calculateScenario(values);
  els.calculatorResults.innerHTML = `
    <div class="calc-result-header">
      <div>
        <span>销售额</span>
        <strong>${formatMoney(result.saleForeign, result.currency)} / ${formatMoney(result.saleRmb, 'CNY')}</strong>
      </div>
      <div>
        <span>平台费用</span>
        <strong>${formatMoney(result.platformCostRmb, 'CNY')}</strong>
      </div>
      <div>
        <span>采购成本</span>
        <strong>${formatMoney(result.purchaseRmb, 'CNY')}</strong>
      </div>
    </div>
    <div class="scenario-grid">
      ${scenarioResult('air', '空运方案', result.air)}
      ${scenarioResult('sea', '海运方案', result.sea)}
    </div>
  `;
}

function calculateScenario(values) {
  const currency = activeCalculatorCurrency();
  const exchangeRate = number(values.exchangeRate);
  const saleForeign = number(values.saleForeign);
  const saleRmb = saleForeign * exchangeRate;
  const commissionRmb = saleRmb * number(values.commissionRate);
  const deliveryRmb = number(values.deliveryForeign) * exchangeRate;
  const purchaseRmb = number(values.factoryRmb) + number(values.extraRmb);
  const weight = number(values.calcWeightKg);
  return {
    currency,
    saleForeign,
    saleRmb,
    purchaseRmb,
    platformCostRmb: commissionRmb + deliveryRmb,
    air: calculatePlan(saleRmb, exchangeRate, purchaseRmb, commissionRmb + deliveryRmb, number(values.airShippingRmb) || weight * number(values.airRateRmbKg)),
    sea: calculatePlan(saleRmb, exchangeRate, purchaseRmb, commissionRmb + deliveryRmb, number(values.seaShippingRmb) || weight * number(values.seaRateRmbKg))
  };
}

function calculatePlan(saleRmb, exchangeRate, purchaseRmb, platformCostRmb, shippingRmb) {
  const profitRmb = saleRmb - purchaseRmb - platformCostRmb - shippingRmb;
  const investment = purchaseRmb + shippingRmb;
  return {
    shippingRmb,
    shippingForeign: toForeign(shippingRmb, exchangeRate),
    profitRmb,
    profitForeign: toForeign(profitRmb, exchangeRate),
    margin: saleRmb > 0 ? profitRmb / saleRmb : 0,
    roi: investment > 0 ? profitRmb / investment : 0
  };
}

function scenarioResult(type, label, plan) {
  const positive = plan.profitRmb >= 0 ? 'positive' : 'negative';
  return `
    <article class="scenario ${type}">
      <div class="scenario-top">
        <span>${label}</span>
        <strong class="${positive}">${formatMoney(plan.profitForeign, activeCalculatorCurrency())} / ${formatMoney(plan.profitRmb, 'CNY')}</strong>
      </div>
      <div class="scenario-kpis">
        <div><span>头程</span><strong>${formatMoney(plan.shippingForeign, activeCalculatorCurrency())} / ${formatMoney(plan.shippingRmb, 'CNY')}</strong></div>
        <div><span>利润率</span><strong>${formatPercent(plan.margin)}</strong></div>
        <div><span>投产比</span><strong>${formatRatio(plan.roi)}</strong></div>
      </div>
    </article>
  `;
}

function activeCalculatorCurrency() {
  const row = state.data.profitRows.find((item) => calcKey(item) === state.selectedCalcKey);
  return field(row, '币种') || '外币';
}

function renderProfitTable(rows) {
  els.profitTableBody.innerHTML = [...rows]
    .sort((a, b) => siteOrder(field(a, '上架站点')) - siteOrder(field(b, '上架站点')))
    .map((row) => profitRowHtml(row))
    .join('');
}

function profitRowHtml(row) {
  const currency = field(row, '币种');
  const exchangeRate = number(field(row, '汇率'));
  const purchaseRmb = number(field(row, '出厂价(人民币)')) + number(field(row, '附加金额(人民币)'));
  const deliveryStatus = field(row, '配送费复核状态') || '-';
  return `<tr>
    <td><strong>${escapeHtml(field(row, '上架站点') || '-')}</strong><div class="site-muted">${escapeHtml(currency || '')} 汇率 ${formatNumber(exchangeRate, 4)}</div></td>
    <td>${dualMoney(field(row, '售价(外币)'), currency, field(row, '售价(人民币)'), 'CNY')}</td>
    <td>${dualMoney(toForeign(purchaseRmb, exchangeRate), currency, purchaseRmb, 'CNY', '出厂价 + 附加')}</td>
    <td>${stackedLines([
      ['air', '空运', dualMoneyText(toForeign(field(row, '空运头程(人民币)'), exchangeRate), currency, field(row, '空运头程(人民币)'), 'CNY')],
      ['sea', '海运', dualMoneyText(toForeign(field(row, '海运头程(人民币)'), exchangeRate), currency, field(row, '海运头程(人民币)'), 'CNY')]
    ])}</td>
    <td>${dualMoney(field(row, '配送费(外币)'), currency, field(row, '配送费(人民币)'), 'CNY', field(row, '配送费获取方式') || '')}</td>
    <td>${dualMoney(field(row, '佣金(外币)'), currency, field(row, '佣金(人民币)'), 'CNY', `佣金率 ${formatPercent(field(row, '佣金率'))}`)}</td>
    <td>${stackedLines([
      ['air', '空运', dualMoneyText(toForeign(field(row, '空运利润(人民币)'), exchangeRate), currency, field(row, '空运利润(人民币)'), 'CNY')],
      ['sea', '海运', dualMoneyText(toForeign(field(row, '海运利润(人民币)'), exchangeRate), currency, field(row, '海运利润(人民币)'), 'CNY')]
    ])}</td>
    <td>${stackedLines([
      ['air', '空运', profitBar(field(row, '空运利润率'), 'air')],
      ['sea', '海运', profitBar(field(row, '海运利润率'), 'sea')]
    ])}</td>
    <td>${stackedLines([
      ['air', '空运', formatRatio(field(row, '空运投产比'))],
      ['sea', '海运', formatRatio(field(row, '海运投产比'))]
    ])}</td>
    <td>${escapeHtml(field(row, '推荐方案') || '-')}</td>
    <td class="${deliveryStatus === '需调整' ? 'status-warn' : ''}">${escapeHtml(deliveryStatus)}<div class="site-muted">${escapeHtml(field(row, '配送费规则命中') || '')}</div></td>
  </tr>`;
}

function renderRules(rows) {
  els.deliveryRules.innerHTML = rows.map((row) => `<div class="rule-item">${escapeHtml(field(row, '上架站点') || '-')}：${escapeHtml(field(row, '配送费规则命中') || '暂无命中规则')}</div>`).join('');
}

function getFilteredProducts() {
  const products = state.data.products.length ? state.data.products : uniqueBySku(state.data.profitRows);
  if (!state.query) return products;
  return products.filter((product) => [product.SKU, product.ASIN, product.FNSKU, field(product, '产品名'), product.Brand].filter(Boolean).join(' ').toLowerCase().includes(state.query));
}

function findProduct(sku) {
  return state.data.products.find((product) => product.SKU === sku);
}

function uniqueBySku(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (row.SKU && !map.has(row.SKU)) map.set(row.SKU, row);
  });
  return [...map.values()];
}

function detailItem(label, value) {
  const safeValue = value === null || value === undefined || value === '' ? '-' : value;
  return `<div class="detail-item"><span>${escapeHtml(label)}</span><strong>${safeValue}</strong></div>`;
}

function linkValue(url) {
  if (!url) return '-';
  const safeUrl = escapeHtml(url);
  return `<a href="${safeUrl}" target="_blank" rel="noreferrer">打开链接</a>`;
}

function field(record, key) {
  return record?.[key];
}

function calcKey(row) {
  return `${row?.SKU || ''}_${field(row, '上架站点') || ''}`;
}

function maxValue(rows, key) {
  return rows.reduce((max, row) => Math.max(max, number(field(row, key))), 0);
}

function stackedLines(lines) {
  return `<div class="stacked-lines">${lines.map(([type, label, value]) => `<div class="stack-line ${type}"><span>${label}</span><strong>${value}</strong></div>`).join('')}</div>`;
}

function dualMoney(foreignValue, foreignCurrency, rmbValue, rmbCurrency, note = '') {
  return `<div class="money-pair"><strong>${dualMoneyText(foreignValue, foreignCurrency, rmbValue, rmbCurrency)}</strong>${note ? `<span>${escapeHtml(note)}</span>` : ''}</div>`;
}

function dualMoneyText(foreignValue, foreignCurrency, rmbValue, rmbCurrency) {
  return `${formatMoney(foreignValue, foreignCurrency)} / ${formatMoney(rmbValue, rmbCurrency)}`;
}

function profitBar(value, type) {
  const numeric = number(value);
  const width = Math.max(0, Math.min(100, numeric * 100));
  return `<strong>${formatPercent(numeric)}</strong><div class="bar-track"><div class="bar-fill ${type}" style="width:${width}%"></div></div>`;
}

function compactJoin(values, separator) {
  return values.filter((value) => value && value !== '-').join(separator);
}

function weightPair(kg, lb) {
  return compactJoin([formatMeasure(kg, 'kg'), formatMeasure(lb, 'lb')], ' / ') || '-';
}

function formatMeasure(value, unit) {
  return number(value) ? `${formatNumber(value, 3)} ${unit}` : '-';
}

function number(value) {
  return Number(value) || 0;
}

function toForeign(rmbValue, exchangeRate) {
  return number(exchangeRate) > 0 ? number(rmbValue) / number(exchangeRate) : 0;
}

function formatNumber(value, digits = 2) {
  return number(value) ? number(value).toFixed(digits) : '-';
}

function formatPercent(value) {
  return `${(number(value) * 100).toFixed(2)}%`;
}

function formatRatio(value) {
  return number(value) ? `${number(value).toFixed(2)}x` : '-';
}

function formatMoney(value, currency) {
  const symbol = currency === 'USD' ? '$' : currency === 'CAD' ? 'C$' : currency === 'AUD' ? 'A$' : currency === 'CNY' ? '¥' : currency || '';
  return `${symbol}${number(value).toFixed(2)}`;
}

function formatDate(value) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function siteOrder(site) {
  return { 美国: 1, 加拿大: 2, 澳洲: 3 }[site] || 99;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
