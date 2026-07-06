#!/bin/bash
# Script de test du système de notation PharmaLink Pro
# Usage: bash test_rating_system.sh

echo "=========================================="
echo "  Tests du Système de Notation"
echo "=========================================="
echo ""

BASE_URL="http://localhost:3000"

# Couleurs pour output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Test 1: Créer une notation (requires JWT)
echo -e "${YELLOW}[TEST 1]${NC} Créer une notation (POST /api/ratings)"
echo "Note: Remplacer TOKEN par votre JWT Token"
echo ""

# Exemple de JSON pour créer une notation
cat > /tmp/rating_payload.json << 'EOF'
{
  "patientId": 1,
  "livreurId": 2,
  "pharmacieId": 3,
  "commandeId": "CMD-2025-001",
  "ratingLivreur": 5,
  "ratingPharmacie": 4,
  "reviewLivreur": "Livraison très rapide, très professionnel",
  "reviewPharmacie": "Produits de qualité, emballage impeccable"
}
EOF

echo "Payload JSON:"
cat /tmp/rating_payload.json
echo ""
echo "Command cURL:"
cat << 'EOF'
TOKEN="your-jwt-token-here"
curl -X POST http://localhost:3000/api/ratings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/rating_payload.json
EOF
echo ""
echo ""

