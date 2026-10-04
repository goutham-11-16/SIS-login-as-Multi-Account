let activeTab = 'home';
let cachedData = {};
let accounts = JSON.parse(localStorage.getItem('sis_accounts') || '[]');
let currentAccountIndex = parseInt(localStorage.getItem('sis_active_index') || '0');

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  setupLongPressProfile();

  if (isNaN(currentAccountIndex) || currentAccountIndex < 0 || (accounts.length > 0 && currentAccountIndex >= accounts.length)) {
    currentAccountIndex = 0;
  }

  const isExplicitlyLoggedOut = localStorage.getItem('sis_is_logged_in') === 'false';

  // DIRECT AUTO-LOGIN ON REFRESH with the present active account
  if (!isExplicitlyLoggedOut && accounts.length > 0 && accounts[currentAccountIndex]) {
    const activeAcc = accounts[currentAccountIndex];
    document.getElementById('login-container').classList.add('d-none');
    document.getElementById('app-container').classList.remove('d-none');
    updateGlobalUserInitials(activeAcc.name || activeAcc.regNo);

    const profileNameEl = document.getElementById('profile-page-name');
    if (profileNameEl && activeAcc.name) profileNameEl.textContent = activeAcc.name;
    const headerRegNoEl = document.getElementById('header-profile-regno');
    if (headerRegNoEl) headerRegNoEl.textContent = activeAcc.regNo;
    const pageRegNoEl = document.getElementById('profile-page-regno');
    if (pageRegNoEl) pageRegNoEl.textContent = activeAcc.regNo;

    performLogin(activeAcc.regNo, activeAcc.password);
  } else {
    initLoginView();
    if (accounts.length > 0 && accounts[currentAccountIndex]) {
      updateGlobalUserInitials(accounts[currentAccountIndex].name || accounts[currentAccountIndex].regNo);
    }
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const regNo = document.getElementById('input-regno').value.trim();
    const pwd = document.getElementById('input-password').value.trim();
    
    if (!regNo || !pwd) return;

    const existingIdx = accounts.findIndex(a => a.regNo === regNo);
    if (existingIdx >= 0) {
      accounts[existingIdx].password = pwd;
      currentAccountIndex = existingIdx;
    } else {
      accounts.push({ regNo, password: pwd });
      currentAccountIndex = accounts.length - 1;
    }
    
    saveAccounts();
    localStorage.setItem('sis_is_logged_in', 'true');
    performLogin(regNo, pwd);
  });
});

function updateGlobalUserInitials(nameOrRegno) {
  if (!nameOrRegno) return;
  const initial = nameOrRegno.trim().charAt(0).toUpperCase();

  const bottomNavAvatar = document.getElementById('bottom-nav-avatar-letter');
  if (bottomNavAvatar) bottomNavAvatar.textContent = initial;

  const profileAvatar = document.getElementById('profile-avatar-letter');
  if (profileAvatar) profileAvatar.textContent = initial;

  const savedAvatar = document.getElementById('saved-account-avatar');
  if (savedAvatar) savedAvatar.textContent = initial;
}

function initLoginView() {
  const savedView = document.getElementById('login-saved-view');
  const formView = document.getElementById('login-form-view');
  const savedBackBtn = document.getElementById('saved-account-back-btn');

  if (accounts.length > 0 && accounts[currentAccountIndex]) {
    const acc = accounts[currentAccountIndex];
    const regnoEl = document.getElementById('saved-account-regno');
    const nameEl = document.getElementById('saved-account-name');
    const avatarEl = document.getElementById('saved-account-avatar');
    const textEl = document.getElementById('saved-login-text');

    if (regnoEl) regnoEl.textContent = acc.regNo;
    if (nameEl) nameEl.textContent = acc.name || 'Saved Student Account';
    if (avatarEl) avatarEl.textContent = (acc.name || acc.regNo).charAt(0).toUpperCase();
    if (textEl) textEl.textContent = `Log in as ${acc.regNo}`;

    updateGlobalUserInitials(acc.name || acc.regNo);

    if (savedView) savedView.classList.remove('d-none');
    if (formView) formView.classList.add('d-none');
    if (savedBackBtn) savedBackBtn.classList.remove('d-none');
  } else {
    if (savedView) savedView.classList.add('d-none');
    if (formView) formView.classList.remove('d-none');
    if (savedBackBtn) savedBackBtn.classList.add('d-none');
  }
}

function loginWithSavedAccount() {
  if (accounts.length > 0 && accounts[currentAccountIndex]) {
    const spinner = document.getElementById('saved-login-spinner');
    if (spinner) spinner.classList.remove('d-none');
    localStorage.setItem('sis_is_logged_in', 'true');
    const acc = accounts[currentAccountIndex];
    performLogin(acc.regNo, acc.password).finally(() => {
      if (spinner) spinner.classList.add('d-none');
    });
  }
}

function showBlankLoginForm() {
  const savedView = document.getElementById('login-saved-view');
  const formView = document.getElementById('login-form-view');
  const savedBackBtn = document.getElementById('saved-account-back-btn');

  if (savedView) savedView.classList.add('d-none');
  if (formView) formView.classList.remove('d-none');
  if (savedBackBtn && accounts.length > 0) savedBackBtn.classList.remove('d-none');

  const regInput = document.getElementById('input-regno');
  const pwdInput = document.getElementById('input-password');
  if (regInput) regInput.value = '';
  if (pwdInput) pwdInput.value = '';
}

function showSavedAccountView() {
  initLoginView();
}

function togglePasswordVisibility() {
  const pwdInput = document.getElementById('input-password');
  const eyeIcon = document.getElementById('pwd-eye-icon');
  if (!pwdInput) return;

  if (pwdInput.type === 'password') {
    pwdInput.type = 'text';
    if (eyeIcon) eyeIcon.className = 'fa-regular fa-eye';
  } else {
    pwdInput.type = 'password';
    if (eyeIcon) eyeIcon.className = 'fa-regular fa-eye-slash';
  }
}

function saveAccounts() {
  localStorage.setItem('sis_accounts', JSON.stringify(accounts));
  localStorage.setItem('sis_active_index', currentAccountIndex);
}

