// backend/server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

let transporter;
nodemailer.createTestAccount((err, account) => {
  if (err) { console.error('Failed to create a testing account. ' + err.message); return; }
  transporter = nodemailer.createTransport({
    host: account.smtp.host, port: account.smtp.port, secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass }
  });
  console.log('Nodemailer: Ethereal test account ready.');
});

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const dataFile = path.join(__dirname, 'data.json');

function readData() {
  try {
    const data = fs.readFileSync(dataFile, 'utf8');
    return JSON.parse(data || '{"users":[],"clients":[],"pharmacies":[]}');
  } catch { return { users: [], clients: [], pharmacies: [] }; }
}

function writeData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// -------------------- ROUTES AUTH --------------------

app.post('/api/register', (req, res) => {
  const { prenom, nom, email, password, role } = req.body;
  if (!prenom || !nom || !email || !password || !role)
    return res.status(400).json({ success: false, message: 'Tous les champs sont requis.' });
  const validRoles = ['patient', 'livreur', 'proprietaire'];
  if (!validRoles.includes(role))
    return res.status(400).json({ success: false, message: 'Rôle invalide.' });
  const data = readData();
  if (!data.users) data.users = [];
  const existing = data.users.find(u => u.email === email);
  if (existing) return res.status(409).json({ success: false, message: 'Un compte avec cet email existe déjà.' });
  const newUser = { id: Date.now(), prenom, nom, email, password: hashPassword(password), role, createdAt: new Date().toISOString() };
  data.users.push(newUser);
  writeData(data);
  const { password: _, ...userSafe } = newUser;
  res.status(201).json({ success: true, message: 'Compte créé avec succès.', user: userSafe });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: 'Email et mot de passe requis.' });
  const data = readData();
  if (!data.users) data.users = [];
  const user = data.users.find(u => u.email === email && u.password === hashPassword(password));
  if (!user) return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect.' });
  const { password: _, ...userSafe } = user;
  res.json({ success: true, message: 'Connexion réussie.', user: userSafe });
});

app.get('/api/user/:email', (req, res) => {
  const data = readData();
  if (!data.users) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
  const user = data.users.find(u => u.email === req.params.email);
  if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
  const { password: _, ...userSafe } = user;
  res.json({ success: true, user: userSafe });
});

app.put('/api/user/:id', (req, res) => {
  const data = readData();
  if (!data.users) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
  const id = Number(req.params.id);
  const index = data.users.findIndex(u => u.id === id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
  const { password, role, ...updates } = req.body;
  data.users[index] = { ...data.users[index], ...updates };
  if (password) data.users[index].password = hashPassword(password);
  writeData(data);
  const { password: _, ...userSafe } = data.users[index];
  res.json({ success: true, message: 'Profil mis à jour.', user: userSafe });
});

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

app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email requis.' });
  const data = readData();
  const userIndex = data.users.findIndex(u => u.email === email);
  if (userIndex === -1) return res.status(404).json({ success: false, message: 'Aucun compte associé à cette adresse e-mail.' });
  const token = crypto.randomBytes(20).toString('hex');
  data.users[userIndex].resetToken = token;
  data.users[userIndex].resetTokenExpires = Date.now() + 3600000;
  writeData(data);
  if (!transporter) return res.status(500).json({ success: false, message: 'Le service email n\'est pas prêt.' });
  const resetUrl = `http://localhost:${PORT}/reset-password.html?token=${token}`;
  const mailOptions = {
    from: '"PharmaLink Pro" <noreply@pharmalink.pro>',
    to: email,
    subject: 'Réinitialisation de votre mot de passe',
    text: `Cliquez sur ce lien : ${resetUrl}`,
    html: `<p><a href="${resetUrl}">Cliquez ici pour réinitialiser votre mot de passe</a></p>`
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Email envoyé.', previewUrl: nodemailer.getTestMessageUrl(info) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi de l\'email.' });
  }
});

