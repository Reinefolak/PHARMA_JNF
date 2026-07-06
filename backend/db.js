const fs = require('fs');
const Database = require('better-sqlite3');

const db = new Database(__dirname + '/pharmalink.sqlite');

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    prenom TEXT NOT NULL,
    nom TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    telephone TEXT,
    adresse TEXT,
    nomPharmacie TEXT,
    resetToken TEXT,
    resetTokenExpires INTEGER,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pharmacies (
    id INTEGER PRIMARY KEY,
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY,
    patientId INTEGER NOT NULL,
    livreurId INTEGER,
    pharmacieId INTEGER,
    commandeId TEXT,
    ratingLivreur INTEGER,
    ratingPharmacie INTEGER,
    reviewLivreur TEXT,
    reviewPharmacie TEXT,
    createdAt TEXT NOT NULL,
    FOREIGN KEY(patientId) REFERENCES users(id),
    FOREIGN KEY(livreurId) REFERENCES users(id),
    FOREIGN KEY(pharmacieId) REFERENCES pharmacies(id)
  );

  CREATE INDEX IF NOT EXISTS idx_ratings_livreur ON ratings(livreurId);
  CREATE INDEX IF NOT EXISTS idx_ratings_pharmacie ON ratings(pharmacieId);
  CREATE INDEX IF NOT EXISTS idx_ratings_patient ON ratings(patientId);
  CREATE INDEX IF NOT EXISTS idx_ratings_commande ON ratings(commandeId);
`);

function parseRowData(row) {
  if (!row) return null;
  try {
    return JSON.parse(row.data);
  } catch {
    return null;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeUser(row) {
  if (!row) return null;
  const { password, ...safe } = row;
  return safe;
}

function migrateFromJson(jsonFilePath) {
  const usersCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const clientsCount = db.prepare('SELECT COUNT(*) AS c FROM clients').get().c;
  const pharmaciesCount = db.prepare('SELECT COUNT(*) AS c FROM pharmacies').get().c;

  if (usersCount > 0 || clientsCount > 0 || pharmaciesCount > 0) return;
  if (!fs.existsSync(jsonFilePath)) return;

  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8') || '{}');
  } catch {
    payload = {};
  }

  const users = Array.isArray(payload.users) ? payload.users : [];
  const clients = Array.isArray(payload.clients) ? payload.clients : [];
  const pharmacies = Array.isArray(payload.pharmacies) ? payload.pharmacies : [];

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (
      id, prenom, nom, email, password, role,
      telephone, adresse, nomPharmacie,
      resetToken, resetTokenExpires, createdAt
    ) VALUES (
      @id, @prenom, @nom, @email, @password, @role,
      @telephone, @adresse, @nomPharmacie,
      @resetToken, @resetTokenExpires, @createdAt
    )
  `);

  const insertClient = db.prepare('INSERT OR REPLACE INTO clients (id, data) VALUES (?, ?)');
  const insertPharmacy = db.prepare('INSERT OR REPLACE INTO pharmacies (id, data) VALUES (?, ?)');

  const tx = db.transaction(() => {
    users.forEach((u, i) => {
      insertUser.run({
        id: Number(u.id) || Date.now() + i,
        prenom: u.prenom || '',
        nom: u.nom || '',
        email: u.email || `user-${Date.now()}-${i}@local.test`,
        password: u.password || '',
        role: u.role || 'patient',
        telephone: u.telephone || null,
        adresse: u.adresse || null,
        nomPharmacie: u.nomPharmacie || null,
        resetToken: u.resetToken || null,
        resetTokenExpires: u.resetTokenExpires || null,
        createdAt: u.createdAt || nowIso()
      });
    });

    clients.forEach((c, i) => {
      const id = Number(c.id) || Date.now() + 1000 + i;
      insertClient.run(id, JSON.stringify({ ...c, id }));
    });

    pharmacies.forEach((p, i) => {
      const id = Number(p.id) || Date.now() + 2000 + i;
      insertPharmacy.run(id, JSON.stringify({ ...p, id }));
    });
  });

  tx();
  console.log('[DB] Migration data.json -> SQLite terminée.');
}

function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(Number(id));
}

function getUserByResetToken(token) {
  return db.prepare('SELECT * FROM users WHERE resetToken = ? AND resetTokenExpires > ?').get(token, Date.now());
}

