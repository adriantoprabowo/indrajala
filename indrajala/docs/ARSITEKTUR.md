# Arsitektur

## Zona

| Zona | Komponen | Aturan |
|---|---|---|
| Merah | Penyusup | Hanya melihat Caddy `:8080` |
| Kuning (DMZ) | Caddy, website dummy (Node `127.0.0.1:8081`) | Meneruskan hanya jalur yang diizinkan; website hanya memanggil `127.0.0.1:5678` |
| Hijau | n8n (`127.0.0.1:5678`), Ollama (`127.0.0.1:11434`), Data Tables | Air-gapped: tidak membuka koneksi keluar |

Caddy memetakan alamat biasa ke jalur n8n dan menolak sisanya (alamat `/webhook/...` dari luar mendapat 404):

| Alamat luar | Tujuan |
|---|---|
| `/portal` | `/webhook/indrajala-portal` |
| `/portal/unduh` | `/webhook/indrajala-unduh` |
| `/portal/lampiran` | `/webhook/indrajala-canary` |
| `/api/terminal` | `/webhook/indrajala` |
| lainnya | website dummy |

## Alur n8n (satu workflow, tujuh jalur)

Nama node harus persis seperti di bawah (kode saling merujuk lewat nama).

1. **Terminal** `POST /indrajala`
   `Webhook → Ambil State → Ambil Profil → Ambil Berkas → Ambil Proses → Ambil Jawaban → Siapkan Memori → IF Perlu Hermes?`
   true: `→ Tandai Hermes Sibuk → HTTP Request (Ollama) → Simpan Memori`; false: `→ Simpan Memori`
   `→ IF Perlu Catat?` true: `→ Catat Log → Simpan State → Respond`; false: `→ Simpan State → Respond`
2. **Dashboard** `GET /indrajala-log` (Basic Auth): `Webhook Dashboard → Ambil Log → Ambil Canary → Ambil Unduhan → Buat Dashboard → Respond`
3. **Analisis** `GET /indrajala-analisis?session=` (Basic Auth): `Webhook Analisis → Ambil Log Analisis → Siapkan Analisis → Analis Hermes → Render Analisis → Respond`
4. **Canary** `GET /indrajala-canary?id=`: `Webhook Canary → Catat Canary → Simpan Canary → Respond (404 palsu)`
5. **Portal** `GET /indrajala-portal?s=`: `Webhook Portal → Susun Portal → Respond (HTML)`
6. **Unduhan** `GET /indrajala-unduh?f=&s=`: `Webhook Unduh → Siapkan Unduhan → Convert to File → Respond (binary)`; cabang samping `Siapkan Unduhan → Catat Unduhan`
7. **Website** `POST /indrajala-web` (hanya dari komputer ini): `Webhook Web → Nilai Peristiwa Web → Catat Log Web → Respond (JSON)`

Node **Get row(s)**: Return All, Execute Once. Node **Insert/Upsert**: mapping kolom manual (`{{ $json.catat.kolom }}` atau `{{ $('Simpan Memori').first().json.stateBaru.kolom }}`), On Error: Continue.

## Tabel

| Tabel | Kolom |
|---|---|
| `indrajala_profil` | server, kunci, nilai (`app`, `bkp`, `global`) |
| `indrajala_berkas` | server, lokasi, tipe (`dir`/`file`), isi (daftar dipisah `\|`, baris baru `\n`) |
| `indrajala_proses` | server, urut, pemilik, pid, ppid, cpu, memori, vsz, rss, tty, stat, mulai, waktu, perintah |
| `indrajala_jawaban` | server, perintah, isi (`ALIAS:perintah` untuk alias) |
| `indrajala_state` | session, versi, data (JSON), updated. Baris sistem: `_seed`, `_hermes` |
| `indrajala_log` | ts, waktu, session, command, level, tahap, host, reply, ua |
| `indrajala_canary` | ts, token, ua |
| `indrajala_unduhan` | ts, kode, session, file, ua |

Tabel konfigurasi (profil, berkas, proses, jawaban) dapat diedit tanpa menyentuh kode. Tabel bukti (log, canary, unduhan) hanya ditambah.

## Emulator terminal

Jalur: sesi dibersihkan, state sesi dibaca dari tabel, batas laju, mesin SSH (bila sedang di prompt), jawaban langsung dari kode, dan hanya bila perlu Hermes.

- **Jawaban langsung (tanpa AI):** `whoami`, `id`, `who`, `w`, `hostname`, `pwd`, `echo`, `uname`, `cd`, `ls`, `cat`, `sudo`, `rm`, `mkdir`, `touch`, `mv`, `chmod`, `chown`, `curl`, `wget`, `ssh`, `ps` (aux, -ef, polos; PID dinamis), `uptime`, `date`, `free`, `history`, jawaban tabel, `perintah | grep`.
- **Hermes** hanya untuk perintah Linux nyata di daftar `PERINTAH_NYATA` yang tidak ada jawabannya. Kalimat biasa dijawab `bash: x: command not found`. Keluaran Hermes melewati penjaga (kata yang membuka kedok diganti `command not found`, maksimal 15 baris).
- **SSH ke `bkp-01`:** prompt sidik jari, password, banner, `exit`, `^C`, dan `ssh user@host 'perintah'`.
- **Pembatas Hermes:** satu penanda `_hermes` di tabel (ditulis sebelum Hermes dipanggil, kedaluwarsa 20 detik) karena n8n baru menyimpan static data saat eksekusi selesai.
- **Batas laju:** 15 perintah/10 dtk per sesi, 80/10 dtk global (perkiraan).

## Website dummy

Entitas fiktif, tanpa database. Halaman biasa tidak dicatat. Peristiwa yang diteruskan: login, honey-link, URL bertanda serangan, pemindai. Login ditunggu jawabannya (maks 4 detik; gagal berarti "Username atau password salah."), lainnya tidak ditunggu. Penilai di n8n (`nilai-peristiwa-web.js`) mendeteksi tautologi, kutip, UNION, ORDER BY, sleep/benchmark, error-based, boolean-blind, stacked, dan kredensial umpan, lalu menentukan: `sukses`, `gagal` (dengan `tunda_ms` untuk sleep), `error_sql`, atau `tampil`.

## Dokumen umpan

`siapkan-unduhan.js` membuat PDF dari string mentah (halaman tunggal, tabel, satu tautan) dengan kode unik `ANGGARAN-Q3-xxxxxx` dan tautan `http://<Host pengunduh>/portal/lampiran?id=<kode>`. Pemicu hanya klik tautan. Unduhan dan pembukaan dicatat di tabel dan dikaitkan ke sesi.

## Analisis

Pemetaan ATT&CK berbasis pola (deterministik): T1033, T1083, T1057, T1082, T1016, T1049, T1046, T1087.001, T1003.008, T1552.001, T1552.003, T1021.004, T1105, T1548.003, T1222.002, T1070.004, T1053.003; peristiwa web: T1190, T1110, T1595.002, T1595.003. Hermes menerima **hanya fakta terhitung** (durasi, tahap, daftar teknik) dan menulis ringkasan dua sampai tiga kalimat.

## Titik sinkron kredensial umpan

Bila nilai berikut diganti, ganti di semua tempat: `PASSWORD_BKP` (tabel profil), baris `.env.bak` (tabel berkas), `TOKEN_UMPAN` (`buat-dashboard.js`), `BAIT_PASS` (`nilai-peristiwa-web.js`), `CONFIG_BAK` (`zona_kuning.js`).
