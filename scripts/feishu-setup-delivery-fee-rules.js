import {
  createBitableField,
  createBitableRecord,
  getTenantAccessToken,
  listBitableFields,
  listBitableRecords,
  updateBitableRecord
} from './lib/feishu.js';
import { requireEnv } from './lib/env.js';

const appToken = requireEnv('FEISHU_BITABLE_APP_TOKEN');
const tableId = requireEnv('FEISHU_TABLE_DELIVERY_REFERENCE');
const accessToken = await getTenantAccessToken();

const fields = [
  text('external_id'),
  singleSelect('站点', ['美国', '加拿大', '澳洲']),
  singleSelect('币种', ['USD', 'CAD', 'AUD']),
  text('费用版本'),
  text('商品类型'),
  text('尺寸分段'),
  number('最长边上限cm', '0.00'),
  number('次长边上限cm', '0.00'),
  number('最短边上限cm', '0.00'),
  number('重量下限g', '0'),
  number('重量上限g', '0'),
  text('价格组'),
  text('分类适用'),
  number('配送费(外币)', '0.00'),
  text('规则JSON'),
  text('来源'),
  singleSelect('复核状态', ['待复核', '已复核', '需调整']),
  text('备注')
];

const rules = [
  ...auRules(),
  ...caRules(),
  ...usRules()
];

await ensureFields();
await upsertRules();

console.log(`Delivery fee reference setup complete. ${rules.length} rules processed.`);

async function ensureFields() {
  const existingFields = await listBitableFields({ appToken, tableId, accessToken });
  const existingNames = new Set(existingFields.map((field) => field.field_name));

  for (const field of fields) {
    if (existingNames.has(field.field_name)) continue;
    await createBitableField({ appToken, tableId, accessToken, field });
    console.log(`Created field: ${field.field_name}`);
    await sleep(120);
  }
}

async function upsertRules() {
  const records = await listBitableRecords({ appToken, tableId, accessToken });
  const recordByExternalId = new Map();

  for (const record of records) {
    const externalId = normalizeValue(record.fields?.external_id);
    if (externalId) recordByExternalId.set(externalId, record);
  }

  for (const rule of rules) {
    const existing = recordByExternalId.get(rule.external_id);
    if (existing) {
      await updateBitableRecord({ appToken, tableId, recordId: existing.record_id, accessToken, fields: rule });
      console.log(`Updated: ${rule.external_id}`);
    } else {
      await createBitableRecord({ appToken, tableId, accessToken, fields: rule });
      console.log(`Created: ${rule.external_id}`);
    }
    await sleep(80);
  }
}

function auRules() {
  const out = [];
  const definitions = [
    ['小号信封', [20, 15, 1], [[0, 75, [3.20, 3.64, 4.55, 4.55]]]],
    ['标准信封', [33, 23, 2.5], [
      [0, 75, [3.30, 3.67, 4.58, 4.58]],
      [76, 225, [3.44, 4.35, 4.60, 5.26]],
      [226, 475, [3.72, 4.70, 5.06, 5.61]]
    ]],
    ['大号信封', [33, 23, 5], [
      [0, 225, [3.72, 5.87, 5.06, 6.78]],
      [226, 475, [3.98, 6.11, 5.06, 7.02]],
      [476, 975, [3.98, 6.33, 5.06, 7.24]]
    ]],
    ['包裹', [45, 34, 20], [
      [0, 250, [3.98, 6.14, 5.48, 7.05]],
      [251, 500, [4.18, 6.14, 5.48, 7.05]],
      [501, 1000, [4.36, 6.33, 5.48, 7.24]],
      [1001, 1500, [6.19, 7.97, 6.19, 8.88]],
      [1501, 2000, [6.64, 8.90, 6.64, 9.81]],
      [2001, 3000, [8.95, 8.95, 9.86, 9.86]],
      [3001, 4000, [9.27, 9.27, 10.18, 10.18]],
      [4001, 5000, [9.28, 9.28, 10.19, 10.19]],
      [5001, 6000, [10.19, 10.19, 11.10, 11.10]],
      [6001, 7000, [10.35, 10.35, 11.26, 11.26]],
      [7001, 8000, [10.35, 10.35, 11.26, 11.26]],
      [8001, 9000, [10.36, 10.36, 11.27, 11.27]],
      [9001, 10000, [10.36, 10.36, 11.27, 11.27]],
      [10001, 11000, [12.89, 12.89, 13.80, 13.80]],
      [11001, 12000, [13.02, 13.02, 13.93, 13.93]]
    ]]
  ];

  const groups = [
    ['价格<13且家居/宠物', '家居及厨房;家居及厨房用品;宠物用品'],
    ['价格<13其他分类', '所有其他分类'],
    ['13<=价格<20且家居/宠物/食品/运动户外', '家居及厨房;家居及厨房用品;宠物用品;食品;运动户外;体育及户外用品'],
    ['价格>=20或13-20其他分类', '所有其他分类']
  ];

  for (const [sizeName, dims, tiers] of definitions) {
    for (const [minG, maxG, fees] of tiers) {
      for (let index = 0; index < fees.length; index += 1) {
        out.push(baseRule({
          site: '澳洲',
          currency: 'AUD',
          version: '2026 OCR 图片',
          productType: 'FBA',
          sizeName,
          dims,
          minG,
          maxG,
          priceGroup: groups[index][0],
          categoryScope: groups[index][1],
          fee: fees[index],
          source: '澳大利亚配送费表_00.png',
          note: '已结构化澳洲信封与包裹 0-12kg 主要分段；超过部分规则后续补充。'
        }));
      }
    }
  }
  return out;
}

