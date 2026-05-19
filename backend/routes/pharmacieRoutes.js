import express from 'express';
import db from '../db.js';
const router = express.Router();

// Create stocks table if not exists
router.get('/init', async (req, res) => {
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS stocks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nom VARCHAR(150),
      quantite INT,
      prix DECIMAL(10,2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    res.json({ message: 'table stocks ready' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ajouter un médicament au stock
router.post('/stock', async (req, res) => {
  try {
    const { nom, quantite, prix } = req.body;
    const sql = 'INSERT INTO stocks (nom, quantite, prix) VALUES (?, ?, ?)';
    const [result] = await db.query(sql, [nom, quantite, prix]);
    res.json({ message: 'Médicament ajouté au stock !', id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Récupérer tout le stock
router.get('/stocks', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM stocks ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
