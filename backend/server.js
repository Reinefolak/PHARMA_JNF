// backend/server.js
const express    = require('express');
const http       = require('http');
const WebSocket  = require('ws');
const path       = require('path');
const cors       = require('cors');
const crypto     = require('crypto');
const jwt        = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const {
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
} = require('./db');

// ==================== SETUP ====================
let transporter;
nodemailer.createTestAccount((err, account) => {
  if (err) { console.error('Nodemailer error: ' + err.message); return; }
  transporter = nodemailer.createTransport({
    host: account.smtp.host, port: account.smtp.port, secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass }
  });
  console.log('Nodemailer: compte Ethereal prêt.');
});

const app  = express();
const PORT = 3000;
const WS_PORT = 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'pharmalink-dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

app.use(cors());
app.use(express.json({ limit: '10mb' })); // 10mb pour les photos d'ordonnance base64
app.use(express.static(path.join(__dirname, '../frontend')));
migrateFromJson(path.join(__dirname, 'data.json'));

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function signAuthToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function getTokenFromHeader(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

function requireJwt(req, res, next) {
  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ success: false, message: 'Session expirée. Veuillez vous reconnecter.' });
  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token invalide.' });
  }
}

function canAccessUser(req, userId) {
  return Number(req.auth?.sub) === Number(userId) || req.auth?.role === 'proprietaire';
}

// ==================== ROUTES AUTH ====================

app.post('/api/register', (req, res) => {
  const { prenom, nom, email, password, role } = req.body;
  if (!prenom || !nom || !email || !password || !role)
    return res.status(400).json({ success: false, message: 'Tous les champs sont requis.' });
  const validRoles = ['patient', 'livreur', 'proprietaire'];
  if (!validRoles.includes(role))
    return res.status(400).json({ success: false, message: 'Rôle invalide.' });
  if (getUserByEmail(email))
    return res.status(409).json({ success: false, message: 'Un compte avec cet email existe déjà.' });
  const created = createUser({
    id: Date.now(),
    prenom,
    nom,
    email,
    password: hashPassword(password),
    role,
    createdAt: new Date().toISOString()
  });
  const userSafe = sanitizeUser(created);
  const token = signAuthToken(userSafe);
  res.status(201).json({ success: true, message: 'Compte créé avec succès.', user: userSafe, token });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email et mot de passe requis.' });
  const user = getUserByEmail(email);
  if (!user || user.password !== hashPassword(password))
    return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect.' });
  const userSafe = sanitizeUser(user);
  const token = signAuthToken(userSafe);
  res.json({ success: true, message: 'Connexion réussie.', user: userSafe, token });
});

app.get('/api/user/:email', requireJwt, (req, res) => {
  const user = getUserByEmail(req.params.email);
  if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
  if (!canAccessUser(req, user.id) && req.auth?.email !== user.email) {
    return res.status(403).json({ success: false, message: 'Accès refusé.' });
  }
  const userSafe = sanitizeUser(user);
  res.json({ success: true, user: userSafe });
});

app.put('/api/user/:id', requireJwt, (req, res) => {
  const id = Number(req.params.id);
  const existing = getUserById(id);
  if (!existing) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
  if (!canAccessUser(req, id)) return res.status(403).json({ success: false, message: 'Accès refusé.' });
  const { password, role, ...updates } = req.body;
  const payload = { ...updates };
  if (password) payload.password = hashPassword(password);
  const updated = updateUser(id, payload);
  const userSafe = sanitizeUser(updated);
  res.json({ success: true, message: 'Profil mis à jour.', user: userSafe });
});

app.delete('/api/user/:id', requireJwt, (req, res) => {
  const id = Number(req.params.id);
  const existing = getUserById(id);
  if (!existing) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
  if (!canAccessUser(req, id)) return res.status(403).json({ success: false, message: 'Accès refusé.' });
  deleteUser(id);
  res.json({ success: true, message: 'Compte supprimé avec succès.' });
});

