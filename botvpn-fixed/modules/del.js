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

async function delssh(username, serverId) {
  if (!/^[a-zA-Z0-9]+$/.test(username))
    return '❌ Username tidak valid.';
  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.delete(
      `http://${server.domain}/vps/deletesshvpn/${username}`,
      { headers: { Authorization: server.auth, Accept: 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    return `✅ *Delete SSH Account Success!*\n\n👤 *Username* : \`${d.data.username}\`\n\n✨ Terimakasih!\n*© Telegram Bots - 2025*`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function delvmess(username, serverId) {
  if (!/^[a-zA-Z0-9]+$/.test(username))
    return '❌ Username tidak valid.';
  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.delete(
      `http://${server.domain}/vps/deletevmess/${username}`,
      { headers: { Authorization: server.auth, Accept: 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    return `✅ *Delete VMess Account Success!*\n\n👤 *Username* : \`${d.data.username}\`\n\n✨ Terimakasih!\n*© Telegram Bots - 2025*`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function delvless(username, serverId) {
  if (!/^[a-zA-Z0-9]+$/.test(username))
    return '❌ Username tidak valid.';
  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.delete(
      `http://${server.domain}/vps/deletevless/${username}`,
      { headers: { Authorization: server.auth, Accept: 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    return `✅ *Delete VLESS Account Success!*\n\n👤 *Username* : \`${d.data.username}\`\n\n✨ Terimakasih!\n*© Telegram Bots - 2025*`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function deltrojan(username, serverId) {
  if (!/^[a-zA-Z0-9]+$/.test(username))
    return '❌ Username tidak valid.';
  try {
    const server = await getServer(serverId);
    const { data: d } = await axios.delete(
      `http://${server.domain}/vps/deletetrojan/${username}`,
      { headers: { Authorization: server.auth, Accept: 'application/json' }, timeout: 15000 }
    );
    if (d?.meta?.code !== 200 || !d.data) return `❌ Respons error:\n${d?.message || d?.meta?.message || JSON.stringify(d)}`;
    return `✅ *Delete TROJAN Account Success!*\n\n👤 *Username* : \`${d.data.username}\`\n\n✨ Terimakasih!\n*© Telegram Bots - 2025*`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

async function delshadowsocks(username, serverId) {
  if (!/^[a-zA-Z0-9]+$/.test(username))
    return '❌ Username tidak valid.';
  try {
    const server = await getServer(serverId);
    const { data } = await axios.get(`http://${server.domain}:5888/delshadowsocks`, {
      params: { user: username, auth: server.auth },
      timeout: 15000,
    });
    if (data.status !== 'success') return `❌ Terjadi kesalahan: ${data.message}`;
    return `✅ *Delete Shadowsocks Account Success!*\n\n👤 *Username* : \`${username}\`\n\n✨ Terimakasih!\n*© Telegram Bots - 2025*`;
  } catch (e) { return `❌ Terjadi kesalahan: ${e.message}`; }
}

module.exports = { delshadowsocks, deltrojan, delvless, delvmess, delssh };