async function performLogin(regNo, password) {
  const btnSpinner = document.getElementById('btn-spinner');
  const loginAlert = document.getElementById('login-alert');

  if (btnSpinner) btnSpinner.classList.remove('d-none');
  if (loginAlert) loginAlert.classList.add('d-none');

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ register_no: regNo, password: password })
    });

    const data = await res.json();
    if (btnSpinner) btnSpinner.classList.add('d-none');

    if (data.success) {
      localStorage.setItem('sis_is_logged_in', 'true');
      localStorage.setItem('sis_active_index', currentAccountIndex);
      document.getElementById('login-container').classList.add('d-none');
      document.getElementById('app-container').classList.remove('d-none');
      
      const matched = accounts.find(a => a.regNo === regNo);
      if (matched && (matched.name || matched.regNo)) {
        updateGlobalUserInitials(matched.name || matched.regNo);
        const profileNameEl = document.getElementById('profile-page-name');
        if (profileNameEl && matched.name) profileNameEl.textContent = matched.name;
        const headerRegNoEl = document.getElementById('header-profile-regno');
        if (headerRegNoEl) headerRegNoEl.textContent = matched.regNo;
        const pageRegNoEl = document.getElementById('profile-page-regno');
        if (pageRegNoEl) pageRegNoEl.textContent = matched.regNo;
      } else {
        updateGlobalUserInitials(regNo);
        const headerRegNoEl = document.getElementById('header-profile-regno');
        if (headerRegNoEl) headerRegNoEl.textContent = regNo;
        const pageRegNoEl = document.getElementById('profile-page-regno');
        if (pageRegNoEl) pageRegNoEl.textContent = regNo;
      }

      cachedData = {};
      profileDataCache = null;
      fetchTimetable();
      fetchProfile();
      fetchAttendance();
      preloadAllData();
    } else {
      if (loginAlert) {
        loginAlert.textContent = data.message || 'Login failed.';
        loginAlert.classList.remove('d-none');
      }
    }
  } catch (err) {
    if (btnSpinner) btnSpinner.classList.add('d-none');
    if (loginAlert) {
      loginAlert.textContent = 'Server connection error.';
      loginAlert.classList.remove('d-none');
    }
  }
}

async function fetchTimetable() {
  try {
    const res = await fetch('/api/timetable');
    const data = await res.json();
    cachedData.timetable = data;
    renderTimetable();
  } catch (e) {
    console.error('Failed to fetch timetable:', e);
  }
}

function renderTimetable() {
  if (!cachedData.timetable) return;
  const { schedule, faculties } = cachedData.timetable;

  const tbody = document.getElementById('timetable-body');
  if (tbody) {
    tbody.innerHTML = '';
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

    days.forEach(day => {
      let rowHtml = `<tr><td class="fw-bold text-primary bg-secondary-subtle align-middle py-3">${day}</td>`;
      const slots = schedule[day] || [];

      slots.forEach(s => {
        if (s.course) {
          rowHtml += `<td class="align-middle bg-primary-subtle border-primary-subtle text-white fw-semibold px-2 py-2" style="font-size:0.7rem;">${s.course}</td>`;
        } else {
          rowHtml += `<td class="align-middle text-secondary extra-small py-2">-</td>`;
        }
      });

      rowHtml += '</tr>';
      tbody.insertAdjacentHTML('beforeend', rowHtml);
    });
  }

  const grid = document.getElementById('faculty-list-grid');
  if (grid && faculties) {
    grid.innerHTML = '';
    faculties.forEach(f => {
      const card = `
        <div class="col-12 col-md-6">
          <div class="glass-panel p-3 rounded-4 h-100 d-flex flex-column justify-content-between">
            <div>
              <div class="d-flex align-items-center justify-content-between mb-2">
                <span class="badge rounded-pill px-2.5 py-1" style="background: rgba(99, 102, 241, 0.2); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3);">${f.code}</span>
                <span class="badge bg-secondary-subtle text-white extra-small">${f.credits} Credits</span>
              </div>
              <h6 class="fw-bold text-white mb-2 lh-sm">${f.name}</h6>
              <div class="d-flex align-items-center gap-2 mb-2">
                <i class="fa-solid fa-chalkboard-user text-success"></i>
                <span class="fw-semibold text-success small">${f.faculty}</span>
              </div>
            </div>

            <div class="pt-2 border-top border-secondary-subtle d-flex justify-content-between align-items-center extra-small text-secondary">
              <span>Type: <strong class="text-white">${f.type}</strong></span>
              <span>Room: <strong class="text-white">${f.room}</strong></span>
            </div>
          </div>
        </div>
      `;
      grid.insertAdjacentHTML('beforeend', card);
    });
  }
}

let rawAadharNumber = '';
let aadharMasked = true;
let profileDataCache = null;

function formatAadhar(num, masked = true) {
  if (!num) return '•••• •••• ••••';
  const clean = num.toString().replace(/\s+/g, '');
  if (clean.length < 12) return clean;
  if (masked) {
    return `•••• •••• ${clean.slice(-4)}`;
  }
  return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)}`;
}

function toggleAadharMask() {
  aadharMasked = !aadharMasked;
  const aadharEl = document.getElementById('tile-aadhar');
  const iconEl = document.getElementById('aadhar-eye-icon');
  if (aadharEl) {
    aadharEl.textContent = formatAadhar(rawAadharNumber, aadharMasked);
  }
  if (iconEl) {
    iconEl.className = aadharMasked ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
  }
}

function showToast(message) {
  const toast = document.getElementById('ig-toast');
  const textEl = document.getElementById('ig-toast-text');
  if (!toast) return;
  if (textEl) textEl.textContent = message;
  toast.classList.remove('d-none');
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';

  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
    setTimeout(() => toast.classList.add('d-none'), 300);
  }, 2200);
}

function copyToClipboard(text, label = 'Copied') {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`${label} copied!`);
    }).catch(() => fallbackCopy(text, label));
  } else {
    fallbackCopy(text, label);
  }
}

function fallbackCopy(text, label) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast(`${label} copied!`);
}

function copyStudentSummary() {
  const name = document.getElementById('profile-page-name')?.textContent || 'ESAMBADI GOUTHAM REDDY';
  const regno = document.getElementById('tile-regno')?.textContent || '99240040465';
  const degree = document.getElementById('profile-page-degree')?.textContent || 'B.Tech. Computer Science and Engineering';
  const advisor = document.getElementById('tile-advisor')?.textContent || 'Dr. J. JEYA A. CELIN';
  const att = document.getElementById('profile-stat-att')?.textContent || '91.1%';

  const summary = `🎓 Kalasalingam University SIS Profile\nStudent: ${name}\nReg No: ${regno}\nDegree: ${degree}\nAttendance: ${att}\nAdvisor: ${advisor}\nPortal: https://sis.kalasalingam.ac.in`;
  copyToClipboard(summary, 'Student Profile');
}

