// App State
const state = {
  schools: [],
  lastUpdated: null,
  nrs: 90.00,
  tka: 80.00,
  mode: 'simulate', // simulate mode is now default and permanent
  activeSchool: null
};

// DOM Elements
const elNrsInput = document.getElementById('input-nrs');
const elBtnThemeToggle = document.getElementById('btn-theme-toggle');
const elThemeIconSun = document.getElementById('theme-icon-sun');
const elThemeIconMoon = document.getElementById('theme-icon-moon');
const elTkaInputContainer = document.getElementById('tka-input-container');
const elInputTka = document.getElementById('input-tka');
const elUpdateTimestamp = document.getElementById('update-timestamp');
const elAutoRefreshTimer = document.getElementById('auto-refresh-timer');
const elBtnRefreshData = document.getElementById('btn-refresh-data');
const elSchoolsGrid = document.getElementById('schools-grid');

// Filter & Sort Elements
const elSearchSchool = document.getElementById('search-school');
const elFilterStatus = document.getElementById('filter-status');
const elSortBy = document.getElementById('sort-by');

// Counters
const elCountSafe = document.getElementById('count-safe');
const elCountDanger = document.getElementById('count-danger');

// Modal Elements
const elSchoolModal = document.getElementById('school-modal');
const elModalClose = document.getElementById('modal-close');
const elModalSchoolName = document.getElementById('modal-school-name');
const elModalSchoolPagu = document.getElementById('modal-school-pagu');
const elModalChoice1 = document.getElementById('modal-choice1');
const elModalChoice2 = document.getElementById('modal-choice2');
const elModalLowestScore = document.getElementById('modal-lowest-score');
const elModalHighestScore = document.getElementById('modal-highest-score');
const elModalMatchBox = document.getElementById('modal-match-box');
const elModalMatchDesc = document.getElementById('modal-match-desc');
const elModalMatchBadge = document.getElementById('modal-match-badge');
const elModalStudentsList = document.getElementById('modal-students-list');
const elSearchStudent = document.getElementById('search-student');

// Popup Elements
const elRefreshPopup = document.getElementById('refresh-popup');
const elPopupClose = document.getElementById('popup-close');
const elBtnCopyCommand = document.getElementById('btn-copy-command');
const elBtnRunScrapeLocal = document.getElementById('btn-run-scrape-local');

// Load Data
async function initApp() {
  initTheme();
  try {
    const response = await fetch('data/smp_data.json');
    if (!response.ok) {
      throw new Error('Gagal mengambil file JSON data');
    }
    const data = await response.json();
    state.schools = data.schools || [];
    state.lastUpdated = data.last_updated;
    
    // Set update timestamp
    if (state.lastUpdated) {
      const date = new Date(state.lastUpdated);
      elUpdateTimestamp.textContent = `Data diupdate: ${date.toLocaleString('id-ID')}`;
    } else {
      elUpdateTimestamp.textContent = 'Data offline termuat';
    }
    
    setupEventListeners();
    calculateAndRender();
    initAutoRefresh();
  } catch (error) {
    console.error(error);
    elSchoolsGrid.innerHTML = `
      <div class="loading-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p>Database mirror lokal (smp_data.json) belum ada atau gagal dibaca.</p>
        <button id="btn-initial-scrape" class="btn btn-primary">Unduh Data Sekarang</button>
      </div>
    `;
    
    document.getElementById('btn-initial-scrape')?.addEventListener('click', () => {
      elRefreshPopup.classList.remove('hidden');
    });
    
    // Still setup the popup and refresh events so user can scrape
    setupPopupEvents();
  }
}

