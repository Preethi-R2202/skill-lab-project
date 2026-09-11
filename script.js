/* =========================================================================
   Digital Time Capsule — Application Logic
   Client-side demo backend using localStorage. Every page includes this
   file; each page's specific behaviour is wired up at the bottom based on
   which elements are present on that page.
   ========================================================================= */

/* ---------------------------- Storage layer ---------------------------- */
const DB = {
  usersKey: 'dtc_users',
  sessionKey: 'dtc_session',
  capsulesKey: 'dtc_capsules',
  prefsKeyFor(userId) { return `dtc_prefs_${userId}`; },

  getUsers() { return JSON.parse(localStorage.getItem(this.usersKey) || '[]'); },
  saveUsers(users) { localStorage.setItem(this.usersKey, JSON.stringify(users)); },

  getSession() { try { return JSON.parse(localStorage.getItem(this.sessionKey)); } catch { return null; } },
  setSession(userId) { localStorage.setItem(this.sessionKey, JSON.stringify({ userId })); },
  clearSession() { localStorage.removeItem(this.sessionKey); },

  getCapsules() { return JSON.parse(localStorage.getItem(this.capsulesKey) || '[]'); },
  saveCapsules(list) { localStorage.setItem(this.capsulesKey, JSON.stringify(list)); },

  getPrefs(userId) {
    const raw = localStorage.getItem(this.prefsKeyFor(userId));
    return raw ? JSON.parse(raw) : { darkMode: false, emailNotifications: true, defaultMood: '' };
  },
  savePrefs(userId, prefs) { localStorage.setItem(this.prefsKeyFor(userId), JSON.stringify(prefs)); }
};

/* ------------------------------- Auth ----------------------------------- */
const Auth = {
  currentUser() {
    const session = DB.getSession();
    if (!session) return null;
    return DB.getUsers().find(u => u.id === session.userId) || null;
  },
  signup(name, email, password) {
    const users = DB.getUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('An account with this email already exists. Try logging in instead.');
    }
    const user = { id: 'u_' + Date.now().toString(36), name, email, password };
    users.push(user);
    DB.saveUsers(users);
    DB.setSession(user.id);
    return user;
  },
  login(email, password) {
    const user = DB.getUsers().find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!user) throw new Error('Incorrect email or password.');
    DB.setSession(user.id);
    return user;
  },
  updateProfile(userId, updates) {
    const users = DB.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...updates };
    DB.saveUsers(users);
    return users[idx];
  },
  logout() { DB.clearSession(); window.location.href = 'login.html'; },
  requireAuth() {
    const user = this.currentUser();
    if (!user) { window.location.href = 'login.html'; return null; }
    return user;
  }
};

/* ----------------------------- Capsules --------------------------------- */
const Capsules = {
  all(userId) {
    return DB.getCapsules().filter(c => c.userId === userId);
  },
  get(id) { return DB.getCapsules().find(c => c.id === id) || null; },
  create(userId, data) {
    const list = DB.getCapsules();
    const capsule = {
      id: 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      userId,
      title: data.title,
      message: data.message,
      mood: data.mood,
      image: data.image || null,
      createdAt: new Date().toISOString(),
      unlockAt: data.unlockAt,
      opened: false,
      openedAt: null
    };
    list.push(capsule);
    DB.saveCapsules(list);
    return capsule;
  },
  update(id, data) {
    const list = DB.getCapsules();
    const idx = list.findIndex(c => c.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...data };
    DB.saveCapsules(list);
    return list[idx];
  },
  delete(id) {
    DB.saveCapsules(DB.getCapsules().filter(c => c.id !== id));
  },
  markOpened(id) {
    return this.update(id, { opened: true, openedAt: new Date().toISOString() });
  },
  status(capsule) {
    if (capsule.opened) return 'opened';
    return new Date(capsule.unlockAt).getTime() <= Date.now() ? 'ready' : 'locked';
  }
};