function switchProfileSubTab(subTab, btnEl) {
  document.querySelectorAll('.profile-subtab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.profile-info-tiles').forEach(panel => panel.classList.add('d-none'));

  if (btnEl) {
    btnEl.classList.add('active');
  } else {
    const btns = document.querySelectorAll('.profile-subtab-btn');
    if (subTab === 'academic' && btns[0]) btns[0].classList.add('active');
    if (subTab === 'personal' && btns[1]) btns[1].classList.add('active');
    if (subTab === 'contact' && btns[2]) btns[2].classList.add('active');
  }

  const target = document.getElementById(`subtab-profile-${subTab}`);
  if (target) target.classList.remove('d-none');
}

async function fetchProfile() {
  try {
    const res = await fetch('/api/profile');
    const data = await res.json();
    profileDataCache = data;

    if (data.name) {
      // Basic profile identity
      const nameEl = document.getElementById('profile-page-name');
      if (nameEl) nameEl.textContent = data.name;

      updateGlobalUserInitials(data.name);

      const regnoEl = document.getElementById('header-profile-regno');
      if (regnoEl) regnoEl.textContent = data.register_no;

      const pageRegno = document.getElementById('profile-page-regno');
      if (pageRegno) pageRegno.textContent = data.register_no;

      const degEl = document.getElementById('profile-page-degree');
      if (degEl) degEl.textContent = data.programme || 'B.Tech. Computer Science and Engineering';

      // Parse Advisor name & phone
      let advName = data.faculty_advisor || 'Dr. J. JEYA A. CELIN';
      let advPhone = '8754915909';
      const phoneMatch = advName.match(/\((.*?)\)/);
      if (phoneMatch) {
        advPhone = phoneMatch[1];
        advName = advName.replace(/\(.*?\)/, '').trim();
      }

      const advEl = document.getElementById('profile-page-advisor');
      if (advEl) advEl.textContent = advName;

      const secEl = document.getElementById('profile-stat-sec');
      if (secEl) secEl.textContent = data.section || '24S05';

      // Subtab Academic
      const tileProg = document.getElementById('tile-prog');
      if (tileProg) tileProg.textContent = data.programme || 'B.Tech. Computer Science and Engineering';

      const tileBatchSec = document.getElementById('tile-batch-sec');
      if (tileBatchSec) tileBatchSec.textContent = `Section ${data.section || '24S05'} · Batch ${data.batch || '2024'}`;

      const tileAdv = document.getElementById('tile-advisor');
      if (tileAdv) tileAdv.textContent = advName;

      const tileAdvPhone = document.getElementById('tile-advisor-phone');
      if (tileAdvPhone) tileAdvPhone.innerHTML = `<i class="fa-solid fa-phone me-1 text-success"></i>+91 ${advPhone}`;

      const btnCallAdv = document.getElementById('btn-call-advisor');
      if (btnCallAdv) btnCallAdv.href = `tel:${advPhone}`;

      // Subtab Personal
      const tileRegno = document.getElementById('tile-regno');
      if (tileRegno) tileRegno.textContent = data.register_no;

      rawAadharNumber = data.aadhar || '';
      const tileAadhar = document.getElementById('tile-aadhar');
      if (tileAadhar) tileAadhar.textContent = formatAadhar(rawAadharNumber, aadharMasked);

      const tileAbc = document.getElementById('tile-abc');
      if (tileAbc) tileAbc.textContent = data.abc_id || '-';

      const tileDob = document.getElementById('tile-dob');
      if (tileDob) tileDob.textContent = data.dob || '-';

      const tileGender = document.getElementById('tile-gender');
      if (tileGender) tileGender.textContent = data.gender || '-';

      const tileComm = document.getElementById('tile-community');
      if (tileComm) tileComm.textContent = data.community || '-';

      // Subtab Contact
      const tileParent = document.getElementById('tile-parent');
      let parentName = '-';
      if (data.address) {
        const parts = data.address.split(',');
        if (parts.length > 0 && parts[0].trim()) {
          parentName = parts[0].trim();
        }
      }
      if (tileParent) tileParent.textContent = parentName;

      const tileAddress = document.getElementById('tile-address');
      if (tileAddress && data.address) {
        tileAddress.textContent = data.address;
      }

      // Save name into accounts array
      if (accounts[currentAccountIndex]) {
        accounts[currentAccountIndex].name = data.name;
        saveAccounts();
      }
    }
  } catch (e) {
    console.error('Failed to fetch profile:', e);
  }
}

function switchTab(tab, btnEl) {
  activeTab = tab;
  document.querySelectorAll('.nav-icon-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-pane-view').forEach(pane => pane.classList.add('d-none'));

  if (btnEl) btnEl.classList.add('active');
  const targetPane = document.getElementById(`tab-content-${tab}`);
  if (targetPane) targetPane.classList.remove('d-none');

  // Toggle Topbar view between SIS Portal brand logo and Instagram Profile header
  const brandBar = document.getElementById('topbar-brand-view');
  const profileBar = document.getElementById('topbar-profile-view');
  if (tab === 'profile') {
    if (brandBar) {
      brandBar.classList.remove('d-flex');
      brandBar.classList.add('d-none');
    }
    if (profileBar) {
      profileBar.classList.remove('d-none');
      profileBar.classList.add('d-flex');
    }
    const currentRegno = accounts[currentAccountIndex] ? accounts[currentAccountIndex].regNo : '99240040465';
    const headerReg = document.getElementById('header-profile-regno');
    if (headerReg) headerReg.textContent = currentRegno;
  } else {
    if (profileBar) {
      profileBar.classList.remove('d-flex');
      profileBar.classList.add('d-none');
    }
    if (brandBar) {
      brandBar.classList.remove('d-none');
      brandBar.classList.add('d-flex');
    }
  }

  if (tab === 'home') fetchTimetable();
  if (tab === 'attendance' && !cachedData.attendance) fetchAttendance();
  if (tab === 'marks') renderMarks();
  if (tab === 'fees') renderFees();
}

