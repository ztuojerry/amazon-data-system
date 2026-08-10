import {
  createBitableField,
  createBitableRecord,
  createBitableTable,
  getTenantAccessToken,
  listBitableFields,
  listBitableRecords,
  listBitableTables
} from './lib/feishu.js';
import { requireEnv } from './lib/env.js';

const appToken = requireEnv('FEISHU_BITABLE_APP_TOKEN');
const accessToken = await getTenantAccessToken();

const tableDefinitions = [
  {
    name: '产品主数据',
    defaultViewName: '全部产品',
    fields: [
      text('external_id'),
      text('产品名'),
      text('SKU'),
      text('ASIN'),
      text('FNSKU'),
      text('主图地址'),
      singleSelect('Brand', ['ATIDOHA', 'MIFACIE', 'CHESEY']),
      singleSelect('默认站点', ['美国', '加拿大', '澳洲']),
      singleSelect('分类', ['服装与配饰', '家居', '厨房', '运动户外', '美妆个护', '其他']),
      text('供应商1'),
      text('供应商产品链接'),
      text('供应商型号'),
      text('尺码颜色选项'),
      singleSelect('产品状态', ['选品中', '打样中', '待上架', '已上架', '停售']),
      text('备注'),
      singleSelect('sync_status', ['pending', 'synced', 'error']),
      text('sync_error'),
      date('last_synced_at')
    ],
    sampleRecords: [
      {
        external_id: 'ATGFSS001BK-FBA',
        产品名: '运动压力袜',
        SKU: 'ATGFSS001BK-FBA',
        ASIN: 'B0GJ672LYP',
        FNSKU: 'X001CLF0DX',
        主图地址: 'https://m.media-amazon.com/images/I/611fyfcu6NL._AC_SX569_.jpg',
        Brand: 'ATIDOHA',
        默认站点: '澳洲',
        分类: '服装与配饰',
        供应商1: '嘉兴美克斯袜业有限公司',
        供应商产品链接: 'https://detail.1688.com/offer/652795342538.html?spm=a360q.8274423%2Fnew.goods.productname',
        尺码颜色选项: '颜色: 神秘黑（反光标） 尺码: L/XL（41-44码）',
        产品状态: '待上架',
        sync_status: 'pending'
      }
    ]
  },
  {
    name: '站点利润核算',
    defaultViewName: '利润方案',
    fields: [
      text('external_id'),
      text('SKU'),
      text('产品名'),
      singleSelect('上架站点', ['美国', '加拿大', '澳洲']),
      singleSelect('币种', ['USD', 'CAD', 'AUD']),
      singleSelect('Brand', ['ATIDOHA', 'MIFACIE', 'CHESEY']),
      singleSelect('分类', ['服装与配饰', '家居', '厨房', '运动户外', '美妆个护', '其他']),
      number('售价(外币)', '0.00'),
      number('汇率', '0.0000'),
      number('售价(人民币)', '¥0.00'),
      percent('佣金率'),
      number('佣金(外币)', '0.00'),
      number('佣金(人民币)', '¥0.00'),
      number('配送费(外币)', '0.00'),
      number('配送费(人民币)', '¥0.00'),
      number('出厂价(人民币)', '¥0.00'),
      text('附加项'),
      number('附加金额(人民币)', '¥0.00'),
      number('单品长cm', '0.000'),
      number('单品宽cm', '0.000'),
      number('单品高cm', '0.000'),
      number('单品长inch', '0.000'),
      number('单品宽inch', '0.000'),
      number('单品高inch', '0.000'),
      number('配送重量kg', '0.000'),
      number('配送重量lb', '0.000'),
      number('商品重量kg', '0.000'),
      number('商品重量lb', '0.000'),
      number('亚马逊体积重量kg', '0.000'),
      number('亚马逊体积重量lb', '0.000'),
      number('整箱长cm', '0.00'),
      number('整箱宽cm', '0.00'),
      number('整箱高cm', '0.00'),
      number('整箱数量', '0'),
      number('整箱重量kg', '0.000'),
      number('整箱单品重量kg', '0.000'),
      number('物流体积重量kg_5000', '0.000'),
      number('物流体积重量kg_6000', '0.000'),
      number('核算单品重量kg', '0.000'),
      number('空运单价(人民币/kg)', '¥0.00'),
      number('空运头程(人民币)', '¥0.00'),
      number('空运利润(人民币)', '¥0.00'),
      percent('空运利润率'),
      number('空运投产比', '0.00'),
      number('海运单价(人民币/kg)', '¥0.00'),
      number('海运头程(人民币)', '¥0.00'),
      number('海运利润(人民币)', '¥0.00'),
      percent('海运利润率'),
      number('海运投产比', '0.00'),
      singleSelect('推荐方案', ['空运', '海运', '待确认']),
      text('备注'),
      singleSelect('sync_status', ['pending', 'synced', 'error']),
      text('sync_error'),
      date('last_synced_at')
    ],
    sampleRecords: [
      {
        external_id: 'ATGFSS001BK-FBA_AU',
        SKU: 'ATGFSS001BK-FBA',
        产品名: '运动压力袜',
        上架站点: '澳洲',
        币种: 'AUD',
        Brand: 'ATIDOHA',
        分类: '服装与配饰',
        '售价(外币)': 18.99,
        汇率: 4.74,
        '佣金率': 0.1,
        '佣金(外币)': 1.899,
        '配送费(外币)': 5.61,
        '出厂价(人民币)': 19.5,
        附加项: '定制纸盒',
        '附加金额(人民币)': 5,
        单品长cm: 22.999,
        单品宽cm: 18.999,
        单品高cm: 2.499,
        配送重量kg: 0.24,
        商品重量kg: 0.24,
        亚马逊体积重量kg: 0.26,
        '空运单价(人民币/kg)': 42,
        '海运单价(人民币/kg)': 12,
        推荐方案: '待确认',
        sync_status: 'pending'
      }
    ]
  },
  {
    name: '分类佣金参考',
    defaultViewName: '佣金率',
    fields: [
      text('external_id'),
      singleSelect('站点', ['美国', '加拿大', '澳洲']),
      singleSelect('分类', ['服装与配饰', '家居', '厨房', '运动户外', '美妆个护', '其他']),
      percent('佣金率'),
      text('备注')
    ],
    sampleRecords: [
      { external_id: 'AU_服装与配饰', 站点: '澳洲', 分类: '服装与配饰', 佣金率: 0.1 },
      { external_id: 'US_服装与配饰', 站点: '美国', 分类: '服装与配饰', 佣金率: 0.1 },
      { external_id: 'CA_服装与配饰', 站点: '加拿大', 分类: '服装与配饰', 佣金率: 0.1 }
    ]
  },
  {
    name: '配送费参考',
    defaultViewName: '配送费',
    fields: [
      text('external_id'),
      singleSelect('站点', ['美国', '加拿大', '澳洲']),
      singleSelect('分类', ['服装与配饰', '家居', '厨房', '运动户外', '美妆个护', '其他']),
      text('尺寸分段'),
      number('重量上限kg', '0.000'),
      number('配送费(外币)', '0.00'),
      text('备注')
    ],
    sampleRecords: [
      { external_id: 'AU_服装与配饰_0.5kg', 站点: '澳洲', 分类: '服装与配饰', 尺寸分段: '小件/服装参考', 重量上限kg: 0.5, '配送费(外币)': 5.61 }
    ]
  },
  {
    name: '物流费率',
    defaultViewName: '头程费率',
    fields: [
      text('external_id'),
      singleSelect('站点', ['美国', '加拿大', '澳洲']),
      singleSelect('运输方式', ['空运', '海运']),
      number('单价(人民币/kg)', '¥0.00'),
      singleSelect('体积重除数', ['4000', '5000', '6000']),
      text('备注')
    ],
    sampleRecords: [
      { external_id: 'AU_空运', 站点: '澳洲', 运输方式: '空运', '单价(人民币/kg)': 42, 体积重除数: '5000' },
      { external_id: 'AU_海运', 站点: '澳洲', 运输方式: '海运', '单价(人民币/kg)': 12, 体积重除数: '5000' }
    ]
  }
];

