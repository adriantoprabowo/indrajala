const staticData = $getWorkflowStaticData('global');

// =====================================================================
// 1. BACA DATA DARI DATA TABLE
//    (diisi oleh 4 kotak "Ambil ..." sebelum kotak ini. Edit datanya di tab Data Tables.)
// =====================================================================
const ambil = (nama) => $(nama).all().map((i) => i.json);
const T_PROFIL = ambil('Ambil Profil');
const T_BERKAS = ambil('Ambil Berkas');
const T_PROSES = ambil('Ambil Proses');
const T_JAWABAN = ambil('Ambil Jawaban');

const unesc = (s) => String(s ?? '').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
const daftar = (s) => String(s ?? '').split('|').map((x) => x.trim()).filter(Boolean);
const HM = new Date().toISOString().slice(11, 16);
const TGL = new Date().toISOString().slice(0, 10);
const isiTpl = (s) => String(s ?? '').replace(/\{HM\}/g, HM).replace(/\{TGL\}/g, TGL);

const CFG = {};
for (const r of T_PROFIL) if (r.server === 'global') CFG[r.kunci] = String(r.nilai ?? '');
const VERSI_PROFIL = CFG.VERSI_PROFIL || '1';
const PASSWORD_BKP = CFG.PASSWORD_BKP;
const IP_BKP = CFG.IP_BKP;
const BOOT = CFG.BOOT;
const isiDinamis = (s) => String(s)
  .replace(/\{SESSION\}/g, encodeURIComponent(session))
  .replace(/\{PORTAL\}/g, CFG.PORTAL_HOST || 'localhost:5678');

function bangunProfil(h) {
  const p = {};
  for (const r of T_PROFIL) if (r.server === h) p[r.kunci] = isiTpl(r.nilai);
  const fs = {};
  for (const r of T_BERKAS) {
    if (r.server !== h) continue;
    fs[String(r.lokasi)] = r.tipe === 'dir' ? daftar(r.isi) : unesc(r.isi);
  }
  const proses = T_PROSES.filter((r) => r.server === h)
    .sort((a, b) => Number(a.urut) - Number(b.urut))
    .map((r) => [String(r.pemilik), Number(r.pid), Number(r.ppid), Number(r.cpu), Number(r.memori),
      Number(r.vsz), Number(r.rss), String(r.tty), String(r.stat), isiTpl(r.mulai), String(r.waktu), String(r.perintah)]);
  const mentah = {};
  for (const r of T_JAWABAN) if (r.server === h) mentah[String(r.perintah)] = unesc(r.isi);
  const jawaban = {};
  for (const [k, v] of Object.entries(mentah)) jawaban[k] = v.startsWith('ALIAS:') ? (mentah[v.slice(6)] ?? '') : v;
  return {
    server: {
      hostname: p.hostname, user: p.user, uid: Number(p.uid), groups: p.groups, home: p.home,
      kernelVer: p.kernelVer, osName: p.osName, loginInfo: p.loginInfo
    },
    mem: {
      total: Number(p.mem_total), used: Number(p.mem_used), free: Number(p.mem_free), shared: Number(p.mem_shared),
      cache: Number(p.mem_cache), avail: Number(p.mem_avail), swap: Number(p.mem_swap)
    },
    banner: unesc(p.banner), promptSidik: unesc(p.prompt_sidik),
    fs, proses, jawaban, umum: daftar(p.UMUM), denied: daftar(p.DENIED), milik: daftar(p.MILIK)
  };
}
const PROFIL = { app: bangunProfil('app'), bkp: bangunProfil('bkp') };

let AKTIF, SERVER, FS, PROSES, UMUM, DENIED, MILIK, MEM, JAWABAN_TETAP;
function pakai(P) {
  AKTIF = P; SERVER = P.server; FS = P.fs; PROSES = P.proses;
  UMUM = P.umum; DENIED = P.denied; MILIK = P.milik; MEM = P.mem; JAWABAN_TETAP = P.jawaban;
}

