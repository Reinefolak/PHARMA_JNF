# Système de Notation PharmaLink Pro

## Vue d'ensemble
Un système complet de notation et d'évaluation qui crée une économie de confiance sur la plateforme. Après chaque livraison, les patients peuvent évaluer indépendamment la pharmacie et le livreur sur une échelle de 1 à 5 étoiles, avec la possibilité d'ajouter un commentaire écrit.

## Architecture

### Base de Données (SQLite)
**Table: `ratings`**
```sql
CREATE TABLE ratings (
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
```

**Indexes pour performance:**
- `idx_ratings_livreur` sur `livreurId`
- `idx_ratings_pharmacie` sur `pharmacieId`
- `idx_ratings_patient` sur `patientId`
- `idx_ratings_commande` sur `commandeId`

### API Endpoints

#### 1. Créer une Notation
**POST `/api/ratings`** (Protégé - JWT requis)

**Body:**
```json
{
  "patientId": 123,
  "livreurId": 456,
  "pharmacieId": 789,
  "commandeId": "CMD-2025-001",
  "ratingLivreur": 5,
  "ratingPharmacie": 4,
  "reviewLivreur": "Excellent service, très rapide",
  "reviewPharmacie": "Produits de qualité, emballage soigné"
}
```

**Validation:**
- `patientId` et (`livreurId` OU `pharmacieId`) sont requis
- `ratingLivreur` et `ratingPharmacie` doivent être entre 1 et 5 (ou null)
- Au moins une note doit être fournie

**Réponse:**
```json
{
  "success": true,
  "message": "Notation enregistrée.",
  "rating": { /* rating object */ }
}
```

#### 2. Récupérer Notations d'un Livreur
**GET `/api/ratings/livreur/:livreurId`**

**Réponse:**
```json
{
  "ratings": [
    {
      "id": 1,
      "ratingLivreur": 5,
      "reviewLivreur": "Très rapide",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "average": {
    "average": 4.7,
    "count": 15
  }
}
```

#### 3. Récupérer Notations d'une Pharmacie
**GET `/api/ratings/pharmacie/:pharmacieId`**

**Réponse:**
```json
{
  "ratings": [
    {
      "id": 1,
      "ratingPharmacie": 4,
      "reviewPharmacie": "Bons produits",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "average": {
    "average": 4.3,
    "count": 28
  }
}
```

#### 4. Récupérer Notations d'un Patient
**GET `/api/ratings/patient/:patientId`** (Protégé - JWT requis)

**Réponse:**
```json
{
  "ratings": [ /* list of ratings by patient */ ]
}
```

## Frontend - Interface de Notation

### Page: `commandes_patient.html`
Page dédiée pour que les patients voient et notent leurs commandes.

**Fonctionnalités:**
- ✅ Liste des commandes avec filtrage par statut
- ✅ Bouton "Noter cette commande" visible uniquement pour les commandes livrées non notées
- ✅ Badge "Notation envoyée" pour les commandes déjà notées
- ✅ Modal de notation avec:
  - Sélection d'étoiles interactif (1-5) pour pharmacie et livreur
  - Champs de commentaire texte optionnels
  - Infos de la commande affichées

**Navigation:**
```
patient.html → commandes_patient.html (link "Commandes" in navbar)
```