function createUser(user) {
  const stmt = db.prepare(`
    INSERT INTO users (
      id, prenom, nom, email, password, role,
      telephone, adresse, nomPharmacie,
      resetToken, resetTokenExpires, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const id = Number(user.id) || Date.now();
  stmt.run(
    id,
    user.prenom,
    user.nom,
    user.email,
    user.password,
    user.role,
    user.telephone || null,
    user.adresse || null,
    user.nomPharmacie || null,
    user.resetToken || null,
    user.resetTokenExpires || null,
    user.createdAt || nowIso()
  );

  return getUserById(id);
}

function updateUser(id, updates) {
  const allowed = [
    'prenom', 'nom', 'email', 'password', 'role',
    'telephone', 'adresse', 'nomPharmacie',
    'resetToken', 'resetTokenExpires', 'createdAt'
  ];

  const entries = Object.entries(updates).filter(([key]) => allowed.includes(key));
  if (!entries.length) return getUserById(id);

  const setSql = entries.map(([key]) => `${key} = @${key}`).join(', ');
  const stmt = db.prepare(`UPDATE users SET ${setSql} WHERE id = @id`);
  stmt.run({ id: Number(id), ...Object.fromEntries(entries) });
  return getUserById(id);
}

function deleteUser(id) {
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(Number(id));
  return info.changes > 0;
}

function listClients(nameQuery = '') {
  const rows = db.prepare('SELECT data FROM clients').all();
  const list = rows.map(parseRowData).filter(Boolean);
  const q = String(nameQuery || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter(c => String(c.nom || '').toLowerCase().includes(q));
}

function createClient(payload) {
  const id = Number(payload.id) || Date.now();
  const data = { ...payload, id };
  db.prepare('INSERT OR REPLACE INTO clients (id, data) VALUES (?, ?)').run(id, JSON.stringify(data));
  return data;
}

function getClientById(id) {
  const row = db.prepare('SELECT data FROM clients WHERE id = ?').get(Number(id));
  return parseRowData(row);
}

function updateClient(id, updates) {
  const existing = getClientById(id);
  if (!existing) return null;
  const merged = { ...existing, ...updates, id: Number(id) };
  db.prepare('UPDATE clients SET data = ? WHERE id = ?').run(JSON.stringify(merged), Number(id));
  return merged;
}

function deleteClient(id) {
  const info = db.prepare('DELETE FROM clients WHERE id = ?').run(Number(id));
  return info.changes > 0;
}

function listPharmacies(nameQuery = '') {
  const rows = db.prepare('SELECT data FROM pharmacies').all();
  const list = rows.map(parseRowData).filter(Boolean);
  const q = String(nameQuery || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter(p => String(p.nom || '').toLowerCase().includes(q));
}

function createPharmacy(payload) {
  const id = Number(payload.id) || Date.now();
  const data = { ...payload, id };
  db.prepare('INSERT OR REPLACE INTO pharmacies (id, data) VALUES (?, ?)').run(id, JSON.stringify(data));
  return data;
}

function getPharmacyById(id) {
  const row = db.prepare('SELECT data FROM pharmacies WHERE id = ?').get(Number(id));
  return parseRowData(row);
}

function updatePharmacy(id, updates) {
  const existing = getPharmacyById(id);
  if (!existing) return null;
  const merged = { ...existing, ...updates, id: Number(id) };
  db.prepare('UPDATE pharmacies SET data = ? WHERE id = ?').run(JSON.stringify(merged), Number(id));
  return merged;
}

function deletePharmacy(id) {
  const info = db.prepare('DELETE FROM pharmacies WHERE id = ?').run(Number(id));
  return info.changes > 0;
}

function createRating(rating) {
  const stmt = db.prepare(`
    INSERT INTO ratings (
      patientId, livreurId, pharmacieId, commandeId,
      ratingLivreur, ratingPharmacie,
      reviewLivreur, reviewPharmacie, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    Number(rating.patientId),
    rating.livreurId ? Number(rating.livreurId) : null,
    rating.pharmacieId ? Number(rating.pharmacieId) : null,
    rating.commandeId || null,
    rating.ratingLivreur || null,
    rating.ratingPharmacie || null,
    rating.reviewLivreur || null,
    rating.reviewPharmacie || null,
    rating.createdAt || nowIso()
  );

  const result = db.prepare('SELECT * FROM ratings ORDER BY id DESC LIMIT 1').get();
  return result;
}

function getRatingsByLivreur(livreurId) {
  const rows = db.prepare(`
    SELECT * FROM ratings 
    WHERE livreurId = ? AND ratingLivreur IS NOT NULL
    ORDER BY createdAt DESC
  `).all(Number(livreurId));
  return rows;
}

function getRatingsByPharmacie(pharmacieId) {
  const rows = db.prepare(`
    SELECT * FROM ratings 
    WHERE pharmacieId = ? AND ratingPharmacie IS NOT NULL
    ORDER BY createdAt DESC
  `).all(Number(pharmacieId));
  return rows;
}

function getAverageRatingLivreur(livreurId) {
  const result = db.prepare(`
    SELECT 
      AVG(ratingLivreur) AS average,
      COUNT(*) AS count
    FROM ratings 
    WHERE livreurId = ? AND ratingLivreur IS NOT NULL
  `).get(Number(livreurId));
  
  return {
    average: result.average ? parseFloat(result.average.toFixed(1)) : 0,
    count: result.count || 0
  };
}

function getAverageRatingPharmacie(pharmacieId) {
  const result = db.prepare(`
    SELECT 
      AVG(ratingPharmacie) AS average,
      COUNT(*) AS count
    FROM ratings 
    WHERE pharmacieId = ? AND ratingPharmacie IS NOT NULL
  `).get(Number(pharmacieId));
  
  return {
    average: result.average ? parseFloat(result.average.toFixed(1)) : 0,
    count: result.count || 0
  };
}

function getRatingById(ratingId) {
  return db.prepare('SELECT * FROM ratings WHERE id = ?').get(Number(ratingId));
}

function listRatingsByPatient(patientId) {
  const rows = db.prepare(`
    SELECT * FROM ratings 
    WHERE patientId = ?
    ORDER BY createdAt DESC
  `).all(Number(patientId));
  return rows;
}

module.exports = {
  db,
  sanitizeUser,
  migrateFromJson,
  getUserByEmail,
  getUserById,
  getUserByResetToken,
  createUser,
  updateUser,
  deleteUser,
  listClients,
  createClient,
  updateClient,
  deleteClient,
  listPharmacies,
  createPharmacy,
  updatePharmacy,
  deletePharmacy,
  createRating,
  getRatingsByLivreur,
  getRatingsByPharmacie,
  getAverageRatingLivreur,
  getAverageRatingPharmacie,
  getRatingById,
  listRatingsByPatient
};
