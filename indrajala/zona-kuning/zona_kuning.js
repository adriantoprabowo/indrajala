'use strict';
// ZONA KUNING (DMZ): website dummy pemerintahan FIKTIF untuk Cyber Range / pelatihan.
// - Tidak memakai database dan tidak mengeksekusi SQL apa pun. Semua "kesalahan SQL" hanyalah teks dari Zona Hijau.
// - Hanya berbicara ke n8n di 127.0.0.1 (satu arah: Kuning -> Hijau).
// Jalankan: node zona_kuning.js   (port 8081, hanya dapat diakses dari komputer ini; Caddy di depannya)
const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8081);
const N8N = new URL(process.env.N8N_URL || 'http://127.0.0.1:5678/webhook/indrajala-web');
const NAMA = 'Pemerintah Kabupaten Nusantara Raya';   // entitas FIKTIF
const PDF_UMPAN = 'Rekap_Belanja_TI_Q3_2026.pdf';

// ---------------------------------------------------------------- alat bantu
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const bersihIp = (s) => String(s || '').split(',')[0].trim().replace(/[^0-9a-fA-F:.]/g, '').slice(0, 45);
const jaringanLokal = (a) => a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
function ipKlien(req) {
  const asal = req.socket.remoteAddress || '';
  // Header X-Forwarded-For hanya dipercaya bila datang dari Caddy (komputer ini sendiri).
  const xff = jaringanLokal(asal) ? bersihIp(req.headers['x-forwarded-for']) : '';
  return xff || bersihIp(asal.replace(/^::ffff:/, '')) || '0.0.0.0';
}
const sesiDariIp = (ip) => 'web-' + ip.replace(/[^0-9a-fA-F]/g, '-');

const PEMINDAI = /(sqlmap|nikto|nmap|gobuster|dirbuster|dirb\b|wpscan|masscan|zgrab|nuclei|burpsuite|acunetix|hydra|feroxbuster|ffuf)/i;
const TANDA_SERANGAN = /('|%27|"|%22|--|%23|\/\*|union[\s+]|select[\s+]|sleep\(|benchmark\(|<script|%3cscript|\.\.\/|%2e%2e|etc\/passwd|\bor\b[\s+]+\d+=\d+|;\s*(drop|exec))/i;
const HONEY = new Set(['/admin-backup', '/dokumen-internal', '/phpmyadmin', '/portal-pegawai']);
const PROBE = new Set(['/.env', '/.git/config', '/wp-login.php', '/wp-admin', '/xmlrpc.php', '/server-status', '/backup.zip', '/config.php.bak', '/admin', '/administrator', '/phpinfo.php']);
const normPath = (p) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p).toLowerCase();

// ---------------------------------------------------------------- batas laju dan komunikasi ke n8n
const laju = new Map();
function bolehKirim(ip) {
  const t = Date.now();
  let r = laju.get(ip);
  if (!r || t - r.t0 > 60000) { r = { t0: t, n: 0 }; laju.set(ip, r); if (laju.size > 2000) laju.delete(laju.keys().next().value); }
  r.n += 1;
  return r.n <= 30;
}
let berjalan = 0;
function kirimKeN8n(muatan, tungguMs = 4000) {
  return new Promise((selesai) => {
    if (berjalan >= 20) return selesai(null);
    berjalan += 1;
    let tuntas = false;
    const akhir = (v) => { if (!tuntas) { tuntas = true; berjalan -= 1; selesai(v); } };
    const data = Buffer.from(JSON.stringify(muatan));
    const r = http.request({
      hostname: N8N.hostname, port: N8N.port, path: N8N.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }, timeout: tungguMs
    }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; if (buf.length > 4096) { res.destroy(); akhir(null); } });
      res.on('end', () => { try { akhir(res.statusCode === 200 ? JSON.parse(buf) : null); } catch { akhir(null); } });
    });
    r.on('timeout', () => { r.destroy(); akhir(null); });
    r.on('error', () => akhir(null));
    r.end(data);
  });
}

// ---------------------------------------------------------------- tampilan
function halaman(judul, isi, kelas = '') {
  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(judul)} - ${esc(NAMA)}</title>
