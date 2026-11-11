// Zona Hijau: menilai peristiwa dari website dummy (Zona Kuning) dan menentukan respons yang HARUS ditampilkan.
// Semua keputusan di sini deterministik (tanpa AI), supaya cepat dan tidak bisa dibujuk.
const b = $input.first().json.body || {};
const str = (v, n) => String(v ?? '').slice(0, n);
const tipe = ['login', 'honeylink', 'url', 'scanner'].includes(b.tipe) ? b.tipe : 'url';
const ip = str(b.ip, 45).replace(/[^0-9a-fA-F:.]/g, '') || '0.0.0.0';
const ua = str(b.ua, 120);
const dec = (t) => { try { return decodeURIComponent(String(t).replace(/\+/g, ' ')); } catch { return String(t); } };
const path = dec(str(b.path, 200));
const query = dec(str(b.query, 300));
const user = str((b.data || {}).username, 200);
const pass = str((b.data || {}).password, 200);

// ---- pengenal sesi: satu per IP ----
const session = 'web-' + ip.replace(/[^0-9a-fA-F]/g, '-');

// ---- kredensial umpan (sama dengan config.php.bak di website dan tabel berkas) ----
const BAIT_USER = 'webapp';
const BAIT_PASS = 'Wb!7qLm2Xp';