// =====================================================================
// 2. SESI DAN STATUS PENYUSUP
// =====================================================================
// State sesi dibaca dari tabel indrajala_state (kotak "Ambil State") dan ditulis kembali oleh kotak "Simpan State".
// Dengan begitu dua sesi berbeda tidak lagi saling menimpa.
const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

const masuk = $('Webhook').first().json;
const sekarang = Date.now();
// Nama sesi: dibersihkan; bila kosong, diturunkan dari sidik klien (UA + header IP bila ada), bukan "default" bersama.
const hdr = masuk.headers || {};
let session = String((masuk.body || {}).session || '').replace(/[^\w.\-]/g, '').slice(0, 40);
if (!session) session = 'anon-' + hash(String(hdr['user-agent'] || '') + String(hdr['x-forwarded-for'] || hdr['x-real-ip'] || '')).toString(36);
if (session.startsWith('_') || ['__proto__', 'constructor', 'prototype'].includes(session)) session = 'x' + session;   // nama berawalan _ dicadangkan untuk baris sistem (_seed, _hermes)
const semuaState = $('Ambil State').all().map((i) => i.json);
const command = String((masuk.body || {}).command || '').slice(0, 500);

const kosong = (x) => (x === undefined || x === null || x === '' || x === '-' ? '' : String(x));
const barisState = semuaState.find((r) => r && r.session === session && String(r.versi) === VERSI_PROFIL);   // versi lain = dianggap sesi baru
let tersimpan = {};
if (barisState) { try { tersimpan = JSON.parse(barisState.data) || {}; } catch { tersimpan = {}; } }
const adaObjek = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : null);

const state = {
  cwd: kosong(tersimpan.cwd) || PROFIL.app.server.home,
  host: kosong(tersimpan.host) || null,
  mode: kosong(tersimpan.mode) || null,
  target: adaObjek(tersimpan.target),
  tries: Number(tersimpan.tries) || 0,
  knownBkp: !!tersimpan.knownBkp,
  pila: adaObjek(tersimpan.pila),
  pid: Number(tersimpan.pid) || 0,
  hermesTerakhir: Number(tersimpan.hermesTerakhir) || 0,
  rl: adaObjek(tersimpan.rl)
};
let history = (Array.isArray(tersimpan.history) ? tersimpan.history : [])
  .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant')).slice(-8);

// Bungkus state untuk disimpan: satu baris per sesi (kolom: session, versi, data, updated).
function bungkus() {
  const data = {
    cwd: state.cwd, host: state.host || '', mode: state.mode || '', target: state.target, tries: state.tries,
    knownBkp: state.knownBkp, pila: state.pila, pid: state.pid, hermesTerakhir: state.hermesTerakhir, rl: state.rl, history
  };
  return { session, versi: VERSI_PROFIL, data: JSON.stringify(data), updated: Date.now() };
}
const keluar = (obj) => [{ json: { session, command, ...obj, stateBaru: bungkus() } }];

pakai(state.host === 'bkp' ? PROFIL.bkp : PROFIL.app);

// ---- batas laju: global dan per sesi (jendela 10 detik) ----
if (!staticData.rl || sekarang - staticData.rl.t0 > 10000) staticData.rl = { t0: sekarang, n: 0 };
staticData.rl.n += 1;
if (!state.rl || sekarang - state.rl.t0 > 10000) state.rl = { t0: sekarang, n: 0 };
state.rl.n += 1;
if (staticData.rl.n > 80 || state.rl.n > 15) {
  const pertama = staticData.rl.n === 81 || state.rl.n === 16;
  return keluar({ perlu_llm: false, banjir: true, banjirTanda: pertama, reply: '-bash: fork: retry: Resource temporarily unavailable' });
}

// =====================================================================
// 3. ALAT BANTU FILESYSTEM PALSU
// =====================================================================
const dirname = (p) => p.substring(0, p.lastIndexOf('/')) || '/';
const basename = (p) => p.substring(p.lastIndexOf('/') + 1);
const join = (d, n) => (d === '/' ? '' : d) + '/' + n;

