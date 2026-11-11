// Kotak ini membuat PDF umpan dengan kode UNIK setiap kali ada yang mengunduh,
// dan menyiapkan baris catatan (siapa, kapan, dengan apa) untuk tabel indrajala_unduhan.
const masuk = $input.first().json;
const q = masuk.query || {};
const hdr = masuk.headers || {};

const host = String(hdr.host || 'localhost:5678').replace(/[^A-Za-z0-9.:\-]/g, '');
const ip = String(hdr['x-forwarded-for'] || '').split(',')[0].trim().replace(/[^0-9a-fA-F:.]/g, '').slice(0, 45);
const ua = ((ip ? 'IP ' + ip + ' | ' : '') + String(hdr['user-agent'] || '-')).slice(0, 160);
const sesi = String(q.s || '').replace(/[^\w\-.]/g, '').slice(0, 60) || '(tanpa sesi)';
const berkas = String(q.f || '');

// Daftar berkas umpan yang boleh diunduh (tambah nama lain di sini nanti)
const DAFTAR = ['Rekap_Belanja_TI_Q3_2026.pdf'];

if (!DAFTAR.includes(berkas)) {
  return [{
    json: {
      status: 404, mime: 'text/plain', namaFile: 'tidak-ditemukan.txt', disposisi: 'inline',
      base64: Buffer.from('Not Found', 'utf8').toString('base64')
    }
  }];
}

// ---- catat unduhan dan buat kode unik ----
const id = 'ANGGARAN-Q3-' + Math.random().toString(36).slice(2, 8);

const url = `http://${host}/portal/lampiran?id=${id}`;

// ---- susun isi halaman PDF ----
const S = [];
const esc = (t) => String(t).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const teks = (x, y, ukuran, font, t, warna) =>
  S.push(`BT /${font} ${ukuran} Tf ${warna || '0 0 0'} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${esc(t)}) Tj ET`);
