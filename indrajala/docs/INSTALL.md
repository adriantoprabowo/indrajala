# Panduan Instalasi (Windows 10/11)

Semua perangkat gratis dan berjalan lokal. Pada Linux/Mac, isi konfigurasinya sama; hanya cara menjalankan perintah yang berbeda (misalnya `export` pengganti `set`).

## Prasyarat

| Perangkat | Keterangan |
|---|---|
| Komputer | RAM 8 GB, ruang kosong sekitar 15 GB. GPU tidak wajib (Hermes berjalan di CPU, lebih lambat) |
| Node.js LTS | nodejs.org |
| Ollama | ollama.com |
| Caddy | caddyserver.com/download (Windows amd64, satu berkas `caddy.exe`) |

## 1. Model AI lokal

```text
ollama pull hermes3:3b
ollama run hermes3:3b      (ketik "halo", lalu /bye untuk keluar)
```

## 2. Jalankan n8n (terbatas ke komputer ini)

```text
set N8N_LISTEN_ADDRESS=127.0.0.1
npx n8n
```

Buka `http://127.0.0.1:5678` dan buat akun lokal. Jendela ini harus tetap terbuka. Variabel `N8N_LISTEN_ADDRESS` hanya berlaku di jendela tempat Anda mengetiknya, jadi ketik dua baris itu setiap kali menjalankan n8n.

## 3. Impor tabel

Di **Overview**, tab **Data tables**, **Create Data table**, **Import CSV**. Gunakan nama tabel persis sama dengan nama berkas (tanpa `.csv`):

| Berkas di `n8n/tabel/` | Fungsi |
|---|---|
| `indrajala_profil.csv` | Pengaturan server palsu (nama, user, memori, dll.) dan nilai global |
| `indrajala_berkas.csv` | Berkas dan folder palsu (isi bisa diedit seperti spreadsheet) |
| `indrajala_proses.csv` | Daftar proses untuk `ps aux` |
| `indrajala_jawaban.csv` | Jawaban tetap (`df -h`, `ip a`, `ss`, ...) |
| `indrajala_state.csv` | State sesi penyusup (satu baris per sesi) |
| `indrajala_log.csv` | Log peristiwa (bukti) |
| `indrajala_canary.csv` | Peristiwa pembukaan dokumen umpan |
| `indrajala_unduhan.csv` | Catatan unduhan dokumen umpan |

Empat tabel terakhir berisi satu **baris contoh** (`ts` = 0 atau `_seed`). **Jangan dihapus**: tanpa baris itu alur di belakangnya tidak berjalan.

## 4. Impor workflow

1. **Workflow baru**, menu titik tiga, **Import from file**, pilih berkas JSON di `n8n/workflow/`.
2. Pada **setiap node Data table**, pilih ulang tabelnya (**From list**). Pada node **Get row(s)**, pastikan **Return All** dan (di tab **Settings**) **Execute Once** menyala.
3. Buat kredensial **Basic Auth** (misalnya pengguna `analis`) dan pasang di node `Webhook Dashboard` dan `Webhook Analisis`.
4. **Publish**. Setelah impor, workflow belum aktif.

Bila tidak ada berkas JSON, susun node sesuai [ARSITEKTUR.md](ARSITEKTUR.md) dan tempel kode dari `n8n/kode/` (nama berkas sama dengan nama node).

## 5. Sesuaikan tabel profil

Di `indrajala_profil`, baris `global`:

- `PORTAL_HOST`: `localhost:8080` untuk uji satu komputer, atau `<IP-LAN>:8080` bila penyusup dari perangkat lain. Gunakan IP Wi-Fi/Ethernet (hasil `ipconfig`), bukan adaptor virtual (`192.168.56.x`).
- `VERSI_PROFIL`: naikkan satu angka setiap Anda mengedit profil, supaya state lama diabaikan.

## 6. Pintu depan (Caddy)

Taruh `caddy.exe` dan salinan `Caddyfile` (di Windows simpan sebagai `Caddyfile.txt`) dalam satu folder, misalnya `C:\caddy`:

```text
cd C:\caddy
caddy validate --config Caddyfile.txt --adapter caddyfile
caddy run --config Caddyfile.txt --adapter caddyfile
```

Izinkan firewall hanya untuk **Private networks**. `akses.log` (IP asal) dibuat di folder yang sama.

## 7. Website dummy

```text
cd <folder repositori>
node zona-kuning/zona_kuning.js
```

Opsi: `PORT` (bawaan 8081) dan `N8N_URL` (bawaan `http://127.0.0.1:5678/webhook/indrajala-web`).

## 8. Urutan menyalakan

Ollama, lalu n8n, lalu Caddy, lalu website.

## 9. Verifikasi cepat

```text
curl -X POST http://localhost:8080/api/terminal -H "Content-Type: application/json" -d "{\"session\":\"cek1\",\"command\":\"whoami\"}"
```
Harus menjawab `deploy`.

| Cek | Hasil |
|---|---|
| `http://localhost:8080/` di browser | Beranda website dummy |
| `http://localhost:8080/robots.txt` | Daftar `Disallow` jalur umpan |
| `http://localhost:8080/webhook/indrajala-log` | 404 (dashboard tertutup dari luar) |
| `http://127.0.0.1:5678/webhook/indrajala-log` (minta Basic Auth) | Dashboard |

## 10. Mengatur ulang sebelum demo

1. Hapus baris di tabel `indrajala_log`, `indrajala_canary`, `indrajala_unduhan`, `indrajala_state` (sisakan baris contoh).
2. Naikkan `VERSI_PROFIL`.
3. Di **Executions**, hapus riwayat.
4. Hentikan Caddy, hapus `akses.log`, jalankan lagi. Mulai ulang website.

## 11. Menjalankan pengujian

```text
npm test
```

## Masalah umum

| Gejala | Kemungkinan penyebab |
|---|---|
| `Error in workflow` | Buka tab **Executions**, lihat node yang merah dan pesannya |
| Kolom tabel kosong (null) | Mapping node Insert memakai **Map Automatically**; ganti ke manual dengan `{{ $json.catat.nama }}` |
| Alur berhenti setelah node Get | Tabel kosong total; pastikan baris contoh ada |
| PDF umpan tidak mencatat | Unduh PDF **baru** setelah mengubah alamat atau versi |
| Perangkat lain tak bisa mengakses | Pakai IP LAN (bukan `192.168.56.x`) dan izinkan Caddy di firewall (Private) |
