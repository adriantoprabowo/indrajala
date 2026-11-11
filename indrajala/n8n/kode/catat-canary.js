// Hanya menyiapkan baris untuk tabel indrajala_canary (disimpan oleh kotak Data table sesudahnya).
const j = $input.first().json;
const q = j.query || {};
const token = /^[A-Za-z0-9\-]{1,40}$/.test(String(q.id || '')) ? String(q.id) : 'tidak-valid';
const ip = String((j.headers || {})['x-forwarded-for'] || '').split(',')[0].trim().replace(/[^0-9a-fA-F:.]/g, '').slice(0, 45);
const ua = ((ip ? 'IP ' + ip + ' | ' : '') + String((j.headers || {})['user-agent'] || '-')).slice(0, 160);
return [{ json: { catat: { ts: Date.now(), token, ua } } }];