app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email requis.' });
  const user = getUserByEmail(email);
  if (!user)
    return res.status(404).json({ success: false, message: 'Aucun compte associé à cette adresse e-mail.' });
  const token = crypto.randomBytes(20).toString('hex');
  updateUser(user.id, { resetToken: token, resetTokenExpires: Date.now() + 3600000 });
  if (!transporter)
    return res.status(500).json({ success: false, message: "Le service email n'est pas prêt." });
  const resetUrl    = `http://localhost:${PORT}/reset-password.html?token=${token}`;
  const mailOptions = {
    from: '"PharmaLink Pro" <noreply@pharmalink.pro>',
    to: email,
    subject: 'Réinitialisation de votre mot de passe',
    text: `Cliquez sur ce lien : ${resetUrl}`,
    html: `<p><a href="${resetUrl}">Réinitialiser mon mot de passe</a></p>`
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Email envoyé.', previewUrl: nodemailer.getTestMessageUrl(info) });
  } catch {
    res.status(500).json({ success: false, message: "Erreur lors de l'envoi de l'email." });
  }
});

app.post('/api/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword)
    return res.status(400).json({ success: false, message: 'Token et nouveau mot de passe requis.' });
  const user = getUserByResetToken(token);
  if (!user)
    return res.status(400).json({ success: false, message: 'Le lien est invalide ou a expiré.' });
  updateUser(user.id, {
    password: hashPassword(newPassword),
    resetToken: null,
    resetTokenExpires: null
  });
  res.json({ success: true, message: 'Mot de passe réinitialisé avec succès.' });
});

// ==================== ROUTES CLIENTS ====================

app.get('/clients', (req, res) => {
  res.json(listClients(req.query.nom));
});
app.post('/clients', (req, res) => {
  const client = createClient({ ...req.body, id: Date.now() });
  res.json({ message: 'Client ajouté', client });
});
app.put('/clients/:id', (req, res) => {
  const client = updateClient(req.params.id, req.body);
  if (!client) return res.status(404).json({ message: 'Client non trouvé' });
  res.json({ message: 'Client modifié', client });
});
app.delete('/clients/:id', (req, res) => {
  deleteClient(req.params.id);
  res.json({ message: 'Client supprimé' });
});

// ==================== ROUTES PHARMACIES ====================

app.get('/pharmacies', (req, res) => {
  res.json(listPharmacies(req.query.nom));
});
app.post('/pharmacies', (req, res) => {
  const pharmacie = createPharmacy({ ...req.body, id: Date.now() });
  res.json({ message: 'Pharmacie ajoutée', pharmacie });
});
app.put('/pharmacies/:id', (req, res) => {
  const pharmacie = updatePharmacy(req.params.id, req.body);
  if (!pharmacie) return res.status(404).json({ message: 'Pharmacie non trouvée' });
  res.json({ message: 'Pharmacie modifiée', pharmacie });
});
app.delete('/pharmacies/:id', (req, res) => {
  deletePharmacy(req.params.id);
  res.json({ message: 'Pharmacie supprimée' });
});

// ==================== ROUTES RATINGS ====================

app.post('/api/ratings', requireJwt, (req, res) => {
  const { patientId, livreurId, pharmacieId, commandeId, ratingLivreur, ratingPharmacie, reviewLivreur, reviewPharmacie } = req.body;

  if (!patientId || (!livreurId && !pharmacieId)) {
    return res.status(400).json({ success: false, message: 'patientId et (livreurId ou pharmacieId) requis.' });
  }

  if (livreurId && (!ratingLivreur || ratingLivreur < 1 || ratingLivreur > 5)) {
    return res.status(400).json({ success: false, message: 'ratingLivreur doit être entre 1 et 5.' });
  }

  if (pharmacieId && (!ratingPharmacie || ratingPharmacie < 1 || ratingPharmacie > 5)) {
    return res.status(400).json({ success: false, message: 'ratingPharmacie doit être entre 1 et 5.' });
  }

  const rating = createRating({
    patientId,
    livreurId,
    pharmacieId,
    commandeId,
    ratingLivreur: ratingLivreur || null,
    ratingPharmacie: ratingPharmacie || null,
    reviewLivreur: reviewLivreur || null,
    reviewPharmacie: reviewPharmacie || null
  });

  res.json({ success: true, message: 'Notation enregistrée.', rating });
});

app.get('/api/ratings/livreur/:livreurId', (req, res) => {
  const ratings = getRatingsByLivreur(req.params.livreurId);
  const average = getAverageRatingLivreur(req.params.livreurId);
  res.json({ ratings, average });
});

app.get('/api/ratings/pharmacie/:pharmacieId', (req, res) => {
  const ratings = getRatingsByPharmacie(req.params.pharmacieId);
  const average = getAverageRatingPharmacie(req.params.pharmacieId);
  res.json({ ratings, average });
});

