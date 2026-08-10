import {
  createBitableRecord,
  getTenantAccessToken,
  listBitableRecords,
  updateBitableRecord
} from './lib/feishu.js';
import { requireEnv } from './lib/env.js';

const appToken = requireEnv('FEISHU_BITABLE_APP_TOKEN');
const productsTableId = requireEnv('FEISHU_TABLE_PRODUCTS');
const profitTableId = requireEnv('FEISHU_TABLE_PROFIT_CALC');
const accessToken = await getTenantAccessToken();

const siteConfigs = [
  {
    site: '美国',
    suffix: 'US',
    currency: 'USD',
    priceField: '美国售价(USD)',
    fxField: 'USD汇率',
    defaultFx: 7.2,
    airField: '美国空运单价(人民币/kg)',
    seaField: '美国海运单价(人民币/kg)'
  },
  {
    site: '加拿大',
    suffix: 'CA',
    currency: 'CAD',
    priceField: '加拿大售价(CAD)',
    fxField: 'CAD汇率',
    defaultFx: 5.25,
    airField: '加拿大空运单价(人民币/kg)',
    seaField: '加拿大海运单价(人民币/kg)'
  },
  {
    site: '澳洲',
    suffix: 'AU',
    currency: 'AUD',
    priceField: '澳洲售价(AUD)',
    fxField: 'AUD汇率',
    defaultFx: 4.74,
    airField: '澳洲空运单价(人民币/kg)',
    seaField: '澳洲海运单价(人民币/kg)'
  }
];

const products = await listBitableRecords({ appToken, tableId: productsTableId, accessToken });
const profitRecords = await listBitableRecords({ appToken, tableId: profitTableId, accessToken });
const profitByExternalId = new Map();

for (const record of profitRecords) {
  const externalId = value(record.fields?.external_id);
  if (externalId) profitByExternalId.set(externalId, record);
}

let created = 0;
let updated = 0;
let skipped = 0;

for (const productRecord of products) {
  const product = productRecord.fields ?? {};
  const sku = value(product.SKU);
  const productName = value(product['产品名']);
  const generationEnabled = value(product['自动生成核算']);

  if (!sku || sku.startsWith('TEMPLATE')) {
    skipped += 1;
    continue;
  }

  if (generationEnabled === '否') {
    skipped += 1;
    continue;
  }

  const messages = [];

  for (const site of siteConfigs) {
    const price = num(product[site.priceField]);
    if (price <= 0) {
      messages.push(`${site.site}未填售价，跳过`);
      continue;
    }

    const externalId = `${sku}_${site.suffix}`;
    const fields = buildProfitFields({ product, site, sku, productName, externalId, price });
    const existing = profitByExternalId.get(externalId);

    if (existing) {
      await updateBitableRecord({
        appToken,
        tableId: profitTableId,
        recordId: existing.record_id,
        accessToken,
        fields
      });
      updated += 1;
      messages.push(`${site.site}已更新`);
    } else {
      await createBitableRecord({
        appToken,
        tableId: profitTableId,
        accessToken,
        fields
      });
      created += 1;
      messages.push(`${site.site}已创建`);
    }

    await sleep(120);
  }

  await updateBitableRecord({
    appToken,
    tableId: productsTableId,
    recordId: productRecord.record_id,
    accessToken,
    fields: {
      核算生成状态: messages.some((message) => message.includes('已')) ? '已生成' : '需检查',
      核算生成备注: messages.join('；') || '没有可生成的站点，请填写站点售价'
    }
  });
}

console.log(`Generate profit rows complete. created=${created}, updated=${updated}, skippedProducts=${skipped}`);

function buildProfitFields({ product, site, sku, productName, externalId, price }) {
  return {
    external_id: externalId,
    SKU: sku,
    产品名: productName,
    上架站点: site.site,
    币种: site.currency,
    Brand: value(product.Brand),
    分类: normalizeCategory(value(product['分类'])),
    '售价(外币)': price,
    汇率: num(product[site.fxField]) || site.defaultFx,
    '出厂价(人民币)': num(product['出厂价(人民币)']),
    附加项: value(product['附加项']),
    '附加金额(人民币)': num(product['附加金额(人民币)']),
    单品长cm: num(product['单品长cm']),
    单品宽cm: num(product['单品宽cm']),
    单品高cm: num(product['单品高cm']),
    配送重量kg: num(product['配送重量kg']),
    商品重量kg: num(product['商品重量kg']),
    整箱长cm: num(product['整箱长cm']),
    整箱宽cm: num(product['整箱宽cm']),
    整箱高cm: num(product['整箱高cm']),
    整箱数量: num(product['整箱数量']),
    整箱重量kg: num(product['整箱重量kg']),
    '空运单价(人民币/kg)': num(product[site.airField]) || defaultAirPrice(site.site),
    '海运单价(人民币/kg)': num(product[site.seaField]) || defaultSeaPrice(site.site),
    配送费获取方式: '自动',
    配送费复核状态: '未复核',
    推荐方案: '待确认',
    sync_status: 'pending'
  };
}

function normalizeCategory(category) {
  if (category === '服装与配饰') return category;
  if (category === '服装和配饰') return '服装与配饰';
  return category;
}

function defaultAirPrice(site) {
  if (site === '澳洲') return 42;
  if (site === '加拿大') return 45;
  if (site === '美国') return 45;
  return 0;
}

function defaultSeaPrice(site) {
  if (site === '澳洲') return 12;
  if (site === '加拿大') return 14;
  if (site === '美国') return 14;
  return 0;
}

function num(input) {
  const raw = value(input);
  if (raw === null || raw === undefined || raw === '') return 0;
  return Number(String(raw).replace(/[,$¥]/g, '')) || 0;
}

function value(input) {
  if (input === null || input === undefined) return null;
  if (Array.isArray(input)) return value(input[0]);
  if (typeof input === 'object') {
    if ('text' in input) return input.text;
    if ('name' in input) return input.name;
    if ('value' in input) return input.value;
    if ('email' in input) return input.email;
    return null;
  }
  return input;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
