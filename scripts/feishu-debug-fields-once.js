import { getTenantAccessToken } from './lib/feishu.js';
import { requireEnv } from './lib/env.js';

const appToken = requireEnv('FEISHU_BITABLE_APP_TOKEN');
const tableId = requireEnv('FEISHU_TABLE_PRE_LAUNCH') || requireEnv('FEISHU_TABLE_PRODUCTS');
const accessToken = await getTenantAccessToken();
const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields?page_size=100`;

const response = await fetch(url, {
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json; charset=utf-8'
  },
  signal: AbortSignal.timeout(20000)
});

console.log(response.status);
console.log(await response.text());
