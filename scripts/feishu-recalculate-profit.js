import {
  getTenantAccessToken,
  listBitableRecords,
  updateBitableRecord
} from './lib/feishu.js';
import { requireEnv } from './lib/env.js';

const appToken = requireEnv('FEISHU_BITABLE_APP_TOKEN');
const tableId = requireEnv('FEISHU_TABLE_PROFIT_CALC');
const accessToken = await getTenantAccessToken();

const records = await listBitableRecords({ appToken, tableId, accessToken });

for (const record of records) {
  const source = record.fields ?? {};
  const calculated = calculateProfit(source);

  await updateBitableRecord({
    appToken,
    tableId,
    recordId: record.record_id,
    accessToken,
    fields: calculated
  });

  console.log(`Recalculated: ${textValue(source.SKU) ?? record.record_id}`);
}

function calculateProfit(row) {
  const price = num(row['售价(外币)']);
  const fx = num(row['汇率']);
  const commissionRate = num(row['佣金率']);
  const factoryCost = num(row['出厂价(人民币)']);
  const extraCost = num(row['附加金额(人民币)']);

  const lengthCm = num(row['单品长cm']);
  const widthCm = num(row['单品宽cm']);
  const heightCm = num(row['单品高cm']);
  const deliveryWeightKg = num(row['配送重量kg']);
  const productWeightKg = num(row['商品重量kg']);

  const cartonLengthCm = num(row['整箱长cm']);
  const cartonWidthCm = num(row['整箱宽cm']);
  const cartonHeightCm = num(row['整箱高cm']);
  const cartonQuantity = num(row['整箱数量']);
  const cartonWeightKg = num(row['整箱重量kg']);

  const priceRmb = price * fx;
  const commissionForeign = price * commissionRate;
  const commissionRmb = commissionForeign * fx;

  const itemLengthInch = lengthCm / 2.54;
  const itemWidthInch = widthCm / 2.54;
  const itemHeightInch = heightCm / 2.54;
  const deliveryWeightLb = deliveryWeightKg * 2.2046226218;
  const productWeightLb = productWeightKg * 2.2046226218;
  const amazonVolumeWeightKg = lengthCm * widthCm * heightCm / 4000;
  const amazonVolumeWeightLb = amazonVolumeWeightKg * 2.2046226218;

  const cartonUnitWeightKg = cartonQuantity > 0 ? cartonWeightKg / cartonQuantity : 0;
  const cartonVolumeWeight5000 = cartonQuantity > 0
    ? cartonLengthCm * cartonWidthCm * cartonHeightCm / 5000 / cartonQuantity
    : lengthCm * widthCm * heightCm / 5000;
  const cartonVolumeWeight6000 = cartonQuantity > 0
    ? cartonLengthCm * cartonWidthCm * cartonHeightCm / 6000 / cartonQuantity
    : lengthCm * widthCm * heightCm / 6000;

  const billableWeightKg = Math.max(
    deliveryWeightKg,
    productWeightKg,
    amazonVolumeWeightKg,
    cartonUnitWeightKg,
    cartonVolumeWeight5000
  );

  const delivery = resolveDeliveryFee(row, {
    price,
    lengthCm,
    widthCm,
    heightCm,
    weightKg: Math.max(deliveryWeightKg, productWeightKg, amazonVolumeWeightKg)
  });
  const deliveryFee = delivery.fee;
  const deliveryFeeRmb = deliveryFee * fx;

  const airUnitPrice = num(row['空运单价(人民币/kg)']);
  const seaUnitPrice = num(row['海运单价(人民币/kg)']);
  const airFreight = airUnitPrice * billableWeightKg;
  const seaFreight = seaUnitPrice * billableWeightKg;

  const airProfit = priceRmb - commissionRmb - deliveryFeeRmb - factoryCost - airFreight - extraCost;
  const seaProfit = priceRmb - commissionRmb - deliveryFeeRmb - factoryCost - seaFreight - extraCost;

  const airInvestment = factoryCost + airFreight + extraCost;
  const seaInvestment = factoryCost + seaFreight + extraCost;

  return {
    '售价(人民币)': round(priceRmb),
    '佣金(外币)': round(commissionForeign),
    '佣金(人民币)': round(commissionRmb),
    '自动配送费(外币)': round(delivery.autoFee),
    '配送费(外币)': round(deliveryFee),
    '配送费(人民币)': round(deliveryFeeRmb),
    '配送费规则命中': delivery.ruleHit,
    '配送费复核状态': delivery.reviewStatus,
    '单品长inch': round(itemLengthInch, 3),
    '单品宽inch': round(itemWidthInch, 3),
    '单品高inch': round(itemHeightInch, 3),
    '配送重量lb': round(deliveryWeightLb, 3),
    '商品重量lb': round(productWeightLb, 3),
    '亚马逊体积重量kg': round(amazonVolumeWeightKg, 3),
    '亚马逊体积重量lb': round(amazonVolumeWeightLb, 3),
    '整箱单品重量kg': round(cartonUnitWeightKg, 3),
    '物流体积重量kg_5000': round(cartonVolumeWeight5000, 3),
    '物流体积重量kg_6000': round(cartonVolumeWeight6000, 3),
    '核算单品重量kg': round(billableWeightKg, 3),
    '空运头程(人民币)': round(airFreight),
    '空运利润(人民币)': round(airProfit),
    '空运利润率': ratio(airProfit, priceRmb),
    '空运投产比': ratio(airProfit, airInvestment),
    '海运头程(人民币)': round(seaFreight),
    '海运利润(人民币)': round(seaProfit),
    '海运利润率': ratio(seaProfit, priceRmb),
    '海运投产比': ratio(seaProfit, seaInvestment),
    推荐方案: seaProfit >= airProfit ? '海运' : '空运',
    sync_status: 'pending'
  };
}

