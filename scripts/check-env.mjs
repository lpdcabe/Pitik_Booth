import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const root = new URL('../', import.meta.url);
const read = async path => {
  try { return parseEnv(await readFile(new URL(path, root), 'utf8')); }
  catch { console.log(`${path}: missing or unreadable`); return {}; }
};
const front = await read('frontend/.env');
const back = await read('backend/.env');
const report = (name, ok) => console.log(`${name}: ${ok ? 'PASS' : 'FAIL'}`);
for (const name of ['PORT','FRONTEND_URL','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'])
  report(`Backend ${name} is populated`, Boolean(back[name]?.trim()));
report('Frontend contains no server secret variables', !Object.keys(front).some(k => /SERVICE_ROLE|SECRET|PASSWORD|PRIVATE_KEY/i.test(k)));
report('Backend secret is not present in frontend values', !back.SUPABASE_SERVICE_ROLE_KEY || !Object.values(front).some(v => v.includes(back.SUPABASE_SERVICE_ROLE_KEY)));
report('Frontend API matches backend local port', !front.VITE_API_URL || front.VITE_API_URL.replace(/\/$/,'') === `http://localhost:${back.PORT || 5000}`);
report('Backend allows local Vite origin', back.FRONTEND_URL === 'http://localhost:5173');
report('Retention is a nonnegative finite number', Number.isFinite(Number(back.PHOTO_RETENTION_DAYS ?? 7)) && Number(back.PHOTO_RETENTION_DAYS ?? 7) >= 0);
const key = back.SUPABASE_SERVICE_ROLE_KEY;
if (key) {
  let role;
  try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch {}
  report('Key is a service-role JWT or server secret key', role === 'service_role' || key.startsWith('sb_secret_'));
}
if (back.SUPABASE_URL && key) {
  try {
    const client = createClient(back.SUPABASE_URL, key, {auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url, options) => fetch(url,{...options,signal:AbortSignal.timeout(15000)})}});
    const checks = await Promise.allSettled([
      client.from('photobooths').select('id,session_id,image_url,storage_path,layout,frame,photo_count,custom_text,event_name,created_at,expires_at').limit(0),
      client.storage.getBucket('photobooth-images'),
    ]);
    for (const [index, result] of checks.entries()) {
      const label = index === 0 ? 'Database table and required columns' : 'Storage bucket access';
      if (result.status === 'rejected') { console.log(`${label}: NETWORK/CONNECTION FAILED`); continue; }
      const {data,error} = result.value;
      if (error) {
        console.log(`${label}: FAIL (code ${String(error.code || error.status || error.statusCode || 'connection').replace(/[^a-zA-Z0-9_-]/g,'')})`);
        continue;
      }
      report(label,true);
      if (index === 1) {
        report('Storage bucket is private',data.public === false);
        report('Storage upload limit is 10 MB',Number(data.file_size_limit) === 10485760);
        report('Storage allows PNG and JPEG', ['image/png','image/jpeg'].every(type => data.allowed_mime_types?.includes(type)));
      }
    }
  } catch { console.log('Supabase client: configuration or connection failed'); }
}
