// WaterWatch Shared Auth Gatekeeper & Dynamic Navbar Injector

(function() {
  const role = sessionStorage.getItem('role');
  const path = window.location.pathname;
  const isLoginPage = path.includes('login.html');

  // 1. Enforce Page-level Session Boundaries (Synchronous check inside <head>)
  if (!role && !isLoginPage) {
    // Redirect unauthenticated traffic to Login Portal
    window.location.href = 'login.html';
    return;
  }

  if (role) {
    if (isLoginPage) {
      // If already logged in, skip login page
      window.location.href = role === 'admin' ? 'dashboard.html' : 'index.html';
      return;
    }

    if (role === 'citizen' && path.includes('dashboard.html')) {
      // Prevent citizens from entering municipal controls
      window.location.href = 'index.html';
      return;
    }
  }
})();

// 2. Dynamic Dynamic Navbar Renderer (Runs on DOMContentLoaded)
document.addEventListener('DOMContentLoaded', () => {
  const role = sessionStorage.getItem('role');
  const username = sessionStorage.getItem('username') || 'Citizen';
  const headerNode = document.getElementById('globalHeader');
  
  if (!headerNode || !role) return;

  const path = window.location.pathname;
  const isHomeActive = path.includes('index.html') || path.endsWith('/frontend/') || path.endsWith('/waterwatch/');
  const isMapActive = path.includes('map.html');
  const isTrackActive = path.includes('track.html');
  const isDashActive = path.includes('dashboard.html');

  let navLinksHtml = '';

  if (role === 'citizen') {
    navLinksHtml = `
      <li class="${isHomeActive ? 'active' : ''}"><a href="index.html">Home</a></li>
      <li class="${isMapActive ? 'active' : ''}"><a href="map.html">Interactive Map</a></li>
      <li class="${isTrackActive ? 'active' : ''}"><a href="track.html">Track Complaint</a></li>
    `;
  } else if (role === 'admin') {
    navLinksHtml = `
      <li class="${isDashActive ? 'active' : ''}"><a href="dashboard.html">Dashboard</a></li>
      <li class="${isMapActive ? 'active' : ''}"><a href="map.html">Interactive Map</a></li>
    `;
  }

  // Inject beautiful, unified navbar with custom greeting and logout buttons
  headerNode.innerHTML = `
    <div class="nav-container">
      <a href="${role === 'admin' ? 'dashboard.html' : 'index.html'}" class="logo">
        <svg viewBox="0 0 24 24">
          <path d="M12,2C12,2 6,8.8 6,13C6,16.3 8.7,19 12,19C15.3,19 18,16.3 18,13C18,8.8 12,2 12,2ZM12,17C9.8,17 8,15.2 8,13C8,11.2 9.5,8.8 12,5.6C14.5,8.8 16,11.2 16,13C16,15.2 14.2,17 12,17Z"/>
        </svg>
        WaterWatch
      </a>
      <ul class="nav-links">
        ${navLinksHtml}
        <li style="display: flex; align-items: center; gap: 0.75rem; border-left: 1px solid var(--border); padding-left: 1.5rem; margin-left: 0.5rem;">
          <span style="font-weight: 700; font-size: 0.85rem; color: var(--primary-dark); display: flex; align-items: center; gap: 0.35rem; white-space: nowrap;">
            ${role === 'admin' ? '🛠️' : '👤'} ${username}
          </span>
          <button id="logoutBtn" class="btn btn-secondary" style="padding: 0.4rem 0.9rem; font-size: 0.8rem; border-radius: var(--radius-full); font-weight: 700;">
            Logout
          </button>
        </li>
      </ul>
    </div>
  `;

  // Attach logout handler
  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.clear();
    window.location.href = 'login.html';
  });
});