/* ------------------------------ Helpers ---------------------------------- */
function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}
function moodClass(mood) { return (mood || '').toLowerCase(); }
function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase()).join('');
}
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function statusBadge(status) {
  if (status === 'locked') return '<span class="badge locked">Locked</span>';
  if (status === 'ready') return '<span class="badge ready">Ready to Open</span>';
  return '<span class="badge opened">Opened</span>';
}
function moodTag(mood) {
  if (!mood) return '';
  return `<span class="mood-tag ${moodClass(mood)}"><span class="dot"></span>${mood}</span>`;
}
function thumbStyle(capsule) {
  return capsule.image
    ? `background-image:url('${capsule.image}');background-size:cover;background-position:center;`
    : '';
}
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/* -------------------------- Dark mode (global) ---------------------------- */
function applyStoredDarkMode() {
  const user = Auth.currentUser();
  if (!user) return;
  const prefs = DB.getPrefs(user.id);
  document.body.classList.toggle('dark', !!prefs.darkMode);
  document.querySelectorAll('[data-dark-toggle]').forEach(t => { t.checked = !!prefs.darkMode; });
}

/* --------------------------- Shared UI wiring ----------------------------- */
function initSidebar() {
  const openBtn = document.querySelector('[data-open-sidebar]');
  const closeBtn = document.querySelector('[data-close-sidebar]');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (!sidebar) return;
  const open = () => { sidebar.classList.add('open'); overlay?.classList.add('show'); };
  const close = () => { sidebar.classList.remove('open'); overlay?.classList.remove('show'); };
  openBtn?.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  overlay?.addEventListener('click', close);
}

function initPasswordToggles() {
  document.querySelectorAll('[data-toggle-pass]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.querySelector(btn.getAttribute('data-toggle-pass'));
      if (!input) return;
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      btn.textContent = isPass ? 'Hide' : 'Show';
    });
  });
}

function initCountdowns() {
  const nodes = document.querySelectorAll('[data-unlock]');
  if (!nodes.length) return;
  function tick() {
    nodes.forEach((node) => {
      const target = new Date(node.getAttribute('data-unlock')).getTime();
      const diff = Math.max(0, target - Date.now());
      const day = 86400000, hour = 3600000, minute = 60000;
      const set = (sel, val) => {
        const el = node.querySelector(sel);
        if (el) el.textContent = String(val).padStart(2, '0');
      };
      set('[data-days]', Math.floor(diff / day));
      set('[data-hours]', Math.floor((diff % day) / hour));
      set('[data-minutes]', Math.floor((diff % hour) / minute));
      set('[data-seconds]', Math.floor((diff % minute) / 1000));
      if (diff <= 0) node.dispatchEvent(new CustomEvent('capsule-ready'));
    });
  }
  tick();
  setInterval(tick, 1000);
}

function initDropzone() {
  const dz = document.querySelector('[data-dropzone]');
  if (!dz) return null;
  const input = dz.querySelector('input[type="file"]');
  const label = dz.querySelector('[data-dz-label]');
  let currentDataUrl = null;

  dz.addEventListener('click', () => input?.click());
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.style.borderColor = 'var(--green)'; });
  dz.addEventListener('dragleave', () => { dz.style.borderColor = ''; });
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.style.borderColor = '';
    if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
  });
  input?.addEventListener('change', () => { if (input.files[0]) readFile(input.files[0]); });

  function readFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      currentDataUrl = reader.result;
      if (label) label.textContent = `Selected: ${file.name}`;
      dz.dispatchEvent(new CustomEvent('image-selected', { detail: currentDataUrl }));
    };
    reader.readAsDataURL(file);
  }

  return {
    getImage: () => currentDataUrl,
    setImage: (dataUrl, name) => {
      currentDataUrl = dataUrl;
      if (label && dataUrl) label.textContent = name ? `Selected: ${name}` : 'Existing photo attached';
    }
  };
}

function initFormGuards() {
  // Prevent any leftover demo-redirect forms from submitting for real.
  document.querySelectorAll('form[data-demo-form]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const redirect = form.getAttribute('data-demo-form');
      if (redirect) window.location.href = redirect;
    });
  });
}

function initLogout() {
  document.querySelectorAll('[data-logout]').forEach((el) => {
    el.addEventListener('click', (e) => { e.preventDefault(); Auth.logout(); });
  });
}

/* Fills in every element that shows the logged-in user's name/initials,
   and requires auth on any page using the app shell. */
