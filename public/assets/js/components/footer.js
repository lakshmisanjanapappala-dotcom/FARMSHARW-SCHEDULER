import { CONFIG } from '../config.js';

export function renderFooter() {
  const footerContainer = document.getElementById('site-footer');
  if (!footerContainer) return;

  footerContainer.className = 'site-footer';
  footerContainer.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px;">
            <span style="font-size:2rem;">🌾</span>
            <span style="font-family:var(--font-family-heading); font-size:1.5rem; color:#fff; font-weight:bold;">FarmSharw Scheduler</span>
          </div>
          <p style="margin-bottom:16px;">
            India's dedicated agricultural equipment sharing marketplace and idle-time exchange platform. Turning idle farm machinery into accessible rural productivity.
          </p>
          <p style="font-size:0.85rem; color:#a2bdb2;">
            <strong>Kisan Sahayata Helpline:</strong><br>
            📞 ${CONFIG.SUPPORT_PHONE} (Toll-Free, 7am - 9pm)<br>
            ✉️ ${CONFIG.SUPPORT_EMAIL}
          </p>
        </div>

        <div>
          <h5>Marketplace</h5>
          <ul style="list-style:none;">
            <li><a href="/equipment.html?category=tractors">Utility Tractors</a></li>
            <li><a href="/equipment.html?category=rotavators">Rotavators & Tillers</a></li>
            <li><a href="/equipment.html?category=harvesters">Combine Harvesters</a></li>
            <li><a href="/equipment.html?category=irrigation-pumps">Irrigation Pumps</a></li>
            <li><a href="/equipment.html">All Farm Implements</a></li>
            <li><a href="/add-equipment.html">List Your Machinery</a></li>
          </ul>
        </div>

        <div>
          <h5>Platform</h5>
          <ul style="list-style:none;">
            <li><a href="/how-it-works.html">How It Works</a></li>
            <li><a href="/exchanges.html">Idle-Time Exchange Model</a></li>
            <li><a href="/pricing.html">Pricing, GST & Fees</a></li>
            <li><a href="/about.html">About & Kisan Trust</a></li>
            <li><a href="/faq.html">Farmer FAQs</a></li>
          </ul>
        </div>

        <div>
          <h5>Trust, Safety & Policies</h5>
          <ul style="list-style:none;">
            <li><a href="/policies.html#terms">Terms of Service</a></li>
            <li><a href="/policies.html#privacy">Privacy & Geodata Policy</a></li>
            <li><a href="/policies.html#cancellation">Cancellation & Refund Rules</a></li>
            <li><a href="/policies.html#dispute">Dispute Resolution Procedure</a></li>
            <li><a href="/profile.html">Kisan KYC Verification</a></li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <div>
          © ${new Date().getFullYear()} FarmSharw Scheduler India. All rights reserved. Built with semantic HTML, CSS & vanilla JS.
        </div>
        <div style="display:flex; gap:16px;">
          <span>🇮🇳 Made for Indian Agriculture</span>
          <span>🔒 Supabase RLS & Auth Protected</span>
        </div>
      </div>
    </div>
  `;
}