function resolve(cwd, p) {
  if (!p || p === '~') return SERVER.home;
  if (p.startsWith('~/')) p = SERVER.home + p.slice(1);
  const parts = (p.startsWith('/') ? p : cwd + '/' + p).split('/');
  const out = [];
  for (const s of parts) {
    if (!s || s === '.') continue;
    if (s === '..') out.pop(); else out.push(s);
  }
  return '/' + out.join('/');
}

const isDir = (p) => Array.isArray(FS[p]) || UMUM.includes(p) || p === '/';
const isFile = (p) => {
  const induk = FS[dirname(p)];
  return Array.isArray(induk) && induk.includes(basename(p)) && !isDir(p);
};
const exists = (p) => isDir(p) || isFile(p) || DENIED.includes(p);

function baris(dir, n) {
  const p = n === '.' ? dir : n === '..' ? dirname(dir) : join(dir, n);
  const folder = n === '.' || n === '..' || isDir(p);
  const pemilik = MILIK.some((pre) => dir.startsWith(pre)) ? SERVER.user : 'root';
  const h = hash(p);
  const ukuran = folder ? 4096 : (typeof FS[p] === 'string' ? FS[p].length : 1024 + (h % 900000));
  let bulan = ['Sep', 'Oct'][h % 2];
  let hari = String(1 + ((h >>> 3) % 25)).padStart(2, ' ');
  let jam = String(h % 24).padStart(2, '0') + ':' + String((h >>> 5) % 60).padStart(2, '0');
  const tgl = n.match(/(\d{4})-(\d{2})-(\d{2})/); // nama berkas bertanggal -> pakai tanggal itu
  if (tgl) {
    bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(tgl[2]) - 1];
    hari = String(Number(tgl[3])).padStart(2, ' ');
    jam = '02:00';
  }
  const mode = folder ? 'drwxr-xr-x' : (n.startsWith('.') ? '-rw-------' : '-rw-r--r--');
  return `${mode} ${folder ? 2 : 1} ${pemilik.padEnd(5)} ${pemilik.padEnd(5)} ${String(ukuran).padStart(6)} ${bulan} ${hari} ${jam} ${n}`;
}

function lsCmd(args) {
  let flags = '';
  const paths = [];
  for (const a of args) { if (a.startsWith('-')) flags += a.slice(1); else paths.push(a); }
  const panjang = flags.includes('l');
  const semua = flags.includes('a');
  const target = paths[0] === undefined ? state.cwd : resolve(state.cwd, paths[0]);
  const tampil = paths[0] || target;
  if (DENIED.includes(target)) return `ls: cannot open directory '${tampil}': Permission denied`;
  if (!exists(target)) return `ls: cannot access '${tampil}': No such file or directory`;
  if (isFile(target)) return panjang ? baris(dirname(target), basename(target)) : tampil;
  if (!Array.isArray(FS[target])) return null; // folder umum -> serahkan ke Hermes
  let nama = FS[target].slice().sort((a, b) => a.localeCompare(b));
  if (!semua) nama = nama.filter((n) => !n.startsWith('.'));
  else nama = ['.', '..', ...nama];
  if (!panjang) return nama.join(state.grepPola ? '\n' : '  ');
  return 'total ' + nama.length * 4 + '\n' + nama.map((n) => baris(target, n)).join('\n');
}

