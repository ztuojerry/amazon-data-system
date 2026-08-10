import { requireEnv } from './env.js';

export async function upsertRows({ table, rows, onConflict }) {
  const url = new URL(`/rest/v1/${table}`, requireEnv('SUPABASE_URL'));
  url.searchParams.set('on_conflict', onConflict);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      Authorization: `Bearer ${requireEnv('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify(rows)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase upsert error ${response.status}: ${text}`);
  }
}
