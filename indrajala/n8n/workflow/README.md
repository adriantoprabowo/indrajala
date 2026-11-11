# Workflow n8n

Letakkan di folder ini file ekspor workflow, misalnya `indrajala-workflow.json`.

## Cara mengekspor dari n8n

1. Buka workflow `Indrajala`.
2. Menu titik tiga di kanan atas, **Download**.
3. Simpan di folder ini.

## Periksa dulu sebelum diunggah ke GitHub

- Buka JSON dengan Notepad, cari kata `password`, `secret`, `token`, `apiKey`, dan `Authorization`. Kata sandi Basic Auth **tidak** ikut terekspor (hanya nama kredensial), tetapi pastikan.
- Hapus bagian `pinData` bila berisi data uji yang tidak ingin dibagikan.
- Jangan unggah isi tabel yang berasal dari uji nyata (`indrajala_log`, `indrajala_canary`, `indrajala_unduhan`, `indrajala_state`), karena berisi IP dan masukan dari uji. Yang ada di `n8n/tabel/` adalah tabel awal yang bersih.

## Setelah impor di perangkat lain

Pada setiap node **Data table**, pilih ulang tabelnya (**From list**), buat kredensial Basic Auth baru untuk `Webhook Dashboard` dan `Webhook Analisis`, lalu **Publish**.
