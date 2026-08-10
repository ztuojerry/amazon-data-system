import {
  createBitableField,
  createBitableRecord,
  createBitableTable,
  getTenantAccessToken,
  listBitableFields,
  listBitableRecords,
  listBitableTables,
  updateBitableRecord
} from './lib/feishu.js';
import { requireEnv } from './lib/env.js';

const appToken = requireEnv('FEISHU_BITABLE_APP_TOKEN');
const accessToken = await getTenantAccessToken();
const tableName = '配送费说明来源';

const sources = [
  {
    external_id: 'AU_DELIVERY_SOURCE_2026',
    站点: '澳洲',
    币种: 'AUD',
    来源类型: '图片OCR',
    来源图片路径: 'd:\\Downloads\\Super Browser\\晨曦云澳大利亚\\澳大利亚配送费表_00.png',
    OCR文本路径: 'd:\\Documents\\亚马逊\\tmp\\ocr\\AU-delivery-fees.txt',
    参考链接: 'https://sellercentral.amazon.com.au/help/hub/reference/G201112670',
    结构化状态: '待结构化',
    备注: '澳洲配送费说明长图，已完成本地 OCR。'
  },
  {
    external_id: 'CA_DELIVERY_SOURCE_2026',
    站点: '加拿大',
    币种: 'CAD',
    来源类型: '图片OCR',
    来源图片路径: 'd:\\Downloads\\Super Browser\\晨曦云澳大利亚\\加拿大配送费率表_00.png',
    OCR文本路径: 'd:\\Documents\\亚马逊\\tmp\\ocr\\CA-delivery-fees.txt',
    参考链接: 'https://sellercentral.amazon.com/help/hub/reference/G201112670',
    结构化状态: '待结构化',
    备注: '加拿大配送费说明长图，已完成本地 OCR。'
  },
  {
    external_id: 'US_DELIVERY_SOURCE_2026',
    站点: '美国',
    币种: 'USD',
    来源类型: '图片OCR',
    来源图片路径: 'd:\\Downloads\\Super Browser\\晨曦云澳大利亚\\美国配送费率表_00.png',
    OCR文本路径: 'd:\\Documents\\亚马逊\\tmp\\ocr\\US-delivery-fees.txt',
    参考链接: 'https://sellercentral.amazon.com/help/hub/reference/GABBX6GZPA8MSZGW',
    结构化状态: '待结构化',
    备注: '美国配送费说明长图，已切片并完成本地 OCR。'
  }
];

const fields = [
  text('external_id'),
  singleSelect('站点', ['美国', '加拿大', '澳洲']),
  singleSelect('币种', ['USD', 'CAD', 'AUD']),
  singleSelect('来源类型', ['图片OCR', 'PDF OCR', '手动录入', '官方API']),
  text('来源图片路径'),
  text('OCR文本路径'),
  text('参考链接'),
  singleSelect('结构化状态', ['待结构化', '结构化中', '已完成', '需复核']),
  text('备注')
];

const tableId = await ensureTable();
await ensureFields(tableId);
await upsertRecords(tableId);

console.log(`Delivery source table ready: ${tableName} (${tableId})`);

async function ensureTable() {
  const tables = await listBitableTables({ appToken, accessToken });
  const existing = tables.find((table) => table.name === tableName);
  if (existing) return existing.table_id;

  const response = await createBitableTable({
    appToken,
    accessToken,
    table: {
      name: tableName,
      default_view_name: '全部来源',
      fields: [text('记录名称')]
    }
  });

  return response.data?.table?.table_id ?? response.data?.table_id;
}

async function ensureFields(tableId) {
  const existingFields = await listBitableFields({ appToken, tableId, accessToken });
  const existingNames = new Set(existingFields.map((field) => field.field_name));

  for (const field of fields) {
    if (existingNames.has(field.field_name)) continue;
    await createBitableField({ appToken, tableId, accessToken, field });
    console.log(`Created field: ${field.field_name}`);
    await sleep(120);
  }
}

async function upsertRecords(tableId) {
  const records = await listBitableRecords({ appToken, tableId, accessToken });
  const recordByExternalId = new Map();

  for (const record of records) {
    const externalId = normalizeValue(record.fields?.external_id);
    if (externalId) recordByExternalId.set(externalId, record);
  }

  for (const fields of sources) {
    const existing = recordByExternalId.get(fields.external_id);
    if (existing) {
      await updateBitableRecord({ appToken, tableId, recordId: existing.record_id, accessToken, fields });
      console.log(`Updated: ${fields.external_id}`);
    } else {
      await createBitableRecord({ appToken, tableId, accessToken, fields });
      console.log(`Created: ${fields.external_id}`);
    }
    await sleep(120);
  }
}

function text(fieldName) {
  return { field_name: fieldName, type: 1 };
}

function singleSelect(fieldName, options) {
  return { field_name: fieldName, type: 3, property: { options: options.map((name) => ({ name })) } };
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
