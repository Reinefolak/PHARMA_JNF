@echo off
chcp 65001 >nul
title PHARMA JNF - Démarrage

echo.
echo ============================================
echo        PHARMA JNF - Démarrage
echo ============================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERREUR] Node.js n'est pas installé.
    echo.
    echo   Télécharge et installe Node.js depuis :
    echo   ^>^>  https://nodejs.org
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo [OK] Node.js détecté : %NODE_VERSION%

where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERREUR] npm n'est pas installé.
    echo   Réinstalle Node.js depuis https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('npm -v') do set NPM_VERSION=%%v
echo [OK] npm détecté : v%NPM_VERSION%

set SCRIPT_DIR=%~dp0
set BACKEND_DIR=%SCRIPT_DIR%backend

if not exist "%BACKEND_DIR%" (
    echo [ERREUR] Le dossier 'backend' est introuvable.
    echo   Assure-toi que ce script est à la racine du projet PHARMA_JNF.
    pause
    exit /b 1
)

echo [OK] Dossier backend trouvé.
cd /d "%BACKEND_DIR%"

if not exist "node_modules" (
    echo.
    echo [INFO] Installation des dépendances npm...
    npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERREUR] npm install a échoué.
        pause
        exit /b 1
    )
    echo [OK] Dépendances installées.
) else (
    echo [OK] Dépendances déjà installées.
)

if not exist "data.json" (
    echo {"clients": [], "pharmacies": []} > data.json
    echo [OK] Fichier data.json créé.
)

echo.
echo --------------------------------------------
echo   Serveur en démarrage...
echo --------------------------------------------
echo.
echo   Accède au site ici ^>^>  http://localhost:3000
echo.
echo   (Ferme cette fenetre pour arreter le serveur)
echo.

node server.js

pause
