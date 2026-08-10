import { getTenantAccessToken, listBitableTables } from './lib/feishu.js';
import { requireEnv } from './lib/env.js';

const appToken = requireEnv('FEISHU_BITABLE_APP_TOKEN');
const accessToken = await getTenantAccessToken();
const tables = await listBitableTables({ appToken, accessToken });

console.log('Feishu bitable tables:');
for (const table of tables) {
  console.log(`${table.name}\t${table.table_id}`);
}