function caRules() {
  const fees = [
    [0, 100, 4.46],
    [101, 200, 4.71],
    [201, 300, 5.01],
    [301, 400, 5.28],
    [401, 500, 5.62],
    [501, 600, 5.92],
    [601, 700, 6.12],
    [701, 800, 6.36],
    [801, 900, 6.73],
    [901, 1000, 7.23],
    [1001, 1100, 7.40],
    [1101, 1200, 7.79],
    [1201, 1300, 8.25],
    [1301, 1400, 8.49],
    [1401, 1500, 8.58]
  ];
  return fees.map(([minG, maxG, fee]) => baseRule({
    site: '加拿大',
    currency: 'CAD',
    version: '2026 非旺季 OCR 图片',
    productType: 'FBA',
    sizeName: '标准尺寸',
    dims: [45, 35, 20],
    minG,
    maxG,
    priceGroup: '非旺季',
    categoryScope: '全部分类',
    fee,
    source: '加拿大配送费率表_00.png',
    note: '加拿大标准尺寸基础分段，后续补充大件与旺季费率。'
  }));
}

function usRules() {
  const out = [];
  const small = [
    [0, 57, [2.50, 3.27, 3.27]],
    [58, 113, [2.50, 3.27, 3.27]],
    [114, 170, [2.65, 3.42, 3.42]],
    [171, 227, [2.65, 3.42, 3.42]],
    [228, 283, [2.76, 3.53, 3.53]],
    [284, 340, [2.83, 3.60, 3.60]],
    [341, 397, [2.91, 3.68, 3.68]],
    [398, 454, [3.04, 3.81, 3.81]]
  ];
  const large = [
    [0, 113, [3.25, 4.02, 4.02]],
    [114, 227, [3.35, 4.12, 4.12]],
    [228, 340, [3.49, 4.26, 4.26]],
    [341, 454, [3.63, 4.40, 4.40]],
    [455, 567, [4.35, 5.12, 5.12]],
    [568, 680, [4.60, 5.37, 5.37]],
    [681, 794, [4.75, 5.52, 5.52]],
    [795, 907, [5.00, 5.77, 5.77]],
    [908, 1021, [5.10, 5.87, 5.87]],
    [1022, 1134, [5.28, 6.05, 6.05]],
    [1135, 1247, [5.44, 6.21, 6.21]],
    [1248, 1361, [5.85, 6.62, 6.62]]
  ];
  out.push(...usSizeRules('小号标准', [38.1, 30.48, 1.905], small));
  out.push(...usSizeRules('大号标准', [45.72, 35.56, 20.32], large));
  return out;
}

function usSizeRules(sizeName, dims, tiers) {
  const priceGroups = [['价格<10', '<$10'], ['10<=价格<=50', '$10-$50'], ['价格>50', '>$50']];
  const out = [];
  for (const [minG, maxG, fees] of tiers) {
    for (let index = 0; index < fees.length; index += 1) {
      out.push(baseRule({
        site: '美国',
        currency: 'USD',
        version: '2026 非旺季 OCR 图片',
        productType: 'FBA 非服装',
        sizeName,
        dims,
        minG,
        maxG,
        priceGroup: priceGroups[index][0],
        categoryScope: priceGroups[index][1],
        fee: fees[index],
        source: '美国配送费率表_00.png',
        note: '美国非服装小号/大号标准尺寸基础分段；服装、大件、旺季费率后续补充。'
      }));
    }
  }
  return out;
}

function baseRule({ site, currency, version, productType, sizeName, dims, minG, maxG, priceGroup, categoryScope, fee, source, note }) {
  const externalId = [
    siteCode(site),
    sizeName,
    minG,
    maxG,
    priceGroup.replace(/[<>=\s$]/g, '')
  ].join('_');
  return {
    external_id: externalId,
    站点: site,
    币种: currency,
    费用版本: version,
    商品类型: productType,
    尺寸分段: sizeName,
    最长边上限cm: dims[0],
    次长边上限cm: dims[1],
    最短边上限cm: dims[2],
    重量下限g: minG,
    重量上限g: maxG,
    价格组: priceGroup,
    分类适用: categoryScope,
    '配送费(外币)': fee,
    规则JSON: JSON.stringify({ dims_cm: dims, min_g: minG, max_g: maxG, price_group: priceGroup, fee }),
    来源: source,
    复核状态: '待复核',
    备注: note
  };
}

function siteCode(site) {
  if (site === '澳洲') return 'AU';
  if (site === '加拿大') return 'CA';
  if (site === '美国') return 'US';
  return site;
}

function text(fieldName) {
  return { field_name: fieldName, type: 1 };
}

function number(fieldName, formatter = '0.00') {
  return { field_name: fieldName, type: 2, property: { formatter } };
}

function singleSelect(fieldName, options) {
  return { field_name: fieldName, type: 3, property: { options: options.map((name) => ({ name })) } };
}

function normalizeValue(value) {
  if (Array.isArray(value)) return normalizeValue(value[0]);
  if (value && typeof value === 'object') {
    if ('text' in value) return value.text;
    if ('name' in value) return value.name;
    if ('value' in value) return value.value;
  }
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