app.post('/api/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ success: false, message: 'Token et nouveau mot de passe requis.' });
  const data = readData();
  const userIndex = data.users.findIndex(u => u.resetToken === token && u.resetTokenExpires > Date.now());
  if (userIndex === -1) return res.status(400).json({ success: false, message: 'Le lien est invalide ou a expiré.' });
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
  if (nom) clients = clients.filter(c => c.nom.toLowerCase().includes(nom));
  res.json(clients);
});

app.post('/clients', (req, res) => {
  const data = readData();
  const client = { ...req.body, id: Date.now() };
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
  data.clients = data.clients.filter(c => c.id !== Number(req.params.id));
  writeData(data);
  res.json({ message: 'Client supprimé' });
});

// -------------------- ROUTES PHARMACIES --------------------

app.get('/pharmacies', (req, res) => {
  const data = readData();
  const nom = req.query.nom?.toLowerCase();
  let pharmacies = data.pharmacies;
  if (nom) pharmacies = pharmacies.filter(p => p.nom.toLowerCase().includes(nom));
  res.json(pharmacies);
});

app.post('/pharmacies', (req, res) => {
  const data = readData();
  const pharmacie = { ...req.body, id: Date.now() };
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
  data.pharmacies = data.pharmacies.filter(p => p.id !== Number(req.params.id));
  writeData(data);
  res.json({ message: 'Pharmacie supprimée' });
});

// ==================== NOUVELLE ROUTE : ASSISTANT IA SYMPTÔMES ====================
// POST /api/symptomes
// Body: { symptomes: "j'ai de la fièvre et mal à la gorge" }
// Retourne: { suggestions: [ { nom, usage, disponible, pharmacie, prix } ] }

