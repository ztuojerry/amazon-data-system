import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTenantAccessToken, listBitableRecords, updateBitableRecord } from './lib/feishu.js';
import { upsertRows } from './lib/supabase.js';
import { getEnv, requireEnv } from './lib/env.js';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(rootDir, '..', 'feishu-bitable-config.template.json');
const config = JSON.parse(await fs.readFile(configPath, 'utf8'));

const appToken = requireEnv('FEISHU_BITABLE_APP_TOKEN');
const accessToken = await getTenantAccessToken();

const tableMappings = config.feishu.tables;

for (const [targetTable, tableConfig] of Object.entries(tableMappings)) {
  const tableId = getEnv(tableConfig.table_id_env);

  if (!tableId) {
    console.log(`Skip ${tableConfig.name}: missing ${tableConfig.table_id_env}`);
    continue;
  }

  console.log(`Syncing ${tableConfig.name} -> ${targetTable}`);
  const records = await listBitableRecords({ appToken, tableId, accessToken });
  const rows = records
    .map((record) => mapRecordToRow(record, tableConfig.fields))
    .filter((row) => row[tableConfig.primary_key]);

  if (dryRun) {
    console.log(JSON.stringify({ table: targetTable, count: rows.length, sample: rows[0] ?? null }, null, 2));
    continue;
  }

  if (rows.length === 0) {
    console.log(`No rows to upsert for ${targetTable}`);
    continue;
  }

  try {
    await upsertRows({
      table: targetTable,
      rows,
      onConflict: tableConfig.primary_key
    });

    await markRecordsSynced({ appToken, tableId, accessToken, records, fieldMap: tableConfig.fields });
    console.log(`Synced ${rows.length} rows into ${targetTable}`);
  } catch (error) {
    console.error(`Failed syncing ${targetTable}: ${error.message}`);
    await markRecordsErrored({ appToken, tableId, accessToken, records, fieldMap: tableConfig.fields, error });
    process.exitCode = 1;
  }
}

function mapRecordToRow(record, fieldMap) {
  const row = {};
  for (const [columnName, feishuFieldName] of Object.entries(fieldMap)) {
    if (columnName.startsWith('sync_') || columnName === 'last_synced_at') {
      continue;
    }

    row[columnName] = normalizeColumnValue(columnName, record.fields?.[feishuFieldName]);
  }
  return row;
}

function normalizeColumnValue(columnName, value) {
  const normalized = normalizeFeishuValue(value);
  if (normalized === null) {
    return null;
  }

  if (columnName === 'date' || columnName.endsWith('_date')) {
    return normalizeDateValue(normalized);
  }

  return normalized;
}

function normalizeDateValue(value) {
  if (typeof value === 'number') {
    return new Date(value).toISOString().slice(0, 10);
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return new Date(Number(value)).toISOString().slice(0, 10);
  }

  return value;
}

function normalizeFeishuValue(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return null;
    }

    const normalized = value.map(normalizeFeishuValue).filter((item) => item !== null);
    return normalized.length === 1 ? normalized[0] : normalized;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if ('text' in value) {
    return value.text;
  }

  if ('name' in value) {
    return value.name;
  }

  if ('email' in value) {
    return value.email;
  }

  if ('value' in value) {
    return value.value;
  }

  return value;
}

async function markRecordsSynced({ appToken, tableId, accessToken, records, fieldMap }) {
  if (!fieldMap.sync_status && !fieldMap.last_synced_at) {
    return;
  }

  for (const record of records) {
    const fields = {};
    if (fieldMap.sync_status) fields[fieldMap.sync_status] = 'synced';
    if (fieldMap.sync_error) fields[fieldMap.sync_error] = '';
    if (fieldMap.last_synced_at) fields[fieldMap.last_synced_at] = Date.now();

    await updateBitableRecord({ appToken, tableId, recordId: record.record_id, accessToken, fields });
  }
}

async function markRecordsErrored({ appToken, tableId, accessToken, records, fieldMap, error }) {
  if (!fieldMap.sync_status && !fieldMap.sync_error) {
    return;
  }

  const message = error.message.slice(0, 500);
  for (const record of records) {
    const fields = {};
    if (fieldMap.sync_status) fields[fieldMap.sync_status] = 'error';
    if (fieldMap.sync_error) fields[fieldMap.sync_error] = message;

    await updateBitableRecord({ appToken, tableId, recordId: record.record_id, accessToken, fields });
  }
}
