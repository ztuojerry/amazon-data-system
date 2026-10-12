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

const sku = 'MISSGS-SDC-SL-1P';
const productName = '不锈钢刮痧板组合1：S+D开孔+C款+毛毡袋';

const productFields = {
  external_id: sku,
  sync_status: 'pending',
  产品名: productName,
  SKU: sku,
  ASIN: 'B0H95FMSLP',
  FNSKU: 'X0057AL95T',
  主图地址: 'https://m.media-amazon.com/images/I/81EdvCynf5L._AC_SL1500_.jpg',
  Brand: 'MiFacie',
  产品状态: '待上架',
  默认站点: '加拿大',
  分类: '美妆和个护健康',
  '加拿大售价(CAD)': 22.79,
  CAD汇率: 5.25,
  '出厂价(人民币)': 20,
  供应商1: '阳江市阳东区德驰五金制品厂',
  供应商产品链接: 'https://detail.1688.com/offer/1054811772012.html?spm=a360q.8274423%2Fnew.goods.productname',
  尺码颜色选项: 'S+C+D开孔（横棕色毛毡袋装）',
  单品长cm: 21.999,
  单品宽cm: 11.999,
  单品高cm: 2.499,
  配送重量kg: 0.349,
  商品重量kg: 0.35,
  '加拿大空运单价(人民币/kg)': 45,
  '加拿大海运单价(人民币/kg)': 14,
  自动生成核算: '是',
  核算生成状态: '待生成',
  核算生成备注: '加拿大站新产品：采购成本 20 CNY；尺寸 21.999×11.999×2.499cm；配送重量 349g；配送费按商城预估 6.97 CAD 手动覆盖'
};

const profitFields = {
  external_id: `${sku}_CA`,
  sync_status: 'pending',
  SKU: sku,
  产品名: productName,
  上架站点: '加拿大',
  币种: 'CAD',
  Brand: productFields.Brand,
  分类: productFields.分类,
  '售价(外币)': 22.79,
  汇率: 5.25,
  佣金率: 0.15,
  '出厂价(人民币)': 20,
  附加项: '横棕色毛毡袋装',
  '附加金额(人民币)': 0,
  单品长cm: 21.999,
  单品宽cm: 11.999,
  单品高cm: 2.499,
  配送重量kg: 0.349,
  商品重量kg: 0.35,
  整箱长cm: 0,
  整箱宽cm: 0,
  整箱高cm: 0,
  整箱数量: 0,
  整箱重量kg: 0,
  '空运单价(人民币/kg)': 45,
  '海运单价(人民币/kg)': 14,
  配送费获取方式: '手动',
  '手动配送费(外币)': 6.97,
  '配送费(外币)': 6.97,
  配送费复核状态: '已复核',
  配送费备注: '加拿大商城预估：配送费用 6.97 CAD = 基本配送费用 6.73 CAD + 3.5% 燃油和物流相关附加费',
  配送费规则命中: '手动覆盖；商城预估配送费 6.97 CAD',
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
