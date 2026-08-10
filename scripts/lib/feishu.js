import { requireEnv } from './env.js';

const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

export async function getTenantAccessToken() {
  const response = await requestJson(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    body: {
      app_id: requireEnv('FEISHU_APP_ID'),
      app_secret: requireEnv('FEISHU_APP_SECRET')
    }
  });

  return response.tenant_access_token;
}

export async function listBitableTables({ appToken, accessToken }) {
  const tables = [];
  let pageToken;

  do {
    const url = new URL(`${FEISHU_API_BASE}/bitable/v1/apps/${appToken}/tables`);
    if (pageToken) url.searchParams.set('page_size', '100');
    if (pageToken) url.searchParams.set('page_token', pageToken);

    const response = await requestJson(url, {
      headers: authHeaders(accessToken)
    });

    tables.push(...(response.data?.items ?? []));
    pageToken = response.data?.has_more ? response.data?.page_token : undefined;
  } while (pageToken);

  return tables;
}

export async function createBitableTable({ appToken, accessToken, table }) {
  return requestJson(`${FEISHU_API_BASE}/bitable/v1/apps/${appToken}/tables`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: { table }
  });
}

export async function listBitableRecords({ appToken, tableId, accessToken }) {
  const records = [];
  let pageToken;

  do {
    const url = new URL(`${FEISHU_API_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records`);
    url.searchParams.set('page_size', '500');
    if (pageToken) url.searchParams.set('page_token', pageToken);

    const response = await requestJson(url, {
      headers: authHeaders(accessToken)
    });

    records.push(...(response.data?.items ?? []));
    pageToken = response.data?.has_more ? response.data?.page_token : undefined;
  } while (pageToken);

  return records;
}

export async function createBitableRecord({ appToken, tableId, accessToken, fields }) {
  return requestJson(`${FEISHU_API_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: removeUndefined({ fields })
  });
}

export async function listBitableFields({ appToken, tableId, accessToken }) {
  const fields = [];
  let pageToken;

  do {
    const url = new URL(`${FEISHU_API_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/fields`);
    url.searchParams.set('page_size', '100');
    if (pageToken) url.searchParams.set('page_token', pageToken);

    const response = await requestJson(url, {
      headers: authHeaders(accessToken)
    });

    fields.push(...(response.data?.items ?? []));
    pageToken = response.data?.has_more ? response.data?.page_token : undefined;
  } while (pageToken);

  return fields;
}

export async function createBitableField({ appToken, tableId, accessToken, field }) {
  const url = new URL(`${FEISHU_API_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/fields`);
  url.searchParams.set('client_token', crypto.randomUUID());

  return requestJson(url, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: removeUndefined(field)
  });
}

export async function updateBitableRecord({ appToken, tableId, recordId, accessToken, fields }) {
  return requestJson(`${FEISHU_API_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`, {
    method: 'PUT',
    headers: authHeaders(accessToken),
    body: removeUndefined({ fields })
  });
}

function removeUndefined(value) {
  if (Array.isArray(value)) {
    return value.map(removeUndefined);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, removeUndefined(item)])
  );
}

function authHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`
  };
}

async function requestJson(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    ...(options.headers ?? {})
  };

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    signal: AbortSignal.timeout(options.timeoutMs ?? 20000),
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok || payload.code !== 0) {
    throw new Error(`Feishu API error ${response.status}: ${text}`);
  }

  return payload;
}
