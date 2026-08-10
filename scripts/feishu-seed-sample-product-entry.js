import {
  getTenantAccessToken,
  listBitableRecords,
  updateBitableRecord
} from './lib/feishu.js';
import { requireEnv } from './lib/env.js';

const appToken = requireEnv('FEISHU_BITABLE_APP_TOKEN');
const tableId = requireEnv('FEISHU_TABLE_PRODUCTS');
const accessToken = await getTenantAccessToken();
const records = await listBitableRecords({ appToken, tableId, accessToken });

const target = records.find((record) => value(record.fields?.SKU) === 'ATGFSS001BK-FBA');
if (!target) {
  throw new Error('Sample product ATGFSS001BK-FBA not found in 产品主数据');
}

await updateBitableRecord({
  appToken,
  tableId,
  recordId: target.record_id,
  accessToken,
  fields: {
    '澳洲售价(AUD)': 18.99,
    AUD汇率: 4.74,
    '出厂价(人民币)': 19.5,
    附加项: '定制纸盒',
    '附加金额(人民币)': 5,
    单品长cm: 22.999,
    单品宽cm: 18.999,
    单品高cm: 2.499,
    配送重量kg: 0.24,
    商品重量kg: 0.24,
    '澳洲空运单价(人民币/kg)': 42,
    '澳洲海运单价(人民币/kg)': 12,
    自动生成核算: '是',
    核算生成状态: '待生成',
    核算生成备注: '示例数据已回填，可一键生成澳洲站核算行'
  }
});

console.log('Seeded sample product entry fields: ATGFSS001BK-FBA');

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
