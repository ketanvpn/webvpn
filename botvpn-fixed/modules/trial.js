const axios = require('axios');
const db = require('./db');

function getServer(serverId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, row) => {
      if (err) return reject(err);
      if (!row) return reject(new Error('Server tidak ditemukan'));
      resolve(row);
    });
  });
}

async function trialssh(username, exp, iplimit, serverId) {
  if (!/^[a-zA-Z0-9]+$/.test(username))
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';
  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.post(
      `http://${server.domain}/vps/trialsshvpn`,
      { timelimit: '1h' },
      { headers: { Authorization: server.auth, 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    const s = d.data;
    return `✅ *SSH Trial Account Created!*\n\n📡 *SSH WS* : \`${s.hostname}:80@${s.username}:${s.password}\`\n🔒 *SSH SSL* : \`${s.hostname}:443@${s.username}:${s.password}\`\n────────────────────────\n🌍 *Hostname* : \`${s.hostname}\`\n👤 *Username* : \`${s.username}\`\n🔑 *Password* : \`${s.password}\`\n📅 *Expiry* : \`${s.exp}\` (${s.time})\n📌 *IP Limit* : \`${iplimit}\`\n📥 Config: http://${s.hostname}:81/myvpn-config.zip\n\n*© Telegram Bots - 2025*\n✨ Terimakasih!`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function trialvmess(username, exp, quota, limitip, serverId) {
  if (!/^[a-zA-Z0-9]+$/.test(username))
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';
  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.post(
      `http://${server.domain}/vps/trialvmessall`,
      { timelimit: '1h' },
      { headers: { Authorization: server.auth, 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    const s = d.data;
    return `✅ *VMess Trial Account Created!*\n\n👤 *Username* : \`${s.username}\`\n🌍 *Host* : \`${s.hostname}\`\n🛡 *UUID* : \`${s.uuid}\`\n🧾 *Expired* : \`${s.expired}\` (${s.time})\n\n🔗 *Link TLS* : \`${s.link.tls}\`\n\n*© Telegram Bots - 2025*\n✨ Terimakasih!`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function trialvless(username, exp, quota, limitip, serverId) {
  if (!/^[a-zA-Z0-9]+$/.test(username))
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';
  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.post(
      `http://${server.domain}/vps/trialvlessall`,
      { timelimit: '1h' },
      { headers: { Authorization: server.auth, 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    const s = d.data;
    return `✅ *VLESS Trial Account Created!*\n\n👤 *Username* : \`${s.username}\`\n🌍 *Host* : \`${s.hostname}\`\n🛡 *UUID* : \`${s.uuid}\`\n📅 *Expired* : \`${s.expired}\` (${s.time})\n\n🔗 *Link TLS* : \`${s.link.tls}\`\n\n*© Telegram Bots - 2025*\n✨ Terimakasih!`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function trialtrojan(username, exp, quota, limitip, serverId) {
  if (!/^[a-zA-Z0-9]+$/.test(username))
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';
  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.post(
      `http://${server.domain}/vps/trialtrojanall`,
      { timelimit: '1h' },
      { headers: { Authorization: server.auth, 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    const s = d.data;
    return `✅ *Trojan Trial Account Created!*\n\n👤 *Username* : \`${s.username}\`\n🌍 *Host* : \`${s.hostname}\`\n🔑 *Key* : \`${s.uuid}\`\n📅 *Expired* : \`${s.expired}\` (${s.time})\n\n🔗 *Link TLS* : \`${s.link.tls}\`\n\n*© Telegram Bots - 2025*\n✨ Terimakasih!`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function trialshadowsocks(username, exp, quota, limitip, serverId) {
  if (!/^[a-zA-Z0-9]+$/.test(username))
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';
  try {
    const server = await getServer(serverId);
    const { data } = await axios.get(`http://${server.domain}:5888/createshadowsocks`, {
      params: { user: username, exp, quota, iplimit: limitip, auth: server.auth },
      timeout: 15000,
    });
    if (data.status !== 'success') return `❌ Terjadi kesalahan: ${data.message}`;
    const ss = data.data;
    return `🌟 *TRIAL SHADOWSOCKS* 🌟\n\n│ *Username* : \`${ss.username}\`\n│ Expiry: \`${ss.expired}\`\n│ Quota: \`${ss.quota === '0 GB' ? 'Unlimited' : ss.quota}\`\n\n🔐 *Link SS TLS* : \`${ss.ss_link_ws}\`\n\n✨ Selamat menggunakan! ✨`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

module.exports = { trialssh, trialvmess, trialvless, trialtrojan, trialshadowsocks };
