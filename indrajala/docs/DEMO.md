# Panduan Demo (sekitar 6 menit)

## Persiapan (10 menit sebelum)

1. Atur ulang data (lihat [INSTALL.md](INSTALL.md), bagian "Mengatur ulang").
2. Nyalakan berurutan: Ollama, n8n, Caddy, website.
3. Buka dua jendela browser: **dashboard** (`http://127.0.0.1:5678/webhook/indrajala-log`) dan **penyusup** (`http://localhost:8080/`).
4. Untuk menunjukkan IP berbeda, pakai perangkat kedua (HP atau laptop) di Wi-Fi yang sama dan alamat `http://<IP-Wi-Fi-laptop>:8080/`. Set `PORTAL_HOST` ke alamat itu.
5. Jalankan satu perintah terminal (misalnya `whoami`) agar Hermes dan model sudah "hangat". Panggilan Hermes pertama paling lama.

## Skenario

| Menit | Aksi (sebagai penyusup) | Yang terlihat |
|---|---|---|
| 0:00 | Buka beranda dan `/robots.txt` | Website biasa; `robots.txt` menyebut jalur terlarang |
| 0:40 | Buka `/login.php`, coba `admin' ` | Galat MySQL palsu |
| 1:10 | Coba `' OR '1'='1` | "Masuk" ke Portal Pegawai palsu |
| 1:40 | Klik **Arsip cadangan**, buka `config.php.bak` | Kredensial umpan terlihat |
| 2:10 | Dari listing, unduh `Rekap_Belanja_TI_Q3_2026.pdf`, buka, klik tautan di dalamnya | Halaman "Not Found" |
| 2:40 | **Dashboard**: alarm SQL injection, honey-link, unduhan, dan **KRITIS** dokumen dibuka, lengkap dengan IP | Banner merah |
| 3:20 | Terminal: `curl -X POST http://localhost:8080/api/terminal ... "command":"cat catatan.txt"`, lalu `.env.bak` | Tautan portal per sesi, kredensial umpan |
| 4:00 | Terminal: `ssh bkp`, `yes`, password umpan | Banner Ubuntu 20.04; `hostname` = `bkp-01` |
| 4:40 | Dashboard: alarm kredensial dipakai dan masuk server kedua | KRITIS |
| 5:00 | Klik **Analisis** pada sesi | Teknik ATT&CK, garis waktu, ringkasan Hermes |
| 5:40 | Tutup dengan keterbatasan dan peta jalan | Slide terakhir |

Contoh perintah terminal (Windows):

```text
curl -X POST http://localhost:8080/api/terminal -H "Content-Type: application/json" -d "{\"session\":\"demo1\",\"command\":\"cat catatan.txt\"}"
```

## Bila ada yang gagal saat demo

- **Hermes lambat:** tidak apa-apa. Perintah umum dijawab kode; tampilkan halaman Analisis setelah beberapa menit atau gunakan hasil yang sudah ada.
- **Perangkat kedua tak bisa terhubung:** pakai `localhost` (IP akan tampil `::1`) dan jelaskan bahwa di jaringan nyata IP perangkat penyusup yang tampil.
- **Cadangan:** siapkan rekaman layar demo ini sebagai video cadangan.

## Merekam video

Gunakan OBS Studio (gratis) atau Xbox Game Bar (Windows + G). Rekam layar penuh dengan suara, resolusi 1080p, dan unggah ke YouTube (tidak publik, "unlisted") atau Google Drive dengan akses "siapa saja yang memiliki tautan". Uji tautan di jendela penyamaran (incognito).