# 2. Test 2: Récupérer ratings d'un livreur
echo -e "${YELLOW}[TEST 2]${NC} Récupérer ratings d'un livreur (GET /api/ratings/livreur/:id)"
echo "URL: GET http://localhost:3000/api/ratings/livreur/2"
echo ""
echo "Réponse attendue:"
cat << 'EOF'
{
  "ratings": [
    {
      "id": 1,
      "patientId": 1,
      "livreurId": 2,
      "ratingLivreur": 5,
      "reviewLivreur": "Livraison très rapide...",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "average": {
    "average": 4.7,
    "count": 15
  }
}
EOF
echo ""
echo ""

# 3. Test 3: Récupérer ratings d'une pharmacie
echo -e "${YELLOW}[TEST 3]${NC} Récupérer ratings d'une pharmacie (GET /api/ratings/pharmacie/:id)"
echo "URL: GET http://localhost:3000/api/ratings/pharmacie/3"
echo ""
echo "Réponse attendue:"
cat << 'EOF'
{
  "ratings": [
    {
      "id": 1,
      "patientId": 1,
      "pharmacieId": 3,
      "ratingPharmacie": 4,
      "reviewPharmacie": "Produits de qualité...",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "average": {
    "average": 4.3,
    "count": 28
  }
}
EOF
echo ""
echo ""

# 4. Test 4: Récupérer ratings d'un patient
echo -e "${YELLOW}[TEST 4]${NC} Récupérer ratings d'un patient (GET /api/ratings/patient/:id)"
echo "Note: Protégé par JWT"
echo "URL: GET http://localhost:3000/api/ratings/patient/1"
echo ""
echo "Command cURL:"
cat << 'EOF'
TOKEN="your-jwt-token-here"
curl -X GET http://localhost:3000/api/ratings/patient/1 \
  -H "Authorization: Bearer $TOKEN"
EOF
echo ""
echo ""

# 5. Tests de validation
echo -e "${YELLOW}[TEST 5]${NC} Tests de Validation"
echo ""

echo -e "${RED}5a. Missing patientId (doit échouer):${NC}"
cat << 'EOF'
curl -X POST http://localhost:3000/api/ratings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"livreurId": 2, "ratingLivreur": 5}'
# Réponse attendue: { "success": false, "message": "patientId et (livreurId ou pharmacieId) requis." }
EOF
echo ""

echo -e "${RED}5b. Rating invalide > 5 (doit échouer):${NC}"
cat << 'EOF'
curl -X POST http://localhost:3000/api/ratings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"patientId": 1, "livreurId": 2, "ratingLivreur": 6}'
# Réponse attendue: { "success": false, "message": "ratingLivreur doit être entre 1 et 5." }
EOF
echo ""

echo -e "${RED}5c. Rating invalide < 1 (doit échouer):${NC}"
cat << 'EOF'
curl -X POST http://localhost:3000/api/ratings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"patientId": 1, "livreurId": 2, "ratingLivreur": 0}'
# Réponse attendue: { "success": false, "message": "ratingLivreur doit être entre 1 et 5." }
EOF
echo ""

echo -e "${RED}5d. Aucune note fournie (doit échouer):${NC}"
cat << 'EOF'
curl -X POST http://localhost:3000/api/ratings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"patientId": 1, "livreurId": 2}'
# Réponse attendue: { "success": false, "message": "ratingLivreur doit être entre 1 et 5." }
EOF
echo ""
echo ""

# 6. Test d'authentification
echo -e "${YELLOW}[TEST 6]${NC} Test d'Authentification (sans JWT)"
echo ""
echo -e "${RED}6a. POST sans JWT (doit échouer):${NC}"
cat << 'EOF'
curl -X POST http://localhost:3000/api/ratings \
  -H "Content-Type: application/json" \
  -d '{"patientId": 1, "livreurId": 2, "ratingLivreur": 5}'
# Réponse attendue: 401 { "message": "Unauthorized" }
EOF
echo ""

echo -e "${GREEN}6b. GET sans JWT (doit réussir):${NC}"
cat << 'EOF'
curl -X GET http://localhost:3000/api/ratings/livreur/2
# Réponse attendue: { "ratings": [...], "average": {...} }
EOF
echo ""
echo ""

# 7. Scénario complet
echo -e "${YELLOW}[SCÉNARIO COMPLET]${NC} Workflow Patient → Livreur → Pharmacie"
echo ""
cat << 'EOF'
Étapes:
1. Patient se connecte → obtient JWT token
2. Patient va sur commandes_patient.html
3. Voit commande avec statut "Livrée"
4. Clique "Noter cette commande"
5. Modal s'ouvre avec stars interactifs
6. Sélectionne 5 étoiles pour livreur, 4 pour pharmacie
7. Ajoute commentaires (optionnel)
8. Clique "Envoyer la notation"
9. POST /api/ratings → Backend sauvegarde
10. Frontend affiche badge "Notation envoyée"
11. Livreur rafraîchit son profil
12. Voit sa note moyenne mise à jour
13. Propriétaire rafraîchit son profil
14. Voit note de sa pharmacie mise à jour
EOF
echo ""
echo ""

# 8. Commandes pratiques
echo -e "${YELLOW}[COMMANDES UTILES]${NC}"
echo ""

echo "A. Lister toutes les ratings livreur #2:"
cat << 'EOF'
curl http://localhost:3000/api/ratings/livreur/2 | jq .
EOF
echo ""

echo "B. Compter nombre de ratings livreur #2:"
cat << 'EOF'
curl http://localhost:3000/api/ratings/livreur/2 | jq '.average.count'
EOF
echo ""

echo "C. Voir note moyenne livreur #2:"
cat << 'EOF'
curl http://localhost:3000/api/ratings/livreur/2 | jq '.average.average'
EOF
echo ""

echo "D. Voir tous les commentaires pour pharmacie #3:"
cat << 'EOF'
curl http://localhost:3000/api/ratings/pharmacie/3 | jq '.ratings[].reviewPharmacie'
EOF
echo ""

echo "E. Créer 3 ratings d'exemple (remplacer TOKEN):"
cat << 'EOF'
TOKEN="your-jwt-token"

# Rating 1: 5 étoiles
curl -X POST http://localhost:3000/api/ratings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"patientId": 1, "livreurId": 2, "pharmacieId": 3, "ratingLivreur": 5, "ratingPharmacie": 5, "reviewLivreur": "Excellent!", "reviewPharmacie": "Très bien!"}'

# Rating 2: 4 étoiles
curl -X POST http://localhost:3000/api/ratings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"patientId": 2, "livreurId": 2, "pharmacieId": 3, "ratingLivreur": 4, "ratingPharmacie": 4}'

# Rating 3: 3 étoiles
curl -X POST http://localhost:3000/api/ratings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"patientId": 3, "livreurId": 2, "pharmacieId": 3, "ratingLivreur": 3, "ratingPharmacie": 3}'
EOF
echo ""
echo ""

# 9. Vérification DB
echo -e "${YELLOW}[VÉRIFICATION DB]${NC}"
echo ""
echo "Pour vérifier directement la BD SQLite:"
cat << 'EOF'
# Voir toutes les ratings
sqlite3 backend/pharmalink.sqlite "SELECT * FROM ratings;"

# Voir moyenne livreur #2
sqlite3 backend/pharmalink.sqlite "SELECT AVG(ratingLivreur) as avg, COUNT(*) as count FROM ratings WHERE livreurId = 2;"

# Voir moyenne pharmacie #3
sqlite3 backend/pharmalink.sqlite "SELECT AVG(ratingPharmacie) as avg, COUNT(*) as count FROM ratings WHERE pharmacieId = 3;"

# Voir ratings d'un patient
sqlite3 backend/pharmalink.sqlite "SELECT * FROM ratings WHERE patientId = 1;"
EOF
echo ""
echo ""

echo -e "${GREEN}=========================================="
echo "  ✓ Tests Terminés"
echo "==========================================${NC}"
