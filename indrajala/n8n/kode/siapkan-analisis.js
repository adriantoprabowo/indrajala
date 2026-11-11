// Data dibaca dari tabel (kotak "Ambil Log Analisis"). Hermes HANYA menerima fakta hasil hitungan,
// tidak pernah teks perintah mentah dari penyerang (tahan prompt injection).
const q = $('Webhook Analisis').first().json.query || {};
const sesi = String(q.session || '').replace(/[^\w.\-]/g, '').slice(0, 40);
const num = (v) => Number(v) || 0;

const entri = $('Ambil Log Analisis').all().map((i) => i.json)
  .filter((e) => num(e.ts) > 0 && String(e.session) === sesi)
  .map((e) => ({ ...e, ts: num(e.ts), tahap: num(e.tahap), command: String(e.command ?? '') }))
  .sort((a, b) => a.ts - b.ts);

const namaTahap = ['Baru masuk', 'Menemukan petunjuk', 'Mengambil kredensial umpan', 'Mencoba pindah server'];

// Sesi tidak ditemukan: kirim permintaan sangat kecil ke Hermes supaya alur tetap lurus.
if (entri.length === 0) {
  return [{
    json: {
      kosong: true, sesi, laporan: null,
      payload: { model: 'hermes3:3b', stream: false, options: { num_predict: 1 }, messages: [{ role: 'user', content: 'ok' }] }
    }
  }];
}

// ---- Kamus teknik MITRE ATT&CK (pemetaan pasti berbasis pola, bukan tebakan AI) ----
const TEKNIK = [
  [/\b(whoami|id|who|w)\b/, 'T1033', 'System Owner/User Discovery', 'Discovery'],
  [/\b(ls|find|tree)\b/, 'T1083', 'File and Directory Discovery', 'Discovery'],
  [/\bps\b/, 'T1057', 'Process Discovery', 'Discovery'],
  [/\b(uname|hostname|lsb_release|os-release)\b/, 'T1082', 'System Information Discovery', 'Discovery'],
  [/\b(ip a|ip addr|ifconfig)\b|hostname -i/, 'T1016', 'System Network Configuration Discovery', 'Discovery'],
  [/\b(ss|netstat)\b/, 'T1049', 'System Network Connections Discovery', 'Discovery'],
  [/\bnmap\b/, 'T1046', 'Network Service Discovery', 'Discovery'],
  [/\/etc\/passwd/, 'T1087.001', 'Account Discovery: Local Account', 'Discovery'],
  [/\/etc\/shadow/, 'T1003.008', 'OS Credential Dumping: /etc/passwd and /etc/shadow', 'Credential Access'],
  [/\.env|config\.php|id_rsa/, 'T1552.001', 'Unsecured Credentials: Credentials In Files', 'Credential Access'],
  [/\.bash_history|\bhistory\b/, 'T1552.003', 'Unsecured Credentials: Bash History', 'Credential Access'],
  [/(^|\s)(ssh|sshpass|scp)(\s|$)/, 'T1021.004', 'Remote Services: SSH', 'Lateral Movement'],
  [/\b(wget|curl)\b/, 'T1105', 'Ingress Tool Transfer', 'Command and Control'],
  [/\bsudo\b/, 'T1548.003', 'Abuse Elevation Control Mechanism: Sudo and Sudo Caching', 'Privilege Escalation'],
  [/\b(chmod|chown)\b/, 'T1222.002', 'File and Directory Permissions Modification', 'Defense Evasion'],
  [/\brm\b/, 'T1070.004', 'Indicator Removal: File Deletion', 'Defense Evasion'],
  [/\bcrontab\b/, 'T1053.003', 'Scheduled Task/Job: Cron', 'Persistence'],
  // ---- peristiwa dari website (Zona Kuning) ----
  [/^\[sqli\]/, 'T1190', 'Exploit Public-Facing Application', 'Initial Access'],
  [/^\[login\]/, 'T1110', 'Brute Force', 'Credential Access'],
  [/^\[pemindai\]/, 'T1595.002', 'Active Scanning: Vulnerability Scanning', 'Reconnaissance'],
  [/^\[(honeylink|url)\]/, 'T1595.003', 'Active Scanning: Wordlist Scanning', 'Reconnaissance']
];

const teknik = new Map();
for (const e of entri) {
  const c = e.command.toLowerCase();
  const dariWeb = c.startsWith('[');
  for (const [re, id, nama, taktik] of TEKNIK) {
    if (dariWeb !== re.source.startsWith('^\\[')) continue; // aturan web hanya untuk peristiwa web, aturan terminal hanya untuk terminal
    if (re.test(c)) {
      if (!teknik.has(id)) teknik.set(id, { id, nama, taktik, jumlah: 0, contoh: e.command.slice(0, 120) });
      teknik.get(id).jumlah += 1;
    }
  }
}

const awal = entri[0].ts;
const akhir = entri[entri.length - 1].ts;
const tahapMax = Math.min(3, Math.max(...entri.map((e) => e.tahap)));
const masukBkp = entri.some((e) => String(e.host) === 'bkp');
const tinggi = entri.filter((e) => e.level === 'tinggi').length;

const laporan = {
  sesi, awal, akhir,
  langkah: entri.length, tinggi,
  tahap: tahapMax, namaTahap: namaTahap[tahapMax],
  timeline: entri.map((e) => ({ t: e.ts - awal, command: e.command.slice(0, 200), level: e.level })),
  teknik: [...teknik.values()]
};

// ---- Bahan untuk Hermes: HANYA fakta terhitung (tanpa teks dari penyerang) ----
const urutTaktik = [...new Set(laporan.teknik.map((t) => t.taktik))];
const fakta = [
  `Session duration: ${Math.round((akhir - awal) / 1000)} seconds`,
  `Commands typed: ${entri.length}; high-risk commands: ${tinggi}`,
  `Deepest bait stage reached: ${tahapMax} of 3 (${namaTahap[tahapMax]})`,
  `Reached the second server: ${masukBkp ? 'yes' : 'no'}`,
  `ATT&CK techniques detected: ${laporan.teknik.map((t) => `${t.id} ${t.nama}`).join('; ') || 'none'}`,
  `Tactics in order of first appearance: ${urutTaktik.join(' -> ') || 'none'}`
].join('\n');

const payload = {
  model: 'hermes3:3b',
  stream: false,
  keep_alive: '30m',
  options: { temperature: 0.2, num_predict: 160 },
  messages: [
    {
      role: 'system',
      content: 'You are a cybersecurity analyst reviewing an intruder session on a decoy (honeypot) server. Write a summary in Indonesian of at most 3 short sentences: what the intruder seems to be trying to achieve and how far they got. Use ONLY the facts provided. No markdown, no lists.'
    },
    { role: 'user', content: fakta }
  ]
};

return [{ json: { kosong: false, sesi, laporan, payload } }];
