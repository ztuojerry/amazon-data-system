import {
  createBitableField,
  getTenantAccessToken,
  listBitableFields
} from './lib/feishu.js';
import { requireEnv } from './lib/env.js';

const appToken = requireEnv('FEISHU_BITABLE_APP_TOKEN');
const tableId = requireEnv('FEISHU_TABLE_PROFIT_CALC');
const accessToken = await getTenantAccessToken();

const fields = [
  singleSelect('配送费获取方式', ['自动', '手动']),
  number('自动配送费(外币)', '0.00'),
  number('手动配送费(外币)', '0.00'),
  text('配送费规则命中'),
  singleSelect('配送费复核状态', ['未复核', '已复核', '需调整']),
  text('配送费备注')
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

console.log('Delivery override fields setup complete.');

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