function initUserChip() {
  const isAppShell = !!document.querySelector('.sidebar');
  if (!isAppShell) return;
  const user = Auth.requireAuth();
  if (!user) return;
  document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = user.name; });
  document.querySelectorAll('[data-user-email]').forEach(el => { el.textContent = user.email; });
  document.querySelectorAll('[data-user-avatar]').forEach(el => { el.textContent = initials(user.name); });
}

/* ------------------------------ Home page --------------------------------- */
function initHomePage() {
  const user = Auth.currentUser();
  const loginLink = document.querySelector('[data-nav-login]');
  const signupLink = document.querySelector('[data-nav-signup]');
  const ctaLink = document.querySelector('[data-cta-create]');
  if (user) {
    if (loginLink) { loginLink.textContent = 'Dashboard'; loginLink.href = 'dashboard.html'; }
    if (signupLink) { signupLink.textContent = 'Dashboard'; signupLink.href = 'dashboard.html'; }
    if (ctaLink) { ctaLink.href = 'dashboard.html'; }
  }
}

/* ------------------------------ Sign up page ------------------------------- */
function initSignupPage() {
  const form = document.getElementById('signup-form');
  const errorBox = document.getElementById('signup-error');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('su-name').value.trim();
    const email = document.getElementById('su-email').value.trim();
    const password = document.getElementById('su-pass').value;
    if (!name || !email || password.length < 4) {
      showError(errorBox, 'Please fill every field. Passwords need at least 4 characters.');
      return;
    }
    try {
      Auth.signup(name, email, password);
      window.location.href = 'dashboard.html';
    } catch (err) {
      showError(errorBox, err.message);
    }
  });
}

/* -------------------------------- Login page -------------------------------- */
function initLoginPage() {
  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('login-error');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('li-email').value.trim();
    const password = document.getElementById('li-pass').value;
    try {
      Auth.login(email, password);
      window.location.href = 'dashboard.html';
    } catch (err) {
      showError(errorBox, err.message);
    }
  });
}

function showError(box, message) {
  if (!box) { alert(message); return; }
  box.textContent = message;
  box.style.display = 'block';
}

/* -------------------------------- Dashboard --------------------------------- */
function initDashboardPage() {
  const user = Auth.currentUser();
  if (!user) return;
  const capsules = Capsules.all(user.id);
  const locked = capsules.filter(c => Capsules.status(c) === 'locked');
  const ready = capsules.filter(c => Capsules.status(c) === 'ready');
  const opened = capsules.filter(c => Capsules.status(c) === 'opened');

  setStat('locked', locked.length);
  setStat('ready', ready.length);
  setStat('opened', opened.length);

  const recent = [...capsules]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3);

  const list = document.getElementById('recent-capsules-list');
  const empty = document.getElementById('recent-empty-state');
  if (!recent.length) {
    if (list) list.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  list.innerHTML = recent.map(rowHtml).join('');
}

function setStat(key, value) {
  document.querySelectorAll(`[data-stat="${key}"]`).forEach(el => { el.textContent = value; });
}

function rowHtml(c) {
  const status = Capsules.status(c);
  const href = status === 'opened' ? `opened-capsule.html?id=${c.id}` : `capsule-details.html?id=${c.id}`;
  return `
    <a class="capsule-row" href="${href}">
      <div class="thumb" style="${thumbStyle(c)}"></div>
      <div class="meta">
        <div class="title">${escapeHtml(c.title)}</div>
        <div class="sub">${moodTag(c.mood)} · ${formatDate(status === 'opened' ? c.openedAt : c.unlockAt)}</div>
      </div>
      ${statusBadge(status)}
    </a>`;
}

