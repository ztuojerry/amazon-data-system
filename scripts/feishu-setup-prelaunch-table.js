import { getTenantAccessToken, createBitableField, listBitableFields } from './lib/feishu.js';
import { requireEnv } from './lib/env.js';

const appToken = requireEnv('FEISHU_BITABLE_APP_TOKEN');
const tableId = requireEnv('FEISHU_TABLE_PRE_LAUNCH') || requireEnv('FEISHU_TABLE_PRODUCTS');
const accessToken = await getTenantAccessToken();
const args = new Set(process.argv.slice(2));

const coreFieldSpecs = [
  text('external_id', '系统唯一键，例如 chesey_US_SKU001'),
  singleSelect('核算站点', ['美洲', '欧洲', '日本', '加拿大', '英国', '德国']),
  singleSelect('销售方式', ['空运', '海运', '快递', '卡派', '海外仓']),
  text('产品'),
  text('型号'),
  text('颜色'),
  money('售价(外币)', '0.00'),
  money('出厂价(￥)', '¥0.00'),
  money('运费(￥)', '¥0.00'),
  money('操作费(外币)', '0.00'),
  money('操作费(￥)', '¥0.00'),
  percent('佣金率'),
  money('销售佣金', '0.00'),
  money('佣金(￥)', '¥0.00'),
  money('广告费', '¥0.00'),
  money('利润(￥)', '¥0.00'),
  percent('利润率'),
  number('投入产出比', '0.00'),
  singleSelect('launch_decision', ['pass', 'review', 'reject']),
  singleSelect('sync_status', ['pending', 'synced', 'error']),
  text('sync_error'),
  date('last_synced_at')
];

const sizeFieldSpecs = [
  number('材积', '0.0000'),
  number('单个重量kg', '0.00'),
  number('单品长cm', '0.00'),
  number('单品宽cm', '0.00'),
  number('单品高cm', '0.00'),
  number('单品体积/张', '0.0000'),
  number('整箱数量', '0'),
  number('整箱重量kg', '0.00'),
  number('整箱长cm', '0.00'),
  number('整箱宽cm', '0.00'),
  number('整箱高cm', '0.00'),
  number('整箱体积/张', '0.0000'),
  number('最大值', '0.00'),
  singleSelect('方案', ['空运', '海运', '快递', '卡派', '海外仓']),
  number('汇率', '0.0000'),
  money('运费单价', '¥0.00')
];

const fieldSpecs = args.has('--core') ? coreFieldSpecs : [...coreFieldSpecs, ...sizeFieldSpecs];

const existingFields = await listBitableFields({ appToken, tableId, accessToken });
const existingNames = new Set(existingFields.map((field) => field.field_name));

console.log(`Setting up Feishu table ${tableId}`);
console.log(`Existing fields: ${existingFields.map((field) => field.field_name).join(', ') || '(none)'}`);

for (const spec of fieldSpecs) {
  if (existingNames.has(spec.field_name)) {
    console.log(`Skip existing field: ${spec.field_name}`);
    continue;
  }

  await createBitableField({ appToken, tableId, accessToken, field: spec });
  console.log(`Created field: ${spec.field_name}`);
  await sleep(60);
}

console.log('Pre-launch calculation table setup complete.');

function text(fieldName, description) {
  return {
    field_name: fieldName,
    type: 1,
    description: description ? { disable_sync: false, text: description } : undefined
  };
}

function number(fieldName, formatter = '0.00') {
  return {
    field_name: fieldName,
    type: 2,
    property: { formatter }
  };
}

function money(fieldName, formatter = '0.00') {
  return number(fieldName, formatter);
}

function percent(fieldName) {
  return number(fieldName, '0.00%');
}

function date(fieldName) {
  return {
    field_name: fieldName,
    type: 5
  };
}

function singleSelect(fieldName, options) {
  return {
    field_name: fieldName,
    type: 3,
    property: {
      options: options.map((name) => ({ name }))
    }
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