// Event Listeners Setup
function setupEventListeners() {
  // NRS Input
  elNrsInput.addEventListener('input', (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val)) val = 0;
    if (val > 100) val = 100;
    state.nrs = val;
    calculateAndRender();
  });

  elInputTka.addEventListener('input', (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val)) val = 0;
    if (val > 100) val = 100;
    state.tka = val;
    calculateAndRender();
  });

  // Filter & Sort Inputs
  elSearchSchool.addEventListener('input', () => renderSchoolsList());
  elFilterStatus.addEventListener('change', () => renderSchoolsList());
  elSortBy.addEventListener('change', () => renderSchoolsList());

  // Modal Events
  elModalClose.addEventListener('click', () => {
    elSchoolModal.classList.add('hidden');
    state.activeSchool = null;
  });
  
  elSearchStudent.addEventListener('input', () => {
    if (state.activeSchool) renderStudentsList(state.activeSchool);
  });

  // Theme Toggle Event
  elBtnThemeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
  });

  // Popup & Refresh Events
  setupPopupEvents();
}

function setupPopupEvents() {
  elBtnRefreshData.addEventListener('click', () => {
    runBrowserScraper();
  });

  elPopupClose.addEventListener('click', () => {
    elRefreshPopup.classList.add('hidden');
  });

  elBtnCopyCommand.addEventListener('click', () => {
    navigator.clipboard.writeText('npm run scrape');
    elBtnCopyCommand.textContent = 'Copied!';
    setTimeout(() => {
      elBtnCopyCommand.textContent = 'Copy';
    }, 2000);
  });

  elBtnRunScrapeLocal.addEventListener('click', () => {
    elRefreshPopup.classList.add('hidden');
    runBrowserScraper();
  });
}

// Logic: Calculate match status and details for each school
function evaluateSchool(school) {
  const lowest = school.lowest_score || 0;
  const pagu = school.pagu || 0;
  const tkaRequired = (lowest - (0.6 * state.nrs)) / 0.4;
  
  // If no applicants in ranking, it's open and safe
  if (lowest === 0 || school.ranking.length === 0) {
    return {
      status: 'safe',
      badgeText: 'AMAN',
      description: 'Belum ada pendaftar dalam ranking. Kursi kosong.',
      tkaRequired: 0,
      userTotal: 0.6 * state.nrs + 0.4 * state.tka
    };
  }

  // Simulate Mode: User inputs a specific TKA score
  const userTotal = (0.6 * state.nrs) + (0.4 * state.tka);
  const pass = userTotal >= lowest;
  const gap = userTotal - lowest;
  
  if (pass) {
    return {
      status: 'safe',
      badgeText: 'LOLOS',
      description: `Nilai Akhir Anda (${userTotal.toFixed(4)}) di atas passing grade (+${gap.toFixed(4)}).`,
      tkaRequired: tkaRequired,
      userTotal: userTotal
    };
  } else {
    return {
      status: 'danger',
      badgeText: 'GUGUR',
      description: `Nilai Akhir Anda (${userTotal.toFixed(4)}) di bawah passing grade (${gap.toFixed(4)}).`,
      tkaRequired: tkaRequired,
      userTotal: userTotal
    };
  }
}

// Calculate all schools status and update overall dashboard counters
function calculateAndRender() {
  if (state.schools.length === 0) return;

  let safeCount = 0;
  let dangerCount = 0;

  // Add evaluation data to each school object in memory
  state.schools.forEach(school => {
    school.eval = evaluateSchool(school);
    if (school.eval.status === 'safe') safeCount++;
    else if (school.eval.status === 'danger') dangerCount++;
  });

  // Update counter elements
  elCountSafe.textContent = safeCount;
  elCountDanger.textContent = dangerCount;

  // Render list
  renderSchoolsList();
  updateTextSummary();

  // If modal is active, update modal content too
  if (state.activeSchool) {
    const updatedSchool = state.schools.find(s => s.id === state.activeSchool.id);
    if (updatedSchool) {
      showSchoolDetails(updatedSchool);
    }
  }
}