### Profil Livreur: `profil_livreur.html`
Section "Votre évaluation" affichant:
- Note moyenne (ex: 4.7/5)
- Stars visuels (remplis jusqu'à la note moyenne)
- Nombre total d'évaluations reçues

**Mise à jour automatique** lors du chargement du profil via `loadRatings(user.id)`

### Profil Proprietaire: `profil_proprietaire.html`
Section "Évaluation de votre pharmacie" affichant:
- Note moyenne de la pharmacie
- Stars visuels
- Nombre total d'évaluations

**Mise à jour automatique** lors du chargement du profil via `loadPharmacyRatings(pharmacyName)`

## Fonctions Métier (db.js)

### Créer une Notation
```javascript
createRating({
  patientId, livreurId, pharmacieId, commandeId,
  ratingLivreur, ratingPharmacie,
  reviewLivreur, reviewPharmacie
})
```

### Récupérer Notations d'un Livreur
```javascript
getRatingsByLivreur(livreurId) // Retourne array de ratings
```

### Récupérer Notations d'une Pharmacie
```javascript
getRatingsByPharmacie(pharmacieId) // Retourne array de ratings
```

### Calculer Note Moyenne - Livreur
```javascript
getAverageRatingLivreur(livreurId)
// Retourne { average: 4.7, count: 15 }
```

### Calculer Note Moyenne - Pharmacie
```javascript
getAverageRatingPharmacie(pharmacieId)
// Retourne { average: 4.3, count: 28 }
```

### Récupérer Notations d'un Patient
```javascript
listRatingsByPatient(patientId) // Retourne array de ratings données par ce patient
```

## Cas d'Usage

### 1. Après Livraison
1. Patient reçoit sa commande avec statut "Livrée"
2. Il accède à `commandes_patient.html`
3. Voit le bouton "Noter cette commande"
4. Clique → Modal de notation s'ouvre
5. Donne une note au livreur (ex: 5 étoiles) et pharmacie (ex: 4 étoiles)
6. Ajoute commentaires optionnels
7. Clique "Envoyer la notation"
8. Requête POST `/api/ratings` sauvegarde la notation
9. Badge "Notation envoyée" remplace le bouton

### 2. Consulter Profil du Livreur
1. Livreur se connecte → va sur `profil_livreur.html`
2. Section "Votre évaluation" affiche sa note moyenne
3. Mise à jour en temps réel basée sur API `/api/ratings/livreur/:id`

### 3. Consulter Profil de Pharmacie
1. Proprietaire se connecte → va sur `profil_proprietaire.html`
2. Section "Évaluation de votre pharmacie" affiche note moyenne
3. Propriétaire peut voir combien d'évaluations ont été reçues

## Sécurité

✅ **Authentification JWT:**
- Endpoint `POST /api/ratings` nécessite authentification
- Endpoint `GET /api/ratings/patient/:patientId` nécessite authentification
- Les ratings anonymes sont bloqués

✅ **Validation des données:**
- Notes entre 1-5 seulement
- Au moins une note doit être fournie
- Pas de notes négatives ou > 5

✅ **Intégrité des données:**
- Transactions SQLite pour éviter les incohérences
- Contraintes de clé étrangère
- Horodatage automatique (`createdAt`)

## Performances

✅ **Indexes optimisés:**
- Recherche rapide par livreur
- Recherche rapide par pharmacie
- Recherche rapide par patient
- Recherche rapide par commande

✅ **Calculs en base de données:**
- `AVG()` calculée au niveau SQL (pas en JavaScript)
- `COUNT()` calculée au niveau SQL
- Pas d'agrégation coûteuse côté client

## Évolutions Futures

### Phase 2 (Optionnel)
- 📊 Dashboard de gestion des notations pour admins
- 📝 Système de réponse aux commentaires
- ⏰ Filtrage des ratings par date
- 🚀 Graphiques de tendance des ratings
- 🔍 Recherche de livreurs/pharmacies par note minimale

### Phase 3 (Optionnel)
- 🛡️ Système de flag pour fausses/spam notations
- 📧 Email au livreur/pharmacie pour chaque notation
- 🏆 Badges d'excellence (ex: "5 étoiles consistent")
- 💰 Incitations pour maintenir hautes notations
- 🔐 Vérification que patient a vraiment commandé avant de noter

## Tests

### Créer une notation manuelle (cURL)
```bash
curl -X POST http://localhost:3000/api/ratings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": 1,
    "livreurId": 2,
    "pharmacieId": 3,
    "commandeId": "CMD-2025-001",
    "ratingLivreur": 5,
    "ratingPharmacie": 4,
    "reviewLivreur": "Excellent",
    "reviewPharmacie": "Très bon"
  }'
```

### Récupérer note moyenne livreur
```bash
curl http://localhost:3000/api/ratings/livreur/2
```

### Récupérer note moyenne pharmacie
```bash
curl http://localhost:3000/api/ratings/pharmacie/3
```

## Structure des Fichiers

```
backend/
├── db.js                          # Fonctions CRUD ratings
└── server.js                      # Endpoints /api/ratings

frontend/
├── commandes_patient.html         # Interface notation (NEW)
├── profil_livreur.html            # Affichage ratings livreur (MODIFIED)
└── profil_proprietaire.html       # Affichage ratings pharmacie (MODIFIED)
```

## Statuts de Mise en Œuvre

✅ **Implémenté et Testé:**
- Schéma SQLite et migrations
- Fonctions CRUD (db.js)
- Endpoints API complets
- Interface de notation (commandes_patient.html)
- Affichage des ratings (profils)
- Authentification JWT

🔄 **Suggestions pour Amélioration:**
- Ajouter des étoiles visuels dans la liste des commandes
- Notification email sur nouvelle notation
- Modération des commentaires
- Page publique pour voir tous les ratings d'un livreur/pharmacie

## FAQ

**Q: Peut-on noter multiple fois la même commande?**
A: Oui actuellement (pas de contrainte UNIQUE). À améliorer avec `UNIQUE(patientId, commandeId)`.

**Q: Les ratings peuvent-ils être supprimés?**
A: Pas actuellement. À ajouter si besoin: `DELETE FROM ratings WHERE id = ?`

**Q: Comment éviter les fausses notations?**
A: Vérifier que `patientId` a réellement commandé la `commandeId`.

**Q: Les ratings sont-ils anonymes?**
A: Non, on connaît le patientId. C'est intentionnel pour la traçabilité.
