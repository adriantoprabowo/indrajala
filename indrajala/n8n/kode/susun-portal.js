// Halaman daftar berkas palsu ("Portal Berkas Internal").
const q = $input.first().json.query || {};
const sesi = String(q.s || '').replace(/[^\w\-.]/g, '').slice(0, 60);

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Daftar berkas yang tampil di portal. Nama harus sama dengan DAFTAR di kotak "Siapkan Unduhan".
const BERKAS = [
  { nama: 'Rekap_Belanja_TI_Q3_2026.pdf', ukuran: '6 KB', tanggal: '12 Okt 2026', ket: 'Rekapitulasi belanja infrastruktur TI triwulan III' }
];

const baris = BERKAS.map((b) => `
<tr>
  <td>${esc(b.nama)}</td>
  <td>${esc(b.ket)}</td>
  <td>${esc(b.ukuran)}</td>
  <td>${esc(b.tanggal)}</td>
  <td><a class="tombol" href="/portal/unduh?f=${encodeURIComponent(b.nama)}&amp;s=${encodeURIComponent(sesi)}">Unduh</a></td>
</tr>`).join('');

const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Portal Berkas Internal</title>
<style>
body{margin:0;font-family:Segoe UI,Arial,sans-serif;background:#f4f6f9;color:#1d2733}
.bar{background:#1f3a5f;color:#fff;padding:14px 28px;font-size:18px;font-weight:600}
.bar span{font-weight:400;font-size:13px;opacity:.8;margin-left:12px}
.isi{max-width:900px;margin:28px auto;padding:0 20px}
h1{font-size:20px;margin:0 0 4px}
.ket{color:#5b6b7c;margin:0 0 18px;font-size:14px}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #d7dee6;border-radius:6px;overflow:hidden}
th,td{padding:11px 14px;text-align:left;font-size:14px;border-bottom:1px solid #e6ebf0}
th{background:#eef2f7;font-weight:600}
.tombol{background:#1a56db;color:#fff;text-decoration:none;padding:5px 14px;border-radius:4px;font-size:13px}
.kaki{margin-top:24px;color:#8493a3;font-size:12px}
</style></head><body>
<div class="bar">Portal Berkas Internal<span>Unit Layanan Teknologi Informasi</span></div>
<div class="isi">
<h1>Dokumen Bersama</h1>
<p class="ket">Akses terbatas untuk pegawai unit. Gunakan jaringan internal.</p>
<table>
<tr><th>Nama berkas</th><th>Keterangan</th><th>Ukuran</th><th>Diperbarui</th><th></th></tr>
${baris}
</table>
<div class="kaki">Portal Berkas Internal &middot; versi 2.4</div>
</div></body></html>`;

return [{ json: { html } }];