// Generate text summary under the overview cards
function updateTextSummary() {
  const elSummaryBox = document.getElementById('summary-text-box');
  if (!elSummaryBox) return;

  // Filter schools by status
  const safeSchools = state.schools.filter(s => s.eval.status === 'safe');

  // Sort safe schools: safest first (lowest 'lowest_score')
  safeSchools.sort((a, b) => (a.lowest_score || 0) - (b.lowest_score || 0));

  let htmlContent = '';

  // 1. Safe summary
  if (safeSchools.length > 0) {
    const safeNamesList = safeSchools.map(s => `<strong>${s.nama}</strong>`).join(', ');
    htmlContent += `
      <div class="summary-text-item">
        <div class="summary-section-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-safe)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span style="color: var(--color-safe)">Berpeluang Lolos:</span>
        </div>
        <p>Anda berpeluang tinggi diterima di: ${safeNamesList}.</p>
      </div>
    `;
  } else {
    htmlContent += `
      <div class="summary-text-item">
        <div class="summary-section-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style="color: var(--color-danger)">Berpeluang Lolos:</span>
        </div>
        <p>Nilai Anda saat ini belum berada di zona aman untuk sekolah mana pun.</p>
      </div>
    `;
  }

  elSummaryBox.innerHTML = htmlContent;
}

// Render school grid with search, filter, and sorting
function renderSchoolsList() {
  const searchQuery = elSearchSchool.value.toLowerCase().trim();
  const filterVal = elFilterStatus.value;
  const sortVal = elSortBy.value;

  // 1. Filter
  let filtered = state.schools.filter(school => {
    // Search match
    const nameMatch = school.nama.toLowerCase().includes(searchQuery) || String(school.id).includes(searchQuery);
    if (!nameMatch) return false;

    // Status match
    if (filterVal !== 'all' && school.eval.status !== filterVal) return false;

    return true;
  });

  // 2. Sort
  filtered.sort((a, b) => {
    if (sortVal === 'id') {
      return a.id - b.id;
    } else if (sortVal === 'lowest-asc') {
      return (a.lowest_score || 0) - (b.lowest_score || 0);
    } else if (sortVal === 'lowest-desc') {
      return (b.lowest_score || 0) - (a.lowest_score || 0);
    } else if (sortVal === 'pagu-desc') {
      return b.pagu - a.pagu;
    } else if (sortVal === 'applicants-desc') {
      return b.total_pendaftar - a.total_pendaftar;
    } else if (sortVal === 'relevance') {
      // Relevance sort:
      // Safe first (lowest TKA requirements first, meaning we are safer)
      // Then Warning (TKA required from lowest to highest, e.g. 10.0 first, then 90.0)
      // Then Danger last (sorted by how close we are to 100 target TKA required)
      const statusOrder = { safe: 1, warning: 2, danger: 3 };
      if (a.eval.status !== b.eval.status) {
        return statusOrder[a.eval.status] - statusOrder[b.eval.status];
      }
      
      // If both are safe, sort by how much higher their rapor is relative to the minimum required
      if (a.eval.status === 'safe') {
        return a.eval.tkaRequired - b.eval.tkaRequired; // more negative is safer
      }
      // If both are warning/danger, sort by target TKA required ascending
      return a.eval.tkaRequired - b.eval.tkaRequired;
    }
    return 0;
  });

  // 3. Render HTML
  if (filtered.length === 0) {
    elSchoolsGrid.innerHTML = `
      <div class="loading-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <p>Tidak ada sekolah yang cocok dengan filter pencarian Anda.</p>
      </div>
    `;
    return;
  }

  elSchoolsGrid.innerHTML = '';
  filtered.forEach(school => {
    const card = document.createElement('div');
    card.className = `school-card card-glass match-${school.eval.status}`;
    
    const fillRate = school.pagu > 0 ? ((school.ranking.length / school.pagu) * 100).toFixed(0) : 0;
    
    card.innerHTML = `
      <div class="school-card-header">
        <div class="school-title-group">
          <h3>${school.nama}</h3>
          <div class="quota">Pagu: ${school.pagu} | Terisi: ${school.ranking.length} (${fillRate}%)</div>
        </div>
        <button class="btn-card-refresh" title="Refresh Live Data (Hanya Sekolah Ini)" data-id="${school.id}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        </button>
      </div>
      
      <div class="school-card-body">
        <div class="school-stats">
          <div class="stat-item">
            <span class="lbl">Terendah (Min)</span>
            <span class="val text-warning">${school.lowest_score ? school.lowest_score.toFixed(4) : '-'}</span>
          </div>
          <div class="stat-item">
            <span class="lbl">Tertinggi (Max)</span>
            <span class="val text-success">${school.highest_score ? school.highest_score.toFixed(4) : '-'}</span>
          </div>
          <div class="stat-item">
            <span class="lbl">Pilihan 1</span>
            <span class="val">${school.jp_pilihan1}</span>
          </div>
          <div class="stat-item">
            <span class="lbl">Pilihan 2</span>
            <span class="val">${school.jp_pilihan2}</span>
          </div>
        </div>
        
        <div class="card-match-result">
          <span class="badge">${school.eval.badgeText}</span>
          <span class="desc">${school.eval.description}</span>
        </div>
      </div>
      
      <div class="school-card-footer">
        <button class="btn btn-secondary btn-view-rank" data-id="${school.id}">Lihat Ranking</button>
      </div>
    `;

    // Add events inside cards
    card.querySelector('.btn-view-rank').addEventListener('click', () => {
      state.activeSchool = school;
      showSchoolDetails(school);
    });

    const refreshBtn = card.querySelector('.btn-card-refresh');
    refreshBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      refreshBtn.classList.add('spinning');
      await refreshSingleSchool(school.id);
      refreshBtn.classList.remove('spinning');
    });

    elSchoolsGrid.appendChild(card);
  });
}

