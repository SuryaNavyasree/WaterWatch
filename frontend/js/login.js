// WaterWatch Login Controller

// Toast Utilities
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = '✓';
  if (type === 'danger') icon = '✕';
  if (type === 'warning') icon = '⚠';

  toast.innerHTML = `
    <span style="font-size: 1.1rem;">${icon}</span>
    <div>${message}</div>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

document.addEventListener('DOMContentLoaded', () => {
  const tabCitizen = document.getElementById('tabCitizen');
  const tabAdmin = document.getElementById('tabAdmin');
  
  const citizenForm = document.getElementById('citizenForm');
  const adminForm = document.getElementById('adminForm');
  
  const loginError = document.getElementById('loginError');

  // Tab switching logic
  tabCitizen.addEventListener('click', () => {
    tabCitizen.classList.add('active');
    tabAdmin.classList.remove('active');
    
    citizenForm.style.display = 'flex';
    adminForm.style.display = 'none';
    
    loginError.style.display = 'none';
  });

  tabAdmin.addEventListener('click', () => {
    tabAdmin.classList.add('active');
    tabCitizen.classList.remove('active');
    
    adminForm.style.display = 'flex';
    citizenForm.style.display = 'none';
    
    loginError.style.display = 'none';
  });

  // Form 1: Citizen Login Submit Handler
  citizenForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const name = document.getElementById('citizenName').value.trim();
    const email = document.getElementById('citizenEmail').value.trim();

    if (!name) {
      showToast("Please enter your name.", "danger");
      return;
    }

    // Save profile attributes to SessionStorage
    sessionStorage.setItem('role', 'citizen');
    sessionStorage.setItem('username', name);
    sessionStorage.setItem('email', email);

    showToast(`Welcome ${name}! Logging in...`, "success");
    
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 800);
  });

  // Form 2: Admin Login Submit Handler
  adminForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;

    loginError.style.display = 'none';

    // Simple robust credentials check (admin / admin123)
    if (username.toLowerCase() === 'admin' && password === 'admin123') {
      // Save Authority attributes to SessionStorage
      sessionStorage.setItem('role', 'admin');
      sessionStorage.setItem('username', 'Water Engineering Officer');

      showToast("Authority credentials verified. Logging in...", "success");
      
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 800);
    } else {
      loginError.style.display = 'block';
      loginError.textContent = "Invalid username or password credentials.";
      showToast("Failed authority authentication.", "danger");
    }
  });
});
