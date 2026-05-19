import express from 'express';
import db from '../db.js';
const router = express.Router();

// Create commandes table if not exists (simple init)
router.get('/init', async (req, res) => {
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS commandes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nom_client VARCHAR(100),
      medicament VARCHAR(100),
      quantite INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    res.json({ message: 'table commandes ready' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ajouter une commande client
router.post('/commande', async (req, res) => {
  try {
    const { nom_client, medicament, quantite } = req.body;
    const sql = 'INSERT INTO commandes (nom_client, medicament, quantite) VALUES (?, ?, ?)';
    const [result] = await db.query(sql, [nom_client, medicament, quantite]);
    res.json({ message: 'Commande enregistrée !', id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Récupérer toutes les commandes
router.get('/commandes', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM commandes ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
