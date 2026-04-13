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

function validateUsername(username) {
  return /^[a-zA-Z0-9]+$/.test(username);
}

function validatePassword(password) {
  // Password: minimal 6 karakter, hanya huruf/angka/simbol umum (tidak mengandung karakter shell berbahaya)
  return typeof password === 'string' && password.length >= 6 && !/['"`;$|&<>\\]/.test(password);
}

async function createssh(username, password, exp, iplimit, serverId) {
  if (!validateUsername(username))
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';
  if (!validatePassword(password))
    return '❌ Password tidak valid. Minimal 6 karakter, tanpa karakter khusus berbahaya.';

  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.post(
      `http://${server.domain}/vps/sshvpn`,
      { expired: Number(exp), kuota: '0', limitip: String(iplimit), password, username },
      { headers: { Authorization: server.auth, 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    const s = d.data;
    return `✅ *SSH Account Created Successfully!*\n\n*🔐 SSH Premium Details*\n────────────────────────\n📡 *SSH WS* : \`${s.hostname}:80@${s.username}:${s.password}\`\n🔒 *SSH SSL* : \`${s.hostname}:443@${s.username}:${s.password}\`\n📶 *SSH UDP* : \`${s.hostname}:1-65535@${s.username}:${s.password}\`\n────────────────────────\n🌍 *Hostname* : \`${s.hostname}\`\n👤 *Username* : \`${s.username}\`\n🔑 *Password* : \`${s.password}\`\n📅 *Expiry Date* : \`${s.exp}\`\n⏰ *Expiry Time* : \`${s.time}\`\n📌 *IP Limit* : \`${iplimit}\`\n────────────────────────\n🛠 *Ports*:\n• TLS : \`${s.port.tls}\`\n• Non-TLS : \`${s.port.none}\`\n• OVPN TCP : \`${s.port.ovpntcp}\`\n• OVPN UDP : \`${s.port.ovpnudp}\`\n• SSH OHP : \`${s.port.sshohp}\`\n• UDP Custom : \`${s.port.udpcustom}\`\n────────────────────────\n📥 *Download Config*:\n🔗 http://${s.hostname}:81/myvpn-config.zip\n\n*© Telegram Bots - 2025*\n✨ Terimakasih!`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function createvmess(username, exp, quota, limitip, serverId) {
  if (!validateUsername(username))
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';
  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.post(
      `http://${server.domain}/vps/vmessall`,
      { expired: Number(exp), kuota: String(quota), limitip: String(limitip), username },
      { headers: { Authorization: server.auth, 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    const s = d.data;
    return `✅ *VMess Account Created Successfully!*\n\n👤 *Username* : \`${s.username}\`\n🌍 *Host* : \`${s.hostname}\`\n🛡 *UUID* : \`${s.uuid}\`\n🧾 *Expired* : \`${s.expired}\` (${s.time})\n📦 *Quota* : \`${quota === "0" ? "Unlimited" : quota} GB\`\n🔢 *IP Limit* : \`${limitip === "0" ? "Unlimited" : limitip} IP\`\n\n🔗 *Link TLS* : \`${s.link.tls}\`\n🔗 *Link Non TLS* : \`${s.link.none}\`\n\n*© Telegram Bots - 2025*\n✨ Terimakasih!`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function createvless(username, exp, quota, limitip, serverId) {
  if (!validateUsername(username))
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';
  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.post(
      `http://${server.domain}/vps/vlessall`,
      { expired: Number(exp), kuota: String(quota), limitip: String(limitip), username },
      { headers: { Authorization: server.auth, 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    const s = d.data;
    return `✅ *VLESS Account Created Successfully!*\n\n👤 *Username* : \`${s.username}\`\n🌍 *Host* : \`${s.hostname}\`\n🛡 *UUID* : \`${s.uuid}\`\n📅 *Expired* : \`${s.expired}\` (${s.time})\n📦 *Quota* : \`${quota === "0" ? "Unlimited" : quota} GB\`\n🔢 *IP Limit* : \`${limitip === "0" ? "Unlimited" : limitip} IP\`\n\n🔗 *Link TLS* : \`${s.link.tls}\`\n🔗 *Link Non TLS* : \`${s.link.none}\`\n\n*© Telegram Bots - 2025*\n✨ Terimakasih!`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function createtrojan(username, exp, quota, limitip, serverId) {
  if (!validateUsername(username))
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';
  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.post(
      `http://${server.domain}/vps/trojanall`,
      { expired: Number(exp), kuota: String(quota), limitip: String(limitip), username },
      { headers: { Authorization: server.auth, 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    const s = d.data;
    return `✅ *Trojan Account Created Successfully!*\n\n👤 *Username* : \`${s.username}\`\n🌍 *Host* : \`${s.hostname}\`\n🔑 *Key* : \`${s.uuid}\`\n📅 *Expired* : \`${s.expired}\` (${s.time})\n📦 *Quota* : \`${quota === "0" ? "Unlimited" : quota} GB\`\n🔢 *IP Limit* : \`${limitip === "0" ? "Unlimited" : limitip} IP\`\n\n🔗 *Link TLS* : \`${s.link.tls}\`\n\n*© Telegram Bots - 2025*\n✨ Terimakasih!`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function createshadowsocks(username, exp, quota, limitip, serverId) {
  if (!validateUsername(username))
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka tanpa spasi.';
  try {
    const server = await getServer(serverId);
    const { data } = await axios.get(`http://${server.domain}:5888/createshadowsocks`, {
      params: { user: username, exp, quota, iplimit: limitip, auth: server.auth },
      timeout: 15000,
    });
    if (data.status !== 'success') return `❌ Terjadi kesalahan: ${data.message}`;
    const ss = data.data;
    return `🌟 *AKUN SHADOWSOCKS PREMIUM* 🌟\n\n│ *Username* : \`${ss.username}\`\n│ *Domain* : \`${ss.domain}\`\n│ Expiry: \`${ss.expired}\`\n│ Quota: \`${ss.quota === '0 GB' ? 'Unlimited' : ss.quota}\`\n│ IP Limit: \`${ss.ip_limit === '0' ? 'Unlimited' : ss.ip_limit} IP\`\n\n🔐 *Link SS TLS* : \`${ss.ss_link_ws}\`\n🔒 *Link SS gRPC* : \`${ss.ss_link_grpc}\`\n\n✨ Selamat menggunakan layanan kami! ✨`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

module.exports = { createssh, createvmess, createvless, createtrojan, createshadowsocks };
