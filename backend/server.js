// backend/server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Dossier frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Chemin du fichier JSON
const dataFile = path.join(__dirname, 'data.json');

// Lire les données
function readData() {
  try {
    const data = fs.readFileSync(dataFile, 'utf8');
    return JSON.parse(data || '{"clients": [], "pharmacies": []}');
  } catch {
    return { clients: [], pharmacies: [] };
  }
}

// Sauvegarder les données
function writeData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

// -------------------- ROUTES CLIENTS --------------------
app.get('/clients', (req, res) => {
  const data = readData();
  const nom = req.query.nom?.toLowerCase();
  let clients = data.clients;

  if (nom) {
    clients = clients.filter(c => c.nom.toLowerCase().includes(nom));
  }
  res.json(clients);
});

app.post('/clients', (req, res) => {
  const data = readData();
  const client = req.body;
  client.id = Date.now();
  data.clients.push(client);
  writeData(data);
  res.json({ message: 'Client ajouté', client });
});

app.put('/clients/:id', (req, res) => {
  const data = readData();
  const id = Number(req.params.id);
  const index = data.clients.findIndex(c => c.id === id);
  if (index === -1) return res.status(404).json({ message: 'Client non trouvé' });

  data.clients[index] = { ...data.clients[index], ...req.body };
  writeData(data);
  res.json({ message: 'Client modifié', client: data.clients[index] });
});

app.delete('/clients/:id', (req, res) => {
  const data = readData();
  const id = Number(req.params.id);
  data.clients = data.clients.filter(c => c.id !== id);
  writeData(data);
  res.json({ message: 'Client supprimé' });
});

// -------------------- ROUTES PHARMACIES --------------------
app.get('/pharmacies', (req, res) => {
  const data = readData();
  const nom = req.query.nom?.toLowerCase();
  let pharmacies = data.pharmacies;

  if (nom) {
    pharmacies = pharmacies.filter(p => p.nom.toLowerCase().includes(nom));
  }
  res.json(pharmacies);
});

app.post('/pharmacies', (req, res) => {
  const data = readData();
  const pharmacie = req.body;
  pharmacie.id = Date.now();
  data.pharmacies.push(pharmacie);
  writeData(data);
  res.json({ message: 'Pharmacie ajoutée', pharmacie });
});

app.put('/pharmacies/:id', (req, res) => {
  const data = readData();
  const id = Number(req.params.id);
  const index = data.pharmacies.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ message: 'Pharmacie non trouvée' });

  data.pharmacies[index] = { ...data.pharmacies[index], ...req.body };
  writeData(data);
  res.json({ message: 'Pharmacie modifiée', pharmacie: data.pharmacies[index] });
});

app.delete('/pharmacies/:id', (req, res) => {
  const data = readData();
  const id = Number(req.params.id);
  data.pharmacies = data.pharmacies.filter(p => p.id !== id);
  writeData(data);
  res.json({ message: 'Pharmacie supprimée' });
});

// -------------------- SERVIR LE FRONTEND --------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/c.html'));
});

// Lancer le serveur
app.listen(PORT, () => console.log(`🚀 Serveur en ligne sur http://localhost:${PORT}`));