app.post('/api/symptomes', async (req, res) => {
  const { symptomes } = req.body;
  if (!symptomes || symptomes.trim().length < 3) {
    return res.status(400).json({ success: false, message: 'Veuillez décrire vos symptômes.' });
  }

  // Récupérer les médicaments en stock depuis data.json
  const data = readData();
  const stockDisponible = [];
  if (data.pharmacies && data.pharmacies.length > 0) {
    data.pharmacies.forEach(pharma => {
      if (pharma.medicaments && Array.isArray(pharma.medicaments)) {
        pharma.medicaments.forEach(med => {
          if (med.quantite > 0) {
            stockDisponible.push({
              nom: med.nom,
              pharmacie: pharma.nom || 'Pharmacie partenaire',
              prix: med.prix || 'N/A',
              quantite: med.quantite
            });
          }
        });
      }
    });
  }

  // Si aucun médicament en stock, on utilise une liste de démonstration
  const stockPourIA = stockDisponible.length > 0 ? stockDisponible : [
    { nom: 'Doliprane 1000mg', pharmacie: 'Pharmacie du Soleil', prix: '1500 F', quantite: 20 },
    { nom: 'Paracétamol 500mg', pharmacie: 'Pharmacie Les Anges', prix: '800 F', quantite: 15 },
    { nom: 'Ibuprofène 400mg', pharmacie: 'Pharmacie du Soleil', prix: '1200 F', quantite: 10 },
    { nom: 'Vitamine C Upsa', pharmacie: 'Pharmacie Les Anges', prix: '900 F', quantite: 25 },
    { nom: 'Amoxicilline 500mg', pharmacie: 'Pharmacie du Centre', prix: '2500 F', quantite: 8 },
    { nom: 'Strepsils', pharmacie: 'Pharmacie Les Anges', prix: '1100 F', quantite: 30 },
    { nom: 'Sirop Toplexil', pharmacie: 'Pharmacie du Soleil', prix: '2000 F', quantite: 5 },
    { nom: 'Nifuroxazide', pharmacie: 'Pharmacie du Centre', prix: '1800 F', quantite: 12 },
    { nom: 'SRO (Sels de Réhydratation)', pharmacie: 'Pharmacie du Soleil', prix: '500 F', quantite: 40 },
    { nom: 'Loratadine 10mg', pharmacie: 'Pharmacie Les Anges', prix: '1300 F', quantite: 18 }
  ];

  const prompt = `Tu es un assistant pharmaceutique pour l'application PharmaLink. Un patient décrit ses symptômes et tu dois suggérer les médicaments les plus adaptés parmi ceux disponibles en stock.

SYMPTÔMES DU PATIENT : "${symptomes}"

MÉDICAMENTS DISPONIBLES EN STOCK :
${stockPourIA.map((m, i) => `${i+1}. ${m.nom} - ${m.pharmacie} - ${m.prix}`).join('\n')}

INSTRUCTIONS :
- Sélectionne 2 à 4 médicaments pertinents parmi la liste disponible
- Ne suggère JAMAIS un médicament qui n'est pas dans la liste
- Ajoute un avertissement si les symptômes nécessitent une consultation médicale urgente
- Réponds UNIQUEMENT en JSON valide, sans aucun texte avant ou après

FORMAT DE RÉPONSE JSON :
{
  "alerte": null,
  "suggestions": [
    {
      "nom": "Nom du médicament",
      "pharmacie": "Nom de la pharmacie",
      "prix": "Prix en F",
      "usage": "Courte explication (max 15 mots)",
      "posologie": "Ex: 1 comprimé toutes les 8h"
    }
  ]
}

Si les symptômes semblent graves (douleur thoracique, difficulté à respirer, etc.), mets dans "alerte" un message d'urgence court.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`API Anthropic error: ${response.status}`);
    }

    const aiData = await response.json();
    const rawText = aiData.content[0].text.trim();

    // Parser le JSON retourné par l'IA
    let parsed;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      throw new Error('Réponse IA non parseable');
    }

    res.json({ success: true, ...parsed });

  } catch (err) {
    console.error('Erreur IA symptômes:', err.message);
    res.status(500).json({
      success: false,
      message: 'Le service IA est temporairement indisponible. Veuillez réessayer.',
      error: err.message
    });
  }
});
// ==================== FIN ROUTE IA ====================

// -------------------- FRONTEND --------------------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => console.log(`🚀 Serveur en ligne sur http://localhost:${PORT}`));


// ==================== ROUTE : DISPONIBILITÉ CROISÉE ====================
// GET /api/disponibilite/:nomMedicament
// Retourne toutes les pharmacies qui ont ce médicament en stock
// (exclut la pharmacie passée en query ?exclure=NomPharmacie)

app.get('/api/disponibilite/:nom', (req, res) => {
  const nomRecherche = decodeURIComponent(req.params.nom).toLowerCase().trim();
  const exclure      = (req.query.exclure || '').toLowerCase();
  const data         = readData();

  const resultats = [];

  if (data.pharmacies && data.pharmacies.length > 0) {
    data.pharmacies.forEach(pharma => {
      if (pharma.nom && pharma.nom.toLowerCase() === exclure) return;
      if (!pharma.medicaments || !Array.isArray(pharma.medicaments)) return;

      const med = pharma.medicaments.find(m =>
        m.nom && m.nom.toLowerCase().includes(nomRecherche) && m.quantite > 0
      );
      if (med) {
        resultats.push({
          pharmacie: pharma.nom || 'Pharmacie partenaire',
          adresse:   pharma.adresse || 'Adresse non renseignée',
          distance:  pharma.distance || 'N/A',
          delai:     pharma.delai || 'N/A',
          prix:      med.prix ? `${med.prix} F` : 'N/A',
          quantite:  med.quantite
        });
      }
    });
  }

  // Trier par distance si disponible
  resultats.sort((a, b) => {
    const da = parseFloat(a.distance) || 99;
    const db = parseFloat(b.distance) || 99;
    return da - db;
  });

  res.json({ success: true, medicament: nomRecherche, alternatives: resultats });
});
// ==================== FIN ROUTE DISPONIBILITÉ ====================