// ---- pendeteksi pola SQL injection ----
function analisis(teks) {
  const t = String(teks);
  const r = { tautologi: false, kondisi: null, orderBy: null, union: false, sleep: null, galat: false, stacked: false, kutip: /['"]/.test(t), info: false };
  // penutup kutip di sisi kanan boleh tidak ada (payload memakai kutip penutup milik kueri asli)
  const taut = t.match(/['"]\s*\)*\s*(?:or|\|\|)\s*\(*\s*(['"]?)(\w+)\1\s*(?:=|like)\s*['"]?(\w+)/i);
  if (taut) { r.tautologi = true; r.kondisi = taut[2] === taut[3]; }
  if (/['"]\s*or\s+true\b/i.test(t) || /^[\w@.\-]*['"]\s*(--|#|\/\*)/.test(t)) r.tautologi = true;
  const bl = t.match(/\b(?:and|&&)\s+(['"]?)(\w+)\1\s*=\s*(['"]?)(\w+)\3/i);
  if (bl && !r.tautologi) r.kondisi = bl[2] === bl[4];
  const ob = t.match(/order\s+by\s+(\d+)/i);
  if (ob) r.orderBy = Number(ob[1]);
  r.union = /union(\s+all)?\s+select/i.test(t);
  const sl = t.match(/sleep\s*\(\s*(\d+)|pg_sleep\s*\(\s*(\d+)|waitfor\s+delay\s+'0:0:(\d+)/i);
  if (sl) r.sleep = Number(sl[1] || sl[2] || sl[3]);
  else if (/benchmark\s*\(/i.test(t)) r.sleep = 3;
  r.galat = /extractvalue|updatexml|floor\s*\(\s*rand|exp\s*\(\s*~/i.test(t);
  r.stacked = /;\s*(drop|insert|update|delete|select|create|alter|exec)\b/i.test(t);
  r.info = /information_schema|@@version|version\s*\(\s*\)|database\s*\(\s*\)|\buser\s*\(\s*\)/i.test(t);
  r.sqli = r.tautologi || r.union || r.sleep !== null || r.galat || r.stacked || r.orderBy !== null || r.kondisi !== null || r.info || r.kutip;
  return r;
}

const gabung = user + ' ' + pass;
const sq = tipe === 'login' ? analisis(gabung) : analisis(path + ' ' + query);
const sqliKeras = sq.sqli && (sq.tautologi || sq.union || sq.sleep !== null || sq.galat || sq.stacked || sq.orderBy !== null || sq.kondisi !== null || sq.info || sq.kutip);

// ---- tentukan respons ----
let aksi = 'tampil', pesan = '', kode = '', tunda_ms = 0, jenis = tipe;

if (tipe === 'login') {
  const kueri = "SELECT id, nama, peran FROM pegawai WHERE username='" + user + "' AND password=MD5('" + pass + "') LIMIT 1";
  const posisi = (() => {
    const iu = user.indexOf("'"), ip2 = pass.indexOf("'");
    if (iu >= 0) return kueri.indexOf("username='") + 10 + iu;
    if (ip2 >= 0) return kueri.indexOf("MD5('") + 5 + ip2;
    return 0;
  })();
  const dekat = kueri.slice(posisi).slice(0, 70);

  if (user === BAIT_USER && pass === BAIT_PASS) {
    aksi = 'sukses'; jenis = 'kredensial-umpan';
  } else if (sq.tautologi && sq.kondisi !== false) {
    aksi = 'sukses'; jenis = 'sqli-tautologi';
  } else if (sq.sleep !== null) {
    aksi = 'gagal'; pesan = 'Username atau password salah.'; tunda_ms = Math.min(sq.sleep * 1000, 8000); jenis = 'sqli-waktu';
  } else if (sq.orderBy !== null) {
    jenis = 'sqli-order-by';
    if (sq.orderBy > 5) { aksi = 'error_sql'; kode = '1054'; pesan = `Unknown column '${sq.orderBy}' in 'order clause'`; }
    else { aksi = 'gagal'; pesan = 'Username atau password salah.'; }
  } else if (sq.union) {
    aksi = 'error_sql'; kode = '1222'; pesan = 'The used SELECT statements have a different number of columns'; jenis = 'sqli-union';
  } else if (sq.galat) {
    aksi = 'error_sql'; kode = '1105'; pesan = "XPATH syntax error: '~8.0.35-0ubuntu0.22.04.1'"; jenis = 'sqli-galat';
  } else if (sq.kondisi !== null) {
    aksi = 'gagal'; pesan = sq.kondisi ? 'Password salah.' : 'Pengguna tidak ditemukan.'; jenis = 'sqli-buta';
  } else if (sq.stacked || sq.kutip || sq.info) {
    aksi = 'error_sql'; kode = '1064';
    pesan = `You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near '${dekat}' at line 1`;
    jenis = sq.stacked ? 'sqli-bertumpuk' : 'sqli-kutip';
  } else {
    aksi = 'gagal'; pesan = 'Username atau password salah.'; jenis = 'login';
  }
}

// ---- baris catatan untuk tabel indrajala_log ----
const sqliTerdeteksi = jenis.startsWith('sqli') || (tipe !== 'login' && sqliKeras && (sq.tautologi || sq.union || sq.sleep !== null || sq.galat || sq.stacked || sq.orderBy !== null || sq.info));
let command, level;
if (tipe === 'login') {
  command = `[${jenis.startsWith('sqli') ? 'sqli' : 'login'}] user="${user}" pass="${pass}"`;
  level = jenis.startsWith('sqli') || jenis === 'kredensial-umpan' ? 'tinggi' : 'sedang';
} else if (tipe === 'honeylink') {
  command = `[honeylink] ${path}${query ? '?' + query : ''}`; level = 'tinggi';
} else if (tipe === 'scanner') {
  command = `[pemindai] ${ua} ${path}`; level = 'tinggi';
} else {
  command = `[${sqliTerdeteksi ? 'sqli' : 'url'}] ${path}${query ? '?' + query : ''}`; level = sqliTerdeteksi ? 'tinggi' : 'sedang';
}

const catat = {
  ts: Date.now(),
  waktu: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
  session,
  command: command.slice(0, 500),
  level,
  tahap: 0,
  host: 'web',
  reply: `${jenis}; aksi=${aksi}`.slice(0, 200),
  ua: (`IP ${ip} | ${ua || '-'}`).slice(0, 160)
};

return [{ json: { respons: { aksi, pesan, kode, tunda_ms }, catat, session } }];
