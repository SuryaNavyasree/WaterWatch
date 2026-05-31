// WaterWatch API Base URL Configuration
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '5000'
  ? 'http://localhost:5000/api'
  : window.location.origin + '/api';

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

// Convert ISO DateTime to local readable string
function formatDateTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

// Perform Complaint Lookup by ID
async function trackComplaint(displayId) {
  const resultSection = document.getElementById('trackResultSection');
  const errorSection = document.getElementById('trackErrorSection');
  
  resultSection.style.display = 'none';
  errorSection.style.display = 'none';

  // Sanitize and extract integer ID (e.g. "WW-00042" -> 42)
  let cleanId = displayId.trim().toUpperCase();
  if (cleanId.startsWith('WW-')) {
    cleanId = cleanId.substring(3);
  }

  const intId = parseInt(cleanId, 10);
  if (isNaN(intId) || intId <= 0) {
    showToast("Invalid Ticket ID format. Ensure it looks like WW-00042", "danger");
    errorSection.style.display = 'block';
    document.getElementById('errorMessage').textContent = "Ticket ID must contain a valid number (e.g., WW-00042 or 42).";
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/complaints/${intId}`);
    const data = await res.json();

    if (res.status === 200) {
      // Success! Populate details card
      document.getElementById('resultTitle').textContent = data.title;
      document.getElementById('resultId').textContent = data.display_id;
      document.getElementById('resultAddress').textContent = `📍 ${data.address}`;
      document.getElementById('resultDesc').textContent = data.description;

      // Types & Severity badges
      const tBadge = document.getElementById('resultTypeBadge');
      tBadge.className = `badge badge-${data.issue_type}`;
      tBadge.textContent = data.issue_type;

      const sBadge = document.getElementById('resultSeverityBadge');
      sBadge.className = `badge badge-${data.severity}`;
      sBadge.textContent = data.severity;

      // Reset stepper classes
      const steps = ['reported', 'under_review', 'in_progress', 'resolved'];
      steps.forEach(s => {
        const el = document.getElementById(`step-${s}`);
        el.classList.remove('active', 'completed');
      });

      // Bind Dates and Stepper highlighting
      const statusIndex = steps.indexOf(data.status);
      
      // Step 1: Reported (Always completed)
      const reportedStep = document.getElementById('step-reported');
      const reportedDate = document.getElementById('date-reported');
      reportedDate.textContent = `Reported on ${formatDateTime(data.created_at)}`;
      
      // Process stepper states based on status index
      steps.forEach((step, index) => {
        const stepEl = document.getElementById(`step-${step}`);
        const dateEl = document.getElementById(`date-${step}`);

        if (index < statusIndex) {
          // Completed steps
          stepEl.classList.add('completed');
        } else if (index === statusIndex) {
          // Current step is active (pulsing)
          stepEl.classList.add('active');
          if (step === 'resolved') {
            stepEl.classList.remove('active');
            stepEl.classList.add('completed');
            dateEl.textContent = `Resolved on ${formatDateTime(data.updated_at)}`;
          } else if (step === 'under_review') {
            dateEl.textContent = `Updated on ${formatDateTime(data.updated_at)}`;
          } else if (step === 'in_progress') {
            dateEl.textContent = `Dispatched on ${formatDateTime(data.updated_at)}`;
          }
        } else {
          // Future pending steps
          if (step === 'under_review') dateEl.textContent = 'Pending field inspection';
          if (step === 'in_progress') dateEl.textContent = 'Pending technician crew assignment';
          if (step === 'resolved') dateEl.textContent = 'Pending repair and closure';
        }
      });

      // Handle Authority Note
      const authSection = document.getElementById('authorityNoteSection');
      if (data.authority_note) {
        authSection.style.display = 'block';
        document.getElementById('resultAuthorityNote').textContent = data.authority_note;
      } else {
        authSection.style.display = 'none';
      }

      // Display result block
      resultSection.style.display = 'block';
      showToast("Ticket found! Displaying status details.", "success");

      // Smooth scroll to results
      setTimeout(() => {
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

    } else {
      // 404 or backend error
      errorSection.style.display = 'block';
      document.getElementById('errorMessage').textContent = data.error || "The ticket could not be found. Please double check the ID number.";
      showToast(data.error || "Ticket not found.", "danger");
    }
  } catch (err) {
    console.error("Tracking lookup error:", err);
    showToast("Server connection error. Ensure Flask backend is running.", "danger");
    errorSection.style.display = 'block';
    document.getElementById('errorMessage').textContent = "Cannot connect to server. Ensure Flask backend is running on port 5000.";
  }
}

// Window Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('trackerSearchForm');
  const input = document.getElementById('trackInput');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (query) {
      trackComplaint(query);
    }
  });

  // Read URL query parameters (e.g. track.html?id=WW-00042)
  const urlParams = new URLSearchParams(window.location.search);
  const ticketId = urlParams.get('id');
  if (ticketId) {
    input.value = ticketId;
    trackComplaint(ticketId);
  }
});
