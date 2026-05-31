// WaterWatch API Base URL Configuration
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '5000'
  ? 'http://localhost:5000/api'
  : window.location.origin + '/api';

let map;
let marker;
const defaultCoords = [12.9716, 77.5946]; // Bangalore center

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
  
  // Slide out and remove
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Initialize Leaflet Mini-Map
function initMiniMap() {
  // Init map centering on Bangalore default
  map = L.map('minimap', {
    center: defaultCoords,
    zoom: 13,
    zoomControl: true
  });

  // Load OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Add Draggable Marker
  marker = L.marker(defaultCoords, {
    draggable: true
  }).addTo(map);

  // Update input values on map drag
  marker.on('dragend', function (e) {
    const coords = marker.getLatLng();
    updateCoordsInput(coords.lat, coords.lng);
    reverseGeocode(coords.lat, coords.lng);
  });

  // Pre-fill inputs with defaults
  updateCoordsInput(defaultCoords[0], defaultCoords[1]);
  reverseGeocode(defaultCoords[0], defaultCoords[1]);
}

function updateCoordsInput(lat, lng) {
  document.getElementById('latitude').value = lat.toFixed(6);
  document.getElementById('longitude').value = lng.toFixed(6);
}

// Reverse Geocoding via OpenStreetMap Nominatim API
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        document.getElementById('address').value = data.display_name;
      }
    }
  } catch (err) {
    console.error("Reverse geocoding error:", err);
  }
}