function reloadActiveTab() {
  cachedData[activeTab] = null;
  if (activeTab === 'home') fetchTimetable();
  if (activeTab === 'attendance') fetchAttendance();
  if (activeTab === 'marks') fetchMarks();
  if (activeTab === 'fees') fetchFees();
}

async function preloadAllData() {
  fetchMarks();
  fetchFees();
}

// ATTENDANCE TAB
async function fetchAttendance() {
  const grid = document.getElementById('attendance-grid');
  if (!cachedData.attendance) {
    if (grid) grid.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><div class="text-secondary extra-small mt-2">Loading attendance...</div></div>';
    const res = await fetch('/api/attendance');
    cachedData.attendance = await res.json();
  }

  const courses = cachedData.attendance.data || [];
  if (grid) grid.innerHTML = '';
  let totalConducted = 0, totalAttended = 0;

  courses.forEach(c => {
    const conducted = parseInt(c.total) || 0;
    const attended = parseInt(c.present) || 0;
    const absent = parseInt(c.absent) || (conducted - attended - (parseInt(c.on_duty) || 0));
    const onDuty = parseInt(c.on_duty) || 0;
    const pct = parseFloat(c.percentage) || 0;

    totalConducted += conducted;
    totalAttended += attended;

    const isSafe = pct >= 75;
    const gaugeClass = pct >= 85 ? 'gauge-safe text-success' : (pct >= 75 ? 'gauge-warn text-warning' : 'gauge-danger text-danger');
    const fillClass = pct >= 85 ? 'progress-fill-safe' : (pct >= 75 ? 'progress-fill-warn' : 'progress-fill-danger');

    const card = `
      <div class="attendance-card">
        <!-- Card Header -->
        <div class="card-header-row">
          <div class="course-meta">
            <div class="course-badges-row">
              <span class="course-code-badge">${c.course_code}</span>
              <span class="credits-badge">${c.credits} Credits</span>
            </div>
            <h5 class="course-title">${c.course_name}</h5>
          </div>

          <div class="percentage-gauge ${gaugeClass}">
            <span class="pct-val">${pct}%</span>
            <span class="pct-lbl">RATE</span>
          </div>
        </div>

        <!-- Progress Track -->
        <div class="attendance-progress-wrapper">
          <div class="progress-track-custom">
            <div class="progress-fill-custom ${fillClass}" style="width: ${pct}%;"></div>
          </div>
          <div class="progress-sub-row">
            <span><i class="fa-solid fa-flag text-warning me-1"></i>Min 75% Target</span>
            <span class="status-pill ${isSafe ? 'status-pill-safe' : 'status-pill-danger'}">
              ${isSafe ? 'Safe Zone' : 'Below Target'}
            </span>
          </div>
        </div>

        <!-- 4-Column Stats Strip -->
        <div class="attendance-stats-strip">
          <div class="stat-col">
            <span class="stat-num text-success">${attended}</span>
            <span class="stat-lbl">Attended</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-col">
            <span class="stat-num text-white">${conducted}</span>
            <span class="stat-lbl">Conducted</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-col">
            <span class="stat-num ${absent > 0 ? 'text-danger' : 'text-secondary'}">${absent}</span>
            <span class="stat-lbl">Absent</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-col">
            <span class="stat-num text-info">${onDuty}</span>
            <span class="stat-lbl">On Duty</span>
          </div>
        </div>

        <!-- Expand Button for Period Breakdown -->
        <button class="expand-slots-btn" onclick="toggleAttendanceSlots('${c.assign_id}', this)">
          <span><i class="fa-regular fa-calendar-check me-2"></i>View Class Log (${conducted} periods)</span>
          <i class="fa-solid fa-chevron-down transition-icon"></i>
        </button>

        <!-- Dynamic Slots Drawer -->
        <div id="slots-container-${c.assign_id}" class="d-none slots-drawer"></div>
      </div>
    `;
    if (grid) grid.insertAdjacentHTML('beforeend', card);
  });

  const overallPct = totalConducted > 0 ? ((totalAttended / totalConducted) * 100).toFixed(1) : 0;
  
  // Update summary header and profile stat
  const attSummaryPct = document.getElementById('att-summary-pct');
  const attSummaryBar = document.getElementById('att-summary-bar');
  const attSummaryCounts = document.getElementById('att-summary-counts');
  if (attSummaryPct) attSummaryPct.textContent = `${overallPct}%`;
  if (attSummaryBar) attSummaryBar.style.width = `${overallPct}%`;
  if (attSummaryCounts) attSummaryCounts.textContent = `${totalAttended} Attended / ${totalConducted} Conducted`;

  const attStat = document.getElementById('profile-stat-att');
  if (attStat) attStat.textContent = `${overallPct}%`;
}

async function toggleAttendanceSlots(assignId, btnEl) {
  const container = document.getElementById(`slots-container-${assignId}`);
  const icon = btnEl.querySelector('.transition-icon');

  if (!container.classList.contains('d-none')) {
    container.classList.add('d-none');
    btnEl.classList.remove('expanded');
    return;
  }

  btnEl.classList.add('expanded');
  if (!container.innerHTML) {
    container.innerHTML = '<div class="text-secondary extra-small py-2 text-center"><div class="spinner-border spinner-border-sm me-2"></div>Loading periods...</div>';
    container.classList.remove('d-none');
    
    const res = await fetch(`/api/attendance-slots/${assignId}`);
    const json = await res.json();
    const slots = json.data || [];

    if (slots.length === 0) {
      container.innerHTML = '<div class="text-secondary extra-small py-2 text-center">No periods recorded yet.</div>';
    } else {
      let html = '';
      slots.slice(0, 10).forEach(s => {
        const isPresent = s.status === 'P';
        const badge = isPresent 
          ? '<span class="slot-badge-present"><i class="fa-solid fa-check me-1"></i>Present</span>' 
          : '<span class="slot-badge-absent"><i class="fa-solid fa-xmark me-1"></i>Absent</span>';
        html += `
          <div class="slot-item-row">
            <div>
              <span class="text-white fw-semibold">${s.entry_date}</span>
              <span class="text-secondary ms-2">${s.slot_name || ''}</span>
            </div>
            ${badge}
          </div>
        `;
      });
      if (slots.length > 10) {
        html += `<div class="text-center text-secondary extra-small py-1">+ ${slots.length - 10} earlier periods recorded</div>`;
      }
      container.innerHTML = html;
    }
  } else {
    container.classList.remove('d-none');
  }
}

