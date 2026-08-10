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
const tableId = requireEnv('FEISHU_TABLE_COMMISSION_REFERENCE');
const accessToken = await getTenantAccessToken();

const requiredFields = [
  text('external_id'),
  singleSelect('站点', ['美国', '加拿大', '澳洲']),
  text('分类'),
  singleSelect('规则类型', ['固定比例', '分段比例']),
  number('佣金率', '0.00%'),
  number('阈值(外币)', '0.00'),
  number('低价佣金率', '0.00%'),
  number('中价佣金率', '0.00%'),
  number('高价佣金率', '0.00%'),
  number('阈值2(外币)', '0.00'),
  number('最低销售佣金(外币)', '0.00'),
  text('计费说明'),
  text('规则JSON'),
  text('备注')
];

const auReferralFees = [
  fixed('酒精饮料', 0.10),
  fixed('汽车用品', 0.105),
  tier('母婴用品', 20, 0.08, 0.11, '售价不超过 20 澳元收取 8%；超过 20 澳元收取 11%'),
  fixed('基础电动工具', 0.07),
  tier('美妆、健康及个护用品', 20, 0.08, 0.13, '售价不超过 20 澳元收取 8%；超过 20 澳元收取 13%'),
  fixed('商业、工业与科学用品', 0.11),
  tier('服装与配饰', 20, 0.10, 0.13, '售价不超过 20 澳元收取 10%；超过 20 澳元收取 13%'),
  tier('电脑', 150, 0.08, 0.06, '售价中不超过 150 澳元的部分收取 8%；超过 150 澳元的部分收取 6%'),
  fixed('消费类电子产品', 0.08),
  fixed('电子产品配件', 0.135),
  fixed('家具', 0.12),
  tier('食品', 20, 0.08, 0.10, '售价不超过 20 澳元收取 8%；超过 20 澳元收取 10%'),
  fixed('家居及厨房', 0.13),
  fixed('家居及厨房用品', 0.08),
  tier('珠宝首饰', 200, 0.15, 0.05, '售价中不超过 200 澳元的部分收取 15%；超过 200 澳元的部分收取 5%'),
  fixed('草坪及花园', 0.105),
  fixed('箱包', 0.13),
  fixed('大型家电', 0.07),
  fixed('媒介类（图书、DVD、音乐、软件、影视）', 0.15),
  fixed('乐器及影音制作', 0.11),
  fixed('办公用品', 0.13),
  tier('宠物用品', 20, 0.10, 0.13, '售价不超过 20 澳元收取 10%；超过 20 澳元收取 13%'),
  tier('鞋靴、手提包及太阳镜', 50, 0.14, 0.10, '售价中不超过 50 澳元的部分收取 14%；超过 50 澳元的部分收取 10%'),
  tier('体育及户外用品', 200, 0.13, 0.12, '售价中不超过 200 澳元的部分收取 13%；超过 200 澳元的部分收取 12%'),
  tier('工具及家居装修', 20, 0.10, 0.13, '售价不超过 20 澳元收取 10%；超过 20 澳元收取 13%'),
  fixed('玩具及游戏', 0.12),
  fixed('轮胎', 0.09),
  fixed('视频游戏机', 0.06),
  fixed('视频游戏及游戏配件', 0.09),
  tier('钟表', 50, 0.12, 0.08, '售价中不超过 50 澳元的部分收取 12%；超过 50 澳元的部分收取 8%'),
  fixed('其他', 0.15, '如果商品无法明确归入任何现有分类，可使用“其他”')
];

await ensureFields();
await upsertFeeRecords();

console.log(`Australian referral fee table setup complete. ${auReferralFees.length} category rules processed.`);

async function ensureFields() {
  const existingFields = await listBitableFields({ appToken, tableId, accessToken });
  const existingNames = new Set(existingFields.map((field) => field.field_name));

  for (const field of requiredFields) {
    if (existingNames.has(field.field_name)) {
      continue;
    }

    await createBitableField({ appToken, tableId, accessToken, field });
    console.log(`Created field: ${field.field_name}`);
    await sleep(120);
  }
}

async function upsertFeeRecords() {
  const records = await listBitableRecords({ appToken, tableId, accessToken });
  const recordByExternalId = new Map();

  for (const record of records) {
    const externalId = normalizeValue(record.fields?.external_id);
    if (externalId) {
      recordByExternalId.set(externalId, record);
    }
  }

  for (const fields of auReferralFees) {
    const existingRecord = recordByExternalId.get(fields.external_id);

    if (existingRecord) {
      await updateBitableRecord({
        appToken,
        tableId,
        recordId: existingRecord.record_id,
        accessToken,
        fields
      });
      console.log(`Updated: ${fields.external_id}`);
    } else {
      await createBitableRecord({ appToken, tableId, accessToken, fields });
      console.log(`Created: ${fields.external_id}`);
    }

    await sleep(120);
  }
}

function fixed(category, rate, note = '') {
  return {
    external_id: `AU_${category}`,
    站点: '澳洲',
    分类: category,
    规则类型: '固定比例',
    佣金率: rate,
    阈值: undefined,
    低价佣金率: rate,
    中价佣金率: rate,
    高价佣金率: rate,
    计费说明: `销售佣金百分比 ${formatPercent(rate)}`,
    规则JSON: JSON.stringify({ type: 'fixed', rate, minimum_fee: null }),
    备注: note
  };
}

function tier(category, threshold, lowRate, highRate, description) {
  return {
    external_id: `AU_${category}`,
    站点: '澳洲',
    分类: category,
    规则类型: '分段比例',
    佣金率: lowRate,
    '阈值(外币)': threshold,
    低价佣金率: lowRate,
    中价佣金率: highRate,
    高价佣金率: highRate,
    计费说明: description,
    规则JSON: JSON.stringify({
      type: 'tiered',
      tiers: [
        { to: threshold, rate: lowRate },
        { from: threshold, rate: highRate }
      ],
      minimum_fee: null
    }),
    备注: ''
  };
}

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

function formatPercent(value) {
  return `${Number(value * 100).toFixed(value * 100 % 1 === 0 ? 0 : 1)}%`;
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