// =====================================================================
// 4. JAWABAN LANGSUNG TANPA AI
// =====================================================================
function jawab(cmdLine) {
  const parts = cmdLine.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const cmd = parts[0];
  const args = parts.slice(1);
  const bukanFlag = args.filter((a) => !a.startsWith('-'));
  const flag = args.filter((a) => a.startsWith('-')).join('');

  // jawaban tetap dari tabel "indrajala_jawaban"
  const kunci = cmdLine.trim().replace(/\s+/g, ' ');
  if (JAWABAN_TETAP[kunci] !== undefined) return JAWABAN_TETAP[kunci];

  const pad2 = (n) => String(n).padStart(2, '0');
  const kini = new Date();
  const jamKini = `${pad2(kini.getUTCHours())}:${pad2(kini.getUTCMinutes())}:${pad2(kini.getUTCSeconds())}`;
  const rnd = () => Math.floor(Math.random() * 9);
  const beban = `0.0${rnd()}, 0.0${rnd()}, 0.0${rnd()}`;
  const ms = Date.now() - Date.parse(BOOT);
  const hariUp = Math.floor(ms / 86400000);
  const jamUp = Math.floor((ms % 86400000) / 3600000);
  const menitUp = Math.floor((ms % 3600000) / 60000);
  const lamaUp = (hariUp > 0 ? `${hariUp} day${hariUp > 1 ? 's' : ''}, ` : '') + `${String(jamUp).padStart(2, ' ')}:${pad2(menitUp)}`;
  const loginHM = (SERVER.loginInfo.match(/(\d\d:\d\d)/) || [])[1] || '09:12';

  const paketTidakAda = { ifconfig: 'net-tools', netstat: 'net-tools', mysql: 'mysql-client-core-8.0', nmap: 'nmap', telnet: 'telnet' };
  if (paketTidakAda[cmd]) {
    return `Command '${cmd}' not found, but can be installed with:\n\nsudo apt install ${paketTidakAda[cmd]}\nPlease ask your administrator.`;
  }

  if (cmd === 'ssh') {
    const t = bukanFlag[0] || '';
    if (!t) return null;
    const bkp = t === 'bkp';
    const user = bkp ? 'backup' : (t.includes('@') ? t.split('@')[0] : SERVER.user);
    const host = bkp ? IP_BKP : (t.includes('@') ? t.split('@')[1] : t);
    return `${user}@${host}: Permission denied (publickey,password).`;
  }

  if (cmd === 'uptime') return ` ${jamKini} up ${lamaUp},  1 user,  load average: ${beban}`;

  if (cmd === 'w') {
    const dari = (SERVER.loginInfo.match(/\((.*?)\)/) || [])[1] || '10.0.0.1';
    return ` ${jamKini} up ${lamaUp},  1 user,  load average: ${beban}\n` +
      'USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU WHAT\n' +
      `${SERVER.user.padEnd(8)} pts/0    ${dari.padEnd(16)} ${loginHM}    0.00s  0.03s  0.00s w`;
  }

  if (cmd === 'date') {
    const H = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const B = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${H[kini.getUTCDay()]} ${B[kini.getUTCMonth()]} ${String(kini.getUTCDate()).padStart(2, ' ')} ${jamKini} UTC ${kini.getUTCFullYear()}`;
  }

  if (cmd === 'free') {
    const h = flag.includes('h');
    const m = flag.includes('m');
    const fmt = (v) => {
      if (h) return v === 0 ? '0B' : v >= 1024 ? (v / 1024).toFixed(1) + 'Gi' : v + 'Mi';
      return String(m ? v : v * 1024);
    };
    const kolom = (label, vals) => label.padEnd(8) + vals.map((v) => String(v).padStart(12)).join('');
    return [
      kolom('', ['total', 'used', 'free', 'shared', 'buff/cache', 'available']),
      kolom('Mem:', [MEM.total, MEM.used, MEM.free, MEM.shared, MEM.cache, MEM.avail].map(fmt)),
      kolom('Swap:', [MEM.swap, 0, MEM.swap].map(fmt))
    ].join('\n');
  }

  if (cmd === 'history') {
    const f = FS[join(SERVER.home, '.bash_history')];
    const isi = typeof f === 'string' ? f.split('\n') : [];
    return [...isi, 'history'].map((l, i) => String(i + 1).padStart(5) + '  ' + l).join('\n');
  }

  if (cmd === 'ps') {
    const semuaBsd = args.length > 0 && args.every((a) => /^-?a[ux]{1,2}w*$/.test(a));
    const modeEf = args.includes('-ef');
    const polos = args.length === 0;
    if (!semuaBsd && !modeEf && !polos) return null; // opsi aneh -> Hermes

    if (!state.pid) state.pid = 2420 + (hash(session) % 50);
    state.pid += 3 + Math.floor(Math.random() * 6);
    const pidPs = state.pid;
    const mulai = jamKini.slice(0, 5);

    if (polos) {
      const k = (p, t, n) => String(p).padStart(7) + ' ' + t.padEnd(8) + ' ' + '00:00:00'.padStart(8) + ' ' + n;
      const br = ['PID'.padStart(7) + ' ' + 'TTY'.padEnd(8) + ' ' + 'TIME'.padStart(8) + ' CMD', k(2399, 'pts/0', 'bash'), k(pidPs, 'pts/0', 'ps')];
      if (state.grepPola) br.push(k(pidPs + 1, 'pts/0', 'grep'));
      return br.join('\n');
    }

    const semua = [
      ...PROSES,
      [SERVER.user, 2399, 2398, 0.0, 0.1, 9984, 5376, 'pts/0', 'Ss', loginHM, '0:00', '-bash'],
      [SERVER.user, pidPs, 2399, 0.0, 0.1, 10156, 3456, 'pts/0', 'R+', mulai, '0:00', ('ps ' + args.join(' ')).trim()]
    ];
    if (state.grepPola) {
      semua.push([SERVER.user, pidPs + 1, 2399, 0.0, 0.0, 9032, 2432, 'pts/0', 'S+', mulai, '0:00', 'grep --color=auto ' + state.grepPola]);
    }

    if (modeEf) {
      const t8 = (t) => { const [mm, ss] = t.split(':'); return '00:' + pad2(mm) + ':' + ss; };
      const kepala = 'UID'.padEnd(8) + ' ' + 'PID'.padStart(7) + ' ' + 'PPID'.padStart(7) + '  C STIME ' + 'TTY'.padEnd(8) + ' ' + 'TIME'.padStart(8) + ' CMD';
      return [kepala, ...semua.map((r) =>
        String(r[0]).padEnd(8) + ' ' + String(r[1]).padStart(7) + ' ' + String(r[2]).padStart(7) + '  0 ' + String(r[9]).padEnd(5) + ' ' + String(r[7]).padEnd(8) + ' ' + t8(r[10]) + ' ' + r[11]
      )].join('\n');
    }

    const kepalaAux = 'USER'.padEnd(8) + ' ' + 'PID'.padStart(7) + ' ' + '%CPU'.padStart(4) + ' ' + '%MEM'.padStart(4) + ' ' + 'VSZ'.padStart(6) + ' ' + 'RSS'.padStart(5) + ' ' + 'TTY'.padEnd(8) + ' ' + 'STAT'.padEnd(4) + ' ' + 'START'.padEnd(5) + ' ' + 'TIME'.padStart(6) + ' COMMAND';
    return [kepalaAux, ...semua.map((r) =>
      String(r[0]).padEnd(8) + ' ' + String(r[1]).padStart(7) + ' ' + r[3].toFixed(1).padStart(4) + ' ' + r[4].toFixed(1).padStart(4) + ' ' + String(r[5]).padStart(6) + ' ' + String(r[6]).padStart(5) + ' ' + String(r[7]).padEnd(8) + ' ' + String(r[8]).padEnd(4) + ' ' + String(r[9]).padEnd(5) + ' ' + String(r[10]).padStart(6) + ' ' + r[11]
    )].join('\n');
  }

  switch (cmd) {
    case 'whoami': return SERVER.user;
    case 'who': return `${SERVER.user}     ${SERVER.loginInfo}`;
    case 'id': return `uid=${SERVER.uid}(${SERVER.user}) gid=${SERVER.uid}(${SERVER.user}) groups=${SERVER.groups}`;
    case 'hostname': return SERVER.hostname;
    case 'pwd': return state.cwd;
    case 'echo': return args.join(' ');
    case 'uname':
      if (flag.includes('a')) return `Linux ${SERVER.hostname} ${SERVER.kernelVer} #101-Ubuntu SMP Tue Nov 14 13:30:08 UTC 2023 x86_64 x86_64 x86_64 GNU/Linux`;
      if (flag.includes('r')) return SERVER.kernelVer;
      if (flag.includes('n')) return SERVER.hostname;
      return 'Linux';
    case 'cd': {
      const target = resolve(state.cwd, args[0]);
      if (DENIED.includes(target)) return `bash: cd: ${args[0]}: Permission denied`;
      if (!exists(target)) return `bash: cd: ${args[0]}: No such file or directory`;
      if (isFile(target)) return `bash: cd: ${args[0]}: Not a directory`;
      state.cwd = target;
      return '';
    }
    case 'ls': return lsCmd(args);
    case 'cat': {
      if (bukanFlag.length === 0) return '';
      return bukanFlag.map((a) => {
        const p = resolve(state.cwd, a);
        if (DENIED.includes(p)) return `cat: ${a}: Permission denied`;
        if (!exists(p)) return `cat: ${a}: No such file or directory`;
        if (isDir(p)) return `cat: ${a}: Is a directory`;
        return typeof FS[p] === 'string' ? isiDinamis(FS[p]) : '';
      }).join('\n');
    }
    case 'sudo': return 'sudo: a terminal is required to read the password; either use the -S option to read from standard input or configure an askpass helper';
    case 'rm':
      if (/r/.test(flag) && ['/', '/*'].includes(bukanFlag[0])) return "rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this safety";
      return `rm: cannot remove '${bukanFlag[0] || ''}': Permission denied`;
    case 'mkdir': return `mkdir: cannot create directory '${bukanFlag[0] || ''}': Permission denied`;
    case 'touch': return `touch: cannot touch '${bukanFlag[0] || ''}': Permission denied`;
    case 'mv': return `mv: cannot move '${bukanFlag[0] || ''}' to '${bukanFlag[1] || ''}': Permission denied`;
    case 'chmod': return `chmod: changing permissions of '${bukanFlag[bukanFlag.length - 1] || ''}': Operation not permitted`;
    case 'chown': return `chown: changing ownership of '${bukanFlag[bukanFlag.length - 1] || ''}': Operation not permitted`;
    case 'curl':
    case 'wget': {
      const url = bukanFlag.find((a) => /^https?:\/\//.test(a) || a.includes('.')) || '';
      const host = url.replace(/^https?:\/\//, '').split(/[\/:]/)[0] || 'host';
      return cmd === 'curl' ? `curl: (6) Could not resolve host: ${host}` : `wget: unable to resolve host address '${host}'`;
    }
    default: return null; // tidak ada di buku -> Hermes
  }
}

// =====================================================================
// 5. SSH KE SERVER KEDUA (bkp-01)
// =====================================================================
function jalankanDiB(cmdLine) {
  const cwdAsal = state.cwd;
  const asal = AKTIF;
  pakai(PROFIL.bkp);
  state.cwd = PROFIL.bkp.server.home;
  const hasil = jawab(cmdLine);
  state.cwd = cwdAsal;
  pakai(asal);
  return hasil === null ? `bash: ${cmdLine.split(/\s+/)[0]}: command not found` : hasil;
}

function parseSsh(cmdLine) {
  const t = cmdLine.trim().split(/\s+/);
  if (t[0] !== 'ssh') return null;
  const denganArg = ['-p', '-i', '-o', '-l', '-F', '-J', '-L', '-R', '-D'];
  let target = null;
  const sisa = [];
  for (let i = 1; i < t.length; i++) {
    if (target === null) {
      if (denganArg.includes(t[i])) { i++; continue; }
      if (t[i].startsWith('-')) continue;
      target = t[i];
    } else sisa.push(t[i]);
  }
  if (!target) return null;
  const adaUser = target.includes('@');
  const host = adaUser ? target.split('@')[1] : target;
  if (host !== 'bkp' && host !== IP_BKP) return null;
  const user = adaUser ? target.split('@')[0] : (host === 'bkp' ? 'backup' : SERVER.user);
  return { user, sisa: sisa.join(' ').replace(/^['"]|['"]$/g, '') };
}

let balasanKhusus = null;
const cmdBersih = command.trim();

if (state.mode && (cmdBersih === '^C' || cmdBersih === '\u0003')) {
  state.mode = null;
  balasanKhusus = '^C';
} else if (state.mode === 'hostkey') {
  const jawaban = cmdBersih.toLowerCase();
  if (jawaban === 'yes') {
    state.knownBkp = true; state.mode = 'password'; state.tries = 0;
    balasanKhusus = `Warning: Permanently added '${IP_BKP}' (ED25519) to the list of known hosts.\n${state.target.user}@${IP_BKP}'s password: `;
  } else if (jawaban === 'no') {
    state.mode = null;
    balasanKhusus = 'Host key verification failed.';
  } else {
    state.tries = (state.tries || 0) + 1;
    if (state.tries >= 3) { state.mode = null; balasanKhusus = 'Host key verification failed.'; }
    else balasanKhusus = "Please type 'yes', 'no' or the fingerprint: ";
  }
} else if (state.mode === 'password') {
  if (state.target.user === 'backup' && cmdBersih === PASSWORD_BKP) {
    state.mode = null;
    if (state.target.sisa) {
      balasanKhusus = jalankanDiB(state.target.sisa);
    } else {
      state.pila = { cwd: state.cwd };
      state.host = 'bkp';
      state.cwd = PROFIL.bkp.server.home;
      history = [];
      balasanKhusus = PROFIL.bkp.banner;
    }
  } else {
    state.tries = (state.tries || 0) + 1;
    if (state.tries >= 3) {
      state.mode = null;
      balasanKhusus = `${state.target.user}@${IP_BKP}: Permission denied (publickey,password).`;
    } else {
      balasanKhusus = `Permission denied, please try again.\n${state.target.user}@${IP_BKP}'s password: `;
    }
  }
} else if (state.host === 'bkp' && (cmdBersih === 'exit' || cmdBersih === 'logout')) {
  state.host = null;
  state.cwd = (state.pila && state.pila.cwd) || PROFIL.app.server.home;
  history = [];
  balasanKhusus = `logout\nConnection to ${IP_BKP} closed.`;
} else if (!state.host && (cmdBersih === 'exit' || cmdBersih === 'logout')) {
  balasanKhusus = 'logout';
} else if (!state.host) {
  const tujuan = parseSsh(cmdBersih);
  if (tujuan) {
    state.target = tujuan;
    state.tries = 0;
    if (state.knownBkp) { state.mode = 'password'; balasanKhusus = `${tujuan.user}@${IP_BKP}'s password: `; }
    else { state.mode = 'hostkey'; balasanKhusus = PROFIL.bkp.promptSidik; }
  }
}

if (balasanKhusus !== null) {
  return keluar({ perlu_llm: false, reply: balasanKhusus });
}

// =====================================================================
// 6. JAWAB LANGSUNG (termasuk "| grep") ATAU SERAHKAN KE HERMES
// =====================================================================
let langsung = null;
const m = command.match(/^([^|;&><`$]+)\|\s*grep\s+(-[iv]+\s+)?['"]?([^'"|;&><`$\s]+)['"]?\s*$/);
if (m) {
  const opsi = m[2] || '';
  const kecil = opsi.includes('i');
  const balik = opsi.includes('v');
  state.grepPola = (opsi.trim() ? opsi.trim() + ' ' : '') + m[3];
  const hasil = jawab(m[1]);
  delete state.grepPola;
  if (hasil !== null) {
    const pola = kecil ? m[3].toLowerCase() : m[3];
    langsung = hasil.split('\n').filter((l) => (((kecil ? l.toLowerCase() : l).includes(pola)) !== balik)).join('\n');
  }
} else if (!/[|;&><`$]/.test(command)) {
  langsung = jawab(command);
}

if (langsung !== null) {
  return keluar({ perlu_llm: false, reply: langsung });
}

// ---- Hermes hanya untuk perintah Linux sungguhan. Kalimat biasa = "command not found", persis seperti bash asli. ----
const KATA_PERTAMA = command.trim().split(/\s+/)[0] || '';
const PERINTAH_NYATA = new Set(('top htop vmstat iostat mpstat sar lsof lscpu lsblk lsmod lspci lsusb dmesg journalctl systemctl service ' +
  'env printenv which whereis type file stat find grep egrep fgrep head tail wc sort uniq awk sed cut tr tee less more diff tar gzip gunzip zip unzip ' +
  'xargs kill pkill killall sleep watch last lastlog groups getent su ln cp dd du df mount ip route arp ping traceroute nslookup dig host ' +
  'python3 perl git vim vi nano base64 md5sum sha1sum sha256sum openssl rsync apt apt-get dpkg snap pip pip3 locale cal clear tty getconf ' +
  'hostnamectl timedatectl crontab passwd chgrp strings od xxd nc').split(' '));
if (/^(\.\/|\/)/.test(KATA_PERTAMA)) {
  return keluar({ perlu_llm: false, reply: `bash: ${KATA_PERTAMA}: No such file or directory` });
}
if (!PERINTAH_NYATA.has(KATA_PERTAMA)) {
  return keluar({ perlu_llm: false, reply: `bash: ${KATA_PERTAMA}: command not found` });
}

// ---- pembatas Hermes: penanda disimpan di tabel (baris "_hermes") oleh kotak "Tandai Hermes Sibuk" SEBELUM Hermes dipanggil,
// sehingga permintaan lain yang datang saat Hermes bekerja langsung melihatnya. Penanda kedaluwarsa sendiri dalam 20 detik. ----
const barisHermes = semuaState.find((r) => r && r.session === '_hermes' && String(r.versi) === VERSI_PROFIL);
let hermesSampai = 0;
if (barisHermes) { try { hermesSampai = Number(JSON.parse(barisHermes.data).sampai) || 0; } catch { hermesSampai = 0; } }
if (hermesSampai > sekarang) {
  return keluar({ perlu_llm: false, reply: `bash: ${command.trim().split(/\s+/)[0]}: command not found` });
}
const hermesBaru = { session: '_hermes', versi: VERSI_PROFIL, data: JSON.stringify({ sampai: sekarang + 20000 }), updated: sekarang };

// ---- jalur Hermes (aktor cadangan) ----
const isiCwd = Array.isArray(FS[state.cwd]) ? FS[state.cwd].join(', ') : '(unknown)';

const systemPrompt = `You are a Linux terminal (${SERVER.osName || 'Ubuntu 22.04'}) on a server named ${SERVER.hostname}. The logged-in user is ${SERVER.user} (a normal user, not root). Current directory: ${state.cwd}. Files in the current directory: ${isiCwd}. You ONLY output exactly what a real terminal would print for the command given, with no explanation, no greeting, and no markdown. Never say you are an AI, a simulation, or a honeypot. If you must invent data, keep it plausible and entirely FICTIONAL: use fake IP addresses in the 10.x.x.x range, and never use real names, real organizations, real passwords, or real secrets. Keep each reply under 15 lines. If a command is unknown, print: bash: <command>: command not found. If a command needs root privileges or would change the system, print a realistic Permission denied error. Stay consistent with everything printed earlier in this conversation. Always stay in character.`;

const contoh = JAWABAN_TETAP['df -h']
  ? [{ role: 'user', content: 'df -h' }, { role: 'assistant', content: JAWABAN_TETAP['df -h'] }]
  : [];

const payload = {
  model: 'hermes3:3b',
  stream: false,
  keep_alive: '30m',
  options: { temperature: 0.1, seed: 7, num_predict: 200 },
  messages: [
    { role: 'system', content: systemPrompt },
    ...(history.length === 0 ? contoh : []),
    ...history,
    { role: 'user', content: command }
  ]
};

return keluar({ perlu_llm: true, payload, hermesBaru });
