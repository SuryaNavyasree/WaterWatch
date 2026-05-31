// WaterWatch API Base URL Configuration
const API_BASE_URL = window.location.origin.startsWith('file://') || window.location.hostname === ''
  ? 'http://localhost:10000/api'
  : (window.location.port === '3000' ? 'http://localhost:10000/api' : window.location.origin + '/api');

let map;
let markerClusterGroup;
let heatmapLayer;
let allComplaints = [];
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
  
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Get Color based on Issue Type
function getColorByType(type) {
  switch (type) {
    case 'leakage': return '#0284C7';       // Blue
    case 'contamination': return '#EF4444'; // Red
    case 'shortage': return '#F59E0B';      // Amber
    case 'pressure': return '#6B7280';      // Grey
    default: return '#8B5CF6';              // Purple
  }
}

// Create a highly visible, styled HTML DivIcon
function createMarkerIcon(type, severity) {
  const color = getColorByType(type);
  let pulseClass = '';
  let size = 18;
  let shadowSize = 28;
  
  if (severity === 'critical') {
    pulseClass = 'pulsing-marker';
    size = 22;
  } else if (severity === 'high') {
    size = 20;
  }

  // Div HTML with custom sizing and coloring
  const html = `
    <div style="position: relative; width: ${size}px; height: ${size}px;">
      ${severity === 'critical' ? `<div style="position: absolute; width: ${shadowSize}px; height: ${shadowSize}px; background-color: ${color}; border-radius: 50%; opacity: 0.25; top: -${(shadowSize-size)/2}px; left: -${(shadowSize-size)/2}px; animation: pulsePulse 1.8s infinite;"></div>` : ''}
      <div style="background-color: ${color}; width: ${size}px; height: ${size}px; border: 2.5px solid white; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.3); transition: transform 0.2s;"></div>
    </div>
  `;

  return L.divIcon({
    html: html,
    className: 'custom-map-marker',
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });
}

// Initialize Leaflet Map
function initMap() {
  map = L.map('mainMap', {
    center: defaultCoords,
    zoom: 12,
    doubleClickZoom: false // disable standard double click zoom to support geocoding redirections
  });

  // Load OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Initialize Marker Cluster Group
  markerClusterGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 40
  }).addTo(map);

  // Double Click empty spot triggers report
  map.on('dblclick', function(e) {
    const { lat, lng } = e.latlng;
    L.popup()
      .setLatLng(e.latlng)
      .setContent(`
        <div style="padding: 0.75rem; text-align: center; max-width: 200px;">
          <h4 style="margin-bottom: 0.5rem; font-family: 'Sora', sans-serif; font-size: 0.95rem; color: var(--primary-dark)">Report Water Issue?</h4>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.75rem;">Create a new report at this exact pin location.</p>
          <a href="index.html?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}" class="btn btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; border-radius: var(--radius-sm); width: 100%;">Report Here</a>
        </div>
      `)
      .openOn(map);
  });
}

// Fetch all complaints
async function fetchComplaints() {
  try {
    const res = await fetch(`${API_BASE_URL}/complaints?limit=200`);
    if (res.ok) {
      allComplaints = await res.json();
      renderMapElements();
    } else {
      showToast("Could not retrieve complaints from server.", "danger");
    }
  } catch (err) {
    console.error("Fetch complaints error:", err);
    showToast("Error connecting to backend API.", "danger");
  }
}

