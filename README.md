# PHARMA JNF – Guide de lancement

## Prérequis

Installe **Node.js** (inclut npm automatiquement) :
https://nodejs.org *(prends la version LTS)*


## Structure du projet

PHARMA_JNF/
├── start.sh          ← Script de lancement (Linux/Mac)
├── start.bat         ← Script de lancement (Windows)
├── README.md         ← Ce fichier
└── backend/
    ├── server.js
    ├── package.json
    ├── data.json      (créé automatiquement au premier lancement)
    └── frontend/
        ├── c.html
        ├── i.html
        └── script.js

## Lancement

### Sur Linux / Mac

chmod +x start.sh

# Lancer le site
./start.sh

### Sur Windows
Double-clique sur **`start.bat`**

## Accéder au site

Une fois le serveur lancé, ouvre ton navigateur et va sur :

http://localhost:3000


## Arrêter le serveur

- **Linux/Mac** : `CTRL + C` dans le terminal
- **Windows** : Ferme la fenêtre de commande


## En cas de problème

| Erreur | Solution |
|--------|----------|
| `Node.js n'est pas installé` | Installe depuis https://nodejs.org |
| `Port 3000 déjà utilisé` | Le script propose de libérer le port automatiquement |
| `Cannot find module 'express'` | Lance `npm install` dans le dossier `backend/` |
| Page blanche dans le navigateur | Vérifie que le serveur affiche bien ` Serveur en ligne` |