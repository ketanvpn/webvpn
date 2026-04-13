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

async function renewssh(username, exp, limitip, serverId) {
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username))
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka.';
  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.patch(
      `http://${server.domain}/vps/renewsshvpn/${username}/${exp}`,
      { kuota: 0 },
      { headers: { Authorization: server.auth, Accept: 'application/json', 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    const s = d.data;
    return `✅ *Renew SSH Account Success!*\n\n🔄 *Akun berhasil diperpanjang*\n────────────────────────────\n👤 *Username* : \`${s.username}\`\n🕒 Dari : \`${s.from}\`\n🕒 Sampai : \`${s.to}\`\n────────────────────────────\n✨ Terimakasih!\n*© Telegram Bots - 2025*`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function renewvmess(username, exp, quota, limitip, serverId) {
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username))
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka.';
  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.patch(
      `http://${server.domain}/vps/renewvmess/${username}/${exp}`,
      { kuota: Number(quota) },
      { headers: { Authorization: server.auth, Accept: 'application/json', 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    const s = d.data;
    return `✅ *Renew VMess Account Success!*\n\n👤 *Username* : \`${s.username}\`\n📦 *Quota* : \`${s.quota === "0" ? "Unlimited" : s.quota} GB\`\n🕒 Dari : \`${s.from}\`\n🕒 Sampai : \`${s.to}\`\n\n✨ Terimakasih!\n*© Telegram Bots - 2025*`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function renewvless(username, exp, quota, limitip, serverId) {
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username))
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka.';
  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.patch(
      `http://${server.domain}/vps/renewvless/${username}/${exp}`,
      { kuota: Number(quota) },
      { headers: { Authorization: server.auth, Accept: 'application/json', 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    const s = d.data;
    return `✅ *Renew VLESS Account Success!*\n\n👤 *Username* : \`${s.username}\`\n📦 *Quota* : \`${s.quota === "0" ? "Unlimited" : s.quota} GB\`\n🕒 Dari : \`${s.from}\`\n🕒 Sampai : \`${s.to}\`\n\n✨ Terimakasih!\n*© Telegram Bots - 2025*`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function renewtrojan(username, exp, quota, limitip, serverId) {
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username))
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka.';
  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.patch(
      `http://${server.domain}/vps/renewtrojan/${username}/${exp}`,
      { kuota: Number(quota) },
      { headers: { Authorization: server.auth, Accept: 'application/json', 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    const s = d.data;
    return `✅ *Renew TROJAN Account Success!*\n\n👤 *Username* : \`${s.username}\`\n📦 *Quota* : \`${s.quota === "0" ? "Unlimited" : s.quota} GB\`\n🕒 Dari : \`${s.from}\`\n🕒 Sampai : \`${s.to}\`\n\n✨ Terimakasih!\n*© Telegram Bots - 2025*`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function renewshadowsocks(username, exp, quota, limitip, serverId) {
  if (/\s/.test(username) || /[^a-zA-Z0-9]/.test(username))
    return '❌ Username tidak valid. Mohon gunakan hanya huruf dan angka.';
  try {
    const server = await getServer(serverId);
    const { data } = await axios.get(`http://${server.domain}:5888/renewshadowsocks`, {
      params: { user: username, exp, quota, iplimit: limitip, auth: server.auth },
      timeout: 15000,
    });
    if (data.status !== 'success') return `❌ Terjadi kesalahan: ${data.message}`;

    // PERBAIKAN: pakai shadowsocksData, bukan vmessData (bug sebelumnya)
    const shadowsocksData = data.data;
    return `🌟 *RENEW SHADOWSOCKS PREMIUM* 🌟\n\n┌─────────────────────────────\n│ Username: \`${username}\`\n│ Kadaluarsa: \`${shadowsocksData.expired}\`\n│ Kuota: \`${shadowsocksData.quota}\`\n│ Batas IP: \`${shadowsocksData.ip_limit || limitip} IP\`\n└─────────────────────────────\n✅ Akun ${username} berhasil diperbarui\n✨ Selamat menggunakan layanan kami! ✨`;
  } catch (e) { return `❌ Terjadi kesalahan saat memperbarui Shadowsocks: ${e.message}`; }
}

module.exports = { renewshadowsocks, renewtrojan, renewvless, renewvmess, renewssh };