// MARKS TAB
async function fetchMarks() {
  const res = await fetch('/api/marks');
  cachedData.marks = await res.json();
  if (activeTab === 'marks') renderMarks();
}

function renderMarks() {
  const grid = document.getElementById('marks-grid');
  if (!cachedData.marks) {
    grid.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div></div>';
    return;
  }

  const courses = cachedData.marks.data || [];
  grid.innerHTML = '';

  courses.forEach(m => {
    const card = `
      <div class="attendance-card">
        <div class="card-header-row">
          <div class="course-meta">
            <div class="course-badges-row">
              <span class="course-code-badge" style="background: rgba(168, 85, 247, 0.16); color: #c084fc; border-color: rgba(168, 85, 247, 0.3);">${m.course_code}</span>
              <span class="credits-badge">${m.credits} Credits</span>
            </div>
            <h5 class="course-title">${m.course_name}</h5>
          </div>
        </div>

        <button class="expand-slots-btn" onclick="toggleAssessmentMarks('${m.id}', this)">
          <span><i class="fa-solid fa-award me-2 text-warning"></i>View Assessment Scores</span>
          <i class="fa-solid fa-chevron-down transition-icon"></i>
        </button>

        <div id="assessments-container-${m.id}" class="d-none slots-drawer"></div>
      </div>
    `;
    grid.insertAdjacentHTML('beforeend', card);
  });
}

async function toggleAssessmentMarks(markId, btnEl) {
  const container = document.getElementById(`assessments-container-${markId}`);

  if (!container.classList.contains('d-none')) {
    container.classList.add('d-none');
    btnEl.classList.remove('expanded');
    return;
  }

  btnEl.classList.add('expanded');
  if (!container.innerHTML) {
    container.innerHTML = '<div class="text-secondary extra-small py-2 text-center"><div class="spinner-border spinner-border-sm me-2"></div>Loading scores...</div>';
    container.classList.remove('d-none');
    
    const res = await fetch(`/api/mark-assessments/${markId}`);
    const json = await res.json();
    const assessments = json.data || [];

    if (assessments.length === 0) {
      container.innerHTML = '<div class="text-secondary extra-small py-2 text-center">No assessment marks uploaded yet.</div>';
    } else {
      let html = '';
      assessments.forEach(a => {
        html += `
          <div class="slot-item-row">
            <span class="text-white fw-semibold">${a.exam}</span>
            <span class="fs-6 fw-bold text-success">${a.marks} Marks</span>
          </div>
        `;
      });
      container.innerHTML = html;
    }
  } else {
    container.classList.remove('d-none');
  }
}

// FEES TAB
async function fetchFees() {
  const res = await fetch('/api/payments');
  cachedData.fees = await res.json();
  if (activeTab === 'fees') renderFees();
}

function renderFees() {
  const grid = document.getElementById('fees-grid');
  if (!cachedData.fees) {
    grid.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div></div>';
    return;
  }

  const txs = cachedData.fees.transactions || [];
  grid.innerHTML = '';

  txs.forEach(t => {
    const card = `
      <div class="attendance-card">
        <div class="d-flex align-items-center justify-content-between">
          <span class="credits-badge">Bill #${t.bill_no}</span>
          <span class="text-secondary extra-small">${t.date}</span>
        </div>

        <div>
          <h5 class="course-title mb-1">${t.head}</h5>
          <div class="display-6 fw-bold text-success my-2">₹${t.amount}</div>
        </div>

        <div class="d-flex align-items-center justify-content-between pt-2 border-top border-secondary-subtle">
          <span class="status-pill status-pill-safe">${t.mode}</span>
          <a href="${t.print_url}" target="_blank" class="btn btn-outline-light btn-sm rounded-pill px-3 extra-small">
            <i class="fa-solid fa-file-pdf me-1 text-danger"></i> Receipt PDF
          </a>
        </div>
      </div>
    `;
    grid.insertAdjacentHTML('beforeend', card);
  });
}

// INSTAGRAM 3-SLASH MENU & GENERIC PROXY
function openInstagramMenu() {
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('instagramMenuModal'));
  modal.show();
}

function openPageProxy(pagePath, title) {
  const menuModalEl = document.getElementById('instagramMenuModal');
  const menuModal = bootstrap.Modal.getInstance(menuModalEl);
  if (menuModal) menuModal.hide();

  document.querySelectorAll('.tab-pane-view').forEach(p => p.classList.add('d-none'));

  const genContainer = document.getElementById('tab-content-generic');
  if (genContainer) genContainer.classList.remove('d-none');

  const titleEl = document.getElementById('subpage-title');
  if (titleEl) titleEl.textContent = title;

  const brandBar = document.getElementById('topbar-brand-view');
  const profileBar = document.getElementById('topbar-profile-view');
  const subpageBar = document.getElementById('topbar-subpage-view');

  if (brandBar) brandBar.classList.add('d-none');
  if (profileBar) {
    profileBar.classList.remove('d-flex');
    profileBar.classList.add('d-none');
  }
  if (subpageBar) {
    subpageBar.classList.remove('d-none');
    subpageBar.classList.add('d-flex');
  }

  const iframe = document.getElementById('generic-page-iframe');
  if (iframe) {
    iframe.src = `/api/generic-page/${pagePath}`;
  }

  history.pushState({ view: 'subpage', pagePath, title }, '');
}

