# Keamanan dan Etika

## Prinsip

- **Defensif dan edukasi.** Honeypot untuk Cyber Range. Tidak ada malware. Tidak menyerang balik. Tidak menyentuh sistem nyata.
- **Tidak ada eksekusi dari masukan penyusup.** Terminal dan website hanya menghasilkan teks; tidak ada SQL, shell, atau `include` dari masukan.
- **Data fiktif.** Entitas, IP `10.x`, dan kredensial umpan karangan. Jangan memasukkan data nyata.

## Ancaman dan mitigasi

| Ancaman | Mitigasi |
|---|---|
| Prompt injection ke Hermes | Hermes tanpa alat; hanya perintah Linux nyata yang sampai ke Hermes; keluaran dijaga (kata pembuka kedok, bahasa Indonesia dan Inggris, maksimal 15 baris); analisis memberi Hermes **hanya fakta terhitung**; alarm dan ATT&CK dihitung kode |
| Nama sesi berbahaya (`__proto__`, `_hermes`) | Sesi dibersihkan; nama berbahaya atau berawalan `_` diberi awalan `x` |
| XSS lewat log atau halaman | Semua keluaran HTML di-escape; header dan Host berbahaya di-escape |
| Banjir perintah dan penghapusan bukti | Bukti di tabel yang hanya bertambah; batas laju per sesi dan global; satu penanda banjir (bukan ribuan baris) |
| IP palsu (`X-Forwarded-For`) | Caddy membuang header klien dan menulis alamat asli; n8n hanya terjangkau dari komputer ini |
| Akses ke dashboard dan analisis | Basic Auth; Caddy tidak meneruskan jalurnya ke luar |
| Pemalsuan alarm canary | Token yang tidak cocok dengan catatan unduhan ditandai "TIDAK DIKENAL" (bukan KRITIS) |
| Website sebagai pintu masuk | Tanpa database, isi dibatasi 8 KB, batas laju, batas waktu koneksi, hanya mendengarkan `127.0.0.1` |
| Hermes tertipu menjadi "bocor" | Tidak ada rahasia di prompt (hanya data palsu) |

## Keterbatasan

- Batas laju bersifat perkiraan pada banjir yang sangat cepat. Untuk penerapan sungguhan, gunakan batas konkurensi n8n dan batas laju di perantara.
- Basic Auth dan seluruh lalu lintas memakai HTTP polos; gunakan HTTPS (lewat Caddy) bila keluar dari lab.
- Password yang diketik penyusup tersimpan apa adanya di log.
- Tabel dapat membesar bila dibanjiri pelan-pelan; periksa ukurannya dan bersihkan secara berkala.
- Penjaga keluaran Hermes berupa daftar kata (heuristik).

## Penggunaan yang bertanggung jawab

Pasang di jaringan terpisah, jangan hubungkan ke sistem produksi, dan dapatkan izin pemilik jaringan. Untuk penerapan di lingkungan satuan, lakukan uji tim merah dan ikuti prosedur dan perizinan resmi.
