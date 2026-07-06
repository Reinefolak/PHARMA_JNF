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
