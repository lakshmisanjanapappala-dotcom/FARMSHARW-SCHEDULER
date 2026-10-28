import { Api } from './api.js';

export class Auth {
  static getToken() {
    return localStorage.getItem('farmsharw_token') || null;
  }

  static getUser() {
    try {
      const userStr = localStorage.getItem('farmsharw_user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  static setSession(token, user) {
    if (token) localStorage.setItem('farmsharw_token', token);
    if (user) localStorage.setItem('farmsharw_user', JSON.stringify(user));
  }

  static clearSession() {
    localStorage.removeItem('farmsharw_token');
    localStorage.removeItem('farmsharw_user');
  }

  static isLoggedIn() {
    return Boolean(this.getToken());
  }

  static async fetchCurrentUser() {
    if (!this.isLoggedIn()) return null;
    try {
      const res = await Api.get('/me');
      if (res.success && res.data.user) {
        localStorage.setItem('farmsharw_user', JSON.stringify(res.data.user));
        return res.data.user;
      }
    } catch {
      this.clearSession();
      return null;
    }
  }

  static logout() {
    this.clearSession();
    window.location.href = '/login.html';
  }

  static requireAuth(requiredRoles = []) {
    if (!this.isLoggedIn()) {
      window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return false;
    }

    if (requiredRoles.length > 0) {
      const user = this.getUser();
      const roles = user?.roles || [];
      const hasRole = requiredRoles.some(r => roles.includes(r));
      if (!hasRole) {
        window.location.href = '/403.html';
        return false;
      }
    }
    return true;
  }
}