function closeGenericPage() {
  const genContainer = document.getElementById('tab-content-generic');
  if (genContainer) genContainer.classList.add('d-none');

  const iframe = document.getElementById('generic-page-iframe');
  if (iframe) iframe.src = 'about:blank';

  const subpageBar = document.getElementById('topbar-subpage-view');
  if (subpageBar) {
    subpageBar.classList.remove('d-flex');
    subpageBar.classList.add('d-none');
  }

  const brandBar = document.getElementById('topbar-brand-view');
  const profileBar = document.getElementById('topbar-profile-view');

  if (activeTab === 'profile') {
    if (brandBar) brandBar.classList.add('d-none');
    if (profileBar) {
      profileBar.classList.remove('d-none');
      profileBar.classList.add('d-flex');
    }
  } else {
    if (profileBar) {
      profileBar.classList.remove('d-flex');
      profileBar.classList.add('d-none');
    }
    if (brandBar) brandBar.classList.remove('d-none');
  }

  const activePane = document.getElementById(`tab-content-${activeTab}`);
  if (activePane) activePane.classList.remove('d-none');
}

function reloadGenericPage() {
  const iframe = document.getElementById('generic-page-iframe');
  if (iframe && iframe.src && iframe.src !== 'about:blank') {
    iframe.src = iframe.src;
    showToast('Page reloaded');
  }
}

function goBack() {
  const genContainer = document.getElementById('tab-content-generic');
  if (genContainer && !genContainer.classList.contains('d-none')) {
    closeGenericPage();
    return;
  }

  const openModal = document.querySelector('.modal.show');
  if (openModal) {
    const modalInstance = bootstrap.Modal.getInstance(openModal);
    if (modalInstance) modalInstance.hide();
    return;
  }

  if (activeTab !== 'home') {
    const homeBtn = document.querySelector('.nav-icon-btn');
    switchTab('home', homeBtn);
  }
}

// HARDWARE & BROWSER BACK BUTTON (POPSTATE)
window.addEventListener('popstate', (e) => {
  const openModal = document.querySelector('.modal.show');
  if (openModal) {
    const modalInstance = bootstrap.Modal.getInstance(openModal);
    if (modalInstance) {
      modalInstance.hide();
      return;
    }
  }

  const genContainer = document.getElementById('tab-content-generic');
  if (genContainer && !genContainer.classList.contains('d-none')) {
    closeGenericPage();
    return;
  }

  if (activeTab !== 'home') {
    const homeBtn = document.querySelector('.nav-icon-btn');
    switchTab('home', homeBtn);
  }
});

// MULTI-ACCOUNT SWITCHING (INSTAGRAM BOTTOM SHEET)
function setupLongPressProfile() {
  const btn = document.getElementById('profile-tab-btn');
  if (!btn) return;
  let pressTimer;

  btn.addEventListener('touchstart', () => {
    pressTimer = setTimeout(() => openAccountSwitcher(), 600);
  });
  btn.addEventListener('touchend', () => clearTimeout(pressTimer));
  btn.addEventListener('mousedown', () => {
    pressTimer = setTimeout(() => openAccountSwitcher(), 600);
  });
  btn.addEventListener('mouseup', () => clearTimeout(pressTimer));
}

