// Menguji portal berkas, unduhan PDF unik, canary, dashboard (alarm), dan halaman analisis.
const fs = require('fs');
const path = require('path');
const kode = (f) => fs.readFileSync(path.join(__dirname, '../n8n/kode', f), 'utf8');
let ok = 0, gagal = 0;
const cek = (n, k, i = '') => { (k ? ok++ : gagal++); console.log((k ? '  [LULUS] ' : '  [GAGAL] ') + n + (i ? '  -> ' + String(i).slice(0, 100) : '')); };
const jalan = (src, mocks, input) => {
  const dolar = (nama) => { if (!(nama in mocks)) throw new Error('Node tidak ada: ' + nama); const m = mocks[nama]; return { all: () => m, first: () => m[0] }; };
  return new Function('$getWorkflowStaticData', '$', '$input', src)(() => ({}), dolar, { first: () => input[0] })[0].json;
};
const rows = (a) => a.map((r) => ({ json: { ...r } }));

console.log('== portal berkas ==');
const portal = jalan(kode('susun-portal.js'), {}, [{ json: { query: { s: 'web-203-0-113-9' } } }]).html;
cek('tombol unduh memakai alamat biasa dan membawa sesi', portal.includes('/portal/unduh?f=Rekap_Belanja_TI_Q3_2026.pdf&amp;s=web-203-0-113-9'));
cek('tidak membocorkan n8n/webhook', !/webhook|n8n/i.test(portal));
cek('sesi berbahaya dibersihkan', !jalan(kode('susun-portal.js'), {}, [{ json: { query: { s: '<script>x</script>' } } }]).html.includes('<script>x'));

console.log('== unduhan PDF unik ==');
const unduh = (q, h) => jalan(kode('siapkan-unduhan.js'), {}, [{ json: { query: q, headers: h } }]);
const a = unduh({ f: 'Rekap_Belanja_TI_Q3_2026.pdf', s: 'uji1' }, { host: '192.168.1.20:8080', 'user-agent': 'Edge', 'x-forwarded-for': '198.51.100.4' });
const b = unduh({ f: 'Rekap_Belanja_TI_Q3_2026.pdf', s: 'uji1' }, { host: '192.168.1.20:8080', 'user-agent': 'Edge' });
const pdf = Buffer.from(a.base64, 'base64').toString('latin1');
cek('berkas PDF valid (header, EOF)', pdf.startsWith('%PDF-1.4') && pdf.trimEnd().endsWith('%%EOF'));
// periksa tabel xref: setiap offset harus menunjuk "N 0 obj"
const xrefPos = Number(/startxref\n(\d+)/.exec(pdf)[1]);
const entri = pdf.slice(xrefPos).split('\n').slice(3).filter((l) => /^\d{10} 00000 n/.test(l));
cek('tabel xref konsisten dengan posisi objek', entri.length >= 8 && entri.every((l, i) => pdf.startsWith(`${i + 1} 0 obj`, Number(l.slice(0, 10)))), entri.length + ' objek');
const url = /\/URI \(([^)]+)\)/.exec(pdf)[1];
cek('tautan canary memakai host pengunduh dan jalur biasa', /^http:\/\/192\.168\.1\.20:8080\/portal\/lampiran\?id=ANGGARAN-Q3-[a-z0-9]{1,6}$/.test(url), url);
cek('kode unik berbeda untuk tiap unduhan', a.catat.kode !== b.catat.kode, a.catat.kode + ' vs ' + b.catat.kode);
cek('IP dari perantara tercatat', a.catat.ua.startsWith('IP 198.51.100.4 | Edge'));
cek('berkas lain ditolak dan tidak dicatat', unduh({ f: '../../etc/passwd' }, {}).status === 404 && !unduh({ f: 'x.pdf' }, {}).catat);

console.log('== canary, dashboard, analisis ==');
const canary = (id, h = {}) => jalan(kode('catat-canary.js'), {}, [{ json: { query: { id }, headers: h } }]).catat;
const cSah = canary(a.catat.kode, { 'user-agent': 'Acrobat', 'x-forwarded-for': '198.51.100.4' });
const cPalsu = canary('PALSU-123');
cek('id aneh dijadikan tidak-valid', canary('<script>x</script>').token === 'tidak-valid');
const t0 = Date.now();
const log = [{ ts: 0, waktu: '-', session: '_seed', command: '-', level: 'rendah', tahap: 0, host: '-', reply: '-', ua: '-' },
  { ts: t0, waktu: 'x', session: 'uji1', command: 'cat /var/www/html/.env.bak', level: 'tinggi', tahap: 2, host: '', reply: 'ok', ua: 'IP 198.51.100.4 | curl' },
  { ts: t0 + 5000, waktu: 'x', session: 'uji1', command: 'ls', level: 'sedang', tahap: 0, host: '', reply: 'ok', ua: 'IP 198.51.100.4 | curl' }];
const dash = jalan(kode('buat-dashboard.js'), { 'Ambil Log': rows(log), 'Ambil Canary': rows([{ ts: 0, token: '-', ua: '-' }, cSah, cPalsu]), 'Ambil Unduhan': rows([{ ts: 0, kode: '-', session: '_seed', file: '-', ua: '-' }, a.catat]), __x: 1 }, [{ json: {} }]).html;
cek('alarm canary sah dikaitkan ke sesi pengunduh (KRITIS)', new RegExp('Dokumen umpan DIBUKA: ' + a.catat.kode).test(dash) && dash.includes('ALARM KRITIS'));
cek('canary palsu ditandai tidak dikenal', dash.includes('TIDAK DIKENAL') && dash.includes('PALSU-123'));
cek('alarm unduhan dan membaca umpan', dash.includes('Berkas umpan DIUNDUH') && dash.includes('membaca file umpan'));
cek('IP penyusup tampil di dashboard', dash.includes('IP 198.51.100.4'));
const an = jalan(kode('siapkan-analisis.js'), { 'Webhook Analisis': [{ json: { query: { session: 'uji1' } } }], 'Ambil Log Analisis': rows(log) }, [{ json: {} }]);
cek('analisis memetakan ATT&CK', an.laporan.teknik.some((t) => t.id === 'T1552.001'));
cek('prompt Hermes hanya berisi fakta', !/\.env|catatan|curl/i.test(JSON.stringify(an.payload.messages)));
const halaman = jalan(kode('render-analisis.js'), { 'Siapkan Analisis': [{ json: an }] }, [{ json: { message: { content: 'Penyusup membaca file umpan. <script>x</script>' } } }]).html;
cek('halaman analisis terbit, ringkasan di-escape', halaman.includes('Analisis penyusup') && halaman.includes('T1552.001') && !halaman.includes('<script>x</script>'));
cek('halaman analisis tanpa jawaban Hermes tetap tampil', jalan(kode('render-analisis.js'), { 'Siapkan Analisis': [{ json: an }] }, [{ json: { error: 'x' } }]).html.includes('Ringkasan AI tidak tersedia'));
console.log(`\nHASIL: ${ok} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