// Filters & Renders Markers & Heatmaps
function renderMapElements() {
  // Clear existing layers
  markerClusterGroup.clearLayers();
  if (heatmapLayer) {
    map.removeLayer(heatmapLayer);
  }

  // Get active filters from sidebar
  const searchQuery = document.getElementById('mapSearch').value.toLowerCase().trim();
  
  const selectedTypes = Array.from(document.querySelectorAll('input[name="typeFilter"]:checked')).map(cb => cb.value);
  const selectedSeverities = Array.from(document.querySelectorAll('input[name="severityFilter"]:checked')).map(cb => cb.value);
  const selectedStatuses = Array.from(document.querySelectorAll('input[name="statusFilter"]:checked')).map(cb => cb.value);
  
  const enableClusters = document.getElementById('clusterToggle').checked;
  const enableHeatmap = document.getElementById('heatmapToggle').checked;

  // Filter complaints
  const filtered = allComplaints.filter(c => {
    // Type Filter
    if (!selectedTypes.includes(c.issue_type)) return false;
    // Severity Filter
    if (!selectedSeverities.includes(c.severity)) return false;
    // Status Filter
    if (!selectedStatuses.includes(c.status)) return false;
    
    // Search Query (Matches display_id, title, description, address)
    if (searchQuery) {
      const matchText = `${c.display_id} ${c.title} ${c.description} ${c.address}`.toLowerCase();
      if (!matchText.includes(searchQuery)) return false;
    }
    return true;
  });

  // Array to collect coordinates for Heatmap
  const heatPoints = [];
  
  // Normal Marker Array (if clustering is disabled)
  const normalMarkers = [];

  filtered.forEach(c => {
    const latlng = [c.latitude, c.longitude];
    
    // Add to heatmap collection
    heatPoints.push([c.latitude, c.longitude, c.severity === 'critical' ? 1.0 : c.severity === 'high' ? 0.75 : 0.4]);

    // Create marker
    const icon = createMarkerIcon(c.issue_type, c.severity);
    const marker = L.marker(latlng, { icon: icon });

    // Popup card markup
    const statusText = c.status.replace('_', ' ');
    const createdDate = new Date(c.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const popupHtml = `
      <div class="popup-header">
        <h3 style="color: var(--primary-dark); font-family: 'Sora', sans-serif;">${c.title}</h3>
        <span style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--primary); font-size: 0.8rem;">${c.display_id}</span>
      </div>
      <div class="popup-body">
        <p class="popup-description">${c.description.substring(0, 80)}${c.description.length > 80 ? '...' : ''}</p>
        <p style="font-size: 0.75rem; font-weight: 700; color: var(--text);">📍 ${c.address}</p>
        <div class="popup-meta">
          <span class="badge badge-${c.issue_type}">${c.issue_type}</span>
          <span class="badge badge-${c.severity}">${c.severity}</span>
          <span class="badge badge-${c.status}">${statusText}</span>
        </div>
      </div>
      <div class="popup-footer">
        <a href="track.html?id=${c.display_id}" class="btn btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; border-radius: var(--radius-sm);">View Details & Track</a>
      </div>
    `;

    marker.bindPopup(popupHtml, { maxWidth: 300, minWidth: 260 });

    if (enableClusters) {
      markerClusterGroup.addLayer(marker);
    } else {
      marker.addTo(map);
      normalMarkers.push(marker);
    }
  });

  // Handle layer toggles
  if (enableClusters) {
    if (!map.hasLayer(markerClusterGroup)) {
      map.addLayer(markerClusterGroup);
    }
    // Remove individual markers if previously added
    map.eachLayer(layer => {
      if (layer instanceof L.Marker && layer !== markerClusterGroup && layer instanceof L.DivIcon) {
        map.removeLayer(layer);
      }
    });
  } else {
    if (map.hasLayer(markerClusterGroup)) {
      map.removeLayer(markerClusterGroup);
    }
  }

  // Draw Heatmap Overlay
  if (enableHeatmap) {
    heatmapLayer = L.heatLayer(heatPoints, {
      radius: 35,
      blur: 20,
      maxZoom: 14,
      gradient: { 0.4: 'blue', 0.65: 'lime', 1: 'red' }
    }).addTo(map);
  }
}

// Window Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Init map elements
  initMap();
  fetchComplaints();

  // Handle Event listeners for Filters
  document.getElementById('mapSearch').addEventListener('input', renderMapElements);
  document.getElementById('clusterToggle').addEventListener('change', renderMapElements);
  document.getElementById('heatmapToggle').addEventListener('change', renderMapElements);

  // Checkboxes list filters
  document.querySelectorAll('input[name="typeFilter"]').forEach(cb => cb.addEventListener('change', renderMapElements));
  document.querySelectorAll('input[name="severityFilter"]').forEach(cb => cb.addEventListener('change', renderMapElements));
  document.querySelectorAll('input[name="statusFilter"]').forEach(cb => cb.addEventListener('change', renderMapElements));

  // Auto-refresh coordinates list every 60 seconds
  setInterval(fetchComplaints, 60000);
});
