import {
  createBitableField,
  getTenantAccessToken,
  listBitableFields
} from './lib/feishu.js';
import { requireEnv } from './lib/env.js';

const appToken = requireEnv('FEISHU_BITABLE_APP_TOKEN');
const tableId = requireEnv('FEISHU_TABLE_PRODUCTS');
const accessToken = await getTenantAccessToken();

const fields = [
  number('美国售价(USD)', '0.00'),
  number('加拿大售价(CAD)', '0.00'),
  number('澳洲售价(AUD)', '0.00'),
  number('USD汇率', '0.0000'),
  number('CAD汇率', '0.0000'),
  number('AUD汇率', '0.0000'),
  number('出厂价(人民币)', '¥0.00'),
  text('附加项'),
  number('附加金额(人民币)', '¥0.00'),
  number('单品长cm', '0.000'),
  number('单品宽cm', '0.000'),
  number('单品高cm', '0.000'),
  number('配送重量kg', '0.000'),
  number('商品重量kg', '0.000'),
  number('整箱长cm', '0.00'),
  number('整箱宽cm', '0.00'),
  number('整箱高cm', '0.00'),
  number('整箱数量', '0'),
  number('整箱重量kg', '0.000'),
  number('美国空运单价(人民币/kg)', '¥0.00'),
  number('美国海运单价(人民币/kg)', '¥0.00'),
  number('加拿大空运单价(人民币/kg)', '¥0.00'),
  number('加拿大海运单价(人民币/kg)', '¥0.00'),
  number('澳洲空运单价(人民币/kg)', '¥0.00'),
  number('澳洲海运单价(人民币/kg)', '¥0.00'),
  singleSelect('自动生成核算', ['是', '否']),
  singleSelect('核算生成状态', ['待生成', '已生成', '需检查']),
  text('核算生成备注')
];

const existingFields = await listBitableFields({ appToken, tableId, accessToken });
const existingNames = new Set(existingFields.map((field) => field.field_name));

for (const field of fields) {
  if (existingNames.has(field.field_name)) {
    console.log(`Skip existing field: ${field.field_name}`);
    continue;
  }

  await createBitableField({ appToken, tableId, accessToken, field });
  console.log(`Created field: ${field.field_name}`);
  await sleep(120);
}

console.log('Product entry fields setup complete.');

function text(fieldName) {
  return { field_name: fieldName, type: 1 };
}

function number(fieldName, formatter = '0.00') {
  return { field_name: fieldName, type: 2, property: { formatter } };
}

function singleSelect(fieldName, options) {
  return {
    field_name: fieldName,
    type: 3,
    property: { options: options.map((name) => ({ name })) }
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