/* ------------------------------ My Capsules page ----------------------------- */
function initMyCapsulesPage() {
  const user = Auth.currentUser();
  if (!user) return;
  const list = document.getElementById('my-capsules-list');
  const empty = document.getElementById('my-capsules-empty');
  const capsules = Capsules.all(user.id)
    .filter(c => Capsules.status(c) !== 'opened')
    .sort((a, b) => new Date(a.unlockAt) - new Date(b.unlockAt));

  if (!capsules.length) {
    list.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  list.innerHTML = capsules.map(rowHtml).join('');
}

/* --------------------------- Create / Edit Capsule --------------------------- */
function initCreateCapsulePage() {
  const user = Auth.currentUser();
  if (!user) return;
  const form = document.getElementById('capsule-form');
  const editId = qs('id');
  const dz = initDropzone();
  const heading = document.getElementById('cc-heading');
  const submitBtn = document.getElementById('cc-submit-btn');
  const deleteBtn = document.getElementById('cc-delete-btn');
  const messageEl = document.getElementById('cc-message');
  const charCount = document.getElementById('cc-charcount');

  messageEl.addEventListener('input', () => {
    charCount.textContent = `${messageEl.value.length}/2000`;
  });

  let editingCapsule = null;
  if (editId) {
    editingCapsule = Capsules.get(editId);
    if (editingCapsule && editingCapsule.userId === user.id) {
      heading.textContent = 'Edit Your Capsule';
      submitBtn.textContent = 'Save Changes';
      deleteBtn.style.display = 'inline-flex';
      document.getElementById('cc-title').value = editingCapsule.title;
      messageEl.value = editingCapsule.message;
      charCount.textContent = `${editingCapsule.message.length}/2000`;
      document.getElementById('cc-mood').value = editingCapsule.mood;
      const unlockDate = new Date(editingCapsule.unlockAt);
      document.getElementById('cc-date').value = unlockDate.toISOString().slice(0, 10);
      document.getElementById('cc-time').value = unlockDate.toTimeString().slice(0, 5);
      if (editingCapsule.image) dz.setImage(editingCapsule.image);
    }
  } else {
    const prefs = DB.getPrefs(user.id);
    if (prefs.defaultMood) document.getElementById('cc-mood').value = prefs.defaultMood;
  }

  deleteBtn?.addEventListener('click', () => {
    if (!editingCapsule) return;
    if (confirm('Delete this capsule? This cannot be undone.')) {
      Capsules.delete(editingCapsule.id);
      window.location.href = 'dashboard.html';
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('cc-title').value.trim();
    const message = messageEl.value.trim();
    const mood = document.getElementById('cc-mood').value;
    const date = document.getElementById('cc-date').value;
    const time = document.getElementById('cc-time').value || '00:00';
    if (!title || !message || !mood || !date) {
      alert('Please fill in the title, message, mood, and unlock date.');
      return;
    }
    const unlockAt = new Date(`${date}T${time}`).toISOString();
    if (new Date(unlockAt).getTime() <= Date.now() && !editingCapsule) {
      if (!confirm('Your unlock date/time is in the past, so this capsule will be immediately ready to open. Continue?')) return;
    }
    const payload = { title, message, mood, unlockAt, image: dz.getImage() ?? (editingCapsule ? editingCapsule.image : null) };

    if (editingCapsule) {
      Capsules.update(editingCapsule.id, payload);
      window.location.href = `capsule-details.html?id=${editingCapsule.id}`;
    } else {
      const capsule = Capsules.create(user.id, payload);
      window.location.href = `capsule-details.html?id=${capsule.id}`;
    }
  });
}

/* ------------------------------ Capsule detail -------------------------------- */
function initCapsuleDetailPage() {
  const user = Auth.currentUser();
  if (!user) return;
  const id = qs('id');
  const capsule = id && Capsules.get(id);
  const wrap = document.getElementById('capsule-detail-content');

  if (!capsule || capsule.userId !== user.id) {
    wrap.innerHTML = `<div class="empty-state"><div class="e-ico">📦</div><h3>Capsule not found</h3><p>It may have been deleted.</p><a href="my-capsules.html" class="btn btn-primary btn-sm">Back to My Capsules</a></div>`;
    return;
  }

  const status = Capsules.status(capsule);
  if (status === 'opened') {
    window.location.href = `opened-capsule.html?id=${capsule.id}`;
    return;
  }

  document.querySelectorAll('[data-cd="title"]').forEach(el => el.textContent = capsule.title);
  document.querySelectorAll('[data-cd="mood"]').forEach(el => el.outerHTML = moodTag(capsule.mood));
  document.querySelectorAll('[data-cd="created"]').forEach(el => el.textContent = formatDate(capsule.createdAt));
  document.querySelectorAll('[data-cd="unlock"]').forEach(el => el.textContent = formatDate(capsule.unlockAt));

  const heroImg = document.querySelector('[data-cd="hero"]');
  if (heroImg && capsule.image) heroImg.style.cssText += thumbStyle(capsule);

  const lockedPanel = document.getElementById('cd-locked-panel');
  const readyPanel = document.getElementById('cd-ready-panel');

  if (status === 'ready') {
    lockedPanel.style.display = 'none';
    readyPanel.style.display = 'block';
    document.getElementById('cd-open-link').href = `opened-capsule.html?id=${capsule.id}`;
  } else {
    lockedPanel.style.display = 'block';
    readyPanel.style.display = 'none';
    const countdownEl = lockedPanel.querySelector('.countdown');
    countdownEl.setAttribute('data-unlock', capsule.unlockAt);
    initCountdowns();
    countdownEl.addEventListener('capsule-ready', () => {
      lockedPanel.style.display = 'none';
      readyPanel.style.display = 'block';
      document.getElementById('cd-open-link').href = `opened-capsule.html?id=${capsule.id}`;
    }, { once: true });
  }

  document.getElementById('cd-edit-link').href = `create-capsule.html?id=${capsule.id}`;
  document.getElementById('cd-delete-btn').addEventListener('click', () => {
    if (confirm('Delete this capsule? This cannot be undone.')) {
      Capsules.delete(capsule.id);
      window.location.href = 'my-capsules.html';
    }
  });
}

/* ------------------------------ Opened capsule -------------------------------- */
function initOpenedCapsulePage() {
  const user = Auth.currentUser();
  if (!user) return;
  const id = qs('id');
  const capsule = id && Capsules.get(id);
  const wrap = document.getElementById('opened-content');

  if (!capsule || capsule.userId !== user.id) {
    wrap.innerHTML = `<div class="empty-state"><div class="e-ico">📦</div><h3>Capsule not found</h3><a href="archive.html" class="btn btn-primary btn-sm">Go to Archive</a></div>`;
    return;
  }

  const status = Capsules.status(capsule);
  if (status === 'locked') {
    window.location.href = `capsule-details.html?id=${capsule.id}`;
    return;
  }
  if (status === 'ready') Capsules.markOpened(capsule.id);
  const fresh = Capsules.get(capsule.id);

  document.querySelectorAll('[data-oc="title"]').forEach(el => el.textContent = fresh.title);
  document.querySelectorAll('[data-oc="mood"]').forEach(el => el.outerHTML = moodTag(fresh.mood));
  document.querySelectorAll('[data-oc="date"]').forEach(el => el.textContent = formatDate(fresh.openedAt));
  document.querySelectorAll('[data-oc="text"]').forEach(el => el.innerHTML = escapeHtml(fresh.message).replace(/\n/g, '<br>'));
  const frame = document.querySelector('[data-oc="frame"]');
  if (frame && fresh.image) frame.style.cssText += thumbStyle(fresh);

  document.getElementById('oc-share-btn')?.addEventListener('click', () => {
    const url = `${window.location.origin}${window.location.pathname}?id=${fresh.id}`;
    if (navigator.share) {
      navigator.share({ title: fresh.title, text: 'A memory from my Digital Time Capsule', url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => alert('Link copied to clipboard.'));
    } else {
      alert(url);
    }
  });
}

/* --------------------------------- Archive ------------------------------------ */
function initArchivePage() {
  const user = Auth.currentUser();
  if (!user) return;

  const state = { mood: 'All', year: 'All', search: '' };
  const opened = () => Capsules.all(user.id).filter(c => Capsules.status(c) === 'opened');

  populateYearFilter(opened());
  render();

  document.querySelectorAll('.archive-filters .pill[data-mood]').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.archive-filters .pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.mood = pill.getAttribute('data-mood');
      render();
    });
  });
  document.getElementById('archive-year-filter')?.addEventListener('change', (e) => {
    state.year = e.target.value;
    render();
  });
  document.getElementById('archive-search-input')?.addEventListener('input', (e) => {
    state.search = e.target.value.trim().toLowerCase();
    render();
  });

  function populateYearFilter(capsules) {
    const select = document.getElementById('archive-year-filter');
    if (!select) return;
    const years = [...new Set(capsules.map(c => new Date(c.openedAt).getFullYear()))].sort((a, b) => b - a);
    select.innerHTML = '<option value="All">Year</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
  }

  function render() {
    let list = opened();
    if (state.mood !== 'All') list = list.filter(c => c.mood === state.mood);
    if (state.year !== 'All') list = list.filter(c => new Date(c.openedAt).getFullYear() === Number(state.year));
    if (state.search) list = list.filter(c => c.title.toLowerCase().includes(state.search));
    list.sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt));

    const container = document.getElementById('archive-list');
    const empty = document.getElementById('archive-empty');
    if (!list.length) {
      container.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';
    container.innerHTML = list.map(c => `
      <a class="capsule-row" href="opened-capsule.html?id=${c.id}">
        <div class="thumb" style="${thumbStyle(c)}"></div>
        <div class="meta">
          <div class="title">${escapeHtml(c.title)}</div>
          <div class="sub">${moodTag(c.mood)} · ${formatDate(c.openedAt)}</div>
        </div>
        <span>›</span>
      </a>`).join('');
  }
}

