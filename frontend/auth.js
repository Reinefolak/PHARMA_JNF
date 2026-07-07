/**
 * auth.js - Gestion de l'authentification côté client (localStorage)
 * Utilisé par toutes les pages du site PharmaLink Pro
 */

const AUTH_KEY = 'pharmalink_user';
const AUTH_TOKEN_KEY = 'pharmalink_token';

const Auth = {
  /**
   * Sauvegarder l'utilisateur connecté dans localStorage
   */
  setUser(user, token = null) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  },

  /**
   * Récupérer l'utilisateur connecté
   * @returns {Object|null}
   */
  getUser() {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  /**
   * Vérifier si un utilisateur est connecté
   */
  isLoggedIn() {
    return this.getUser() !== null && !!this.getToken();
  },

  getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },

  getAuthHeaders(extra = {}) {
    const token = this.getToken();
    return {
      ...extra,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  },

  async authFetch(url, options = {}) {
    const headers = this.getAuthHeaders(options.headers || {});
    return fetch(url, { ...options, headers });
  },

  /**
   * Déconnecter l'utilisateur (supprimer la session)
   */
  logout() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    window.location.href = 'login.html';
  },

  /**
   * Supprimer le compte (désincription) - appel API + déconnexion
   */
  async deleteAccount() {
    const user = this.getUser();
    if (!user) return;

    const confirmed = confirm('Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.');
    if (!confirmed) return;

    try {
      const resp = await this.authFetch(`/api/user/${user.id}`, { method: 'DELETE' });
      const data = await resp.json();
      if (data.success) {
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(AUTH_TOKEN_KEY);
        alert('Votre compte a bien été supprimé.');
        window.location.href = 'index.html';
      } else {
        alert('Erreur lors de la suppression : ' + data.message);
      }
    } catch (err) {
      alert('Erreur réseau. Veuillez réessayer.');
    }
  },

  /**
   * Protéger une page : redirige vers login si non connecté.
   * @param {string|null} requiredRole - rôle requis (ou null pour tout rôle)
   */
  requireAuth(requiredRole = null) {
    const user = this.getUser();
    const token = this.getToken();
    if (!user || !token) {
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      window.location.href = 'login.html';
      return null;
    }
    if (requiredRole && user.role !== requiredRole) {
      // Rediriger vers la bonne page selon le rôle
      Auth.redirectByRole(user.role);
      return null;
    }
    return user;
  },

  /**
   * Rediriger vers la page d'accueil selon le rôle
   */
  redirectByRole(role) {
    const pages = {
      patient: 'patient.html',
      livreur: 'livreur.html',
      proprietaire: 'proprietaire.html'
    };
    const page = pages[role] || 'login.html';
    window.location.href = page;
  }
};

// --- PWA: Offline Background Sync ---
window.OfflineSync = {
  queueName: 'pharmalink_offline_actions',
  
  saveAction(actionData) {
    let queue = JSON.parse(localStorage.getItem(this.queueName)) || [];
    queue.push({
      ...actionData,
      timestamp: new Date().getTime()
    });
    localStorage.setItem(this.queueName, JSON.stringify(queue));
    console.log('[Offline Sync] Action enregistrée hors-ligne:', actionData);
    this.showOfflineToast();
  },

  async syncActions() {
    let queue = JSON.parse(localStorage.getItem(this.queueName)) || [];
    if (queue.length === 0) return;

    console.log('[Offline Sync] Synchronisation de', queue.length, 'actions...');
    let failedActions = [];

    for (let action of queue) {
      try {
        const response = await fetch(action.url, {
          method: action.method || 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.body)
        });
        
        if (!response.ok) throw new Error('Erreur réseau lors de la synchro');
        console.log('[Offline Sync] Action synchronisée avec succès:', action);
      } catch (err) {
        console.warn('[Offline Sync] Échec de la synchro pour une action, sera réessayée plus tard.', err);
        failedActions.push(action);
      }
    }

    localStorage.setItem(this.queueName, JSON.stringify(failedActions));
    if (failedActions.length === 0) {
      this.showOnlineToast('Toutes vos modifications hors-ligne ont été synchronisées.');
    } else {
      this.showOnlineToast(`${failedActions.length} actions n'ont pas pu être synchronisées.`);
    }
  },

  showOfflineToast() {
    const existing = document.getElementById('offline-sync-toast');
    if (existing) return;
    const toast = document.createElement('div');
    toast.id = 'offline-sync-toast';
    toast.className = 'fixed bottom-4 right-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded shadow-lg z-50 flex items-center gap-3 animate-fade-in-up';
    toast.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                       <div>
                         <p class="font-bold">Vous êtes hors-ligne</p>
                         <p class="text-sm">Vos actions sont sauvegardées et seront envoyées au retour de la connexion.</p>
                       </div>`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 5000);
  },

  showOnlineToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-lg z-50 flex items-center gap-3 animate-fade-in-up';
    toast.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                       <div>
                         <p class="font-bold">Connexion rétablie</p>
                         <p class="text-sm">${message}</p>
                       </div>`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 5000);
  }
};

window.addEventListener('online', () => {
  window.OfflineSync.syncActions();
});

// --- PWA: Service Worker Registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((registration) => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
      // Optional: Background Sync API si supporté (pour les PWA sur Chrome/Android)
      if ('sync' in registration) {
        window.addEventListener('online', () => {
          registration.sync.register('pharmalink-sync').catch(err => console.log('Sync registration failed', err));
        });
      }
    }, (err) => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}
