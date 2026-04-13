const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./sellvpn.db', (err) => {
  if (err) {
    console.error('Kesalahan koneksi SQLite3:', err.message);
  } else {
    db.run('PRAGMA journal_mode=WAL');
    db.run('PRAGMA busy_timeout=5000');
  }
});

module.exports = db;