/* -------------------------------- Profile page --------------------------------- */
function initProfilePage() {
  const user = Auth.currentUser();
  if (!user) return;
  const prefs = DB.getPrefs(user.id);

  document.getElementById('pr-name').value = user.name;
  document.getElementById('pr-email').value = user.email;

  const darkToggle = document.querySelector('[data-dark-toggle]');
  if (darkToggle) {
    darkToggle.checked = !!prefs.darkMode;
    darkToggle.addEventListener('change', () => {
      DB.savePrefs(user.id, { ...prefs, darkMode: darkToggle.checked });
      document.body.classList.toggle('dark', darkToggle.checked);
    });
  }

  const emailToggle = document.getElementById('pref-email-notif');
  if (emailToggle) {
    emailToggle.checked = prefs.emailNotifications !== false;
    emailToggle.addEventListener('change', () => {
      const p = DB.getPrefs(user.id);
      DB.savePrefs(user.id, { ...p, emailNotifications: emailToggle.checked });
    });
  }

  const moodSelect = document.getElementById('pref-default-mood');
  if (moodSelect) {
    moodSelect.value = prefs.defaultMood || '';
    moodSelect.addEventListener('change', () => {
      const p = DB.getPrefs(user.id);
      DB.savePrefs(user.id, { ...p, defaultMood: moodSelect.value });
    });
  }

  document.getElementById('pr-change-pass')?.addEventListener('click', () => {
    const current = prompt('Enter your current password:');
    if (current === null) return;
    if (current !== user.password) { alert('Current password is incorrect.'); return; }
    const next = prompt('Enter your new password (min 4 characters):');
    if (!next || next.length < 4) { alert('Password not changed.'); return; }
    Auth.updateProfile(user.id, { password: next });
    alert('Password updated.');
  });

  document.getElementById('profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('pr-name').value.trim();
    const email = document.getElementById('pr-email').value.trim();
    if (!name || !email) { alert('Name and email cannot be empty.'); return; }
    Auth.updateProfile(user.id, { name, email });
    document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = name);
    document.querySelectorAll('[data-user-avatar]').forEach(el => el.textContent = initials(name));
    document.querySelectorAll('[data-user-email]').forEach(el => el.textContent = email);
    alert('Profile saved.');
  });
}

/* ---------------------------------- Boot ---------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  applyStoredDarkMode();
  initSidebar();
  initPasswordToggles();
  initCountdowns();
  initFormGuards();
  initLogout();
  initUserChip();

  if (document.getElementById('home-hero')) initHomePage();
  if (document.getElementById('signup-form')) initSignupPage();
  if (document.getElementById('login-form')) initLoginPage();
  if (document.getElementById('dashboard-content')) initDashboardPage();
  if (document.getElementById('my-capsules-list')) initMyCapsulesPage();
  if (document.getElementById('capsule-form')) initCreateCapsulePage();
  if (document.getElementById('capsule-detail-content')) initCapsuleDetailPage();
  if (document.getElementById('opened-content')) initOpenedCapsulePage();
  if (document.getElementById('archive-list')) initArchivePage();
  if (document.getElementById('profile-form')) initProfilePage();
});