const existingTables = await listBitableTables({ appToken, accessToken });
const tableByName = new Map(existingTables.map((table) => [table.name, table]));
const createdSummary = [];

for (const definition of tableDefinitions) {
  let table = tableByName.get(definition.name);

  if (!table) {
    const response = await createBitableTable({
      appToken,
      accessToken,
      table: {
        name: definition.name,
        default_view_name: definition.defaultViewName,
        fields: [text('记录名称')]
      }
    });

    table = response.data?.table ?? response.data;
    console.log(`Created table: ${definition.name} (${table.table_id})`);
    await sleep(300);
  } else {
    console.log(`Using existing table: ${definition.name} (${table.table_id})`);
  }

  await ensureFields(table.table_id, definition.fields);
  await seedRecords(table.table_id, definition.sampleRecords);
  createdSummary.push({ name: definition.name, table_id: table.table_id });
}

console.log('Amazon Feishu system setup complete:');
console.log(JSON.stringify(createdSummary, null, 2));

async function ensureFields(tableId, fields) {
  const existingFields = await listBitableFields({ appToken, tableId, accessToken });
  const existingNames = new Set(existingFields.map((field) => field.field_name));

  for (const field of fields) {
    if (existingNames.has(field.field_name)) {
      console.log(`  Skip field: ${field.field_name}`);
      continue;
    }

    await createBitableField({ appToken, tableId, accessToken, field });
    console.log(`  Created field: ${field.field_name}`);
    await sleep(120);
  }
}

async function seedRecords(tableId, records = []) {
  const existingRecords = await listBitableRecords({ appToken, tableId, accessToken });
  if (existingRecords.length > 0) {
    console.log(`  Skip seed records: table already has ${existingRecords.length} record(s)`);
    return;
  }

  for (const fields of records) {
    await createBitableRecord({ appToken, tableId, accessToken, fields });
    console.log(`  Added sample record: ${fields.external_id ?? fields.SKU ?? 'record'}`);
    await sleep(120);
  }
}

function text(fieldName) {
  return { field_name: fieldName, type: 1 };
}

function number(fieldName, formatter = '0.00') {
  return { field_name: fieldName, type: 2, property: { formatter } };
}

function percent(fieldName) {
  return number(fieldName, '0.00%');
}

function date(fieldName) {
  return { field_name: fieldName, type: 5 };
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
