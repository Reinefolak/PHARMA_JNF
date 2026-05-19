# Backend Pharmacie (Express + MySQL)

## Setup rapide

1. Copier .env et modifier si nécessaire.
2. Installer les dépendances :
   
   npm install
   
3. Créer la base MySQL (si pas déjà) :
   sql
   CREATE DATABASE epytodo;
   
4. Lancer le serveur :
   
   npm start
   
5. Initialiser les tables (optionnel) :
   - Client commandes: GET /client/init
   - Pharmacie stocks: GET /pharmacie/init

## Routes principales
- POST /client/commande  { nom_client, medicament, quantite }
- GET  /client/commandes
- POST /pharmacie/stock  { nom, quantite, prix }
- GET  /pharmacie/stocks
