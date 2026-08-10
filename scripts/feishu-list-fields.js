import { getTenantAccessToken, listBitableFields } from './lib/feishu.js';
import { requireEnv } from './lib/env.js';

const appToken = requireEnv('FEISHU_BITABLE_APP_TOKEN');
const tableId = requireEnv('FEISHU_TABLE_PRE_LAUNCH') || requireEnv('FEISHU_TABLE_PRODUCTS');
const accessToken = await getTenantAccessToken();
const fields = await listBitableFields({ appToken, tableId, accessToken });

console.log('Feishu bitable fields:');
for (const field of fields) {
  console.log(`${field.field_name}\t${field.field_id}\t${field.type}`);
}
