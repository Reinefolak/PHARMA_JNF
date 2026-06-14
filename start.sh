#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}        PHARMA JNF - Démarrage             ${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERREUR] Node.js n'est pas installé.${NC}"
    echo ""
    echo "  Télécharge et installe Node.js depuis :"
    echo "  https://nodejs.org"
    echo ""
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}[OK]${NC} Node.js détecté : $NODE_VERSION"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}[ERREUR] npm n'est pas installé.${NC}"
    echo "  npm est normalement inclus avec Node.js."
    echo "  Réinstalle Node.js depuis https://nodejs.org"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo -e "${GREEN}[OK]${NC} npm détecté : v$NPM_VERSION"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}[ERREUR] Le dossier 'backend' est introuvable.${NC}"
    echo "  Assure-toi que ce script est placé à la racine du projet PHARMA_JNF,"
    echo "  au même niveau que le dossier 'backend/'."
    exit 1
fi

echo -e "${GREEN}[OK]${NC} Dossier backend trouvé."

cd "$BACKEND_DIR"

if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
    echo ""
    echo -e "${YELLOW}[INFO]${NC} Installation des dépendances npm..."
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERREUR] npm install a échoué.${NC}"
        exit 1
    fi
    echo -e "${GREEN}[OK]${NC} Dépendances installées."
else
    echo -e "${GREEN}[OK]${NC} Dépendances déjà installées."
fi

if [ ! -f "data.json" ]; then
    echo '{"clients": [], "pharmacies": []}' > data.json
    echo -e "${GREEN}[OK]${NC} Fichier data.json créé."
fi

if command -v lsof &> /dev/null; then
    PORT_USED=$(lsof -ti:3000 2>/dev/null)
    if [ -n "$PORT_USED" ]; then
        echo ""
        echo -e "${YELLOW}[ATTENTION]${NC} Le port 3000 est déjà utilisé (PID: $PORT_USED)."
        echo -n "  Veux-tu arrêter le processus et continuer ? (o/n) : "
        read ANSWER
        if [[ "$ANSWER" == "o" || "$ANSWER" == "O" ]]; then
            kill -9 $PORT_USED 2>/dev/null
            sleep 1
            echo -e "${GREEN}[OK]${NC} Processus arrêté."
        else
            echo -e "${RED}[ANNULÉ]${NC} Lancement annulé. Libère le port 3000 manuellement."
            exit 1
        fi
    fi
fi

echo ""
echo -e "${CYAN}--------------------------------------------${NC}"
echo -e "${GREEN}  Serveur en démarrage...${NC}"
echo -e "${CYAN}--------------------------------------------${NC}"
echo ""
echo -e "  Accède au site ici   ${CYAN}http://localhost:3000${NC}"
echo ""
echo "  (Appuie sur CTRL+C pour arrêter le serveur)"
echo ""

node server.js