// Show Detail Modal
function showSchoolDetails(school) {
  elModalSchoolName.textContent = school.nama;
  elModalSchoolPagu.textContent = `Pagu: ${school.pagu} Kursi`;
  elModalChoice1.textContent = `${school.jp_pilihan1} Siswa`;
  elModalChoice2.textContent = `${school.jp_pilihan2} Siswa`;
  elModalLowestScore.textContent = school.lowest_score ? school.lowest_score.toFixed(4) : '-';
  elModalHighestScore.textContent = school.highest_score ? school.highest_score.toFixed(4) : '-';

  // Match info Box in Modal
  elModalMatchBox.className = `modal-match-box match-${school.eval.status}`;
  elModalMatchBadge.textContent = school.eval.badgeText;
  
  const userTotal = (0.6 * state.nrs) + (0.4 * state.tka);
  if (school.eval.status === 'safe') {
    elModalMatchDesc.textContent = `Dengan Rapor ${state.nrs.toFixed(2)} & TKA ${state.tka.toFixed(2)}, Nilai Akhir Anda adalah ${userTotal.toFixed(4)}. Anda dinyatakan LOLOS kuota (di atas passing grade ${school.lowest_score ? school.lowest_score.toFixed(4) : '-'}).`;
  } else {
    elModalMatchDesc.textContent = `Dengan Rapor ${state.nrs.toFixed(2)} & TKA ${state.tka.toFixed(2)}, Nilai Akhir Anda adalah ${userTotal.toFixed(4)}. Anda TIDAK LOLOS kuota (di bawah passing grade ${school.lowest_score ? school.lowest_score.toFixed(4) : '-'}).`;
  }

  // Populate student list
  renderStudentsList(school);
  
  elSchoolModal.classList.remove('hidden');
}

