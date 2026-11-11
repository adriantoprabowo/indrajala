
const prep = $('Siapkan Memori').first().json;
const j = $input.first().json;

// ---- keluaran: jawaban langsung (j.reply) atau dari Hermes (j.message.content) ----
const dariHermes = j.reply === undefined;

// Penjaga keluaran: jawaban AI yang membuka kedok diganti pesan terminal biasa.
function jagaKeluaran(teks, cmd) {
  let t = String(teks || '').replace(/\r/g, '').replace(/```[a-z]*\n?/gi, '').replace(/\*\*/g, '').trim();
  const bocor = /(as an ai|language model|ai model|i am an ai|i'm an ai|i cannot|i can't|i'm sorry|i apologize|sorry,|honeypot|simulat|ollama|hermes|openai|chatbot|fictional|as a terminal|my instructions|system prompt|\b(saya|anda|kamu|maaf|prototipe|prototype|asisten|kecerdasan buatan|tidak dapat|berperan|jebakan|umpan)\b)/i;
  if (bocor.test(t) || /\bAI\b/.test(t)) return `bash: ${String(cmd).trim().split(/\s+/)[0]}: command not found`;
  if (!t) return `bash: ${String(cmd).trim().split(/\s+/)[0]}: command not found`;
  const baris = t.split('\n');
  if (baris.length > 15) t = baris.slice(0, 15).join('\n');
  return t.slice(0, 1200);
}

let reply;
if (dariHermes) {
  reply = jagaKeluaran(j.message?.content, prep.command);
} else {
  reply = String(j.reply);
}

// ---- riwayat percakapan: dibaca dari state yang disiapkan kotak sebelumnya (tidak diubah bila dibuang karena banjir) ----
let keadaan = {};
try { keadaan = JSON.parse(prep.stateBaru.data) || {}; } catch { keadaan = {}; }
let history = Array.isArray(keadaan.history) ? keadaan.history : [];
if (!prep.banjir) {
  history.push({ role: 'user', content: prep.command });
  history.push({ role: 'assistant', content: reply });
  history = history.slice(-8);
  while (JSON.stringify(history).length > 7000 && history.length > 2) history.shift();
  keadaan.history = history;
}
const stateBaru = { ...prep.stateBaru, data: JSON.stringify(keadaan), updated: Date.now() };

// ---- label tingkat bahaya dan kedalaman rantai umpan ----
function tingkat(cmd) {
  const c = cmd.toLowerCase();
  if (/\b(rm|wget|curl|nc|ncat|chmod|chown|sudo|passwd|base64|crontab|scp|ssh|sshpass|mysql|nmap|dd|mkfs|mkfifo)\b|\/etc\/shadow|\/dev\/tcp|\.env|\.ssh/.test(c)) return 'tinggi';
  if (/^\s*(ls|cat|pwd|whoami|id|uname|ifconfig|ip|netstat|ss|ps|env|find|grep|cd|history|hostname|head|tail|less|more)\b/.test(c)) return 'sedang';
  return 'rendah';
}
function tahap(cmd) {
  const c = cmd.toLowerCase();
  if (/\bssh\b|10\.20\.4\.20|\bbkp\b/.test(c)) return 3;
  if (/\.env/.test(c)) return 2;
  if (/catatan|\.bash_history|crontab|\.ssh|backup_to_bkp/.test(c)) return 1;
  return 0;
}

const host = keadaan.host || '';
const hdrMasuk = $('Webhook').first().json.headers || {};
const ipMasuk = String(hdrMasuk['x-forwarded-for'] || '').split(',')[0].trim().replace(/[^0-9a-fA-F:.]/g, '').slice(0, 45);
const ua = ((ipMasuk ? 'IP ' + ipMasuk + ' | ' : '') + String(hdrMasuk['user-agent'] || '-')).slice(0, 120);
const waktu = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

let catat = null;
if (!prep.banjir) {
  catat = { ts: Date.now(), waktu, session: prep.session, command: prep.command, level: tingkat(prep.command), tahap: tahap(prep.command), host, reply: reply.slice(0, 600), ua };
} else if (prep.banjirTanda) {
  catat = { ts: Date.now(), waktu, session: prep.session, command: '(banjir perintah terdeteksi; perintah berikutnya diabaikan)', level: 'tinggi', tahap: 0, host, reply: '', ua };
}

return [{ json: { reply, catat, catat_perlu: catat !== null, stateBaru } }];
