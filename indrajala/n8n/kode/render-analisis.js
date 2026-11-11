// Menyusun halaman analisis penyusup (HTML) dari laporan hasil hitungan + ringkasan Hermes.
const data = $('Siapkan Analisis').first().json;
const j = $input.first().json;
const ringkasan = String(j.message?.content || '').trim().slice(0, 700);

// Pengaman: perintah penyerang dibersihkan sebelum ditampilkan.
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
const offset = (ms) => {
  const t = Math.round(ms / 1000);
  return '+' + String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
};
const label = { tinggi: '🔴 TINGGI', sedang: '🟡 PENGINTAIAN', rendah: '🟢 RENDAH' };

const css = `
body{font-family:Segoe UI,Arial,sans-serif;background:#0f1419;color:#e6e6e6;margin:24px;max-width:1100px}
h1{margin:0 0 4px} h2{margin:28px 0 8px;font-size:18px}
a{color:#7cc4ff}
.ringkas{display:flex;gap:16px;margin:16px 0;flex-wrap:wrap}
.kartu{background:#1c2430;padding:12px 20px;border-radius:8px;min-width:140px}
.kartu b{font-size:22px;display:block}
.ai{background:#1c2430;border-left:4px solid #7cc4ff;padding:12px 16px;border-radius:6px;line-height:1.5}
.ai small{color:#9fb3c8;display:block;margin-top:8px}
table{border-collapse:collapse;width:100%}
th,td{border-bottom:1px solid #2c3746;padding:8px;text-align:left;vertical-align:top;font-size:14px}
th{background:#1c2430}
code{color:#f7c873}
.tinggi{color:#ff6b5b;font-weight:bold} .sedang{color:#f0b429;font-weight:bold} .rendah{color:#4cc38a;font-weight:bold}`;

let isi;
if (data.kosong) {
  isi = `<h1>Analisis penyusup</h1>
<p>Tidak ada catatan untuk sesi <code>${esc(data.sesi)}</code>.</p>
<p><a href="/webhook/indrajala-log">← Kembali ke dashboard</a></p>`;
} else {
  const L = data.laporan;
  const baristeknik = L.teknik.map((t) => `
<tr><td><code>${esc(t.id)}</code></td><td>${esc(t.nama)}</td><td>${esc(t.taktik)}</td><td>${t.jumlah}x</td><td><code>${esc(t.contoh)}</code></td></tr>`).join('');
  const barisWaktu = L.timeline.map((x) => `
<tr><td>${esc(offset(x.t))}</td><td><code>${esc(x.command)}</code></td><td class="${esc(x.level)}">${label[x.level] || ''}</td></tr>`).join('');
  const kotakAi = ringkasan
    ? `<div class="ai">${esc(ringkasan)}<small>Ringkasan ini ditulis AI lokal (Hermes) dan bisa keliru. Fakta ada di tabel di bawahnya.</small></div>`
    : `<div class="ai">Ringkasan AI tidak tersedia (Hermes belum menjawab). Tabel di bawah tetap valid.</div>`;

  isi = `<h1>🔎 Analisis penyusup: ${esc(L.sesi)}</h1>
<div><a href="/webhook/indrajala-log">← Kembali ke dashboard</a></div>
<div class="ringkas">
  <div class="kartu"><b>${esc(durasi(L.akhir - L.awal))}</b>waktu tertahan</div>
  <div class="kartu"><b>${L.langkah}</b>langkah</div>
  <div class="kartu"><b>${L.tinggi}</b>perintah bahaya tinggi</div>
  <div class="kartu"><b>${'●'.repeat(L.tahap)}${'○'.repeat(3 - L.tahap)}</b>${esc(L.namaTahap)}</div>
</div>
<h2>Ringkasan analis (AI)</h2>
${kotakAi}
<h2>Teknik MITRE ATT&amp;CK yang terdeteksi (pemetaan pasti)</h2>
<table>
<tr><th>ID</th><th>Teknik</th><th>Taktik</th><th>Jumlah</th><th>Contoh perintah</th></tr>
${baristeknik || '<tr><td colspan="5">Belum ada teknik yang dikenali.</td></tr>'}
</table>
<h2>Garis waktu (mulai ${esc(wib(L.awal))} WIB)</h2>
<table>
<tr><th>Waktu</th><th>Perintah</th><th>Tingkat</th></tr>
${barisWaktu}
</table>`;
}

const html = `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>Indrajala - Analisis</title><style>${css}</style></head><body>${isi}</body></html>`;
return [{ json: { html } }];
