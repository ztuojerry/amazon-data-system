import fs from 'node:fs/promises';
import path from 'node:path';
import {
  getTenantAccessToken,
  listBitableRecords
} from './lib/feishu.js';
import { requireEnv } from './lib/env.js';

const appToken = requireEnv('FEISHU_BITABLE_APP_TOKEN');
const productsTableId = requireEnv('FEISHU_TABLE_PRODUCTS');
const profitTableId = requireEnv('FEISHU_TABLE_PROFIT_CALC');
const accessToken = await getTenantAccessToken();

const products = await listBitableRecords({ appToken, tableId: productsTableId, accessToken });
const profitRows = await listBitableRecords({ appToken, tableId: profitTableId, accessToken });

const normalizedProducts = products.map((record) => normalizeRecord(record.fields ?? {}));
const normalizedProfitRows = profitRows.map((record) => normalizeRecord(record.fields ?? {}));

const payload = {
  exportedAt: new Date().toISOString(),
  products: normalizedProducts,
  profitRows: normalizedProfitRows
};

const outDir = path.resolve('amazon-dashboard/data');
await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(
  path.join(outDir, 'dashboard-data.js'),
  `window.AMAZON_DASHBOARD_DATA = ${JSON.stringify(payload, null, 2)};\n`,
  'utf8'
);

console.log(`Exported dashboard data: ${normalizedProducts.length} products, ${normalizedProfitRows.length} profit rows`);

function normalizeRecord(fields) {
  const output = {};
  for (const [key, value] of Object.entries(fields)) {
    output[key] = normalizeValue(value);
  }
  return output;
}

function normalizeValue(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    const values = value.map(normalizeValue).filter((item) => item !== null && item !== '');
    return values.length === 1 ? values[0] : values;
  }
  if (typeof value === 'object') {
    if ('text' in value) return value.text;
    if ('name' in value) return value.name;
    if ('value' in value) return value.value;
    if ('email' in value) return value.email;
    return value;
  }
  return value;
}