// Render student list in modal
function renderStudentsList(school) {
  const searchQuery = elSearchStudent.value.toLowerCase().trim();
  const tbody = elModalStudentsList;
  tbody.innerHTML = '';

  const filtered = school.ranking.filter(s => 
    s.nama_siswa.toLowerCase().includes(searchQuery) || String(s.urutan).includes(searchQuery)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem;">Tidak ada siswa yang cocok.</td></tr>`;
    return;
  }

  // Add simulated user row if applicable
  let userInserted = false;
  const userTotal = 0.6 * state.nrs + 0.4 * state.tka;

  filtered.forEach(student => {
    // If the simulated user score is higher than this student, and we haven't inserted the user yet, let's insert them!
    if (!userInserted && userTotal > student.total) {
      insertUserRow(tbody, userTotal);
      userInserted = true;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${student.urutan}</td>
      <td>${student.nama_siswa}</td>
      <td class="font-semibold text-primary">${student.total.toFixed(4)}</td>
      <td>Pilihan ${student.pilihan_ke}</td>
      <td class="mobile-hide">${student.bind.toFixed(2)}</td>
      <td class="mobile-hide">${student.mat.toFixed(2)}</td>
      <td class="mobile-hide">${student.ipa.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });

  // If user is lowest, append at the end
  if (!userInserted) {
    insertUserRow(tbody, userTotal);
  }
}

function insertUserRow(tbody, score) {
  const tr = document.createElement('tr');
  tr.className = 'user-row';
  tr.innerHTML = `
    <td>SIMULASI</td>
    <td>ANDA (SIMULASI NILAI)</td>
    <td class="text-success">${score.toFixed(4)}</td>
    <td>-</td>
    <td class="mobile-hide">-</td>
    <td class="mobile-hide">-</td>
    <td class="mobile-hide">-</td>
  `;
  tbody.appendChild(tr);
}

// Refresh Live data for a single school directly via client fetch
async function refreshSingleSchool(id) {
  const url = `/api/proxy?id=${id}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP status ${res.status}`);
    const result = await res.json();
    
    if (result && result.success && result.data) {
      const d = result.data;
      const ranking = d.ranking || [];
      const pagu = d.pagu || 0;
      const jp_pilihan1 = d.jp_pilihan1 || 0;
      const jp_pilihan2 = d.jp_pilihan2 || 0;
      
      let highest_score = null;
      let lowest_score = null;
      if (ranking.length > 0) {
        highest_score = parseFloat(ranking[0].total);
        lowest_score = parseFloat(ranking[ranking.length - 1].total);
      }

      // Update school in state array
      const idx = state.schools.findIndex(s => s.id === id);
      if (idx !== -1) {
        state.schools[idx] = {
          id: id,
          nama: `SMPN ${id} Surabaya`,
          pagu: pagu,
          jp_pilihan1: jp_pilihan1,
          jp_pilihan2: jp_pilihan2,
          total_pendaftar: jp_pilihan1 + jp_pilihan2,
          highest_score: highest_score,
          lowest_score: lowest_score,
          waktu_api: d.waktu,
          ranking: ranking.map(r => ({
            urutan: parseInt(r.urutan),
            nama_siswa: r.nama_siswa,
            total: parseFloat(r.total),
            pilihan_ke: parseInt(r.pilihan_ke),
            bind: parseFloat(r.bind || 0),
            mat: parseFloat(r.mat || 0),
            ipa: parseFloat(r.ipa || 0),
            waktu_pendaftaran: r.waktu_pendaftaran
          }))
        };
        
        console.log(`Live refreshed SMPN ${id} successfully.`);
        calculateAndRender();
      }
    }
  } catch (error) {
    console.error(`Failed live refresh for school ${id}:`, error);
    alert(`Gagal mengambil data terbaru untuk SMPN ${id}. Pastikan Anda memiliki koneksi internet.`);
  }
}

