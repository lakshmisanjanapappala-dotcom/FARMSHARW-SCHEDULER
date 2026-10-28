import { Auth } from '../auth.js';
import { I18n } from '../i18n.js';

export function renderHeader() {
  const headerContainer = document.getElementById('site-header');
  if (!headerContainer) return;

  const user = Auth.getUser();
  const isLoggedIn = Auth.isLoggedIn();
  const currentPath = window.location.pathname;
  const currentLang = I18n.getLanguage();

  const isAdmin = user?.roles?.includes('admin');

  headerContainer.className = 'site-header';
  headerContainer.innerHTML = `
    <div class="container nav-container">
      <a href="/" class="brand">
        <span class="brand-icon">🌾</span>
        <div>
          <span class="brand-text">FarmSharw</span>
          <span class="brand-tagline">Scheduler & Exchange</span>
        </div>
      </a>

      <ul class="nav-links" id="nav-menu">
        <li><a href="/equipment.html" class="nav-link ${currentPath.includes('equipment') && !currentPath.includes('add') ? 'active' : ''}">Find Equipment</a></li>
        <li><a href="/how-it-works.html" class="nav-link ${currentPath.includes('how-it-works') ? 'active' : ''}">How It Works</a></li>
        <li><a href="/exchanges.html" class="nav-link ${currentPath.includes('exchanges') ? 'active' : ''}">Idle-Time Exchange</a></li>
        <li><a href="/pricing.html" class="nav-link ${currentPath.includes('pricing') ? 'active' : ''}">Pricing & GST</a></li>
        ${isLoggedIn ? `
          <li><a href="/dashboard.html" class="nav-link ${currentPath.includes('dashboard') ? 'active' : ''}">Dashboard</a></li>
          <li><a href="/bookings.html" class="nav-link ${currentPath.includes('bookings') ? 'active' : ''}">My Bookings</a></li>
          <li><a href="/messages.html" class="nav-link ${currentPath.includes('messages') ? 'active' : ''}">Messages</a></li>
          ${isAdmin ? `<li><a href="/admin.html" class="nav-link ${currentPath.includes('admin') ? 'active' : ''}" style="color:var(--color-secondary); font-weight:bold;">Admin</a></li>` : ''}
        ` : ''}
      </ul>

      <div class="nav-actions">
        <!-- Language Selector -->
        <select id="lang-select" class="lang-selector" aria-label="Select regional language">
          <option value="en" ${currentLang === 'en' ? 'selected' : ''}>English</option>
          <option value="te" ${currentLang === 'te' ? 'selected' : ''}>తెలుగు (Telugu)</option>
          <option value="hi" ${currentLang === 'hi' ? 'selected' : ''}>हिन्दी (Hindi)</option>
          <option value="ta" ${currentLang === 'ta' ? 'selected' : ''}>தமிழ் (Tamil)</option>
          <option value="kn" ${currentLang === 'kn' ? 'selected' : ''}>ಕನ್ನಡ (Kannada)</option>
          <option value="mr" ${currentLang === 'mr' ? 'selected' : ''}>मराठी (Marathi)</option>
        </select>

        ${isLoggedIn ? `
          <a href="/add-equipment.html" class="btn btn-secondary btn-sm">+ List Machine</a>
          <a href="/profile.html" class="btn btn-outline btn-sm">👤 ${user.profile?.full_name?.split(' ')[0] || 'Profile'}</a>
          <button id="logout-btn" class="btn btn-sm" style="background:#f1ece1; border:1px solid #d4cdbf; color:#555;">Logout</button>
        ` : `
          <a href="/login.html" class="btn btn-outline btn-sm">Login</a>
          <a href="/register.html" class="btn btn-primary btn-sm">Join FarmSharw</a>
        `}

        <button class="mobile-menu-btn" id="mobile-toggle" aria-label="Toggle navigation menu">☰</button>
      </div>
    </div>
  `;

  // Event Listeners
  const langSelect = document.getElementById('lang-select');
  if (langSelect) {
    langSelect.addEventListener('change', (e) => {
      I18n.setLanguage(e.target.value);
    });
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      Auth.logout();
    });
  }

  const mobileToggle = document.getElementById('mobile-toggle');
  const navMenu = document.getElementById('nav-menu');
  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
    });
  }

  I18n.translatePage();
}