function openAccountSwitcher() {
  const list = document.getElementById('accounts-list');
  if (!list) return;
  list.innerHTML = '';

  if (accounts.length === 0) {
    list.innerHTML = '<div class="text-center py-3 text-secondary extra-small">No saved accounts found.</div>';
  } else {
    accounts.forEach((acc, idx) => {
      const isActive = idx === currentAccountIndex;
      const initial = (acc.name || acc.regNo).charAt(0).toUpperCase();
      const displayName = acc.name || 'Student Account';

      const item = document.createElement('div');
      item.className = `ig-account-row ${isActive ? 'active' : ''}`;
      item.onclick = () => switchAccount(idx);

      item.innerHTML = `
        <div class="d-flex align-items-center gap-3">
          <div class="ig-account-avatar ${isActive ? 'active-ring' : ''}">
            <div class="ig-avatar-letter">${initial}</div>
          </div>
          <div class="ig-account-meta">
            <div class="ig-account-username">${acc.regNo}</div>
            <div class="ig-account-subname text-truncate" style="max-width: 190px;">${displayName}</div>
          </div>
        </div>
        <div class="d-flex align-items-center gap-2">
          ${isActive ? '<i class="fa-solid fa-circle-check ig-active-checkmark"></i>' : ''}
          <button type="button" class="btn-remove-account" onclick="removeSavedAccount(event, ${idx})" title="Remove account">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      `;
      list.appendChild(item);
    });
  }

  const modalEl = document.getElementById('accountSwitcherModal');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

function switchAccount(index) {
  const modalEl = document.getElementById('accountSwitcherModal');
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();

  if (index === currentAccountIndex) {
    return;
  }

  currentAccountIndex = index;
  saveAccounts();
  localStorage.setItem('sis_is_logged_in', 'true');

  const acc = accounts[index];
  updateGlobalUserInitials(acc.name || acc.regNo);
  showToast(`Switching to ${acc.regNo}...`);
  performLogin(acc.regNo, acc.password);
}

function addNewAccount() {
  const switcherEl = document.getElementById('accountSwitcherModal');
  const switcherModal = bootstrap.Modal.getInstance(switcherEl);
  if (switcherModal) switcherModal.hide();

  const menuEl = document.getElementById('instagramMenuModal');
  const menuModal = bootstrap.Modal.getInstance(menuEl);
  if (menuModal) menuModal.hide();

  document.getElementById('app-container').classList.add('d-none');
  document.getElementById('login-container').classList.remove('d-none');
  showBlankLoginForm();
}

function removeSavedAccount(event, index) {
  if (event) event.stopPropagation();

  const removedAcc = accounts[index];
  accounts.splice(index, 1);

  if (accounts.length === 0) {
    currentAccountIndex = 0;
    saveAccounts();
    localStorage.setItem('sis_is_logged_in', 'false');
    const modalEl = document.getElementById('accountSwitcherModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    document.getElementById('app-container').classList.add('d-none');
    document.getElementById('login-container').classList.remove('d-none');
    showBlankLoginForm();
    showToast('All accounts removed');
    return;
  }

  if (currentAccountIndex === index) {
    currentAccountIndex = 0;
    saveAccounts();
    const modalEl = document.getElementById('accountSwitcherModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    const nextAcc = accounts[0];
    showToast(`Switched to ${nextAcc.regNo}`);
    performLogin(nextAcc.regNo, nextAcc.password);
    return;
  } else if (currentAccountIndex > index) {
    currentAccountIndex--;
    saveAccounts();
  } else {
    saveAccounts();
  }

  openAccountSwitcher();
  showToast(`Account ${removedAcc.regNo} removed`);
}

function logoutCurrentAccount() {
  const menuEl = document.getElementById('instagramMenuModal');
  const menuModal = bootstrap.Modal.getInstance(menuEl);
  if (menuModal) menuModal.hide();

  localStorage.setItem('sis_is_logged_in', 'false');

  document.getElementById('app-container').classList.add('d-none');
  document.getElementById('login-container').classList.remove('d-none');

  initLoginView();
  showToast('Logged out');
}

// PROFILE PDF EXPORT, WHATSAPP SHARING & PRINTING
function openShareProfileModal() {
  const modalEl = document.getElementById('shareProfileModal');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

function toggleAllShareOptions(checked) {
  const checks = document.querySelectorAll('#share-options-list .ig-custom-check');
  checks.forEach(c => c.checked = checked);
}

function getSelectedProfileData() {
  const name = document.getElementById('profile-page-name')?.textContent?.trim() || profileDataCache?.name || 'ESAMBADI GOUTHAM REDDY';
  const regno = document.getElementById('header-profile-regno')?.textContent?.trim() || profileDataCache?.register_no || (accounts[currentAccountIndex]?.regNo) || '99240040465';
  const programme = document.getElementById('tile-prog')?.textContent?.trim() || profileDataCache?.programme || '-';
  const section = document.getElementById('profile-stat-sec')?.textContent?.trim() || profileDataCache?.section || '-';
  const batch = profileDataCache?.batch || '-';
  const advisor = document.getElementById('tile-advisor')?.textContent?.trim() || profileDataCache?.faculty_advisor || '-';
  const advisorPhone = document.getElementById('tile-advisor-phone')?.textContent?.replace(/[^0-9]/g, '') || '-';
  const att = document.getElementById('profile-stat-att')?.textContent?.trim() || '-';
  const aadhar = rawAadharNumber || profileDataCache?.aadhar || '-';
  const abcId = document.getElementById('tile-abc')?.textContent?.trim() || profileDataCache?.abc_id || '-';
  const dob = document.getElementById('tile-dob')?.textContent?.trim() || profileDataCache?.dob || '-';
  const gender = document.getElementById('tile-gender')?.textContent?.trim() || profileDataCache?.gender || '-';
  const community = document.getElementById('tile-community')?.textContent?.trim() || profileDataCache?.community || '-';
  const parent = document.getElementById('tile-parent')?.textContent?.trim() || '-';
  const address = document.getElementById('tile-address')?.textContent?.trim() || profileDataCache?.address || '-';

  const incPersonal = document.getElementById('share-opt-personal')?.checked ?? true;
  const incAcademic = document.getElementById('share-opt-academic')?.checked ?? true;
  const incAttendance = document.getElementById('share-opt-attendance')?.checked ?? true;
  const incAdvisor = document.getElementById('share-opt-advisor')?.checked ?? true;
  const incIds = document.getElementById('share-opt-ids')?.checked ?? true;
  const incContact = document.getElementById('share-opt-contact')?.checked ?? true;
  const incCourses = document.getElementById('share-opt-courses')?.checked ?? true;

  let coursesList = [];
  if (cachedData.attendance && cachedData.attendance.data) {
    coursesList = cachedData.attendance.data.map(c => ({
      code: c.code || '',
      title: c.name || c.title || '',
      faculty: c.faculty || '',
      att: c.percentage || c.attended_conducted || ''
    }));
  } else if (cachedData.timetable && cachedData.timetable.faculties) {
    coursesList = cachedData.timetable.faculties.map(f => ({
      code: f.code || '',
      title: f.title || f.name || '',
      faculty: f.faculty || '',
      att: ''
    }));
  }

  return {
    name, regno, programme, section, batch, advisor, advisorPhone, att,
    aadhar, abcId, dob, gender, community, parent, address, coursesList,
    incPersonal, incAcademic, incAttendance, incAdvisor, incIds, incContact, incCourses
  };
}

function buildSummaryText(d) {
  let msg = `🎓 *KALASALINGAM UNIVERSITY - SIS PROFILE SUMMARY*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  if (d.incPersonal) {
    msg += `👤 *Student Name*: ${d.name}\n`;
    msg += `🆔 *Register Number*: ${d.regno}\n`;
  }
  if (d.incAcademic) {
    msg += `📚 *Programme*: ${d.programme}\n`;
    msg += `🏛 *Section*: ${d.section} | *Batch*: ${d.batch}\n`;
  }
  if (d.incAttendance) {
    msg += `📊 *Attendance*: ${d.att}\n`;
  }
  if (d.incAdvisor) {
    msg += `👨‍🏫 *Faculty Advisor*: ${d.advisor} (📞 +91 ${d.advisorPhone})\n`;
  }
  if (d.incIds) {
    msg += `🪪 *Aadhaar Number*: ${d.aadhar}\n`;
    msg += `💳 *ABC ID*: ${d.abcId}\n`;
    msg += `🎂 *DOB*: ${d.dob} | *Gender*: ${d.gender}\n`;
    msg += `🏷 *Category*: ${d.community}\n`;
  }
  if (d.incContact) {
    msg += `🏡 *Parent/Guardian*: ${d.parent}\n`;
    msg += `📍 *Permanent Address*: ${d.address}\n`;
  }
  if (d.incCourses && d.coursesList.length > 0) {
    msg += `📖 *Enrolled Courses*:\n`;
    d.coursesList.slice(0, 8).forEach((c, i) => {
      msg += `  ${i + 1}. [${c.code}] ${c.title} (${c.faculty})\n`;
    });
  }
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🌐 Official KARE SIS Portal: https://sis.kalasalingam.ac.in`;
  return msg;
}

function renderPrintableContainer(d) {
  const container = document.getElementById('pdf-printable-container');
  if (!container) return;

  const docId = `KARE-SIS-${d.regno}-${Date.now().toString(36).toUpperCase()}`;
  const nowStr = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  let html = `
    <div class="pdf-doc-sheet">
      <!-- University Header -->
      <div class="pdf-header-top">
        <div>
          <div class="pdf-univ-name">Kalasalingam Academy of Research and Education</div>
          <div class="pdf-univ-sub">Deemed to be University Under Section 3 of UGC Act 1956 · Anand Nagar, Krishnankoil - 626126</div>
          <div class="pdf-univ-sub fw-semibold text-danger mt-1">STUDENT PROFILE & ACADEMIC DOSSIER</div>
        </div>
        <div class="pdf-doc-badge">
          <div>Ref: ${docId}</div>
          <div class="extra-small text-muted fw-normal">${nowStr}</div>
        </div>
      </div>
  `;

  if (d.incPersonal) {
    html += `
      <div class="pdf-section-title">1. Student Identity</div>
      <table class="pdf-data-table">
        <tr><th>Full Legal Name</th><td><strong>${d.name}</strong></td></tr>
        <tr><th>Registration Number</th><td><span style="font-family: monospace; font-weight: bold; font-size: 0.95rem;">${d.regno}</span></td></tr>
      </table>
    `;
  }

  if (d.incAcademic) {
    html += `
      <div class="pdf-section-title">2. Academic Information</div>
      <table class="pdf-data-table">
        <tr><th>Degree / Programme</th><td>${d.programme}</td></tr>
        <tr><th>Section & Batch</th><td>Section: <strong>${d.section}</strong> | Admission Batch: <strong>${d.batch}</strong></td></tr>
        <tr><th>Institution</th><td>School of Computing, Kalasalingam University</td></tr>
      </table>
    `;
  }

  if (d.incAttendance) {
    html += `
      <div class="pdf-section-title">3. Attendance Record</div>
      <table class="pdf-data-table">
        <tr><th>Current Rate</th><td><strong style="color: #047857; font-size: 1.05rem;">${d.att}</strong></td></tr>
        <tr><th>Eligibility Status</th><td>Eligible for End-Semester Examinations (Above 75% threshold)</td></tr>
      </table>
    `;
  }

  if (d.incAdvisor) {
    html += `
      <div class="pdf-section-title">4. Faculty Mentorship</div>
      <table class="pdf-data-table">
        <tr><th>Faculty Advisor</th><td><strong>${d.advisor}</strong></td></tr>
        <tr><th>Contact Number</th><td>+91 ${d.advisorPhone}</td></tr>
      </table>
    `;
  }

  if (d.incIds) {
    html += `
      <div class="pdf-section-title">5. Official Registry & National IDs</div>
      <table class="pdf-data-table">
        <tr><th>Aadhaar Number</th><td><span style="font-family: monospace;">${d.aadhar}</span></td></tr>
        <tr><th>Academic Bank of Credits (ABC ID)</th><td><span style="font-family: monospace;">${d.abcId}</span></td></tr>
        <tr><th>Date of Birth</th><td>${d.dob}</td></tr>
        <tr><th>Gender</th><td>${d.gender}</td></tr>
        <tr><th>Category / Community</th><td>${d.community}</td></tr>
      </table>
    `;
  }

  if (d.incContact) {
    html += `
      <div class="pdf-section-title">6. Guardian & Residential Address</div>
      <table class="pdf-data-table">
        <tr><th>Parent / Guardian</th><td>${d.parent}</td></tr>
        <tr><th>Permanent Address</th><td>${d.address}</td></tr>
      </table>
    `;
  }

  if (d.incCourses && d.coursesList.length > 0) {
    html += `
      <div class="pdf-section-title">7. Registered Course Curriculum</div>
      <table class="pdf-courses-table">
        <thead>
          <tr>
            <th style="width: 15%;">Course Code</th>
            <th style="width: 50%;">Course Title</th>
            <th style="width: 35%;">Faculty in Charge</th>
          </tr>
        </thead>
        <tbody>
          ${d.coursesList.map(c => `
            <tr>
              <td style="font-family: monospace; font-weight: bold;">${c.code}</td>
              <td>${c.title}</td>
              <td>${c.faculty}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  html += `
      <div class="pdf-footer-note">
        <div>Official computer-generated record from Kalasalingam University SIS Portal.</div>
        <div>Page 1 of 1 · Authenticated via SIS System</div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function downloadSelectedProfilePDF() {
  const d = getSelectedProfileData();
  renderPrintableContainer(d);

  showToast('Preparing PDF document...');

  const element = document.getElementById('pdf-printable-container');
  const opt = {
    margin: [8, 10, 8, 10],
    filename: `KARE_SIS_Profile_${d.regno}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  if (typeof html2pdf !== 'undefined') {
    html2pdf().set(opt).from(element).save().then(() => {
      showToast('📄 Official PDF generated and saved!');
      const modalEl = document.getElementById('shareProfileModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }).catch(err => {
      console.error('html2pdf failed:', err);
      window.print();
    });
  } else {
    window.print();
  }
}

function shareProfileToWhatsApp() {
  const d = getSelectedProfileData();
  const msg = buildSummaryText(d);
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');

  const modalEl = document.getElementById('shareProfileModal');
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();
  showToast('Opening WhatsApp...');
}

async function shareProfileNativeOrPrint() {
  const d = getSelectedProfileData();
  const summaryText = buildSummaryText(d);

  if (navigator.share) {
    try {
      await navigator.share({
        title: `SIS Profile - ${d.name} (${d.regno})`,
        text: summaryText,
        url: 'https://sis.kalasalingam.ac.in'
      });
      showToast('Shared successfully!');
      const modalEl = document.getElementById('shareProfileModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
      return;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Native share failed, printing:', err);
      } else {
        return;
      }
    }
  }

  renderPrintableContainer(d);
  const modalEl = document.getElementById('shareProfileModal');
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();

  setTimeout(() => {
    window.print();
  }, 250);
}

function copySelectedProfileText() {
  const d = getSelectedProfileData();
  const summaryText = buildSummaryText(d);
  copyToClipboard(summaryText, 'Profile details');

  const modalEl = document.getElementById('shareProfileModal');
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();
}

