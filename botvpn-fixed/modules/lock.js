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

async function lockssh(username, serverId) {
  if (!/^[a-zA-Z0-9]+$/.test(username)) return '❌ Username tidak valid.';
  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.patch(
      `http://${server.domain}/vps/locksshvpn/${username}`,
      {},
      { headers: { Authorization: server.auth, Accept: 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    return `✅ *Lock SSH Account Success!*\n\n👤 *Username* : \`${d.data.username}\`\n\n✨ Terimakasih!\n*© Telegram Bots - 2025*`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function lockvmess(username, serverId) {
  if (!/^[a-zA-Z0-9]+$/.test(username)) return '❌ Username tidak valid.';
  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.patch(
      `http://${server.domain}/vps/lockvmess/${username}`,
      {},
      { headers: { Authorization: server.auth, Accept: 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    return `✅ *Lock VMess Account Success!*\n\n👤 *Username* : \`${d.data.username}\`\n\n✨ Terimakasih!\n*© Telegram Bots - 2025*`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function lockvless(username, serverId) {
  if (!/^[a-zA-Z0-9]+$/.test(username)) return '❌ Username tidak valid.';
  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.patch(
      `http://${server.domain}/vps/lockvless/${username}`,
      {},
      { headers: { Authorization: server.auth, Accept: 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    return `✅ *Lock VLESS Account Success!*\n\n👤 *Username* : \`${d.data.username}\`\n\n✨ Terimakasih!\n*© Telegram Bots - 2025*`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function locktrojan(username, serverId) {
  if (!/^[a-zA-Z0-9]+$/.test(username)) return '❌ Username tidak valid.';
  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.patch(
      `http://${server.domain}/vps/locktrojan/${username}`,
      {},
      { headers: { Authorization: server.auth, Accept: 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    return `✅ *Lock TROJAN Account Success!*\n\n👤 *Username* : \`${d.data.username}\`\n\n✨ Terimakasih!\n*© Telegram Bots - 2025*`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function lockshadowsocks(username, serverId) {
  if (!/^[a-zA-Z0-9]+$/.test(username)) return '❌ Username tidak valid.';
  try {
    const server = await getServer(serverId);
    const { data } = await axios.get(`http://${server.domain}:5888/lockshadowsocks`, {
      params: { user: username, auth: server.auth },
      timeout: 15000,
    });
    if (data.status !== 'success') return `❌ Terjadi kesalahan: ${data.message}`;
    return `✅ *Lock Shadowsocks Account Success!*\n\n👤 *Username* : \`${username}\`\n\n✨ Terimakasih!\n*© Telegram Bots - 2025*`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

module.exports = { lockshadowsocks, locktrojan, lockvless, lockvmess, lockssh };
