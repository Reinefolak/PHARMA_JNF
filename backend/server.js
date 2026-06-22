// backend/server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

let transporter;
// Create a test ethereal account automatically
nodemailer.createTestAccount((err, account) => {
  if (err) {
    console.error('Failed to create a testing account. ' + err.message);
    return;
  }
  transporter = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: {
      user: account.user,
      pass: account.pass
    }
  });
  console.log('Nodemailer: Ethereal test account ready.');
});

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
    return JSON.parse(data || '{"users":[],"clients": [], "pharmacies": []}');
  } catch {
    return { users: [], clients: [], pharmacies: [] };
  }
}

// Sauvegarder les données
function writeData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

// Hash simple du mot de passe (sha256)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// -------------------- ROUTES AUTH --------------------

// Inscription
app.post('/api/register', (req, res) => {
  const { prenom, nom, email, password, role } = req.body;

  if (!prenom || !nom || !email || !password || !role) {
    return res.status(400).json({ success: false, message: 'Tous les champs sont requis.' });
  }

  const validRoles = ['patient', 'livreur', 'proprietaire'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ success: false, message: 'Rôle invalide.' });
  }

  const data = readData();
  if (!data.users) data.users = [];

  // Vérifier si l'email existe déjà
  const existing = data.users.find(u => u.email === email);
  if (existing) {
    return res.status(409).json({ success: false, message: 'Un compte avec cet email existe déjà.' });
  }

  const newUser = {
    id: Date.now(),
    prenom,
    nom,
    email,
    password: hashPassword(password),
    role,
    createdAt: new Date().toISOString()
  };

  data.users.push(newUser);
  writeData(data);

  // Ne pas renvoyer le mot de passe
  const { password: _, ...userSafe } = newUser;
  res.status(201).json({ success: true, message: 'Compte créé avec succès.', user: userSafe });
});

// Connexion
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email et mot de passe requis.' });
  }

  const data = readData();
  if (!data.users) data.users = [];

  const user = data.users.find(u => u.email === email && u.password === hashPassword(password));

  if (!user) {
    return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect.' });
  }

  const { password: _, ...userSafe } = user;
  res.json({ success: true, message: 'Connexion réussie.', user: userSafe });
});

// Récupérer les infos d'un utilisateur par email (pour le profil)
app.get('/api/user/:email', (req, res) => {
  const data = readData();
  if (!data.users) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });

  const user = data.users.find(u => u.email === req.params.email);
  if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });

  const { password: _, ...userSafe } = user;
  res.json({ success: true, user: userSafe });
});

// Mise à jour du profil
app.put('/api/user/:id', (req, res) => {
  const data = readData();
  if (!data.users) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });

  const id = Number(req.params.id);
  const index = data.users.findIndex(u => u.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });

  // Ne pas écraser le mot de passe ou le rôle sauf si explicitement fourni
  const { password, role, ...updates } = req.body;
  data.users[index] = { ...data.users[index], ...updates };

  if (password) {
    data.users[index].password = hashPassword(password);
  }

  writeData(data);
  const { password: _, ...userSafe } = data.users[index];
  res.json({ success: true, message: 'Profil mis à jour.', user: userSafe });
});

// Suppression de compte (désinscription)
app.delete('/api/user/:id', (req, res) => {
  const data = readData();
  if (!data.users) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });

  const id = Number(req.params.id);
  const index = data.users.findIndex(u => u.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });

  data.users.splice(index, 1);
  writeData(data);
  res.json({ success: true, message: 'Compte supprimé avec succès.' });
});

// Mot de passe oublié
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email requis.' });

  const data = readData();
  const userIndex = data.users.findIndex(u => u.email === email);
  if (userIndex === -1) {
    // Return success anyway for security reasons (don't leak emails)
    return res.json({ success: true, message: 'Si l\'adresse existe, un email a été envoyé.' });
  }

  // Generate token
  const token = crypto.randomBytes(20).toString('hex');
  data.users[userIndex].resetToken = token;
  data.users[userIndex].resetTokenExpires = Date.now() + 3600000; // 1 hour
  writeData(data);

  // Send email
  if (!transporter) return res.status(500).json({ success: false, message: 'Le service email n\'est pas prêt.' });

  const resetUrl = `http://localhost:${PORT}/reset-password.html?token=${token}`;
  
  const mailOptions = {
    from: '"PharmaLink Pro" <noreply@pharmalink.pro>',
    to: email,
    subject: 'Réinitialisation de votre mot de passe',
    text: `Vous avez demandé la réinitialisation de votre mot de passe.\n\nCliquez sur ce lien pour en créer un nouveau : \n${resetUrl}\n\nSi vous n'avez rien demandé, ignorez cet email.`,
    html: `<p>Vous avez demandé la réinitialisation de votre mot de passe.</p><p><a href="${resetUrl}">Cliquez ici pour créer un nouveau mot de passe</a></p><p>Si vous n'avez rien demandé, ignorez cet email.</p>`
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('=============================================');
    console.log('EMAIL ENVOYÉ !');
    console.log('Aperçu de l\'email : %s', nodemailer.getTestMessageUrl(info));
    console.log('=============================================');
    
    // We send the test message URL to the frontend for the user to easily click it in the demo
    res.json({ 
      success: true, 
      message: 'Email de réinitialisation envoyé.',
      previewUrl: nodemailer.getTestMessageUrl(info) // For demo purposes only
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi de l\'email.' });
  }
});

// Réinitialisation du mot de passe
app.post('/api/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ success: false, message: 'Token et nouveau mot de passe requis.' });

  const data = readData();
  const userIndex = data.users.findIndex(u => u.resetToken === token && u.resetTokenExpires > Date.now());

  if (userIndex === -1) {
    return res.status(400).json({ success: false, message: 'Le lien est invalide ou a expiré.' });
  }

  // Update password and clear token
  data.users[userIndex].password = hashPassword(newPassword);
  delete data.users[userIndex].resetToken;
  delete data.users[userIndex].resetTokenExpires;
  writeData(data);

  res.json({ success: true, message: 'Mot de passe réinitialisé avec succès.' });
});

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
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Lancer le serveur
app.listen(PORT, () => console.log(`🚀 Serveur en ligne sur http://localhost:${PORT}`));