const kotak = (x, y, w, h, warna) => S.push(`${warna} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
const garis = (x1, y1, x2, y2, warna, tebal) =>
  S.push(`${warna} RG ${tebal} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
const lebarAngka = (t, ukuran) => ukuran * ([...t].reduce((a, c) => a + (c === '.' ? 0.278 : 0.556), 0));

const KIRI = 56.7, KANAN = 538.3;
teks(152.0, 785, 17, 'F2', 'Rekapitulasi Belanja Infrastruktur TI');
teks(140.6, 768, 10, 'F1', 'Triwulan III Tahun Anggaran 2026  |  Unit Layanan Teknologi Informasi', '0.33 0.33 0.33');
[
  'Dokumen ini merangkum realisasi belanja infrastruktur TI sampai akhir September 2026. Secara',
  'umum realisasi berada di bawah pagu karena pengadaan perangkat jaringan bergeser ke triwulan IV.',
  'Rincian vendor, nomor kontrak, dan akses administrasi server berkas dipisahkan dalam lampiran.'
].forEach((l, i) => teks(KIRI, 735 - i * 15, 10.5, 'F1', l));

// tabel
const kolomX = [56.7, 232.4, 331.6, 439.3, 538.5];
const tinggi = 22;
const baris = [
  ['Server dan penyimpanan', '420.000.000', '318.450.000', '101.550.000'],
  ['Perangkat jaringan', '260.000.000', '96.200.000', '163.800.000'],
  ['Lisensi perangkat lunak', '150.000.000', '148.750.000', '1.250.000'],
  ['Langganan konektivitas', '180.000.000', '135.000.000', '45.000.000'],
  ['Pemeliharaan dan dukungan', '95.000.000', '61.300.000', '33.700.000'],
  ['Total', '1.105.000.000', '759.700.000', '345.300.000']
];
const atas = 670;
kotak(kolomX[0], atas - tinggi, kolomX[4] - kolomX[0], tinggi, '0.122 0.227 0.373');
teks(kolomX[0] + 6, atas - tinggi + 7, 9, 'F2', 'Pos belanja', '1 1 1');
[['Pagu (Rp)', 42.5], ['Realisasi (Rp)', 59.5], ['Sisa (Rp)', 39.0]].forEach(([t, lebar], i) =>
  teks(kolomX[i + 2] - 6 - lebar, atas - tinggi + 7, 9, 'F2', t, '1 1 1'));
baris.forEach((r, i) => {
  const bawah = atas - tinggi * (i + 2);
  const total = i === baris.length - 1;
  kotak(kolomX[0], bawah, kolomX[4] - kolomX[0], tinggi, total ? '0.9 0.925 0.957' : (i % 2 === 0 ? '1 1 1' : '0.953 0.965 0.98'));
  const font = total ? 'F2' : 'F1';
  teks(kolomX[0] + 6, bawah + 7, 9.5, font, r[0]);
  for (let k = 1; k <= 3; k++) teks(kolomX[k + 1] - 6 - lebarAngka(r[k], 9.5), bawah + 7, 9.5, font, r[k]);
});
for (let i = 0; i <= baris.length + 1; i++) garis(kolomX[0], atas - tinggi * i, kolomX[4], atas - tinggi * i, '0.78 0.82 0.855', 0.4);
kolomX.forEach((x) => garis(x, atas, x, atas - tinggi * (baris.length + 1), '0.78 0.82 0.855', 0.4));

// catatan
teks(KIRI, 490, 11, 'F2', 'Catatan');
[
  '1. Pengadaan switch dan akses nirkabel dijadwalkan ulang ke triwulan IV.',
  '2. Kontrak konektivitas diperpanjang sampai Maret 2027.',
  '3. Audit hak akses server berkas dijadwalkan bersamaan dengan rilis aplikasi berikutnya.'
].forEach((l, i) => teks(KIRI, 470 - i * 15, 10.5, 'F1', l));

// tautan canary (satu-satunya pemicu: harus diklik)
teks(KIRI, 410, 10.5, 'F1', 'Lampiran lengkap (rincian vendor dan akses server): ');
teks(304.71, 410, 10.5, 'F1', 'Buka lampiran di portal internal', '0.102 0.337 0.859');
garis(304.71, 408.3, 449.43, 408.3, '0.102 0.337 0.859', 0.6);
teks(KIRI, 372, 8.5, 'F1', 'Disusun oleh Unit Layanan Teknologi Informasi.', '0.47 0.47 0.47');
teks(KIRI, 34, 8, 'F1', 'DOKUMEN INTERNAL - TERBATAS. Jangan disebarluaskan di luar unit.', '0.47 0.47 0.47');
teks(490, 34, 8, 'F1', 'Halaman 1', '0.47 0.47 0.47');
const stream = S.join('\n');

// ---- rakit berkas PDF ----
const objek = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R /Annots [7 0 R] >>',
  `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  `<< /Type /Annot /Subtype /Link /Rect [304.71 405 449.43 418] /Border [0 0 0] /A << /S /URI /URI (${url}) >> >>`,
  '<< /Title (Rekapitulasi Belanja Infrastruktur TI Triwulan III 2026) /Author (Unit Layanan Teknologi Informasi) >>'
];
let pdf = '%PDF-1.4\n';
const letak = [];
objek.forEach((o, i) => { letak.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
const xref = pdf.length;
pdf += `xref\n0 ${objek.length + 1}\n0000000000 65535 f \n`;
for (const o of letak) pdf += String(o).padStart(10, '0') + ' 00000 n \n';
pdf += `trailer\n<< /Size ${objek.length + 1} /Root 1 0 R /Info 8 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

return [{
  json: {
    status: 200, mime: 'application/pdf', namaFile: berkas,
    catat: { ts: Date.now(), kode: id, session: sesi, file: berkas, ua },
    disposisi: `attachment; filename="${berkas}"`,
    base64: Buffer.from(pdf, 'latin1').toString('base64')
  }
}];