<style>
body{margin:0;font-family:Segoe UI,Arial,sans-serif;background:#f3f5f8;color:#1f2933}
header{background:#14365d;color:#fff;padding:16px 28px}
header b{font-size:19px} header span{display:block;font-size:12px;opacity:.75;margin-top:2px}
nav{background:#0e2a4a;padding:0 28px} nav a{display:inline-block;color:#cfe0f4;text-decoration:none;padding:11px 14px;font-size:14px}
nav a:hover{background:#1c4272}
main{max-width:920px;margin:26px auto;padding:0 20px}
.kartu{background:#fff;border:1px solid #dde3ea;border-radius:6px;padding:18px 22px;margin-bottom:16px}
h1{font-size:22px;margin:0 0 10px} h2{font-size:17px;margin:0 0 8px}
.kecil{color:#6b7a8a;font-size:13px}
input[type=text],input[type=password]{width:100%;padding:9px;margin:4px 0 12px;border:1px solid #b9c4d0;border-radius:4px;box-sizing:border-box}
button{background:#14365d;color:#fff;border:0;padding:9px 20px;border-radius:4px;cursor:pointer}
.galat{background:#fdecea;border:1px solid #f5b5ae;color:#8a1f11;padding:10px 14px;border-radius:4px;margin-bottom:14px;font-size:13px}
.php{background:#fff8e6;border:1px solid #f0d78a;color:#4d3b00;padding:10px 14px;border-radius:4px;margin-bottom:14px;font:13px/1.5 Consolas,monospace;word-break:break-word}
footer{text-align:center;color:#7a8896;font-size:12px;padding:24px}
table{border-collapse:collapse;width:100%} td,th{padding:6px 10px;text-align:left;font-size:14px;border-bottom:1px solid #e4e9ef}
</style></head><body class="${esc(kelas)}">
<header><b>${esc(NAMA)}</b><span>Portal Layanan Publik</span></header>
<nav><a href="/">Beranda</a><a href="/layanan">Layanan</a><a href="/berita">Berita</a><a href="/kontak">Kontak</a><a href="/login.php">Portal Pegawai</a></nav>
<main>${isi}</main>
<footer>&copy; 2026 ${esc(NAMA)}. Situs ini adalah lingkungan simulasi pelatihan dan bukan situs pemerintah yang sebenarnya.<!-- TODO: hapus folder /dokumen-internal/ sebelum rilis publik --></footer>
<a href="/admin-backup/" style="display:none" aria-hidden="true" tabindex="-1">Arsip</a>
</body></html>`;
}

const BERANDA = halaman('Beranda', `
<div class="kartu"><h1>Selamat datang</h1><p>Portal layanan publik ${esc(NAMA)}. Ajukan permohonan layanan, pantau informasi, dan hubungi petugas kami.</p></div>
<div class="kartu"><h2>Berita terbaru</h2>
<p><b>Pemeliharaan sistem layanan</b><br><span class="kecil">12 Oktober 2026</span><br>Layanan daring akan menjalani pemeliharaan berkala pada akhir pekan ini.</p>
<p><b>Pembukaan loket layanan tambahan</b><br><span class="kecil">28 September 2026</span><br>Loket layanan tambahan dibuka untuk mempersingkat antrean.</p></div>`);
const LAYANAN = halaman('Layanan', `<div class="kartu"><h1>Layanan</h1><ul><li>Permohonan informasi publik</li><li>Pengaduan masyarakat</li><li>Pendaftaran layanan administrasi</li><li>Konsultasi dan bantuan</li></ul></div>`);
const BERITA = halaman('Berita', `<div class="kartu"><h1>Berita</h1><p>Belum ada berita tambahan.</p></div>`);
const KONTAK = halaman('Kontak', `<div class="kartu"><h1>Kontak</h1><p>Jl. Contoh Raya No. 1, Nusantara Raya<br>Telepon (000) 0000-0000<br>kontak@nusantararaya.example</p></div>`);

function formLogin(galat = '', php = '') {
  return halaman('Portal Pegawai', `
<div class="kartu" style="max-width:420px;margin:0 auto"><h1>Portal Pegawai</h1><p class="kecil">Masuk dengan akun pegawai Anda.</p>
${php ? `<div class="php">${php}</div>` : ''}${galat ? `<div class="galat">${esc(galat)}</div>` : ''}
<form method="post" action="/login.php" autocomplete="off">
<label>Username</label><input type="text" name="username" maxlength="200">
<label>Password</label><input type="password" name="password" maxlength="200">
<button type="submit">Masuk</button></form></div>`);
}
const phpGalat = (kode, pesan) => `<b>Warning</b>: mysqli_query(): (HY000/${esc(kode)}): ${esc(pesan)} in <b>/var/www/html/login.php</b> on line <b>38</b>`;

function listing(judul, entri, ip) {
  const baris = entri.map((e) => `<tr><td><a href="${e.href}">${esc(e.nama)}</a></td><td>${esc(e.tgl)}</td><td>${esc(e.ukuran)}</td></tr>`).join('');
  return `<!DOCTYPE html><html><head><title>Index of ${esc(judul)}</title></head><body><h1>Index of ${esc(judul)}</h1>
<table><tr><th>Name</th><th>Last modified</th><th>Size</th></tr><tr><td><a href="/">Parent Directory</a></td><td></td><td>-</td></tr>${baris}</table>
<hr><address>Apache/2.4.52 (Ubuntu) Server at localhost Port 80</address></body></html>`;
}
const linkPdf = (ip) => `/portal/unduh?f=${encodeURIComponent(PDF_UMPAN)}&s=${encodeURIComponent(sesiDariIp(ip))}`;
const CONFIG_BAK = `<?php
// konfigurasi basis data (cadangan)
$db_host = '10.20.4.5';
$db_user = 'webapp';
$db_pass = 'Wb!7qLm2Xp';
$db_name = 'files_prod';
?>
`;
const ROBOTS = `User-agent: *
Disallow: /admin-backup/
Disallow: /dokumen-internal/
Disallow: /phpmyadmin/
Disallow: /portal-pegawai/
`;
const PORTAL_PEGAWAI = halaman('Beranda Pegawai', `
<div class="kartu"><h1>Selamat datang, Administrator</h1><p class="kecil">Sesi aktif. Terakhir masuk: 25 Oktober 2026 02:00.</p></div>
<div class="kartu"><h2>Menu</h2><ul><li><a href="/dokumen-internal/">Dokumen internal</a></li><li><a href="/admin-backup/">Arsip cadangan</a></li><li>Manajemen pegawai (tidak tersedia)</li></ul></div>`);

function apache404(host) {
  return `<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN"><html><head><title>404 Not Found</title></head><body><h1>Not Found</h1>
<p>The requested URL was not found on this server.</p><hr><address>Apache/2.4.52 (Ubuntu) Server at ${esc(String(host || 'localhost').split(':')[0])} Port 80</address></body></html>`;
}
function apache403(host) {
  return `<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN"><html><head><title>403 Forbidden</title></head><body><h1>Forbidden</h1>
<p>You don't have permission to access this resource.</p><hr><address>Apache/2.4.52 (Ubuntu) Server at ${esc(String(host || 'localhost').split(':')[0])} Port 80</address></body></html>`;
}

// ---------------------------------------------------------------- sesi pegawai palsu
const sesiAktif = new Map();
function buatSesi() {
  const id = crypto.randomBytes(16).toString('hex');
  sesiAktif.set(id, Date.now() + 30 * 60000);
  if (sesiAktif.size > 500) sesiAktif.delete(sesiAktif.keys().next().value);
  return id;
}
function sesiSah(req) {
  const m = /(?:^|;\s*)PHPSESSID=([0-9a-f]{32})/.exec(req.headers.cookie || '');
  return !!(m && (sesiAktif.get(m[1]) || 0) > Date.now());
}

// ---------------------------------------------------------------- penanganan permintaan
function jawab(res, status, isi, tipe = 'text/html; charset=utf-8', tambahan = {}) {
  res.writeHead(status, { 'Content-Type': tipe, 'Server': 'Apache/2.4.52 (Ubuntu)', 'X-Powered-By': 'PHP/8.1.2', 'Cache-Control': 'no-store', ...tambahan });
  res.end(isi);
}
const tunda = (ms) => new Promise((r) => setTimeout(r, ms));

async function tangani(req, res) {
  const url = new URL(req.url, 'http://x');
  const jalur = url.pathname;
  const np = normPath(jalur);
  const ip = ipKlien(req);
  const ua = String(req.headers['user-agent'] || '').slice(0, 120);
  const host = req.headers.host;
  const metode = req.method;

  // isi permintaan (dibatasi)
  let data = {};
  if (metode === 'POST') {
    const potongan = [];
    let total = 0;
    for await (const c of req) {
      total += c.length;
      if (total > 8192) { res.on('finish', () => req.destroy()); jawab(res, 413, 'Payload Too Large', 'text/plain', { Connection: 'close' }); return; }
      potongan.push(c);
    }
    const mentah = Buffer.concat(potongan).toString('utf8');
    try {
      if ((req.headers['content-type'] || '').includes('json')) { const o = JSON.parse(mentah); data = { username: String(o.username ?? ''), password: String(o.password ?? '') }; }
      else { const p = new URLSearchParams(mentah); data = { username: p.get('username') || '', password: p.get('password') || '' }; }
    } catch { data = {}; }
  }

  const dasar = { ip, ua, metode, path: jalur.slice(0, 200), query: url.search.slice(1, 301) };
  let dekode = jalur + url.search;
  try { dekode = decodeURIComponent(dekode); } catch { /* biarkan apa adanya */ }
  const pemindai = PEMINDAI.test(ua);
  const mencurigakan = TANDA_SERANGAN.test(dekode) || PROBE.has(np);
  const honey = HONEY.has(np) || np.startsWith('/admin-backup/') || np.startsWith('/dokumen-internal/');

  // ---- login (jawaban ditentukan Zona Hijau) ----
  if (np === '/login.php') {
    if (metode === 'GET') {
      if (pemindai && bolehKirim(ip)) kirimKeN8n({ ...dasar, tipe: 'scanner' });
      return jawab(res, 200, formLogin());
    }
    if (metode === 'POST') {
      const r = bolehKirim(ip) ? await kirimKeN8n({ ...dasar, tipe: 'login', data }) : null;
      const aksi = r && typeof r.aksi === 'string' ? r.aksi : 'gagal';
      const pesan = r && typeof r.pesan === 'string' ? r.pesan.slice(0, 400) : 'Username atau password salah.';
      const kode = r && typeof r.kode === 'string' ? r.kode.slice(0, 8) : '';
      const jeda = r && Number(r.tunda_ms) > 0 ? Math.min(Number(r.tunda_ms), 8000) : 0;
      if (jeda) await tunda(jeda);
      if (aksi === 'sukses') {
        const id = buatSesi();
        return jawab(res, 302, '', 'text/html', { Location: '/portal-pegawai/', 'Set-Cookie': `PHPSESSID=${id}; path=/; HttpOnly` });
      }
      if (aksi === 'error_sql') return jawab(res, 200, formLogin('', phpGalat(kode || '1064', pesan)));
      return jawab(res, 200, formLogin(pesan));
    }
  }

  // ---- peristiwa lain: dicatat tanpa menunggu agar halaman tetap cepat ----
  const catatTanpaTunggu = (tipe) => { if (bolehKirim(ip)) kirimKeN8n({ ...dasar, tipe }); };

  if (np === '/portal-pegawai') {
    if (!sesiSah(req)) { catatTanpaTunggu('honeylink'); return jawab(res, 302, '', 'text/html', { Location: '/login.php' }); }
    return jawab(res, 200, PORTAL_PEGAWAI);
  }
  if (np === '/admin-backup' || np === '/dokumen-internal') {
    catatTanpaTunggu('honeylink');
    const entri = np === '/admin-backup'
      ? [{ href: 'config.php.bak', nama: 'config.php.bak', tgl: '2026-09-14 10:21', ukuran: '1.1K' },
         { href: 'db_backup_2026-10-25.sql.gz', nama: 'db_backup_2026-10-25.sql.gz', tgl: '2026-10-25 02:00', ukuran: '1.2M' },
         { href: linkPdf(ip), nama: PDF_UMPAN, tgl: '2026-10-12 09:40', ukuran: '6.0K' }]
      : [{ href: linkPdf(ip), nama: PDF_UMPAN, tgl: '2026-10-12 09:40', ukuran: '6.0K' }];
    return jawab(res, 200, listing('/' + np.slice(1), entri, ip));
  }
  if (np === '/admin-backup/config.php.bak') { catatTanpaTunggu('honeylink'); return jawab(res, 200, CONFIG_BAK, 'text/plain; charset=utf-8'); }
  if (np.startsWith('/admin-backup/') || np.startsWith('/dokumen-internal/')) { catatTanpaTunggu('honeylink'); return jawab(res, 403, apache403(host)); }
  if (np === '/phpmyadmin') { catatTanpaTunggu('honeylink'); return jawab(res, 403, apache403(host)); }

  if (pemindai) catatTanpaTunggu('scanner');
  else if (mencurigakan) catatTanpaTunggu('url');

  if (np === '/robots.txt') return jawab(res, 200, ROBOTS, 'text/plain; charset=utf-8');
  if (np === '/favicon.ico') return jawab(res, 204, '');
  if (np === '/' || np === '/index.php' || np === '/index.html') return jawab(res, 200, BERANDA);
  if (np === '/layanan') return jawab(res, 200, LAYANAN);
  if (np === '/berita') return jawab(res, 200, BERITA);
  if (np === '/kontak') return jawab(res, 200, KONTAK);
  return jawab(res, 404, apache404(host));
}

const server = http.createServer((req, res) => {
  tangani(req, res).catch(() => { try { jawab(res, 500, 'Internal Server Error', 'text/plain'); } catch { /* sudah ditutup */ } });
});
server.headersTimeout = 10000;
server.requestTimeout = 15000;
server.maxHeadersCount = 50;
server.maxConnections = 200;
if (require.main === module) {
  server.listen(PORT, '127.0.0.1', () => console.log(`Zona Kuning aktif di http://127.0.0.1:${PORT} (di belakang Caddy). n8n: ${N8N.href}`));
}
module.exports = { server };