app.get('/api/ratings/patient/:patientId', requireJwt, (req, res) => {
  const ratings = listRatingsByPatient(req.params.patientId);
  res.json({ ratings });
});

// ==================== ROUTE : ASSISTANT IA SYMPTÔMES ====================
// POST /api/symptomes
// Body : { symptomes: "j'ai de la fièvre et mal à la gorge" }

app.post('/api/symptomes', async (req, res) => {
  const { symptomes } = req.body;
  if (!symptomes || symptomes.trim().length < 3)
    return res.status(400).json({ success: false, message: 'Veuillez décrire vos symptômes.' });

  const data           = { pharmacies: listPharmacies() };
  const stockDisponible = [];
  if (data.pharmacies?.length > 0) {
    data.pharmacies.forEach(pharma => {
      (pharma.medicaments || []).forEach(med => {
        if (med.quantite > 0) {
          stockDisponible.push({
            nom:      med.nom,
            pharmacie: pharma.nom || 'Pharmacie partenaire',
            prix:     med.prix || 'N/A',
            quantite: med.quantite
          });
        }
      });
    });
  }

  const stockPourIA = stockDisponible.length > 0 ? stockDisponible : [
    { nom: 'Doliprane 1000mg',          pharmacie: 'Pharmacie du Soleil',   prix: '1500 F', quantite: 20 },
    { nom: 'Paracétamol 500mg',         pharmacie: 'Pharmacie Les Anges',   prix: '800 F',  quantite: 15 },
    { nom: 'Ibuprofène 400mg',          pharmacie: 'Pharmacie du Soleil',   prix: '1200 F', quantite: 10 },
    { nom: 'Vitamine C Upsa',           pharmacie: 'Pharmacie Les Anges',   prix: '900 F',  quantite: 25 },
    { nom: 'Amoxicilline 500mg',        pharmacie: 'Pharmacie du Centre',   prix: '2500 F', quantite: 8  },
    { nom: 'Strepsils',                 pharmacie: 'Pharmacie Les Anges',   prix: '1100 F', quantite: 30 },
    { nom: 'Sirop Toplexil',            pharmacie: 'Pharmacie du Soleil',   prix: '2000 F', quantite: 5  },
    { nom: 'Nifuroxazide',              pharmacie: 'Pharmacie du Centre',   prix: '1800 F', quantite: 12 },
    { nom: 'SRO (Sels de Réhydratation)', pharmacie: 'Pharmacie du Soleil', prix: '500 F',  quantite: 40 },
    { nom: 'Loratadine 10mg',           pharmacie: 'Pharmacie Les Anges',   prix: '1300 F', quantite: 18 }
  ];

  const prompt = `Tu es un assistant pharmaceutique pour PharmaLink. Un patient décrit ses symptômes.

SYMPTÔMES : "${symptomes}"

MÉDICAMENTS EN STOCK :
${stockPourIA.map((m, i) => `${i + 1}. ${m.nom} - ${m.pharmacie} - ${m.prix}`).join('\n')}

Sélectionne 2 à 4 médicaments pertinents parmi cette liste uniquement.
Réponds UNIQUEMENT en JSON valide, sans texte avant ou après.

{
  "alerte": null,
  "suggestions": [
    { "nom": "", "pharmacie": "", "prix": "", "usage": "(max 15 mots)", "posologie": "" }
  ]
}

Si symptômes graves, mets un message d'urgence court dans "alerte".`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages:   [{ role: 'user', content: prompt }]
      })
    });
    if (!response.ok) throw new Error(`API Anthropic: ${response.status}`);
    const aiData  = await response.json();
    const rawText = aiData.content[0].text.trim();
    const clean   = rawText.replace(/```json|```/g, '').trim();
    const parsed  = JSON.parse(clean);
    res.json({ success: true, ...parsed });
  } catch (err) {
    console.error('Erreur IA symptômes:', err.message);
    res.status(500).json({ success: false, message: 'Service IA indisponible.', error: err.message });
  }
});

// ==================== ROUTE : DISPONIBILITÉ CROISÉE ====================
// GET /api/disponibilite/:nom?exclure=NomPharmacie