function resolveDeliveryFee(row, input) {
  const mode = textValue(row['配送费获取方式']);
  const manualFee = num(row['手动配送费(外币)']);
  const existingFee = num(row['配送费(外币)']);
  const site = textValue(row['上架站点']);
  const category = textValue(row['分类']);

  const auto = autoDeliveryFee({ ...input, site, category });
  const autoFee = auto?.fee ?? 0;

  if (mode === '手动' && manualFee > 0) {
    return {
      fee: manualFee,
      autoFee,
      ruleHit: `手动覆盖；自动参考：${auto?.ruleHit ?? '未命中'}`,
      reviewStatus: '已复核'
    };
  }

  if (autoFee > 0) {
    return {
      fee: autoFee,
      autoFee,
      ruleHit: auto.ruleHit,
      reviewStatus: '未复核'
    };
  }

  return {
    fee: existingFee,
    autoFee: 0,
    ruleHit: '自动规则未命中，保留原配送费；请手动填写或补充参考表',
    reviewStatus: '需调整'
  };
}

function autoDeliveryFee({ site, category, price, lengthCm, widthCm, heightCm, weightKg }) {
  const normalizedSite = normalizeSite(site);
  if (normalizedSite === 'AU') {
    return auDeliveryFee({ category, price, lengthCm, widthCm, heightCm, weightKg });
  }
  if (normalizedSite === 'CA') {
    return caDeliveryFee({ lengthCm, widthCm, heightCm, weightKg });
  }
  if (normalizedSite === 'US') {
    return usDeliveryFee({ price, lengthCm, widthCm, heightCm, weightKg });
  }
  return null;
}

function auDeliveryFee({ category, price, lengthCm, widthCm, heightCm, weightKg }) {
  const dims = [lengthCm, widthCm, heightCm].sort((a, b) => b - a);
  const weightG = Math.ceil(weightKg * 1000);
  const group = auPriceGroup(category, price);
  const rules = [
    rule('小号信封', [20, 15, 1], 75, [[0, 75, [3.20, 3.64, 4.55, 4.55]]]),
    rule('标准信封', [33, 23, 2.5], 475, [
      [0, 75, [3.30, 3.67, 4.58, 4.58]],
      [76, 225, [3.44, 4.35, 4.60, 5.26]],
      [226, 475, [3.72, 4.70, 5.06, 5.61]]
    ]),
    rule('大号信封', [33, 23, 5], 975, [
      [0, 225, [3.72, 5.87, 5.06, 6.78]],
      [226, 475, [3.98, 6.11, 5.06, 7.02]],
      [476, 975, [3.98, 6.33, 5.06, 7.24]]
    ]),
    rule('包裹', [45, 34, 20], 12000, [
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
    ])
  ];

  for (const item of rules) {
    if (!fitsDims(dims, item.maxDims) || weightG > item.maxWeightG) continue;
    const tier = item.tiers.find(([min, max]) => weightG >= min && weightG <= max);
    if (!tier) continue;
    const fee = tier[2][group];
    return {
      fee,
      ruleHit: `AU ${item.name} ${tier[0]}-${tier[1]}g priceGroup=${group + 1}`
    };
  }
  return null;
}

