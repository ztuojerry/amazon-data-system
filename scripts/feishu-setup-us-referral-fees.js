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

const minimumFee = 0.3;

const usReferralFees = [
  fixed('亚马逊设备配件', 0.45, minimumFee),
  fixed('汽车和户外动力设备', 0.12, minimumFee),
  tier('母婴', 10, 0.08, 0.15, minimumFee, '售价不超过 10.00 美元收取 8%；超过 10.00 美元收取 15%'),
  fixed('背包、手提包和箱包', 0.15, minimumFee),
  fixed('基础设备电动工具', 0.12, minimumFee),
  tier('美妆和个护健康', 10, 0.08, 0.15, minimumFee, '售价不超过 10.00 美元收取 8%；超过 10.00 美元收取 15%'),
  fixed('商业、工业与科学用品', 0.12, minimumFee),
  multi('服装和配饰', [
    { to: 15, rate: 0.05 },
    { from: 15, to: 20, rate: 0.10 },
    { from: 20, rate: 0.17 }
  ], minimumFee, '售价不超过 15.00 美元收取 5%；超过 15.00 且不超过 20.00 美元收取 10%；超过 20.00 美元收取 17%'),
  tier('小型电器', 300, 0.15, 0.08, minimumFee, '售价中不超过 300.00 美元的部分收取 15%；超过 300.00 美元的部分收取 8%'),
  fixed('电脑', 0.08, minimumFee),
  fixed('消费类电子产品', 0.08, minimumFee),
  tier('电子产品配件', 100, 0.15, 0.08, minimumFee, '售价中不超过 100.00 美元的部分收取 15%；超过 100.00 美元的部分收取 8%'),
  fixed('所有其他分类', 0.15, minimumFee),
  fixed('眼镜', 0.15, minimumFee),
  multi('艺术品', [
    { to: 100, rate: 0.20 },
    { from: 100, to: 1000, rate: 0.15 },
    { from: 1000, to: 5000, rate: 0.10 },
    { from: 5000, rate: 0.05 }
  ], null, '售价中不超过 100 美元部分收取 20%；超过 100 且不超过 1,000 美元部分收取 15%；超过 1,000 且不超过 5,000 美元部分收取 10%；超过 5,000 美元部分收取 5%'),
  fixed('鞋靴', 0.15, minimumFee),
  fixed('全尺寸电器', 0.08, minimumFee),
  tier('家具', 200, 0.15, 0.10, minimumFee, '售价中不超过 200.00 美元的部分收取 15%；超过 200.00 美元的部分收取 10%'),
  fixed('礼品卡', 0.20, null),
  tier('食品', 15, 0.08, 0.15, minimumFee, '售价不超过 15.00 美元收取 8%；超过 15.00 美元收取 15%'),
  fixed('家居及厨房用品', 0.15, minimumFee),
  tier('珠宝首饰', 250, 0.20, 0.05, minimumFee, '售价中不超过 250.00 美元的部分收取 20%；超过 250.00 美元的部分收取 5%'),
  fixed('草坪和园艺', 0.15, minimumFee),
  tier('割草机和除雪机', 500, 0.15, 0.08, minimumFee, '售价不超过 500.00 美元收取 15%；超过 500.00 美元收取 8%'),
  fixed('床垫', 0.15, minimumFee),
  fixed('媒介类商品 - 图书、DVD、音乐、软件、视频', 0.15, null),
  fixed('卖家自配送服务', 0.20, minimumFee),
  fixed('乐器和影音制作', 0.15, minimumFee),
  fixed('办公用品', 0.15, minimumFee),
  fixed('宠物用品', 0.15, minimumFee, '但处方宠物粮为 22%'),
  fixed('运动户外', 0.15, minimumFee),
  fixed('轮胎', 0.10, minimumFee),
  fixed('工具和家居装修', 0.15, minimumFee),
  fixed('玩具和游戏', 0.15, minimumFee),
  fixed('视频游戏机', 0.08, null),
  fixed('视频游戏和游戏配件', 0.15, null),
  tier('钟表', 1500, 0.16, 0.03, minimumFee, '售价中不超过 1,500.00 美元的部分收取 16%；超过 1,500.00 美元的部分收取 3%')
];

await ensureFields();
await upsertFeeRecords();

console.log(`US referral fee table setup complete. ${usReferralFees.length} category rules processed.`);

async function ensureFields() {
  const existingFields = await listBitableFields({ appToken, tableId, accessToken });
  const existingNames = new Set(existingFields.map((field) => field.field_name));

  for (const field of requiredFields) {
    if (existingNames.has(field.field_name)) continue;
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
    if (externalId) recordByExternalId.set(externalId, record);
  }

  for (const fields of usReferralFees) {
    const existingRecord = recordByExternalId.get(fields.external_id);
    if (existingRecord) {
      await updateBitableRecord({ appToken, tableId, recordId: existingRecord.record_id, accessToken, fields });
      console.log(`Updated: ${fields.external_id}`);
    } else {
      await createBitableRecord({ appToken, tableId, accessToken, fields });
      console.log(`Created: ${fields.external_id}`);
    }
    await sleep(120);
  }
}

function fixed(category, rate, minFee = minimumFee, note = '') {
  return {
    external_id: `US_${category}`,
    站点: '美国',
    分类: category,
    规则类型: '固定比例',
    佣金率: rate,
    低价佣金率: rate,
    中价佣金率: rate,
    高价佣金率: rate,
    '最低销售佣金(外币)': minFee,
    计费说明: `销售佣金百分比 ${formatPercent(rate)}`,
    规则JSON: JSON.stringify({ type: 'fixed', rate, minimum_fee: minFee }),
    备注: note
  };
}

function tier(category, threshold, lowRate, highRate, minFee, description) {
  return {
    external_id: `US_${category}`,
    站点: '美国',
    分类: category,
    规则类型: '分段比例',
    佣金率: lowRate,
    '阈值(外币)': threshold,
    低价佣金率: lowRate,
    中价佣金率: highRate,
    高价佣金率: highRate,
    '最低销售佣金(外币)': minFee,
    计费说明: description,
    规则JSON: JSON.stringify({
      type: 'tiered',
      tiers: [
        { to: threshold, rate: lowRate },
        { from: threshold, rate: highRate }
      ],
      minimum_fee: minFee
    }),
    备注: ''
  };
}

function multi(category, tiers, minFee, description) {
  const first = tiers[0] ?? {};
  const second = tiers[1] ?? first;
  const last = tiers[tiers.length - 1] ?? first;
  return {
    external_id: `US_${category}`,
    站点: '美国',
    分类: category,
    规则类型: '分段比例',
    佣金率: first.rate,
    '阈值(外币)': first.to,
    低价佣金率: first.rate,
    中价佣金率: second.rate,
    高价佣金率: last.rate,
    '阈值2(外币)': second.to,
    '最低销售佣金(外币)': minFee,
    计费说明: description,
    规则JSON: JSON.stringify({ type: 'tiered', tiers, minimum_fee: minFee }),
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
  return { field_name: fieldName, type: 3, property: { options: options.map((name) => ({ name })) } };
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