app.get('/api/disponibilite/:nom', (req, res) => {
  const nomRecherche = decodeURIComponent(req.params.nom).toLowerCase().trim();
  const exclure      = (req.query.exclure || '').toLowerCase();
  const data         = { pharmacies: listPharmacies() };
  const resultats    = [];

  if (data.pharmacies?.length > 0) {
    data.pharmacies.forEach(pharma => {
      if (pharma.nom?.toLowerCase() === exclure) return;
      const med = (pharma.medicaments || []).find(m =>
        m.nom?.toLowerCase().includes(nomRecherche) && m.quantite > 0
      );
      if (med) {
        resultats.push({
          pharmacie: pharma.nom    || 'Pharmacie partenaire',
          adresse:   pharma.adresse || 'Adresse non renseignée',
          distance:  pharma.distance || 'N/A',
          delai:     pharma.delai    || 'N/A',
          prix:      med.prix ? `${med.prix} F` : 'N/A',
          quantite:  med.quantite
        });
      }
    });
  }

  resultats.sort((a, b) => (parseFloat(a.distance) || 99) - (parseFloat(b.distance) || 99));
  res.json({ success: true, medicament: nomRecherche, alternatives: resultats });
});

// ==================== ROUTE : STATUT COMMANDE (déclenche WS) ====================
// POST /api/commandes/:id/statut
// Body : { statut, client, produit, adresse }

app.post('/api/commandes/:id/statut', (req, res) => {
  const { statut, client, produit, adresse } = req.body;
  const cmdId = req.params.id;

  if (!statut) return res.status(400).json({ success: false, message: 'Statut requis.' });

  // Broadcast WebSocket → patient
  broadcast('patient', {
    type:   'statut_commande',
    cmdId,
    statut,
    client: client || ''
  });

  // Si commande en livraison → alerter les livreurs
  if (statut === 'En livraison') {
    broadcast('livreur', {
      type:    'nouvelle_course',
      cmdId,
      client:  client  || '',
      produit: produit || '',
      adresse: adresse || ''
    });
  }

  res.json({ success: true, message: `Statut mis à jour → ${statut}` });
});

// ==================== ROUTE : NOUVELLE COMMANDE (déclenche WS) ====================
// POST /api/commandes/nouvelle
// Body : { cmdId, client, produit }

app.post('/api/commandes/nouvelle', (req, res) => {
  const { cmdId, client, produit } = req.body;
  broadcast('proprietaire', { type: 'nouvelle_commande', cmdId, client, produit });
  res.json({ success: true, message: 'Pharmacien notifié.' });
});

// ==================== FRONTEND ====================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ==================== WEBSOCKET SERVER ====================
const httpServer = http.createServer(app);
const wss        = new WebSocket.Server({ port: WS_PORT });

// Clients par rôle
const wsClients = {
  patient:      new Set(),
  livreur:      new Set(),
  proprietaire: new Set()
};

wss.on('connection', (ws) => {
  let clientRole = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // Identification
    if (msg.type === 'identify' && msg.role) {
      clientRole = msg.role;
      if (wsClients[clientRole]) wsClients[clientRole].add(ws);
      console.log(`[WS] +${clientRole} (${wsClients[clientRole]?.size} connectés)`);
      ws.send(JSON.stringify({ type: 'connected', role: clientRole }));
      return;
    }

    // Changement statut commande (envoyé aussi depuis le frontend)
    if (msg.type === 'statut_commande') {
      broadcast('patient', { type: 'statut_commande', cmdId: msg.cmdId, statut: msg.statut, client: msg.client });
      if (msg.statut === 'En livraison') {
        broadcast('livreur', { type: 'nouvelle_course', cmdId: msg.cmdId, client: msg.client, produit: msg.produit, adresse: msg.adresse });
      }
      return;
    }

    // Nouvelle commande patient
    if (msg.type === 'nouvelle_commande') {
      broadcast('proprietaire', { type: 'nouvelle_commande', cmdId: msg.cmdId, client: msg.client, produit: msg.produit });
      return;
    }
  });

  ws.on('close', () => {
    if (clientRole && wsClients[clientRole]) {
      wsClients[clientRole].delete(ws);
      console.log(`[WS] -${clientRole} (${wsClients[clientRole]?.size} restants)`);
    }
  });

  ws.on('error', (err) => console.error('[WS] Erreur:', err.message));
});

function broadcast(role, payload) {
  const targets = wsClients[role];
  if (!targets?.size) return;
  const msg = JSON.stringify(payload);
  targets.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
  console.log(`[WS] → ${role} ×${targets.size} : ${payload.type}`);
}

// ==================== DÉMARRAGE ====================
httpServer.listen(PORT, () => {
  console.log(`🚀 HTTP  → http://localhost:${PORT}`);
  console.log(`⚡ WS    → ws://localhost:${WS_PORT}`);
});