// Geolocation Handling
async function handleGeolocation() {
  if (!navigator.geolocation) {
    showToast("Geolocation is not supported by your browser.", "warning");
    return;
  }

  const geoBtn = document.getElementById('geoBtn');
  geoBtn.disabled = true;
  geoBtn.innerHTML = 'Detecting...';

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      
      // Update fields
      updateCoordsInput(latitude, longitude);
      
      // Set map focus
      const newLatLng = new L.LatLng(latitude, longitude);
      marker.setLatLng(newLatLng);
      map.setView(newLatLng, 15);
      
      // Reverse geocode
      await reverseGeocode(latitude, longitude);
      
      geoBtn.disabled = false;
      geoBtn.innerHTML = 'Detect My Location';
      showToast("Location successfully detected!", "success");
    },
    (error) => {
      console.warn("Geolocation warning:", error.message);
      showToast("Could not retrieve GPS coordinates. Please select manually on the map.", "warning");
      geoBtn.disabled = false;
      geoBtn.innerHTML = 'Detect My Location';
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// Validate Form Client-side
function validateForm() {
  const issueType = document.getElementById('issueType').value;
  const severityRadio = document.querySelector('input[name="severity"]:checked');
  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();
  const latitude = document.getElementById('latitude').value;
  const longitude = document.getElementById('longitude').value;
  const address = document.getElementById('address').value.trim();
  const email = document.getElementById('reporterEmail').value.trim();

  if (!issueType) {
    showToast("Please choose an issue category.", "danger");
    return false;
  }
  if (!severityRadio) {
    showToast("Please select a severity level.", "danger");
    return false;
  }
  if (!title) {
    showToast("Please summarize the water issue.", "danger");
    return false;
  }
  if (title.length > 100) {
    showToast("Summary must not exceed 100 characters.", "danger");
    return false;
  }
  if (!description || description.length < 30) {
    showToast("Please write a description (minimum 30 characters).", "danger");
    return false;
  }
  if (!latitude || !longitude) {
    showToast("Please select a valid coordinates position on the map.", "danger");
    return false;
  }
  if (!address) {
    showToast("A physical address description is required.", "danger");
    return false;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast("Please enter a valid email address.", "danger");
    return false;
  }

  return true;
}

// Asynchronously POST complaint
async function postComplaint(bypassDuplicate = false) {
  const issueType = document.getElementById('issueType').value;
  const severity = document.querySelector('input[name="severity"]:checked').value;
  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();
  const latitude = parseFloat(document.getElementById('latitude').value);
  const longitude = parseFloat(document.getElementById('longitude').value);
  const address = document.getElementById('address').value.trim();
  const reporterName = document.getElementById('reporterName').value.trim();
  const reporterEmail = document.getElementById('reporterEmail').value.trim();

  const payload = {
    title,
    description,
    issue_type: issueType,
    severity,
    latitude,
    longitude,
    address,
    reporter_name: reporterName || null,
    reporter_email: reporterEmail || null,
    bypass_duplicate: bypassDuplicate
  };

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Submitting...';

  try {
    const response = await fetch(`${API_BASE_URL}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.status === 201) {
      // Success! Open Success Modal
      document.getElementById('ticketIdDisplay').textContent = data.display_id;
      document.getElementById('trackTicketLink').href = `track.html?id=${data.display_id}`;
      
      const successModal = document.getElementById('successModal');
      successModal.classList.add('open');
      
      // Reset form
      document.getElementById('complaintForm').reset();
      marker.setLatLng(defaultCoords);
      map.setView(defaultCoords, 13);
      updateCoordsInput(defaultCoords[0], defaultCoords[1]);
      reverseGeocode(defaultCoords[0], defaultCoords[1]);
      showToast("Complaint submitted successfully!", "success");
    } 
    else if (response.status === 409 && data.duplicate_found) {
      // Proximity duplicate detected. Pop up Duplicate Modal.
      const dup = data.complaint;
      document.getElementById('dupId').textContent = dup.display_id;
      document.getElementById('dupTitle').textContent = dup.title;
      document.getElementById('dupDesc').textContent = dup.description.substring(0, 120) + '...';
      
      // Badges
      const dType = document.getElementById('dupType');
      dType.className = `badge badge-${dup.issue_type}`;
      dType.textContent = dup.issue_type;

      const dStatus = document.getElementById('dupStatus');
      dStatus.className = `badge badge-${dup.status}`;
      dStatus.textContent = dup.status.replace('_', ' ');

      const dSeverity = document.getElementById('dupSeverity');
      dSeverity.className = `badge badge-${dup.severity}`;
      dSeverity.textContent = dup.severity;

      // Track button
      document.getElementById('dupTrackLink').href = `track.html?id=${dup.display_id}`;
      
      // Open modal
      const duplicateModal = document.getElementById('duplicateModal');
      duplicateModal.classList.add('open');
    } 
    else {
      // Backend error returned
      showToast(data.error || "Submission failed. Please check inputs.", "danger");
    }
  } catch (err) {
    console.error("Submission fetch error:", err);
    showToast("Cannot connect to server. Ensure Flask backend is running on port 5000.", "danger");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `
      <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right: 0.25rem;">
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path>
      </svg>
      Submit Complaint
    `;
  }
}

// Window Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Init Map
  initMiniMap();

  // Pre-fill reporter profile from active session (auth.js integration)
  const sessionName = sessionStorage.getItem('username');
  const sessionEmail = sessionStorage.getItem('email');
  if (sessionName && sessionStorage.getItem('role') === 'citizen') {
    document.getElementById('reporterName').value = sessionName;
  }
  if (sessionEmail) {
    document.getElementById('reporterEmail').value = sessionEmail;
  }

  // Geolocation trigger
  document.getElementById('geoBtn').addEventListener('click', handleGeolocation);

  // Form submission intercept
  document.getElementById('complaintForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (validateForm()) {
      postComplaint(false); // First attempt checks for duplicates
    }
  });

  // Modal Closures
  document.getElementById('closeSuccessBtn').addEventListener('click', () => {
    document.getElementById('successModal').classList.remove('open');
  });

  document.getElementById('closeDuplicateBtn').addEventListener('click', () => {
    document.getElementById('duplicateModal').classList.remove('open');
  });

  // Force Submission Bypass
  document.getElementById('forceSubmitBtn').addEventListener('click', () => {
    document.getElementById('duplicateModal').classList.remove('open');
    postComplaint(true); // Re-POST with bypass_duplicate = true
  });
});