function caDeliveryFee({ lengthCm, widthCm, heightCm, weightKg }) {
  const dims = [lengthCm, widthCm, heightCm].sort((a, b) => b - a);
  const weightG = Math.ceil(weightKg * 1000);
  if (fitsDims(dims, [45, 35, 20]) && weightG <= 1500) {
    const tiers = [
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
    const tier = tiers.find(([min, max]) => weightG >= min && weightG <= max);
    if (tier) return { fee: tier[2], ruleHit: `CA 标准尺寸 ${tier[0]}-${tier[1]}g 非旺季` };
  }
  return null;
}

function usDeliveryFee({ price, lengthCm, widthCm, heightCm, weightKg }) {
  const dims = [lengthCm, widthCm, heightCm].sort((a, b) => b - a);
  const weightLb = weightKg * 2.2046226218;
  const priceGroup = price < 10 ? 0 : price <= 50 ? 1 : 2;

  if (fitsDims(dims, [15, 12, 0.75]) && weightLb <= 1) {
    const tiers = [
      [0, 0.125, [2.50, 3.27, 3.27]],
      [0.125, 0.25, [2.50, 3.27, 3.27]],
      [0.25, 0.375, [2.65, 3.42, 3.42]],
      [0.375, 0.5, [2.65, 3.42, 3.42]],
      [0.5, 0.625, [2.76, 3.53, 3.53]],
      [0.625, 0.75, [2.83, 3.60, 3.60]],
      [0.75, 0.875, [2.91, 3.68, 3.68]],
      [0.875, 1.0, [3.04, 3.81, 3.81]]
    ];
    const tier = tiers.find(([min, max]) => weightLb > min && weightLb <= max);
    if (tier) return { fee: tier[2][priceGroup], ruleHit: `US 小号标准 ${tier[0]}-${tier[1]}lb 非旺季` };
  }

  if (fitsDims(dims, [18, 14, 8]) && weightLb <= 3) {
    const tiers = [
      [0, 0.25, [3.25, 4.02, 4.02]],
      [0.25, 0.5, [3.35, 4.12, 4.12]],
      [0.5, 0.75, [3.49, 4.26, 4.26]],
      [0.75, 1, [3.63, 4.40, 4.40]],
      [1, 1.25, [4.35, 5.12, 5.12]],
      [1.25, 1.5, [4.60, 5.37, 5.37]],
      [1.5, 1.75, [4.75, 5.52, 5.52]],
      [1.75, 2, [5.00, 5.77, 5.77]],
      [2, 2.25, [5.10, 5.87, 5.87]],
      [2.25, 2.5, [5.28, 6.05, 6.05]],
      [2.5, 2.75, [5.44, 6.21, 6.21]],
      [2.75, 3, [5.85, 6.62, 6.62]]
    ];
    const tier = tiers.find(([min, max]) => weightLb > min && weightLb <= max);
    if (tier) return { fee: tier[2][priceGroup], ruleHit: `US 大号标准 ${tier[0]}-${tier[1]}lb 非旺季` };
  }
  return null;
}

function auPriceGroup(category, price) {
  const special = ['家居及厨房', '家居及厨房用品', '宠物用品'];
  const midSpecial = ['家居及厨房', '家居及厨房用品', '宠物用品', '食品', '运动户外', '体育及户外用品'];
  if (price < 13) return special.includes(category) ? 0 : 1;
  if (price < 20) return midSpecial.includes(category) ? 2 : 3;
  return 3;
}

function rule(name, maxDims, maxWeightG, tiers) {
  return { name, maxDims, maxWeightG, tiers };
}

function fitsDims(dims, maxDims) {
  return dims.every((value, index) => value <= maxDims[index]);
}

function normalizeSite(site) {
  if (site === '澳洲' || site === '澳大利亚' || site === 'AU') return 'AU';
  if (site === '加拿大' || site === 'CA') return 'CA';
  if (site === '美国' || site === 'US') return 'US';
  return site;
}

function num(value) {
  const text = textValue(value);
  if (text === null || text === '') return 0;
  return Number(String(text).replace(/[,$¥]/g, '')) || 0;
}

function textValue(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return textValue(value[0]);
  if (typeof value === 'object') {
    if ('text' in value) return value.text;
    if ('value' in value) return value.value;
    if ('name' in value) return value.name;
    return null;
  }
  return value;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function ratio(numerator, denominator) {
  if (!denominator) return 0;
  return round(numerator / denominator, 4);
}
