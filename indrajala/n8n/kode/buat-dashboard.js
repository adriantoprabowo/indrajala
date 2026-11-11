// Semua data dibaca dari Data Table (diisi kotak "Ambil Log", "Ambil Canary", "Ambil Unduhan").
const ambil = (nama) => $(nama).all().map((i) => i.json);
const num = (v) => Number(v) || 0;

const log = ambil('Ambil Log')
  .filter((e) => num(e.ts) > 0)
  .map((e) => ({ ...e, ts: num(e.ts), tahap: num(e.tahap), session: String(e.session ?? ''), command: String(e.command ?? '') }))
  .sort((a, b) => a.ts - b.ts);
const canary = ambil('Ambil Canary').filter((c) => num(c.ts) > 0).map((c) => ({ ts: num(c.ts), token: String(c.token ?? ''), ua: c.ua }));
const unduhan = ambil('Ambil Unduhan').filter((u) => num(u.ts) > 0).map((u) => ({ ts: num(u.ts), kode: String(u.kode ?? ''), session: String(u.session ?? ''), file: u.file, ua: u.ua }));

// Pengaman: apa pun yang berasal dari penyerang dibersihkan sebelum ditampilkan.
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const label = { tinggi: '🔴 TINGGI', sedang: '🟡 PENGINTAIAN', rendah: '🟢 RENDAH' };
const namaTahap = ['Baru masuk', 'Menemukan petunjuk', 'Mengambil kredensial umpan', 'Mencoba pindah server'];
const wib = (ms) => new Date(ms).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
const durasi = (ms) => {
  const total = Math.round(ms / 1000);
  const jam = Math.floor(total / 3600);
  const mnt = Math.floor((total % 3600) / 60);
  const dtk = total % 60;
  if (jam > 0) return `${jam} jam ${mnt} mnt`;
  if (mnt > 0) return `${mnt} mnt ${dtk} dtk`;
  return `${dtk} dtk`;
};

// ---- kelompokkan per penyusup (Map: aman untuk nama sesi apa pun) ----
const sesi = new Map();
for (const e of log) {
  if (!sesi.has(e.session)) sesi.set(e.session, { id: e.session, awal: e.ts, akhir: e.ts, langkah: 0, tinggi: 0, tahap: 0, ua: e.ua });
  const s = sesi.get(e.session);
  s.awal = Math.min(s.awal, e.ts);
  s.akhir = Math.max(s.akhir, e.ts);
  s.langkah += 1;
  if (e.level === 'tinggi') s.tinggi += 1;
  s.tahap = Math.max(s.tahap, Math.min(3, e.tahap));
}
const daftar = [...sesi.values()].sort((a, b) => b.akhir - a.akhir);
const lama = daftar.map((s) => s.akhir - s.awal);
const terlama = lama.length ? Math.max(...lama) : 0;
const rata = lama.length ? lama.reduce((a, b) => a + b, 0) / lama.length : 0;
const sampaiUmpan = daftar.filter((s) => s.tahap >= 2).length;
const sampaiPindah = daftar.filter((s) => s.tahap >= 3).length;
const jumlahTinggi = log.filter((e) => e.level === 'tinggi').length;

// ---- alarm otomatis (dihitung dari data; tidak bisa dibujuk AI) ----
// Nilai ini HARUS sama dengan password palsu di .env.bak dan tabel profil.
const TOKEN_UMPAN = ['Bk#4rTz9Vn', 'Wb!7qLm2Xp'];

const alarm = [];
const sudah = new Set();
for (const e of log) {
  const cek = [];
  if (TOKEN_UMPAN.some((k) => e.command.includes(k))) cek.push(['kredensial-dipakai', 'KRITIS', 'Kredensial umpan DIGUNAKAN penyusup']);
  if (e.host === 'bkp') cek.push(['masuk-server-kedua', 'KRITIS', 'Penyusup BERHASIL masuk ke server kedua (bkp-01)']);
  if (e.tahap >= 3) cek.push(['pindah-server', 'TINGGI', 'Penyusup mencoba pindah ke server lain']);
  if (e.tahap >= 2) cek.push(['umpan-dibaca', 'TINGGI', 'Penyusup membaca file umpan berisi kredensial']);
  if (e.command.startsWith('[sqli]')) cek.push(['sqli', 'TINGGI', 'Percobaan SQL injection di website']);
  if (e.command.startsWith('[honeylink]')) cek.push(['honeylink', 'TINGGI', 'Honey-link di website dikunjungi']);
  if (e.command.startsWith('[pemindai]')) cek.push(['pemindai', 'TINGGI', 'Pemindai otomatis terdeteksi di website']);
  if (e.command.startsWith('(banjir perintah')) cek.push(['banjir', 'TINGGI', 'Banjir perintah terdeteksi (kemungkinan alat otomatis)']);
  for (const [jenis, tingkat, pesan] of cek) {
    const kunci = e.session + '|' + jenis;
    if (sudah.has(kunci)) continue;
    sudah.add(kunci);
    alarm.push({ ts: e.ts, session: e.session, tingkat, pesan, command: e.command });
  }
}
for (const u of unduhan) {
  alarm.push({ ts: u.ts, session: u.session, tingkat: 'TINGGI', pesan: 'Berkas umpan DIUNDUH: ' + u.file, command: u.ua });
}
for (const c of canary) {
  const u = unduhan.find((x) => x.kode === c.token);
  if (u) alarm.push({ ts: c.ts, session: u.session, tingkat: 'KRITIS', pesan: 'Dokumen umpan DIBUKA: ' + c.token, command: c.ua });
  else alarm.push({ ts: c.ts, session: '(tidak dikenal)', tingkat: 'TINGGI', pesan: 'Token canary TIDAK DIKENAL (kemungkinan percobaan pemalsuan): ' + c.token, command: c.ua });
}
alarm.sort((a, b) => b.ts - a.ts); // terbaru di atas
const adaKritis = alarm.some((a) => a.tingkat === 'KRITIS');