// Client-side scraper loop in browser
// Client-side scraper loop in browser (Parallelized)
async function runBrowserScraper() {
  elSchoolsGrid.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p id="scrape-progress-text">Menghubungkan ke API pusat (0/63)...</p>
      <p class="text-xs text-muted">Sedang mengunduh data real-time untuk 63 sekolah...</p>
    </div>
  `;

  const total = 63;
  let countSuccess = 0;
  const textEl = document.getElementById('scrape-progress-text');
  
  const fetchPromises = [];

  for (let id = 1; id <= total; id++) {
    const url = `/api/proxy?id=${id}`;
    const promise = fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP status ${res.status}`);
        const result = await res.json();
        if (result && result.success && result.data) {
          const d = result.data;
          const ranking = d.ranking || [];
          const pagu = d.pagu || 0;
          const jp_pilihan1 = d.jp_pilihan1 || 0;
          const jp_pilihan2 = d.jp_pilihan2 || 0;
          
          let highest_score = null;
          let lowest_score = null;
          if (ranking.length > 0) {
            highest_score = parseFloat(ranking[0].total);
            lowest_score = parseFloat(ranking[ranking.length - 1].total);
          }

          const schoolObj = {
            id: id,
            nama: `SMPN ${id} Surabaya`,
            pagu: pagu,
            jp_pilihan1: jp_pilihan1,
            jp_pilihan2: jp_pilihan2,
            total_pendaftar: jp_pilihan1 + jp_pilihan2,
            highest_score: highest_score,
            lowest_score: lowest_score,
            waktu_api: d.waktu,
            ranking: ranking.map(r => ({
              urutan: parseInt(r.urutan),
              nama_siswa: r.nama_siswa,
              total: parseFloat(r.total),
              pilihan_ke: parseInt(r.pilihan_ke),
              bind: parseFloat(r.bind || 0),
              mat: parseFloat(r.mat || 0),
              ipa: parseFloat(r.ipa || 0),
              waktu_pendaftaran: r.waktu_pendaftaran
            }))
          };

          const idx = state.schools.findIndex(s => s.id === id);
          if (idx !== -1) {
            state.schools[idx] = schoolObj;
          } else {
            state.schools.push(schoolObj);
          }
          
          countSuccess++;
          if (textEl) {
            textEl.textContent = `Mengunduh data real-time: Berhasil ${countSuccess}/${total} sekolah...`;
          }
        }
      })
      .catch(err => {
        console.warn(`Browser scraper failed for school ${id}:`, err);
      });
    
    fetchPromises.push(promise);
  }

  // Wait for all fetches to complete
  await Promise.all(fetchPromises);

  // Update timestamps
  state.lastUpdated = new Date().toISOString();
  elUpdateTimestamp.textContent = `Data diupdate (Browser): ${new Date().toLocaleString('id-ID')}`;
  
  // Re-save or just notify and render
  calculateAndRender();
  alert(`Refresh selesai! Berhasil memperbarui ${countSuccess} dari ${total} sekolah.`);
}

// Auto refresh logic
let autoRefreshIntervalId = null;
let autoRefreshSeconds = 120;

function initAutoRefresh() {
  if (autoRefreshIntervalId) clearInterval(autoRefreshIntervalId);
  autoRefreshSeconds = 120;
  
  autoRefreshIntervalId = setInterval(async () => {
    autoRefreshSeconds--;
    if (autoRefreshSeconds <= 0) {
      elAutoRefreshTimer.textContent = 'Auto-refresh: Updating...';
      try {
        const response = await fetch('data/smp_data.json?t=' + Date.now());
        if (response.ok) {
          const data = await response.json();
          state.schools = data.schools || [];
          state.lastUpdated = data.last_updated;
          
          if (state.lastUpdated) {
            const date = new Date(state.lastUpdated);
            elUpdateTimestamp.textContent = `Data diupdate: ${date.toLocaleString('id-ID')}`;
          }
          calculateAndRender();
        }
      } catch (error) {
        console.error('Auto-refresh load failed:', error);
      }
      autoRefreshSeconds = 120;
    } else {
      elAutoRefreshTimer.textContent = `Auto-refresh: ${autoRefreshSeconds}s`;
    }
  }, 1000);
}

// Theme functions
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  
  if (theme === 'dark') {
    elThemeIconSun.classList.remove('hidden');
    elThemeIconMoon.classList.add('hidden');
  } else {
    elThemeIconSun.classList.add('hidden');
    elThemeIconMoon.classList.remove('hidden');
  }
}

// Initialise
window.addEventListener('DOMContentLoaded', initApp);
