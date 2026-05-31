// WaterWatch API Base URL Configuration
const API_BASE_URL = window.location.origin.startsWith('file://') || window.location.hostname === ''
  ? 'http://localhost:10000/api'
  : (window.location.port === '3000' ? 'http://localhost:10000/api' : window.location.origin + '/api');

let dashMap;
let mapMarkers = [];
let allComplaints = [];
let filteredComplaints = [];
let timelineChart, typesChart, statusChart;
let currentSortColumn = 'id';
let currentSortDirection = 'desc'; // default newest first

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
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Initialize Dashboard Map
function initDashboardMap() {
  dashMap = L.map('dashMinimap', {
    center: [12.9716, 77.5946],
    zoom: 11
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(dashMap);
}

// Render markers on Dashboard Map
function updateDashboardMapMarkers() {
  // Clear old markers
  mapMarkers.forEach(m => dashMap.removeLayer(m));
  mapMarkers = [];

  // Plot only active complaints
  const activeIssues = allComplaints.filter(c => c.status !== 'resolved');

  activeIssues.forEach(c => {
    let color = '#0284C7';
    if (c.issue_type === 'contamination') color = '#EF4444';
    else if (c.issue_type === 'shortage') color = '#F59E0B';
    else if (c.issue_type === 'pressure') color = '#6B7280';
    else if (c.issue_type === 'other') color = '#8B5CF6';

    const icon = L.divIcon({
      html: `<div style="background-color: ${color}; width: 12px; height: 12px; border: 1.5px solid white; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
      className: 'dash-marker',
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });

    const marker = L.marker([c.latitude, c.longitude], { icon }).addTo(dashMap);
    
    const popupHtml = `
      <div style="font-size: 0.8rem; padding: 0.25rem;">
        <strong style="color: var(--primary-dark); font-family: 'Sora', sans-serif;">${c.title}</strong><br>
        <span style="font-family: 'JetBrains Mono', monospace; font-weight:700;">${c.display_id}</span> | 
        <span class="badge badge-${c.severity}" style="padding: 0.1rem 0.4rem; font-size:0.6rem;">${c.severity}</span>
        <p style="margin-top: 0.25rem; color: var(--text-muted);">${c.address.substring(0, 50)}...</p>
      </div>
    `;
    marker.bindPopup(popupHtml);
    mapMarkers.push(marker);
  });

  // Fit bounds if markers exist
  if (mapMarkers.length > 0) {
    const group = new L.featureGroup(mapMarkers);
    dashMap.fitBounds(group.getBounds().pad(0.1));
  }
}

// Fetch stats and render Chart.js graphics
async function loadAnalytics() {
  try {
    const res = await fetch(`${API_BASE_URL}/stats`);
    const data = await res.json();

    if (res.ok) {
      // Binds count figures
      document.getElementById('stat-total-val').textContent = data.total_reports;
      
      const openPending = data.status_counts.reported + data.status_counts.under_review;
      document.getElementById('stat-open-val').textContent = openPending;
      document.getElementById('stat-progress-val').textContent = data.status_counts.in_progress;
      document.getElementById('stat-resolved-val').textContent = data.resolved_this_week;

      // Draw Charts
      renderTimelineChart(data.history);
      renderTypesChart(data.type_counts);
      renderStatusChart(data.status_counts);
    }
  } catch (err) {
    console.error("Stats fetching error:", err);
    showToast("Error retrieving analytical stats.", "danger");
  }
}

// 1. Line Chart: Timeline
function renderTimelineChart(history) {
  const ctx = document.getElementById('timelineChart').getContext('2d');
  
  const labels = history.map(h => {
    const d = new Date(h.date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const values = history.map(h => h.count);

  if (timelineChart) timelineChart.destroy();

  // Create subtle blue gradient under line
  const gradient = ctx.createLinearGradient(0, 0, 0, 240);
  gradient.addColorStop(0, 'rgba(0, 119, 182, 0.25)');
  gradient.addColorStop(1, 'rgba(0, 119, 182, 0.00)');

  timelineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Reports Filed',
        data: values,
        borderColor: '#0077B6',
        borderWidth: 3,
        pointBackgroundColor: '#0077B6',
        pointHoverRadius: 6,
        fill: true,
        backgroundColor: gradient,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#E2E8F0' }, ticks: { stepSize: 1 } },
        x: { grid: { display: false } }
      }
    }
  });
}

// 2. Bar Chart: Types
function renderTypesChart(typeCounts) {
  const ctx = document.getElementById('typesChart').getContext('2d');
  
  if (typesChart) typesChart.destroy();

  typesChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Leakage', 'Contamination', 'Shortage', 'Pressure', 'Other'],
      datasets: [{
        data: [
          typeCounts.leakage,
          typeCounts.contamination,
          typeCounts.shortage,
          typeCounts.pressure,
          typeCounts.other
        ],
        backgroundColor: ['#0284C7', '#EF4444', '#F59E0B', '#6B7280', '#8B5CF6'],
        borderRadius: 8,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#E2E8F0' }, ticks: { stepSize: 1 } },
        x: { grid: { display: false } }
      }
    }
  });
}

// 3. Doughnut Chart: Status
function renderStatusChart(statusCounts) {
  const ctx = document.getElementById('statusChart').getContext('2d');
  
  if (statusChart) statusChart.destroy();

  statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Reported', 'Under Review', 'In Progress', 'Resolved'],
      datasets: [{
        data: [
          statusCounts.reported,
          statusCounts.under_review,
          statusCounts.in_progress,
          statusCounts.resolved
        ],
        backgroundColor: ['#CBD5E1', '#0077B6', '#F4A261', '#2D9E5F'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 12, font: { weight: 'bold' } }
        }
      },
      cutout: '60%'
    }
  });
}

// Fetch list of all complaints to build Pipeline Table
async function loadTableData() {
  try {
    const res = await fetch(`${API_BASE_URL}/complaints?limit=300`);
    if (res.ok) {
      allComplaints = await res.json();
      filteredComplaints = [...allComplaints];
      applyTableFilters();
      updateDashboardMapMarkers();
    }
  } catch (err) {
    console.error("Table fetching error:", err);
    showToast("Error connecting to pipeline database.", "danger");
  }
}

// Apply table filters and searches
function applyTableFilters() {
  const searchQuery = document.getElementById('tableSearch').value.toLowerCase().trim();
  const statusFilter = document.getElementById('tableStatusFilter').value;

  filteredComplaints = allComplaints.filter(c => {
    // Status Filter
    if (statusFilter && c.status !== statusFilter) return false;
    
    // Search Query (summary, description, address, ID)
    if (searchQuery) {
      const text = `${c.display_id} ${c.title} ${c.description} ${c.address}`.toLowerCase();
      if (!text.includes(searchQuery)) return false;
    }
    return true;
  });

  // Re-sort and render
  sortComplaints(currentSortColumn, false); // sort without changing direction
}

// Table sort logic
function sortComplaints(column, toggleDirection = true) {
  if (toggleDirection) {
    if (currentSortColumn === column) {
      currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      currentSortColumn = column;
      currentSortDirection = 'asc';
    }
  }

  filteredComplaints.sort((a, b) => {
    let valA = a[column];
    let valB = b[column];

    // String casing normalize
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  renderTable();
}

// Render rows in the Pipeline Table
function renderTable() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  if (filteredComplaints.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-muted); font-size: 0.95rem;">No complaints match the current filters.</td>
      </tr>
    `;
    return;
  }

  filteredComplaints.forEach(c => {
    const tr = document.createElement('tr');
    
    // Apply visual severity left border accent
    tr.className = `row-severity-${c.severity}`;

    const dateStr = formatDateTime(c.created_at);
    const statusText = c.status.replace('_', ' ');

    tr.innerHTML = `
      <td class="table-id">${c.display_id}</td>
      <td style="max-width: 250px; font-weight:600; color: var(--primary-dark);">${c.title}</td>
      <td><span class="badge badge-${c.issue_type}">${c.issue_type}</span></td>
      <td><span class="badge badge-${c.severity}">${c.severity}</span></td>
      <td style="max-width: 200px; font-size: 0.8rem; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;" title="${c.address}">📍 ${c.address}</td>
      <td style="font-size:0.8rem; color: var(--text-muted); font-weight:600;">${dateStr}</td>
      <td><span class="badge badge-${c.status}">${statusText}</span></td>
      <td>
        <button class="btn btn-secondary btn-icon" onclick="openStatusModal(${c.id}, '${c.display_id}', '${c.status}', \`${c.authority_note.replace(/`/g, '\\`').replace(/"/g, '&quot;')}\`)" title="Update Status">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align: middle;">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          Update
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Modal status controls
window.openStatusModal = function(id, displayId, status, note) {
  document.getElementById('modalIntId').value = id;
  document.getElementById('modalTicketId').textContent = displayId;
  document.getElementById('modalStatusSelect').value = status;
  document.getElementById('modalNoteText').value = note || '';

  document.getElementById('statusModal').classList.add('open');
};

function closeStatusModal() {
  document.getElementById('statusModal').classList.remove('open');
}

// Submit status update
async function handleStatusUpdate(e) {
  e.preventDefault();

  const id = document.getElementById('modalIntId').value;
  const status = document.getElementById('modalStatusSelect').value;
  const note = document.getElementById('modalNoteText').value.trim();

  const payload = {
    status,
    authority_note: note || null
  };

  try {
    const res = await fetch(`${API_BASE_URL}/complaints/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok) {
      showToast(`Status successfully updated to ${status.replace('_', ' ').toUpperCase()}!`, "success");
      
      // Phase 3 mock email notifier toast double-check
      if (data.mock_email_sent) {
        setTimeout(() => {
          showToast(`Mock update email dispatched to reporter!`, "success");
        }, 800);
      }

      closeStatusModal();
      // Auto-reload listings and maps
      loadAnalytics();
      loadTableData();
    } else {
      showToast(data.error || "Failed to update status.", "danger");
    }
  } catch (err) {
    console.error("Status PATCH error:", err);
    showToast("Server connection error during status update.", "danger");
  }
}

// Export to CSV spreadsheet helper (Phase 3 Bonus item 10)
function exportToCSV() {
  if (filteredComplaints.length === 0) {
    showToast("No data to export.", "warning");
    return;
  }

  // Define headers
  const headers = ["Ticket ID", "Title", "Category", "Severity", "Latitude", "Longitude", "Address", "Date Filed", "Status", "Authority Remarks"];
  
  // Format rows
  const csvRows = [
    headers.join(',') // add headers line
  ];

  filteredComplaints.forEach(c => {
    const statusText = c.status.replace('_', ' ');
    const noteEscaped = (c.authority_note || '').replace(/"/g, '""');
    const addressEscaped = c.address.replace(/"/g, '""');
    const titleEscaped = c.title.replace(/"/g, '""');

    const row = [
      c.display_id,
      `"${titleEscaped}"`,
      c.issue_type,
      c.severity,
      c.latitude,
      c.longitude,
      `"${addressEscaped}"`,
      c.created_at,
      statusText,
      `"${noteEscaped}"`
    ];

    csvRows.push(row.join(','));
  });

  // Blob trigger
  const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
  const encodedUri = encodeURI(csvContent);
  
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `waterwatch_complaints_export_${new Date().toISOString().substring(0, 10)}.csv`);
  document.body.appendChild(link);
  
  link.click();
  link.remove();
  showToast("CSV data export successfully initiated!", "success");
}

// Window Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Init map, analytics, and table pipeline
  initDashboardMap();
  loadAnalytics();
  loadTableData();

  // Search filter hooks
  document.getElementById('tableSearch').addEventListener('input', applyTableFilters);
  document.getElementById('tableStatusFilter').addEventListener('change', applyTableFilters);

  // Sorting columns click listeners
  document.querySelectorAll('.complaints-table th').forEach(th => {
    const col = th.getAttribute('data-sort');
    if (col) {
      th.addEventListener('click', () => sortComplaints(col));
    }
  });

  // Modal actions
  document.getElementById('closeStatusModalBtn').addEventListener('click', closeStatusModal);
  document.getElementById('cancelStatusModalBtn').addEventListener('click', closeStatusModal);
  document.getElementById('statusUpdateForm').addEventListener('submit', handleStatusUpdate);

  // CSV Export action
  document.getElementById('exportCsvBtn').addEventListener('click', exportToCSV);

  // Poll server for updates every 60 seconds
  setInterval(() => {
    loadAnalytics();
    loadTableData();
  }, 60000);
});
