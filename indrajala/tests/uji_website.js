const http = require('http');
const fs = require('fs');
let ok = 0, gagal = 0;
const cek = (n, k, i = '') => { k ? ok++ : gagal++; console.log((k ? '  [LULUS] ' : '  [GAGAL] ') + n + (i ? '  -> ' + String(i).slice(0, 110) : '')); };

// ---- n8n tiruan: menjalankan KODE ASLI "Nilai Peristiwa Web" lalu "menyimpan" baris log ----
const kodeNilai = fs.readFileSync(__dirname + '/../n8n/kode/nilai-peristiwa-web.js', 'utf8');
const baris = [];
let n8nHidup = true;
const mock = http.createServer((req, res) => {
  let buf = '';
  req.on('data', (c) => (buf += c));
  req.on('end', () => {
    if (req.url !== '/webhook/indrajala-web') { res.writeHead(404); return res.end('{}'); }
    const body = JSON.parse(buf);
    const out = new Function('$input', kodeNilai)({ first: () => ({ json: { body } }) })[0].json;
    baris.push(out.catat);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(out.respons));
  });
});

const minta = (port, path, { method = 'GET', headers = {}, body } = {}) => new Promise((selesai, tolak) => {
  const t0 = Date.now();
  const r = http.request({ hostname: '127.0.0.1', port, path, method, headers }, (res) => {
    let b = ''; res.on('data', (c) => (b += c));
    res.on('end', () => selesai({ status: res.statusCode, headers: res.headers, body: b, ms: Date.now() - t0 }));
  });
  r.on('error', () => selesai({ status: 0, headers: {}, body: '', ms: Date.now() - t0 })); if (body) r.write(body); r.end();
});
const form = (u, p) => 'username=' + encodeURIComponent(u) + '&password=' + encodeURIComponent(p);
const POST = { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
const tunggu = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => mock.listen(15678, '127.0.0.1', r));
  process.env.PORT = '18081'; process.env.N8N_URL = 'http://127.0.0.1:15678/webhook/indrajala-web';
  const { server } = require('../zona-kuning/zona_kuning.js');
  await new Promise((r) => server.listen(18081, '127.0.0.1', r));
  const S = 18081;

  console.log('== 1. halaman biasa dan penyamaran ==');
  let r = await minta(S, '/');
  cek('beranda 200', r.status === 200 && r.body.includes('Nusantara Raya'));
  cek('header palsu Apache dan PHP', r.headers.server === 'Apache/2.4.52 (Ubuntu)' && r.headers['x-powered-by'] === 'PHP/8.1.2');
  cek('tidak membocorkan n8n/webhook/node', !/n8n|webhook|node\.js|express/i.test(r.body + JSON.stringify(r.headers)));
  cek('honey-link tersembunyi di halaman', r.body.includes('href="/admin-backup/" style="display:none"'));
  cek('komentar HTML umpan', r.body.includes('<!-- TODO: hapus folder /dokumen-internal/'));
  cek('ada pernyataan simulasi di kaki halaman', r.body.includes('lingkungan simulasi'));
  cek('beranda biasa TIDAK dicatat', baris.length === 0);
  r = await minta(S, '/robots.txt'); cek('robots.txt menyebut jalur umpan', /Disallow: \/admin-backup\//.test(r.body) && /dokumen-internal/.test(r.body));
  r = await minta(S, '/login.php'); cek('form login', r.status === 200 && r.body.includes('name="password"'));

  console.log('== 2. login biasa dan SQL injection ==');
  r = await minta(S, '/login.php', { ...POST, body: form('admin', 'admin') });
  cek('login biasa gagal', r.status === 200 && r.body.includes('Username atau password salah.'));
  cek('dicatat [login] level sedang, sesi web-127-0-0-1', baris.at(-1).command.startsWith('[login]') && baris.at(-1).level === 'sedang' && baris.at(-1).session === 'web-127-0-0-1', baris.at(-1).command);
  r = await minta(S, '/login.php', { ...POST, body: form("admin'", 'x') });
  cek('kutip tunggal -> galat MySQL ala PHP', r.body.includes('You have an error in your SQL syntax') && r.body.includes('/var/www/html/login.php'));
  cek('dicatat [sqli] level tinggi', baris.at(-1).command.startsWith('[sqli]') && baris.at(-1).level === 'tinggi');
  r = await minta(S, '/login.php', { ...POST, body: form("' OR '1'='1", 'x') });
  cek('tautologi -> 302 ke portal pegawai + cookie', r.status === 302 && r.headers.location === '/portal-pegawai/' && /PHPSESSID=[0-9a-f]{32}/.test(r.headers['set-cookie'][0]));
  const cookie = r.headers['set-cookie'][0].split(';')[0];
  r = await minta(S, '/portal-pegawai/', { headers: { Cookie: cookie } });
  cek('portal pegawai dapat dibuka dengan cookie', r.status === 200 && r.body.includes('Selamat datang, Administrator') && r.body.includes('/dokumen-internal/'));
  r = await minta(S, '/portal-pegawai/');
  cek('tanpa cookie dialihkan ke login', r.status === 302 && r.headers.location === '/login.php');
  r = await minta(S, '/login.php', { ...POST, body: form("admin' AND SLEEP(2)-- -", 'x') });
  cek('SLEEP(2) membuat respons tertunda ~2 detik', r.ms >= 1900 && r.ms < 3500 && r.status === 200, r.ms + ' ms');
  r = await minta(S, '/login.php', { ...POST, body: form("admin' ORDER BY 9-- -", 'x') });
  cek("ORDER BY 9 -> Unknown column '9'", r.body.includes("Unknown column &#39;9&#39; in &#39;order clause&#39;"));
  r = await minta(S, '/login.php', { ...POST, body: form("admin' UNION SELECT 1,2,3-- -", 'x') });
  cek('UNION -> beda jumlah kolom', r.body.includes('different number of columns'));
  const a = await minta(S, '/login.php', { ...POST, body: form("admin' AND 1=1-- -", 'x') });
  const b = await minta(S, '/login.php', { ...POST, body: form("admin' AND 1=2-- -", 'x') });
  cek('boolean-blind: 1=1 dan 1=2 menghasilkan halaman berbeda', a.body.includes('Password salah.') && b.body.includes('Pengguna tidak ditemukan.'));
  r = await minta(S, '/login.php', { ...POST, body: form('webapp', 'Wb!7qLm2Xp') });
  cek('kredensial umpan -> berhasil dan dicatat lengkap', r.status === 302 && baris.at(-1).command.includes('Wb!7qLm2Xp') && baris.at(-1).level === 'tinggi', baris.at(-1).reply);

  console.log('== 3. honey-link dan umpan ==');
  const sebelum = baris.length;
  r = await minta(S, '/admin-backup/');
  cek('listing /admin-backup/ ada', r.status === 200 && r.body.includes('Index of /admin-backup') && r.body.includes('config.php.bak'));
  cek('listing mengarah ke portal unduh dengan sesi web-<ip>', r.body.includes('/portal/unduh?f=Rekap_Belanja_TI_Q3_2026.pdf&amp;s=web-127-0-0-1') || r.body.includes('/portal/unduh?f=Rekap_Belanja_TI_Q3_2026.pdf&s=web-127-0-0-1'));
  await tunggu(150);
  cek('akses honey-link dicatat [honeylink]', baris.length === sebelum + 1 && baris.at(-1).command.startsWith('[honeylink] /admin-backup') && baris.at(-1).level === 'tinggi');
  r = await minta(S, '/admin-backup/config.php.bak');
  cek('config.php.bak berisi kredensial umpan (teks biasa)', r.headers['content-type'].startsWith('text/plain') && r.body.includes("$db_pass = 'Wb!7qLm2Xp'"));
  r = await minta(S, '/admin-backup/db_backup_2026-10-25.sql.gz'); cek('berkas cadangan -> 403 ala Apache', r.status === 403 && r.body.includes('Forbidden'));
  r = await minta(S, '/dokumen-internal/'); cek('/dokumen-internal/ berisi PDF umpan', r.body.includes('Rekap_Belanja_TI_Q3_2026.pdf'));
  r = await minta(S, '/phpmyadmin/'); cek('/phpmyadmin/ -> 403', r.status === 403);

  console.log('== 4. IP asli lewat Caddy, pemindai, dan serangan di URL ==');
  await minta(S, '/admin-backup/', { headers: { 'X-Forwarded-For': '203.0.113.9' } }); await tunggu(150);
  cek('IP dari X-Forwarded-For (dari Caddy) dipakai', baris.at(-1).session === 'web-203-0-113-9' && baris.at(-1).ua.startsWith('IP 203.0.113.9 |'), baris.at(-1).ua);
  await minta(S, '/', { headers: { 'User-Agent': 'sqlmap/1.7' } }); await tunggu(150);
  cek('pemindai (sqlmap) dicatat', baris.at(-1).command.startsWith('[pemindai]'), baris.at(-1).command);
  await minta(S, "/layanan?id=1'%20UNION%20SELECT%201,2--"); await tunggu(150);
  cek('serangan di URL dicatat sebagai [sqli]', baris.at(-1).command.startsWith('[sqli]'), baris.at(-1).command);
  await minta(S, '/.env'); await tunggu(150);
  cek('probing /.env dicatat', baris.at(-1).command.startsWith('[url] /.env'), baris.at(-1).command);

  console.log('== 5. keamanan situs ==');
  r = await minta(S, '/login.php', { ...POST, body: form('<script>alert(1)</script>', '<img src=x onerror=alert(1)>') });
  cek('XSS tidak dipantulkan mentah', !r.body.includes('<script>alert(1)</script>') && !r.body.includes('<img src=x'));
  r = await minta(S, '/login.php', { ...POST, body: form("a<b>'<script>", 'x') });
  cek('galat SQL yang memuat payload sudah di-escape', r.body.includes('You have an error') && !/<script>/.test(r.body.replace(/<script>[\s\S]*?<\/script>/g, '')) || !r.body.includes('<b>\'<script>'));
  r = await minta(S, '/login.php', { ...POST, body: 'username=' + 'A'.repeat(20000) + '&password=x' });
  cek('isi terlalu besar -> 413', r.status === 413);
  r = await minta(S, '/tidak-ada', { headers: { Host: '<b>jahat</b>:8080' } });
  cek('404 ala Apache, Host berbahaya di-escape', r.status === 404 && r.body.includes('Apache/2.4.52') && !r.body.includes('<b>jahat</b>'));
  r = await minta(S, '/login.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: "admin'", password: 'x' }) });
  cek('login berformat JSON juga ditangani', r.body.includes('SQL syntax'));
  r = await minta(S, '/login.php', { ...POST, body: 'username[]=a&password=x' });
  cek('input aneh tidak membuat server jatuh', r.status === 200);

  console.log('== 6. ketahanan ==');
  const idx = baris.length;
  for (let i = 0; i < 45; i++) await minta(S, '/admin-backup/', { headers: { 'X-Forwarded-For': '198.51.100.77' } });
  await tunggu(300);
  const dikirim = baris.slice(idx).filter((x) => x.session === 'web-198-51-100-77').length;
  cek('batas laju: maks 30 per menit per IP diteruskan', dikirim <= 30 && dikirim >= 25, 'diteruskan=' + dikirim);
  cek('halaman tetap melayani walau dibatasi', (await minta(S, '/admin-backup/', { headers: { 'X-Forwarded-For': '198.51.100.77' } })).status === 200);
  await new Promise((r2) => mock.close(r2));
  r = await minta(S, '/login.php', { ...POST, body: form("admin'", 'x') });
  cek('n8n mati -> login tetap menjawab "gagal" biasa, tidak error', r.status === 200 && r.body.includes('Username atau password salah.') && r.ms < 6000, r.ms + ' ms');
  r = await minta(S, '/admin-backup/'); cek('n8n mati -> honey-link tetap tampil tanpa menunggu', r.status === 200 && r.ms < 500, r.ms + ' ms');

  console.log(`\nHASIL: ${ok} lulus, ${gagal} gagal`);
  server.close(); process.exit(gagal ? 1 : 0);
})();
