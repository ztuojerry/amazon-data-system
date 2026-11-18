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

const sku = 'ATMB-TSL-GY-1P';
const productName = '塔丝隆医药包-深灰';

const productFields = {
  external_id: sku,
  sync_status: 'pending',
  产品名: productName,
  SKU: sku,
  ASIN: 'B0HCGJBQ3R',
  FNSKU: 'X001E72G9L',
  主图地址: 'https://cbu01.alicdn.com/img/ibank/O1CN01xQrWhf1GVfsF8lAEn_!!6000000000628-0-cib.jpg',
  Brand: 'ATIDOHA',
  产品状态: '已上架',
  默认站点: '澳洲',
  分类: '家居',
  '澳洲售价(AUD)': 0,
  AUD汇率: 4.74,
  '出厂价(人民币)': 7,
  供应商1: '浙江华彩箱包有限公司',
  尺码颜色选项: '颜色：深灰；材质：塔丝隆面料',
  单品长cm: 20,
  单品宽cm: 13,
  单品高cm: 2,
  配送重量kg: 0.07,
  商品重量kg: 0.07,
  整箱长cm: 45,
  整箱宽cm: 35,
  整箱高cm: 35,
  整箱数量: 100,
  '澳洲空运单价(人民币/kg)': 42,
  '澳洲海运单价(人民币/kg)': 12,
  自动生成核算: '是',
  核算生成状态: '需检查',
  核算生成备注: '澳洲站在售产品；售价待补录；配送费按商城预估 7.46 AUD 手动覆盖',
  备注: 'UPC/识别码：794000327594；售价待补录；整箱重量待补录；参数图：https://cbu01.alicdn.com/img/ibank/O1CN01hBLSK01H4TyQiXA9Z_!!2684580704-0-cib.jpg'
};

const profitFields = {
  external_id: `${sku}_AU`,
  sync_status: 'pending',
  SKU: sku,
  产品名: productName,
  上架站点: '澳洲',
  币种: 'AUD',
  Brand: productFields.Brand,
  分类: productFields.分类,
  '售价(外币)': 0,
  汇率: 4.74,
  佣金率: 0.08,
  '出厂价(人民币)': 7,
  附加项: '',
  '附加金额(人民币)': 0,
  单品长cm: 20,
  单品宽cm: 13,
  单品高cm: 2,
  配送重量kg: 0.07,
  商品重量kg: 0.07,
  整箱长cm: 45,
  整箱宽cm: 35,
  整箱高cm: 35,
  整箱数量: 100,
  整箱重量kg: 0,
  '空运单价(人民币/kg)': 42,
  '海运单价(人民币/kg)': 12,
  配送费获取方式: '手动',
  '手动配送费(外币)': 7.46,
  '配送费(外币)': 7.46,
  配送费复核状态: '已复核',
  配送费备注: '澳大利亚商城预估：7.46 AUD = 基本配送费 6.78 AUD + 税费 0.68 AUD',
  配送费规则命中: '手动覆盖；商城预估配送费 7.46 AUD',
  推荐方案: '待确认',
  备注: '售价待补录；整箱重量待补录'
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
  matchValue: `${sku}_AU`,
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
