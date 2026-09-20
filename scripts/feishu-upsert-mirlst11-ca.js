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

const sku = 'MIRLST11BK-2P';
const productFields = {
  external_id: sku,
  sync_status: 'pending',
  产品名: '防偷伸缩扣ST11两个装',
  SKU: sku,
  ASIN: 'B0H4ZQG3VS',
  FNSKU: 'X0055PKFGF',
  Brand: 'MiFacie',
  产品状态: '待上架',
  默认站点: '加拿大',
  分类: '电子产品配件',
  '加拿大售价(CAD)': 16.99,
  CAD汇率: 5.25,
  '出厂价(人民币)': 18,
  供应商1: '义乌市盘江饰品厂',
  供应商产品链接: 'https://detail.1688.com/offer/800086638717.html?spm=a360q.8274423%2Fnew.goods.productname',
  单品长cm: 13,
  单品宽cm: 9.1,
  单品高cm: 2.2,
  配送重量kg: 0.11,
  商品重量kg: 0.11,
  '加拿大空运单价(人民币/kg)': 45,
  '加拿大海运单价(人民币/kg)': 14,
  自动生成核算: '是',
  核算生成状态: '待生成',
  核算生成备注: '加拿大站新产品：配送费按商城预估 6.33 CAD 手动覆盖；分类按电子产品配件'
};

const profitFields = {
  external_id: `${sku}_CA`,
  sync_status: 'pending',
  SKU: sku,
  产品名: productFields.产品名,
  上架站点: '加拿大',
  币种: 'CAD',
  Brand: productFields.Brand,
  分类: productFields.分类,
  '售价(外币)': 16.99,
  汇率: 5.25,
  佣金率: 0.15,
  '出厂价(人民币)': 18,
  附加项: '',
  '附加金额(人民币)': 0,
  单品长cm: 13,
  单品宽cm: 9.1,
  单品高cm: 2.2,
  配送重量kg: 0.11,
  商品重量kg: 0.11,
  整箱长cm: 0,
  整箱宽cm: 0,
  整箱高cm: 0,
  整箱数量: 0,
  整箱重量kg: 0,
  '空运单价(人民币/kg)': 45,
  '海运单价(人民币/kg)': 14,
  配送费获取方式: '手动',
  '自动配送费(外币)': 4.71,
  '手动配送费(外币)': 6.33,
  '配送费(外币)': 6.33,
  配送费复核状态: '已复核',
  配送费备注: '加拿大商城预估：配送费用 6.33 CAD = 基本配送费用 6.12 CAD + 3.5% 燃油和物流相关附加费',
  配送费规则命中: '手动覆盖；商城预估配送费 6.33 CAD',
  推荐方案: '待确认'
};

await upsertRecord({
  tableId: productsTableId,
  matchField: 'SKU',
  matchValue: sku,
  fields: productFields,
  label: '产品主数据'
});

await upsertRecord({
  tableId: profitTableId,
  matchField: 'external_id',
  matchValue: `${sku}_CA`,
  fields: profitFields,
  label: '站点利润核算'
});

console.log(`Upsert complete: ${sku}`);

async function upsertRecord({ tableId, matchField, matchValue, fields, label }) {
  const records = await listBitableRecords({ appToken, tableId, accessToken });
  const existing = records.find((record) => value(record.fields?.[matchField]) === matchValue);

  if (existing) {
    await updateBitableRecord({
      appToken,
      tableId,
      recordId: existing.record_id,
      accessToken,
      fields
    });
    console.log(`${label} updated: ${matchValue}`);
    return;
  }

  await createBitableRecord({
    appToken,
    tableId,
    accessToken,
    fields
  });
  console.log(`${label} created: ${matchValue}`);
}

function value(input) {
  if (input === null || input === undefined) return null;
  if (Array.isArray(input)) return value(input[0]);
  if (typeof input === 'object') {
    if ('text' in input) return input.text;
    if ('name' in input) return input.name;
    if ('value' in input) return input.value;
  }
  return input;
}
