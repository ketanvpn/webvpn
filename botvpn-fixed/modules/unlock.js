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

async function unlockssh(username, serverId) {
  if (!/^[a-zA-Z0-9]+$/.test(username)) return '❌ Username tidak valid.';
  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.patch(
      `http://${server.domain}/vps/unlocksshvpn/${username}/pw`,
      {},
      { headers: { Authorization: server.auth, Accept: 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    return `✅ *Unlock SSH Account Success!*\n\n👤 *Username* : \`${d.data.username}\`\n\n✨ Terimakasih!\n*© Telegram Bots - 2025*`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function unlockvmess(username, serverId) {
  if (!/^[a-zA-Z0-9]+$/.test(username)) return '❌ Username tidak valid.';
  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.patch(
      `http://${server.domain}/vps/unlockvmess/${username}`,
      {},
      { headers: { Authorization: server.auth, Accept: 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    return `✅ *Unlock VMess Account Success!*\n\n👤 *Username* : \`${d.data.username}\`\n\n✨ Terimakasih!\n*© Telegram Bots - 2025*`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function unlockvless(username, serverId) {
  if (!/^[a-zA-Z0-9]+$/.test(username)) return '❌ Username tidak valid.';
  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.patch(
      `http://${server.domain}/vps/unlockvless/${username}`,
      {},
      { headers: { Authorization: server.auth, Accept: 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    return `✅ *Unlock VLESS Account Success!*\n\n👤 *Username* : \`${d.data.username}\`\n\n✨ Terimakasih!\n*© Telegram Bots - 2025*`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function unlocktrojan(username, serverId) {
  if (!/^[a-zA-Z0-9]+$/.test(username)) return '❌ Username tidak valid.';
  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.patch(
      `http://${server.domain}/vps/unlocktrojan/${username}`,
      {},
      { headers: { Authorization: server.auth, Accept: 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    return `✅ *Unlock TROJAN Account Success!*\n\n👤 *Username* : \`${d.data.username}\`\n\n✨ Terimakasih!\n*© Telegram Bots - 2025*`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function unlockshadowsocks(username, serverId) {
  if (!/^[a-zA-Z0-9]+$/.test(username)) return '❌ Username tidak valid.';
  try {
    const server = await getServer(serverId);
    const { data } = await axios.get(`http://${server.domain}:5888/unlockshadowsocks`, {
      params: { user: username, auth: server.auth },
      timeout: 15000,
    });
    if (data.status !== 'success') return `❌ Terjadi kesalahan: ${data.message}`;
    return `✅ *Unlock Shadowsocks Account Success!*\n\n👤 *Username* : \`${username}\`\n\n✨ Terimakasih!\n*© Telegram Bots - 2025*`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

module.exports = { unlockshadowsocks, unlocktrojan, unlockvless, unlockvmess, unlockssh };