const barisAlarm = alarm.slice(0, 20).map((a) => `
<tr>
  <td>${esc(wib(a.ts))}</td>
  <td><span class="${a.tingkat === 'KRITIS' ? 'kritis' : 'tinggi'}">${esc(a.tingkat)}</span></td>
  <td>${esc(a.session)}</td>
  <td>${esc(a.pesan)}</td>
  <td><code>${esc(a.command)}</code></td>
</tr>`).join('');

const barisSesi = daftar.map((s) => `
<tr>
  <td>${esc(s.id)}</td>
  <td>${esc(wib(s.awal))}</td>
  <td><b>${esc(durasi(s.akhir - s.awal))}</b></td>
  <td>${s.langkah}</td>
  <td class="${s.tinggi > 0 ? 'tinggi' : ''}">${s.tinggi}</td>
  <td>${'●'.repeat(s.tahap)}${'○'.repeat(3 - s.tahap)} ${esc(namaTahap[s.tahap])}</td>
  <td>${esc(s.ua)}</td>
  <td><a href="/webhook/indrajala-analisis?session=${encodeURIComponent(s.id)}">🔎 Analisis</a></td>
</tr>`).join('');

const barisLog = log.slice(-100).reverse().map((e) => `
<tr>
  <td>${esc(e.waktu)}</td>
  <td>${esc(e.session)}</td>
  <td><code>${esc(e.command)}</code></td>
  <td class="${esc(e.level)}">${label[e.level] || ''}</td>
  <td><pre>${esc(String(e.reply ?? '').slice(0, 600))}</pre></td>
</tr>`).join('');

const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="10">
<title>Indrajala - Buku Tamu</title>
<style>
body{font-family:Segoe UI,Arial,sans-serif;background:#0f1419;color:#e6e6e6;margin:24px}
h1{margin:0 0 4px}
h2{margin:28px 0 8px;font-size:18px}
a{color:#7cc4ff}
.ringkas{display:flex;gap:16px;margin:16px 0;flex-wrap:wrap}
.kartu{background:#1c2430;padding:12px 20px;border-radius:8px;min-width:140px}
.kartu b{font-size:26px;display:block}
table{border-collapse:collapse;width:100%}
th,td{border-bottom:1px solid #2c3746;padding:8px;text-align:left;vertical-align:top;font-size:14px}
th{background:#1c2430}
pre{margin:0;white-space:pre-wrap;font-size:12px;color:#9fb3c8}
code{color:#f7c873}
.tinggi{color:#ff6b5b;font-weight:bold}
.sedang{color:#f0b429;font-weight:bold}
.rendah{color:#4cc38a;font-weight:bold}
.kritis{color:#fff;background:#b3261e;font-weight:bold;padding:2px 8px;border-radius:4px}
.banner{background:#b3261e;color:#fff;padding:12px 16px;border-radius:8px;margin:12px 0;font-weight:bold}
</style></head><body>
<h1>🕸️ Indrajala: Buku Tamu Jebakan</h1>
<div>Menyegarkan diri tiap 10 detik. Data tersimpan lokal di laptop ini.</div>

<div class="ringkas">
  <div class="kartu"><b>${daftar.length}</b>penyusup (sesi)</div>
  <div class="kartu"><b>${esc(durasi(terlama))}</b>waktu tertahan terlama</div>
  <div class="kartu"><b>${esc(durasi(rata))}</b>rata-rata waktu tertahan</div>
  <div class="kartu"><b>${sampaiUmpan}</b>sampai mengambil umpan</div>
  <div class="kartu"><b>${sampaiPindah}</b>mencoba pindah server</div>
  <div class="kartu"><b>${jumlahTinggi}</b>perintah bahaya tinggi</div>
</div>

${adaKritis ? '<div class="banner">🚨 ALARM KRITIS: umpan telah dipakai atau dibuka penyusup!</div>' : ''}
<h2>⚠️ Peringatan otomatis</h2>
<table>
<tr><th>Waktu (WIB)</th><th>Tingkat</th><th>Sesi</th><th>Kejadian</th><th>Perintah / klien pemicu</th></tr>
${barisAlarm || '<tr><td colspan="5">Belum ada alarm. Belum ada yang menyentuh umpan.</td></tr>'}
</table>

<h2>Per penyusup</h2>
<table>
<tr><th>Sesi</th><th>Mulai (WIB)</th><th>Waktu tertahan</th><th>Langkah</th><th>Bahaya tinggi</th><th>Kedalaman rantai umpan</th><th>Alat penyerang</th><th>Analisis</th></tr>
${barisSesi || '<tr><td colspan="8">Belum ada tamu. Jebakan masih sepi.</td></tr>'}
</table>

<h2>Riwayat perintah (100 terakhir)</h2>
<table>
<tr><th>Waktu (WIB)</th><th>Sesi</th><th>Perintah</th><th>Tingkat</th><th>Balasan palsu kita</th></tr>
${barisLog || '<tr><td colspan="5">Belum ada perintah.</td></tr>'}
</table>
</body></html>`;

return [{ json: { html } }];
