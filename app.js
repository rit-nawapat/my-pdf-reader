/**
 * Minimal PDF Reader - Impeccable Engine
 * Features:
 * - Google Drive-style Sidebar (Thumbnails Preview & Outline TOC)
 * - Virtual Scroll & Zero-Leak Canvas Memory Disposal
 * - Fully Responsive (Desktop, Laptop, Tablet, Mobile)
 * - Mobile Touch Gestures: Tap to toggle toolbar, Swipe left/right to turn page
 * - GPU-Accelerated Reading Themes (Default, Sepia, Dark) + Mobile Theme Cycle Button
 * - Local-First Memory Sync (localStorage)
 * - Screen Wake Lock API & Fullscreen Support
 */

// 1. Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// DOM Elements - Shell & Controls
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const openDocBtn = document.getElementById('openDocBtn');
const openDocWrap = document.getElementById('openDocWrap');
const openDocMenu = document.getElementById('openDocMenu');
const viewerContainer = document.getElementById('viewerContainer');
const viewer = document.getElementById('viewer');
const floatingCapsule = document.getElementById('floatingCapsule');
const toolbar = floatingCapsule; // Alias for backward compatibility
const fileNameEl = document.getElementById('fileName');
const pageNumberInput = document.getElementById('pageNumberInput');
const pageCountEl = document.getElementById('pageCount');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomFitBtn = document.getElementById('zoomFitBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const pageSlider = document.getElementById('pageSlider');
const bottomBar = document.getElementById('bottomBar');
const sliderTooltip = document.getElementById('sliderTooltip');
const toastEl = document.getElementById('toast');
const themeButtons = document.querySelectorAll('.theme-btn');
const themeCycleBtn = document.getElementById('themeCycleBtn');

// DOM Elements - Flyout Menu
const capsuleMenuBtn = document.getElementById('capsuleMenuBtn');
const flyoutMenu = document.getElementById('flyoutMenu');
const flyoutBackdrop = document.getElementById('flyoutBackdrop');
const closeFlyoutBtn = document.getElementById('closeFlyoutBtn');
const flyoutSidebarBtn = document.getElementById('flyoutSidebarBtn');
const flyoutSettingsBtn = document.getElementById('flyoutSettingsBtn');

// DOM Elements - Shelf / Recent Files
const shelfBtn = document.getElementById('shelfBtn');
const shelfSection = document.getElementById('shelfSection');
const recentGrid = document.getElementById('recentGrid');
const clearRecentsBtn = document.getElementById('clearRecentsBtn');
const emptyShelf = document.getElementById('emptyShelf');
const RECENT_STORAGE_KEY = 'pdf_reader_recent_files';

// DOM Elements - Sidebar & Panels
const toggleSidebarBtn = flyoutSidebarBtn || document.getElementById('toggleSidebarBtn');
const sidebar = document.getElementById('sidebar');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const tabThumbnails = document.getElementById('tabThumbnails');
const tabOutline = document.getElementById('tabOutline');
const thumbnailsPanel = document.getElementById('thumbnailsPanel');
const outlinePanel = document.getElementById('outlinePanel');
const thumbnailsGrid = document.getElementById('thumbnailsGrid');
const outlineTree = document.getElementById('outlineTree');

// State Variables
let currentPdf = null;
let currentFileKey = null;
let currentPage = 1;
let totalPages = 0;
let baseViewport = null;
let currentScale = 1.0;
let pageElements = new Map(); // pageNum -> { container, canvas, renderTask, pdfPage, isRendered }
let thumbnailElements = new Map(); // pageNum -> { item, card, canvas, renderTask, isRendered }
let viewerObserver = null;
let thumbnailObserver = null;
let wakeLock = null;
let saveTimer = null;
let scrollTimer = null;
let resizeTimer = null;
let isJumpingToPage = false;
let pendingTargetPage = null;

// DOM Elements - Google Drive & Settings Modal
const driveOpenBtn = document.getElementById('driveOpenBtn');
const dropZoneDriveBtn = document.getElementById('dropZoneDriveBtn');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const clearConfigBtn = document.getElementById('clearConfigBtn');
const cfgClientIdInput = document.getElementById('cfgClientId');
const cfgApiKeyInput = document.getElementById('cfgApiKey');

// Google Drive State Variables (Zero-hardcoded secrets)
const GDRIVE_CONFIG_KEY = 'pdf_reader_gdrive_config';
let gdriveAccessToken = null;
let tokenClient = null;
let gapiInited = false;
let gisInited = false;
let currentDriveFileId = null;
let driveSyncTimer = null;

// Auth & User Profile Session Management
const authProfileBtn = document.getElementById('authProfileBtn');
const guestUserIcon = document.getElementById('guestUserIcon');
const userAvatarImg = document.getElementById('userAvatarImg');
const avatarStatusDot = document.getElementById('avatarStatusDot');
const profileBackdrop = document.getElementById('profileBackdrop');
const profilePopover = document.getElementById('profilePopover');
const popoverLoggedInView = document.getElementById('popoverLoggedInView');
const popoverGuestView = document.getElementById('popoverGuestView');
const popoverAvatarImg = document.getElementById('popoverAvatarImg');
const popoverUserName = document.getElementById('popoverUserName');
const popoverUserEmail = document.getElementById('popoverUserEmail');
const closeProfilePopoverBtn = document.getElementById('closeProfilePopoverBtn');
const closeGuestPopoverBtn = document.getElementById('closeGuestPopoverBtn');
const sessionCountdownText = document.getElementById('sessionCountdownText');
const popoverBookCount = document.getElementById('popoverBookCount');
const guestSignInBtn = document.getElementById('guestSignInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const shelfSubtitle = document.getElementById('shelfSubtitle');

const SESSION_STORAGE_KEY = 'pdf_reader_session';
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes inactivity timeout
const ABSOLUTE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour absolute token lifespan
let sessionWatchdogTimer = null;
let lastUserActivityAt = Date.now();
let lastActivityUpdateSent = 0;
let pendingAuthCallback = null;

// Touch tracking for gestures
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

// Theme Icon SVGs for Mobile Cycle Button
const THEME_ICONS = {
  default: `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`,
  sepia: `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>`,
  dark: `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`
};

// ==========================================================================
// Theme Setup & Mobile Cycle Button
// ==========================================================================

function initTheme() {
  const savedTheme = localStorage.getItem('pdf_reader_theme') || 'default';
  applyTheme(savedTheme);

  // Desktop & flyout swatch theme buttons
  const allThemeButtons = document.querySelectorAll('.theme-btn, .swatch-btn');
  allThemeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      applyTheme(theme);
      localStorage.setItem('pdf_reader_theme', theme);
    });
  });

  // Mobile theme cycle button
  if (themeCycleBtn) {
    themeCycleBtn.addEventListener('click', () => {
      const currentTheme = document.body.className.replace('theme-', '');
      const themes = ['default', 'sepia', 'dark'];
      const nextTheme = themes[(themes.indexOf(currentTheme) + 1) % themes.length];
      applyTheme(nextTheme);
      localStorage.setItem('pdf_reader_theme', nextTheme);
      showToast(`โหมด: ${nextTheme === 'default' ? 'สว่างปกติ' : nextTheme === 'sepia' ? 'ถนอมสายตา' : 'โหมดมืด'}`);
    });
  }
}

function applyTheme(theme) {
  document.body.className = `theme-${theme}`;

  document.querySelectorAll('.theme-btn, .swatch-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });

  if (themeCycleBtn) {
    const iconSvg = themeCycleBtn.querySelector('svg');
    if (iconSvg && THEME_ICONS[theme]) {
      iconSvg.innerHTML = THEME_ICONS[theme];
    }
  }
}

// Toast Notification
function showToast(message, duration = 2200) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => {
    toastEl.classList.remove('show');
  }, duration);
}

// Screen Wake Lock
async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    } catch (err) {
      console.warn('Wake Lock error:', err);
    }
  }
}

document.addEventListener('visibilitychange', async () => {
  if (wakeLock !== null && document.visibilityState === 'visible') {
    await requestWakeLock();
  }
});

// ==========================================================================
// IndexedDB Storage (Enables instant reopening of local files without re-picking!)
// ==========================================================================

const IDB_NAME = 'MinimalPdfReaderDB';
const IDB_VERSION = 1;
const IDB_STORE = 'pdf_blobs';

function openPdfDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function savePdfToIDB(key, blob) {
  try {
    const db = await openPdfDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(blob, key);
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn('IDB Save error:', err);
    return false;
  }
}

async function getPdfFromIDB(key) {
  try {
    const db = await openPdfDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('IDB Get error:', err);
    return null;
  }
}

async function deletePdfFromIDB(key) {
  try {
    const db = await openPdfDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
  } catch (err) {
    console.warn('IDB Delete error:', err);
  }
}

async function clearAllPdfFromIDB() {
  try {
    const db = await openPdfDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).clear();
  } catch (err) {}
}

// ==========================================================================
// Shelf & Recent Files Manager (Profile-Scoped)
// ==========================================================================

function getProfileRecentKey() {
  const profile = getActiveProfile();
  return `pdf_reader_recents_${profile.id}`;
}

function getUserScopedKey(baseKey) {
  if (!baseKey) return baseKey;
  const profile = getActiveProfile();
  return `${baseKey}_${profile.id}`;
}

function migrateLegacyGuestRecents() {
  const guestKey = 'pdf_reader_recents_guest';
  if (!localStorage.getItem(guestKey)) {
    const legacy = localStorage.getItem('pdf_reader_recent_files');
    if (legacy) {
      localStorage.setItem(guestKey, legacy);
    }
  }
}

function getRecentFiles() {
  try {
    migrateLegacyGuestRecents();
    const key = getProfileRecentKey();
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveRecentFile(meta) {
  if (!meta || !meta.id) return;
  const list = getRecentFiles();
  const existingIndex = list.findIndex((item) => item.id === meta.id);

  const updatedItem = {
    id: meta.id,
    name: meta.name || 'เอกสารไม่มีชื่อ',
    lastPage: meta.lastPage || 1,
    totalPages: meta.totalPages || (existingIndex >= 0 ? list[existingIndex].totalPages : 1),
    fileSize: meta.fileSize || (existingIndex >= 0 ? list[existingIndex].fileSize : 0),
    percentage: Math.min(100, Math.round(((meta.lastPage || 1) / (meta.totalPages || 1)) * 100)),
    isDrive: meta.isDrive ?? (existingIndex >= 0 ? list[existingIndex].isDrive : false),
    driveFileId: meta.driveFileId || (existingIndex >= 0 ? list[existingIndex].driveFileId : null),
    lastReadAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    list.splice(existingIndex, 1);
  }
  list.unshift(updatedItem);

  if (list.length > 12) list.pop();

  localStorage.setItem(getProfileRecentKey(), JSON.stringify(list));
}

function removeRecentFile(id, e) {
  if (e) e.stopPropagation();
  let list = getRecentFiles();
  list = list.filter((item) => item.id !== id);
  localStorage.setItem(getProfileRecentKey(), JSON.stringify(list));
  localStorage.removeItem(getUserScopedKey(id));
  localStorage.removeItem(id);
  deletePdfFromIDB(id);
  renderRecentShelf();
  showToast('ลบออกจากประวัติแล้ว');
}

function clearAllRecents() {
  const profile = getActiveProfile();
  const label = profile.isGuest ? 'โหมดทั่วไป (Guest)' : `โปรไฟล์ "${profile.name}"`;
  if (confirm(`ต้องการล้างประวัติการอ่านของ ${label} ทั้งหมดหรือไม่?`)) {
    localStorage.removeItem(getProfileRecentKey());
    clearAllPdfFromIDB();
    renderRecentShelf();
    showToast('ล้างประวัติเรียบร้อย');
  }
}

function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 2) return 'เมื่อสักครู่';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  if (days === 1) return 'เมื่อวานนี้';
  if (days < 30) return `${days} วันที่แล้ว`;
  return new Date(isoString).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

function renderRecentShelf() {
  if (!recentGrid || !shelfSection) return;
  const profile = getActiveProfile();
  const list = getRecentFiles();

  if (shelfSubtitle) {
    if (profile.isGuest) {
      shelfSubtitle.textContent = 'อ่านต่อจากที่ค้างไว้ (โหมดทั่วไป)';
    } else {
      shelfSubtitle.textContent = `ประวัติการอ่านของ ${profile.name}`;
    }
  }

  if (list.length === 0) {
    shelfSection.style.display = 'none';
    if (emptyShelf) emptyShelf.style.display = 'flex';
    return;
  }

  shelfSection.style.display = 'flex';
  if (emptyShelf) emptyShelf.style.display = 'none';

  recentGrid.innerHTML = '';
  list.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'recent-card';
    card.title = `คลิกเพื่อเปิดอ่านต่อ (${item.name})`;

    card.innerHTML = `
      <div class="recent-top">
        <div class="recent-info">
          <div class="recent-name" title="${item.name}">${item.name} ${item.isDrive ? '<span class="drive-badge">Drive</span>' : ''}</div>
          <div class="recent-sub">
            <span>หน้า ${item.lastPage} / ${item.totalPages} (${item.percentage}%)</span>
            <span>•</span>
            <span>${formatRelativeTime(item.lastReadAt)}</span>
          </div>
        </div>
        <button class="recent-remove-btn" title="ลบออกจากประวัติ" aria-label="ลบ">
          <svg class="icon" viewBox="0 0 24 24" style="width: 14px; height: 14px;">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="recent-progress-bar">
        <div class="recent-progress-fill" style="width: ${item.percentage}%"></div>
      </div>
    `;

    // Click card -> load instantly from IndexedDB or Google Drive!
    card.addEventListener('click', async () => {
      showToast(`กำลังเปิด "${item.name}"...`);

      if (item.isDrive && item.driveFileId) {
        const cachedBlob = await getPdfFromIDB(item.id);
        if (cachedBlob) {
          cachedBlob.name = item.name;
          cachedBlob.driveFileId = item.driveFileId;
          loadFile(cachedBlob, item.lastPage);
        } else {
          openDriveFileById(item.driveFileId, item.name, item.lastPage);
        }
      } else {
        const cachedBlob = await getPdfFromIDB(item.id);
        if (cachedBlob) {
          cachedBlob.name = item.name;
          loadFile(cachedBlob, item.lastPage);
        } else {
          // Fallback if cache cleared
          showToast(`เลือกไฟล์ "${item.name}" เพื่อเปิดอ่านต่อ`);
          pendingTargetPage = item.lastPage;
          fileInput.click();
        }
      }
    });

    const removeBtn = card.querySelector('.recent-remove-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => removeRecentFile(item.id, e));
    }

    recentGrid.appendChild(card);
  });
}

// ==========================================================================
// Google Drive Cloud Shelf Sync
// Fetches files from Drive that have been read on ANY device and merges
// them into the local shelf so the bookshelf stays in sync cross-device.
// ==========================================================================

let driveShelfSyncTimer = null;

async function syncDriveShelf() {
  const session = getSession();
  if (!session || !session.token) return; // Only run when logged in

  const token = session.token;

  try {
    // Query Drive for PDF files that have our appProperty written (lastReadPage)
    // Using drive.file scope means we can only see files the app has opened before
    const query = encodeURIComponent("mimeType='application/pdf' and trashed=false");
    const fields = encodeURIComponent('files(id,name,size,modifiedTime,appProperties)');
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=50&orderBy=modifiedTime desc`;

    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!resp.ok) {
      if (resp.status === 401) {
        // Token expired silently - don't disrupt user
        console.info('[DriveSync] Token expired during shelf sync');
      }
      return;
    }

    const data = await resp.json();
    const driveFiles = (data.files || []).filter(
      (f) => f.appProperties && f.appProperties.lastReadPage
    );

    if (driveFiles.length === 0) return;

    // Merge Drive files into local shelf (local always takes priority for same fileId)
    const currentList = getRecentFiles();
    const existingIds = new Set(currentList.map((item) => item.id));
    let mergedCount = 0;

    driveFiles.forEach((f) => {
      const itemId = `pdf_drive_${f.id}`;
      if (existingIds.has(itemId)) {
        // Update lastPage from cloud (it may be newer from another device)
        const localIdx = currentList.findIndex((item) => item.id === itemId);
        if (localIdx >= 0) {
          const cloudPage = parseInt(f.appProperties.lastReadPage, 10);
          const localPage = currentList[localIdx].lastPage || 1;
          if (cloudPage > 0 && cloudPage !== localPage) {
            currentList[localIdx].lastPage = cloudPage;
            currentList[localIdx].percentage = Math.min(
              100,
              Math.round((cloudPage / (currentList[localIdx].totalPages || 1)) * 100)
            );
            // Mark as synced from cloud (more recent)
            currentList[localIdx].lastReadAt = f.modifiedTime || currentList[localIdx].lastReadAt;
          }
        }
      } else {
        // New file from Drive (read on another device) - add to shelf
        const cloudPage = parseInt(f.appProperties.lastReadPage, 10) || 1;
        currentList.unshift({
          id: itemId,
          name: f.name || 'เอกสาร Google Drive',
          lastPage: cloudPage,
          totalPages: 0, // Will be updated when opened
          fileSize: parseInt(f.size, 10) || 0,
          percentage: 0, // Unknown until opened (totalPages = 0)
          isDrive: true,
          driveFileId: f.id,
          lastReadAt: f.modifiedTime || new Date().toISOString(),
          fromCloudSync: true
        });
        mergedCount++;
      }
    });

    // Sort by lastReadAt descending (most recently read first)
    currentList.sort((a, b) => new Date(b.lastReadAt) - new Date(a.lastReadAt));

    // Save the merged list back to localStorage
    if (currentList.length > 12) currentList.splice(12);
    localStorage.setItem(getProfileRecentKey(), JSON.stringify(currentList));

    // Re-render the shelf to show newly synced files
    renderRecentShelf();

    if (mergedCount > 0) {
      showToast(`🔄 ซิงค์คลังหนังสือจาก Drive: พบ ${mergedCount} ไฟล์ใหม่จากอุปกรณ์อื่น`);
    }
  } catch (err) {
    console.warn('[DriveSync] Shelf sync failed:', err);
  }
}

// Debounced trigger for Drive Shelf Sync (avoids double-calling)
function triggerDriveShelfSync(delayMs = 1500) {
  clearTimeout(driveShelfSyncTimer);
  driveShelfSyncTimer = setTimeout(() => {
    syncDriveShelf();
  }, delayMs);
}



// ==========================================================================
// Sidebar & Tab Control (Drive-Style Drawer)
// ==========================================================================

function toggleSidebar() {
  const isOpen = sidebar.classList.toggle('open');
  sidebarBackdrop.classList.toggle('active', isOpen);
  toggleSidebarBtn.classList.toggle('active', isOpen);

  if (isOpen && currentPdf) {
    updateActiveThumbnail(currentPage);
  }
}

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarBackdrop.classList.remove('active');
  if (toggleSidebarBtn) toggleSidebarBtn.classList.remove('active');
}

if (toggleSidebarBtn && toggleSidebarBtn !== flyoutSidebarBtn) {
  toggleSidebarBtn.addEventListener('click', toggleSidebar);
}
if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);

tabThumbnails.addEventListener('click', () => {
  tabThumbnails.classList.add('active');
  tabOutline.classList.remove('active');
  thumbnailsPanel.classList.add('active');
  outlinePanel.classList.remove('active');
  updateActiveThumbnail(currentPage);
});

tabOutline.addEventListener('click', () => {
  tabOutline.classList.add('active');
  tabThumbnails.classList.remove('active');
  outlinePanel.classList.add('active');
  thumbnailsPanel.classList.remove('active');
});

// ==========================================================================
// File Input & Drag & Drop
// ==========================================================================

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file && file.type === 'application/pdf') {
    const target = pendingTargetPage;
    pendingTargetPage = null;
    if (openDocWrap) openDocWrap.classList.remove('open');
    loadFile(file, target);
  }
});

['dragenter', 'dragover'].forEach((eventName) => {
  window.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  window.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
  });
});

window.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    loadFile(file);
  } else if (file) {
    showToast('กรุณาเลือกไฟล์ PDF เท่านั้น');
  }
});

// ==========================================================================
// PDF Loading & Architecture Setup
// ==========================================================================

async function loadFile(file, targetPage = null) {
  try {
    showToast('กำลังเปิดเอกสาร...');
    fileNameEl.textContent = file.name;
    fileNameEl.title = file.name;

    if (file.driveFileId) {
      currentDriveFileId = file.driveFileId;
      currentFileKey = `pdf_drive_${file.driveFileId}`;
    } else {
      currentDriveFileId = null;
      currentFileKey = `pdf_pos_${encodeURIComponent(file.name)}_${file.size || 0}`;
    }
    const arrayBuffer = await file.arrayBuffer();

    if (currentPdf) {
      await cleanupAllPages();
      currentPdf.destroy();
    }

    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      disableAutoFetch: true,
      rangeChunkSize: 65536
    });

    currentPdf = await loadingTask.promise;
    totalPages = currentPdf.numPages;

    // Determine target page to open
    const scopedKey = getUserScopedKey(currentFileKey);
    let savedPage = localStorage.getItem(scopedKey);
    if (!savedPage) {
      savedPage = localStorage.getItem(currentFileKey);
    }
    let pageToOpen = 1;
    if (targetPage && targetPage >= 1 && targetPage <= totalPages) {
      pageToOpen = targetPage;
    } else if (savedPage) {
      const pageNum = parseInt(savedPage, 10);
      if (pageNum >= 1 && pageNum <= totalPages) {
        pageToOpen = pageNum;
      }
    }

    // Set page indicators and lock scroll tracking while building DOM
    isJumpingToPage = true;
    currentPage = pageToOpen;
    pageNumberInput.value = pageToOpen;
    pageCountEl.textContent = totalPages;
    pageSlider.max = totalPages;
    pageSlider.value = pageToOpen;
    updateScrubberVisuals(pageToOpen);

    const firstPage = await currentPdf.getPage(1);
    baseViewport = firstPage.getViewport({ scale: 1.0 });

    dropZone.style.display = 'none';
    viewer.classList.add('active');
    if (floatingCapsule) {
      floatingCapsule.style.display = 'flex';
      floatingCapsule.classList.remove('hidden');
    }
    bottomBar.classList.add('visible');
    bottomBar.classList.remove('hidden');
    if (typeof scheduleScrubberAutoHide === 'function') scheduleScrubberAutoHide(3000);
    if (shelfBtn) shelfBtn.style.display = 'inline-flex';

    calculateFitWidthScale();
    createPagePlaceholders();
    setupViewerObserver();

    createThumbnails();
    setupThumbnailObserver();
    loadOutline();

    await requestWakeLock();

    // Cache file in IndexedDB for instant reopening without picking again
    savePdfToIDB(currentFileKey, file);

    // Save reading state to shelf and storage
    localStorage.setItem(getUserScopedKey(currentFileKey), pageToOpen.toString());
    saveRecentFile({
      id: currentFileKey,
      name: file.name,
      lastPage: pageToOpen,
      totalPages: totalPages,
      fileSize: file.size || 0,
      isDrive: !!currentDriveFileId,
      driveFileId: currentDriveFileId
    });

    if (currentDriveFileId) {
      if (gdriveAccessToken) {
        debounceSyncDrivePage(currentDriveFileId, pageToOpen);
      }
    } else {
      // Local file: upload to Drive (if signed in) so other devices can see it
      uploadLocalToDrive(file, pageToOpen);
    }

    // Jump directly to the target page
    if (pageToOpen > 1) {
      setTimeout(() => {
        scrollToPage(pageToOpen, false);
        showToast(`เปิดหน้าที่ ${pageToOpen} ที่อ่านค้างไว้`);
        setTimeout(() => {
          isJumpingToPage = false;
        }, 500);
      }, 50);
    } else {
      showToast('พร้อมอ่านแล้ว');
      setTimeout(() => {
        isJumpingToPage = false;
      }, 300);
    }
  } catch (err) {
    isJumpingToPage = false;
    console.error('Error loading PDF:', err);
    showToast('ไม่สามารถเปิดไฟล์ได้: ' + err.message);
  }
}

// Calculate fit width scale depending on screen size (desktop vs mobile)
function calculateFitWidthScale() {
  if (!baseViewport) return;

  // On mobile (<= 768px), keep side margins tight (16px) so text fills the screen
  const sidePadding = window.innerWidth <= 768 ? 16 : 48;
  const containerWidth = viewerContainer.clientWidth - sidePadding;

  if (containerWidth > 0) {
    currentScale = Math.min(Math.max(containerWidth / baseViewport.width, 0.35), 3.5);
  } else {
    currentScale = 1.0;
  }
}

// ==========================================================================
// Virtual Scroll Engine (Main Viewer)
// ==========================================================================

function createPagePlaceholders() {
  viewer.innerHTML = '';
  pageElements.clear();

  const width = Math.floor(baseViewport.width * currentScale);
  const height = Math.floor(baseViewport.height * currentScale);

  for (let i = 1; i <= totalPages; i++) {
    const container = document.createElement('div');
    container.className = 'page-container';
    container.id = `page-${i}`;
    container.dataset.pageNumber = i;
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;

    const placeholder = document.createElement('div');
    placeholder.className = 'page-placeholder';
    placeholder.textContent = `หน้า ${i}`;
    container.appendChild(placeholder);

    viewer.appendChild(container);

    pageElements.set(i, {
      container,
      canvas: null,
      renderTask: null,
      pdfPage: null,
      isRendered: false
    });
  }
}

function setupViewerObserver() {
  if (viewerObserver) viewerObserver.disconnect();

  viewerObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const pageNum = parseInt(entry.target.dataset.pageNumber, 10);
      if (entry.isIntersecting) {
        renderMainPage(pageNum);
      } else {
        unrenderMainPage(pageNum);
      }
    });
  }, {
    root: viewerContainer,
    rootMargin: '350px 0px 350px 0px',
    threshold: 0.01
  });

  pageElements.forEach(({ container }) => viewerObserver.observe(container));
}

async function renderMainPage(pageNum) {
  const pageData = pageElements.get(pageNum);
  if (!pageData || pageData.isRendered || pageData.renderTask) return;

  try {
    const pdfPage = await currentPdf.getPage(pageNum);
    pageData.pdfPage = pdfPage;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = pdfPage.getViewport({ scale: currentScale * dpr });

    const canvas = document.createElement('canvas');
    canvas.className = 'page-canvas';
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

    const ctx = canvas.getContext('2d', { alpha: false });
    pageData.container.innerHTML = '';
    pageData.container.appendChild(canvas);
    pageData.canvas = canvas;

    const renderTask = pdfPage.render({ canvasContext: ctx, viewport: viewport });
    pageData.renderTask = renderTask;

    await renderTask.promise;
    pageData.isRendered = true;
    pageData.renderTask = null;
  } catch (err) {
    if (err.name !== 'RenderingCancelledException') {
      console.warn(`Render error on page ${pageNum}:`, err);
    }
  }
}

function unrenderMainPage(pageNum) {
  const pageData = pageElements.get(pageNum);
  if (!pageData) return;

  if (pageData.renderTask) {
    pageData.renderTask.cancel();
    pageData.renderTask = null;
  }

  if (pageData.canvas) {
    pageData.canvas.width = 0;
    pageData.canvas.height = 0;
    pageData.canvas.remove();
    pageData.canvas = null;
  }

  if (pageData.pdfPage) {
    pageData.pdfPage.cleanup();
    pageData.pdfPage = null;
  }

  pageData.isRendered = false;

  if (pageData.container.children.length === 0) {
    const placeholder = document.createElement('div');
    placeholder.className = 'page-placeholder';
    placeholder.textContent = `หน้า ${pageNum}`;
    pageData.container.appendChild(placeholder);
  }
}

// ==========================================================================
// Thumbnails Preview System (Drive Style)
// ==========================================================================

function createThumbnails() {
  thumbnailsGrid.innerHTML = '';
  thumbnailElements.clear();

  // 130px thumbnail width for clean sidebar fit across screen sizes
  const thumbWidth = window.innerWidth <= 768 ? 120 : 140;
  const thumbScale = thumbWidth / baseViewport.width;
  const thumbHeight = Math.floor(baseViewport.height * thumbScale);

  for (let i = 1; i <= totalPages; i++) {
    const item = document.createElement('div');
    item.className = 'thumbnail-item';
    item.id = `thumb-${i}`;
    item.dataset.pageNumber = i;
    if (i === currentPage) item.classList.add('active');

    const card = document.createElement('div');
    card.className = 'thumbnail-card';
    card.style.width = `${thumbWidth}px`;
    card.style.height = `${thumbHeight}px`;

    const placeholder = document.createElement('div');
    placeholder.className = 'thumbnail-placeholder';
    placeholder.textContent = `${i}`;
    card.appendChild(placeholder);

    const label = document.createElement('div');
    label.className = 'thumbnail-label';
    label.textContent = `${i}`;

    item.appendChild(card);
    item.appendChild(label);

    item.addEventListener('click', () => {
      scrollToPage(i);
      if (window.innerWidth <= 1024) closeSidebar();
    });

    thumbnailsGrid.appendChild(item);

    thumbnailElements.set(i, {
      item,
      card,
      canvas: null,
      renderTask: null,
      isRendered: false,
      thumbWidth,
      thumbHeight
    });
  }
}

function setupThumbnailObserver() {
  if (thumbnailObserver) thumbnailObserver.disconnect();

  thumbnailObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const pageNum = parseInt(entry.target.dataset.pageNumber, 10);
      if (entry.isIntersecting) {
        renderThumbnail(pageNum);
      } else {
        unrenderThumbnail(pageNum);
      }
    });
  }, {
    root: thumbnailsPanel,
    rootMargin: '200px 0px 200px 0px',
    threshold: 0.01
  });

  thumbnailElements.forEach(({ item }) => thumbnailObserver.observe(item));
}

async function renderThumbnail(pageNum) {
  const thumbData = thumbnailElements.get(pageNum);
  if (!thumbData || thumbData.isRendered || thumbData.renderTask) return;

  try {
    const pdfPage = await currentPdf.getPage(pageNum);
    const thumbScale = thumbData.thumbWidth / pdfPage.getViewport({ scale: 1 }).width;
    const viewport = pdfPage.getViewport({ scale: thumbScale });

    const canvas = document.createElement('canvas');
    canvas.className = 'thumbnail-canvas';
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d', { alpha: false });
    thumbData.card.innerHTML = '';
    thumbData.card.appendChild(canvas);
    thumbData.canvas = canvas;

    const renderTask = pdfPage.render({ canvasContext: ctx, viewport: viewport });
    thumbData.renderTask = renderTask;

    await renderTask.promise;
    thumbData.isRendered = true;
    thumbData.renderTask = null;
    pdfPage.cleanup();
  } catch (err) {
    if (err.name !== 'RenderingCancelledException') {
      console.warn(`Thumb error on page ${pageNum}:`, err);
    }
  }
}

function unrenderThumbnail(pageNum) {
  const thumbData = thumbnailElements.get(pageNum);
  if (!thumbData) return;

  if (thumbData.renderTask) {
    thumbData.renderTask.cancel();
    thumbData.renderTask = null;
  }

  if (thumbData.canvas) {
    thumbData.canvas.width = 0;
    thumbData.canvas.height = 0;
    thumbData.canvas.remove();
    thumbData.canvas = null;
  }

  thumbData.isRendered = false;

  if (thumbData.card.children.length === 0) {
    const placeholder = document.createElement('div');
    placeholder.className = 'thumbnail-placeholder';
    placeholder.textContent = `${pageNum}`;
    thumbData.card.appendChild(placeholder);
  }
}

function updateActiveThumbnail(pageNum) {
  thumbnailElements.forEach((thumb, i) => {
    thumb.item.classList.toggle('active', i === pageNum);
  });

  const activeThumb = document.getElementById(`thumb-${pageNum}`);
  if (activeThumb && sidebar.classList.contains('open')) {
    activeThumb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// ==========================================================================
// Table of Contents / Outline System
// ==========================================================================

async function loadOutline() {
  outlineTree.innerHTML = '';

  try {
    const outline = await currentPdf.getOutline();
    if (!outline || outline.length === 0) {
      outlineTree.innerHTML = `
        <div class="outline-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <p>เอกสารนี้ไม่มีสารบัญในตัว</p>
        </div>`;
      return;
    }

    await renderOutlineItems(outline, outlineTree, 0);
  } catch (err) {
    console.warn('Outline fetch error:', err);
    outlineTree.innerHTML = `<div class="outline-empty"><p>ไม่สามารถโหลดสารบัญได้</p></div>`;
  }
}

async function renderOutlineItems(items, container, depth) {
  for (const item of items) {
    const link = document.createElement('a');
    link.className = `outline-item depth-${Math.min(depth, 2)}`;
    link.textContent = item.title;
    link.href = '#';

    link.addEventListener('click', async (e) => {
      e.preventDefault();
      let targetDest = item.dest;
      if (typeof targetDest === 'string') {
        targetDest = await currentPdf.getDestination(targetDest);
      }
      if (Array.isArray(targetDest)) {
        const pageIndex = await currentPdf.getPageIndex(targetDest[0]);
        scrollToPage(pageIndex + 1);
        if (window.innerWidth <= 1024) closeSidebar();
      }
    });

    container.appendChild(link);

    if (item.items && item.items.length > 0) {
      await renderOutlineItems(item.items, container, depth + 1);
    }
  }
}

// ==========================================================================
// Scroll Tracking & Local-First Sync
// ==========================================================================

let lastScrollTop = 0;
const scrollDeltaThreshold = 8;

viewerContainer.addEventListener('scroll', () => {
  if (!currentPdf || isJumpingToPage) return;

  const currentScrollTop = viewerContainer.scrollTop;
  const delta = currentScrollTop - lastScrollTop;

  if (Math.abs(delta) > scrollDeltaThreshold) {
    if (delta > 0 && currentScrollTop > 40) {
      // Scrolling down -> hide floating capsule and bottom bar
      if (floatingCapsule) floatingCapsule.classList.add('hidden');
      if (bottomBar) bottomBar.classList.add('hidden');
      if (typeof closeFlyoutMenu === 'function') closeFlyoutMenu();
    } else if (delta < 0 || currentScrollTop < 40) {
      // Scrolling up -> reveal floating capsule and bottom bar
      if (floatingCapsule) floatingCapsule.classList.remove('hidden');
      if (bottomBar) {
        bottomBar.classList.remove('hidden');
        if (typeof scheduleScrubberAutoHide === 'function') scheduleScrubberAutoHide(2500);
      }
    }
    lastScrollTop = currentScrollTop;
  }

  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    if (isJumpingToPage) return;
    updateCurrentPageFromScroll();
  }, 60);
});

// Desktop top and bottom hover reveal
document.addEventListener('mousemove', (e) => {
  if (!currentPdf || dropZone.style.display !== 'none') return;
  if (e.clientY <= 50) {
    if (floatingCapsule) floatingCapsule.classList.remove('hidden');
  }
  if (window.innerHeight - e.clientY <= 70) {
    if (bottomBar && (!flyoutMenu || !flyoutMenu.classList.contains('open'))) {
      bottomBar.classList.remove('hidden');
      if (typeof scheduleScrubberAutoHide === 'function') scheduleScrubberAutoHide(2500);
    }
  }
});

function updateCurrentPageFromScroll() {
  if (!currentPdf || isJumpingToPage) return;

  const containerRect = viewerContainer.getBoundingClientRect();
  const centerY = containerRect.top + containerRect.height / 2;

  let closestPage = currentPage;
  let minDiff = Infinity;

  pageElements.forEach(({ container }, pageNum) => {
    const rect = container.getBoundingClientRect();
    const pageCenter = rect.top + rect.height / 2;
    const diff = Math.abs(centerY - pageCenter);
    if (diff < minDiff) {
      minDiff = diff;
      closestPage = pageNum;
    }
  });

  if (closestPage !== currentPage) {
    currentPage = closestPage;
    pageNumberInput.value = currentPage;
    pageSlider.value = currentPage;
    updateScrubberVisuals(currentPage);
    updateActiveThumbnail(currentPage);

    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (currentFileKey && !isJumpingToPage) {
        localStorage.setItem(getUserScopedKey(currentFileKey), currentPage.toString());
        saveRecentFile({
          id: currentFileKey,
          name: fileNameEl.title || fileNameEl.textContent,
          lastPage: currentPage,
          totalPages: totalPages,
          isDrive: !!currentDriveFileId,
          driveFileId: currentDriveFileId
        });
        if (currentDriveFileId && gdriveAccessToken) {
          debounceSyncDrivePage(currentDriveFileId, currentPage);
        }
      }
    }, 800);
  }
}

let lastNavTime = 0;
let jumpTimer = null;

function scrollToPage(pageNum, smooth = true) {
  if (pageNum < 1) pageNum = 1;
  if (pageNum > totalPages) pageNum = totalPages;

  const now = Date.now();
  const isRapidNav = (now - lastNavTime < 450);
  lastNavTime = now;

  currentPage = pageNum;
  pageNumberInput.value = currentPage;
  pageSlider.value = currentPage;
  updateScrubberVisuals(currentPage);
  updateActiveThumbnail(currentPage);

  // 1. Keep capsule and bottom bar visible when user intentionally navigates
  if (floatingCapsule) {
    floatingCapsule.classList.remove('hidden');
  }
  if (bottomBar) {
    bottomBar.classList.remove('hidden');
    if (typeof scheduleScrubberAutoHide === 'function') {
      scheduleScrubberAutoHide(3000);
    }
  }

  // 2. Set jump lock so programmatic scroll down does NOT hide the capsule
  isJumpingToPage = true;
  clearTimeout(jumpTimer);

  // 3. Immediately pre-render target page and neighbors for seamless, continuous reading
  renderMainPage(pageNum);
  if (pageNum < totalPages) renderMainPage(pageNum + 1);
  if (pageNum > 1) renderMainPage(pageNum - 1);

  const targetEl = document.getElementById(`page-${pageNum}`);
  if (targetEl) {
    const containerRect = viewerContainer.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const topOffset = window.innerWidth <= 768 ? 58 : 68;
    const targetTop = Math.max(0, viewerContainer.scrollTop + (targetRect.top - containerRect.top) - topOffset);

    // If clicking rapidly, jump directly without queuing slow animations
    const scrollBehavior = (smooth && !isRapidNav) ? 'smooth' : 'auto';
    viewerContainer.scrollTo({ top: targetTop, behavior: scrollBehavior });
  }

  const lockDuration = (smooth && !isRapidNav) ? 500 : 120;
  jumpTimer = setTimeout(() => {
    isJumpingToPage = false;
    lastScrollTop = viewerContainer.scrollTop;
  }, lockDuration);

  if (currentFileKey) {
    localStorage.setItem(getUserScopedKey(currentFileKey), currentPage.toString());
    saveRecentFile({
      id: currentFileKey,
      name: fileNameEl.title || fileNameEl.textContent,
      lastPage: currentPage,
      totalPages: totalPages,
      isDrive: !!currentDriveFileId,
      driveFileId: currentDriveFileId
    });
    if (currentDriveFileId && gdriveAccessToken) {
      debounceSyncDrivePage(currentDriveFileId, currentPage);
    }
  }
}

// Navigation Controls
prevPageBtn.addEventListener('click', () => {
  if (currentPage > 1) scrollToPage(currentPage - 1);
});

nextPageBtn.addEventListener('click', () => {
  if (currentPage < totalPages) scrollToPage(currentPage + 1);
});

pageNumberInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const val = parseInt(pageNumberInput.value, 10);
    if (!isNaN(val)) {
      scrollToPage(val);
      pageNumberInput.blur();
    }
  }
});

const scrubberTrack = document.getElementById('scrubberTrack');
const scrubberProgress = document.getElementById('scrubberProgress');
const scrubberThumb = document.getElementById('scrubberThumb');
let isDraggingScrubber = false;
let scrubberAutoHideTimer = null;

function scheduleScrubberAutoHide(delay = 2500) {
  clearTimeout(scrubberAutoHideTimer);
  if (isDraggingScrubber) return;
  scrubberAutoHideTimer = setTimeout(() => {
    if (isDraggingScrubber) return;
    if (bottomBar) bottomBar.classList.add('hidden');
  }, delay);
}

function updateScrubberVisuals(pageNum) {
  if (!totalPages || totalPages <= 1) {
    if (scrubberThumb) scrubberThumb.style.left = '0%';
    if (scrubberProgress) scrubberProgress.style.width = '0%';
    if (sliderTooltip) {
      sliderTooltip.style.left = '0%';
      sliderTooltip.textContent = `หน้า 1`;
    }
    return;
  }
  const pct = Math.max(0, Math.min(1, (pageNum - 1) / (totalPages - 1))) * 100;
  if (scrubberThumb) scrubberThumb.style.left = `${pct}%`;
  if (scrubberProgress) scrubberProgress.style.width = `${pct}%`;
  if (sliderTooltip) {
    sliderTooltip.style.left = `${pct}%`;
    sliderTooltip.textContent = `หน้า ${pageNum} / ${totalPages}`;
  }
}

function handleScrubberPointer(e) {
  if (!currentPdf || totalPages <= 1) return currentPage;
  const trackEl = scrubberTrack || bottomBar;
  const rect = trackEl.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const pct = Math.max(0, Math.min(1, clickX / rect.width));
  const targetPage = Math.round(1 + pct * (totalPages - 1));

  updateScrubberVisuals(targetPage);
  if (sliderTooltip) sliderTooltip.classList.add('visible');
  if (pageNumberInput) pageNumberInput.value = targetPage;
  if (pageSlider) pageSlider.value = targetPage;

  return targetPage;
}

if (bottomBar) {
  bottomBar.addEventListener('mouseenter', () => {
    clearTimeout(scrubberAutoHideTimer);
  });

  bottomBar.addEventListener('mouseleave', () => {
    if (!isDraggingScrubber) scheduleScrubberAutoHide(1500);
  });

  bottomBar.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    clearTimeout(scrubberAutoHideTimer);
    isDraggingScrubber = true;
    bottomBar.classList.add('dragging');
    try { bottomBar.setPointerCapture(e.pointerId); } catch (_) {}
    handleScrubberPointer(e);
  });

  bottomBar.addEventListener('pointermove', (e) => {
    if (!isDraggingScrubber) return;
    handleScrubberPointer(e);
  });

  const onPointerUp = (e) => {
    if (!isDraggingScrubber) return;
    isDraggingScrubber = false;
    bottomBar.classList.remove('dragging');
    try { bottomBar.releasePointerCapture(e.pointerId); } catch (_) {}
    const targetPage = handleScrubberPointer(e);
    if (sliderTooltip) sliderTooltip.classList.remove('visible');
    if (targetPage) {
      scrollToPage(targetPage);
    }
    scheduleScrubberAutoHide(2200);
  };

  bottomBar.addEventListener('pointerup', onPointerUp);
  bottomBar.addEventListener('pointercancel', onPointerUp);
}

if (pageSlider) {
  pageSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    updateScrubberVisuals(val);
    sliderTooltip.classList.add('visible');
  });

  pageSlider.addEventListener('change', (e) => {
    sliderTooltip.classList.remove('visible');
    scrollToPage(parseInt(e.target.value, 10));
  });
}

// ==========================================================================
// Zoom Controls
// ==========================================================================

function applyZoom(newScale) {
  if (!currentPdf || !baseViewport) return;

  currentScale = Math.min(Math.max(newScale, 0.35), 3.5);
  const width = Math.floor(baseViewport.width * currentScale);
  const height = Math.floor(baseViewport.height * currentScale);

  pageElements.forEach((pageData, pageNum) => {
    pageData.container.style.width = `${width}px`;
    pageData.container.style.height = `${height}px`;

    if (pageData.isRendered) {
      unrenderMainPage(pageNum);
      renderMainPage(pageNum);
    }
  });

  scrollToPage(currentPage, false);
}

if (zoomInBtn) zoomInBtn.addEventListener('click', () => applyZoom(currentScale * 1.2));
if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => applyZoom(currentScale / 1.2));
if (zoomFitBtn) zoomFitBtn.addEventListener('click', () => {
  calculateFitWidthScale();
  applyZoom(currentScale);
});

// Mobile Zoom Popover Controls
const mobileZoomBtn = document.getElementById('mobileZoomBtn');
const zoomPopover = document.getElementById('zoomPopover');
const mZoomInBtn = document.getElementById('mZoomInBtn');
const mZoomOutBtn = document.getElementById('mZoomOutBtn');
const mZoomFitBtn = document.getElementById('mZoomFitBtn');

if (mobileZoomBtn && zoomPopover) {
  mobileZoomBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    zoomPopover.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!zoomPopover.contains(e.target) && e.target !== mobileZoomBtn) {
      zoomPopover.classList.remove('open');
    }
  });

  if (mZoomInBtn) mZoomInBtn.addEventListener('click', () => applyZoom(currentScale * 1.2));
  if (mZoomOutBtn) mZoomOutBtn.addEventListener('click', () => applyZoom(currentScale / 1.2));
  if (mZoomFitBtn) {
    mZoomFitBtn.addEventListener('click', () => {
      calculateFitWidthScale();
      applyZoom(currentScale);
      zoomPopover.classList.remove('open');
      showToast('ปรับพอดีจอแล้ว');
    });
  }
}

// Fullscreen
if (fullscreenBtn) {
  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Fullscreen error:', err);
      });
    } else {
      document.exitFullscreen();
    }
  });
}

// Cleanup
async function cleanupAllPages() {
  if (viewerObserver) viewerObserver.disconnect();
  if (thumbnailObserver) thumbnailObserver.disconnect();

  pageElements.forEach((_, pageNum) => unrenderMainPage(pageNum));
  pageElements.clear();

  thumbnailElements.forEach((_, pageNum) => unrenderThumbnail(pageNum));
  thumbnailElements.clear();

  viewer.innerHTML = '';
  thumbnailsGrid.innerHTML = '';
  outlineTree.innerHTML = '';
}

// ==========================================================================
// Mobile Touch Gestures (Tap to Toggle Bars, Swipe to Turn Page, Double-Tap & Pinch Zoom)
// ==========================================================================

let lastTapTime = 0;
let initialPinchDistance = null;
let initialScaleOnPinch = 1.0;

viewerContainer.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    // 2 Fingers: Start Pinch Zoom
    initialPinchDistance = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    initialScaleOnPinch = currentScale;
  } else if (e.touches.length === 1) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
  }
}, { passive: true });

viewerContainer.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2 && initialPinchDistance) {
    const currentDistance = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    const factor = currentDistance / initialPinchDistance;
    const newScale = Math.min(Math.max(initialScaleOnPinch * factor, 0.35), 3.5);
    applyZoom(newScale);
  }
}, { passive: true });

viewerContainer.addEventListener('touchend', (e) => {
  if (initialPinchDistance) {
    initialPinchDistance = null;
    return;
  }

  if (!currentPdf || e.changedTouches.length === 0) return;

  const touchEndX = e.changedTouches[0].clientX;
  const touchEndY = e.changedTouches[0].clientY;
  const deltaX = touchEndX - touchStartX;
  const deltaY = touchEndY - touchStartY;
  const duration = Date.now() - touchStartTime;

  // 1. Double-Tap or Single-Tap Detection
  if (Math.abs(deltaX) < 14 && Math.abs(deltaY) < 14 && duration < 300) {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTime;

    if (timeSinceLastTap < 350) {
      // Double Tap: Toggle Zoom in/out
      lastTapTime = 0;
      const fitScale = (viewerContainer.clientWidth - (window.innerWidth <= 768 ? 16 : 48)) / (baseViewport ? baseViewport.width : 1);
      if (currentScale > fitScale * 1.25) {
        calculateFitWidthScale();
        applyZoom(currentScale);
        showToast('ซูมพอดีจอ');
      } else {
        applyZoom(fitScale * 1.75);
        showToast('ซูมขยาย 175%');
      }
      return;
    } else {
      lastTapTime = now;
      setTimeout(() => {
        if (Date.now() - lastTapTime >= 320 && lastTapTime !== 0) {
          if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'A' && !e.target.closest('#floatingCapsule') && !e.target.closest('#flyoutMenu')) {
            if (floatingCapsule) floatingCapsule.classList.toggle('hidden');
            if (bottomBar) {
              bottomBar.classList.toggle('hidden');
              if (!bottomBar.classList.contains('hidden') && typeof scheduleScrubberAutoHide === 'function') {
                scheduleScrubberAutoHide(2500);
              }
            }
            closeFlyoutMenu();
          }
        }
      }, 320);
      return;
    }
  }

  // 2. Horizontal Swipe for Next/Prev Page
  if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.6 && duration < 400) {
    if (deltaX < 0 && currentPage < totalPages) {
      scrollToPage(currentPage + 1);
    } else if (deltaX > 0 && currentPage > 1) {
      scrollToPage(currentPage - 1);
    }
  }
}, { passive: true });

// ==========================================================================
// Keyboard Shortcuts
// ==========================================================================

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;

  switch (e.key) {
    case 'ArrowLeft':
    case 'PageUp':
      e.preventDefault();
      if (currentPage > 1) scrollToPage(currentPage - 1);
      break;
    case 'ArrowRight':
    case 'PageDown':
      e.preventDefault();
      if (currentPage < totalPages) scrollToPage(currentPage + 1);
      break;
    case '+':
    case '=':
      e.preventDefault();
      applyZoom(currentScale * 1.2);
      break;
    case '-':
      e.preventDefault();
      applyZoom(currentScale / 1.2);
      break;
    case '0':
      e.preventDefault();
      calculateFitWidthScale();
      applyZoom(currentScale);
      break;
    case 'f':
    case 'F':
      e.preventDefault();
      if (fullscreenBtn) fullscreenBtn.click();
      break;
    case 't':
    case 'T':
      e.preventDefault();
      if (themeCycleBtn) {
        themeCycleBtn.click();
      }
      break;
  }
});

// Window resize handler (debounced auto-fit and re-centering across devices)
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (currentPdf) {
      calculateFitWidthScale();
      applyZoom(currentScale);
    }
  }, 180);
});

// Open Document Dropdown
if (openDocBtn && openDocWrap) {
  openDocBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openDocWrap.classList.toggle('open');
  });
}

if (openDocMenu && openDocWrap) {
  openDocMenu.addEventListener('click', () => {
    openDocWrap.classList.remove('open');
  });
}

document.addEventListener('pointerdown', (e) => {
  if (openDocWrap && !openDocWrap.contains(e.target)) {
    openDocWrap.classList.remove('open');
  }
});

document.addEventListener('click', (e) => {
  if (openDocWrap && !openDocWrap.contains(e.target)) {
    openDocWrap.classList.remove('open');
  }
});

// Flyout Menu Controls
function openFlyoutMenu() {
  if (flyoutMenu) flyoutMenu.classList.add('open');
  if (flyoutBackdrop) flyoutBackdrop.classList.add('open');
  if (bottomBar) bottomBar.classList.add('hidden');
}

function closeFlyoutMenu() {
  if (flyoutMenu) flyoutMenu.classList.remove('open');
  if (flyoutBackdrop) flyoutBackdrop.classList.remove('open');
}

function toggleFlyoutMenu() {
  if (flyoutMenu && flyoutMenu.classList.contains('open')) {
    closeFlyoutMenu();
  } else {
    openFlyoutMenu();
  }
}

if (capsuleMenuBtn) {
  capsuleMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFlyoutMenu();
  });
}

if (closeFlyoutBtn) closeFlyoutBtn.addEventListener('click', closeFlyoutMenu);
if (flyoutBackdrop) flyoutBackdrop.addEventListener('click', closeFlyoutMenu);

if (flyoutSidebarBtn) {
  flyoutSidebarBtn.addEventListener('click', () => {
    closeFlyoutMenu();
    toggleSidebar();
  });
}

if (flyoutSettingsBtn) {
  flyoutSettingsBtn.addEventListener('click', () => {
    closeFlyoutMenu();
    openSettingsModal();
  });
}

// Shelf and Recents controls
if (shelfBtn) {
  shelfBtn.addEventListener('click', () => {
    dropZone.style.display = 'flex';
    viewer.classList.remove('active');
    if (floatingCapsule) floatingCapsule.style.display = 'none';
    bottomBar.classList.remove('visible');
    closeFlyoutMenu();
    fileNameEl.textContent = 'คลังหนังสือ';
    fileNameEl.title = 'คลังหนังสือ';
    renderRecentShelf();
    closeSidebar();
  });
}

if (clearRecentsBtn) {
  clearRecentsBtn.addEventListener('click', clearAllRecents);
}

// ==========================================================================
// Google Drive & In-App Credentials Manager (Zero-Hardcode Security)
// ==========================================================================

function getGdriveConfig() {
  // 1. Check optional window.GDRIVE_CONFIG (e.g. from ignored local config.js)
  if (typeof window !== 'undefined' && window.GDRIVE_CONFIG && window.GDRIVE_CONFIG.clientId && window.GDRIVE_CONFIG.apiKey) {
    return window.GDRIVE_CONFIG;
  }
  // 2. Check localStorage
  try {
    const raw = localStorage.getItem(GDRIVE_CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveGdriveConfig(clientId, apiKey) {
  const cfg = {
    clientId: (clientId || '').trim(),
    apiKey: (apiKey || '').trim()
  };
  localStorage.setItem(GDRIVE_CONFIG_KEY, JSON.stringify(cfg));
  initGoogleClients();
  return cfg;
}

function clearGdriveConfig() {
  localStorage.removeItem(GDRIVE_CONFIG_KEY);
  gdriveAccessToken = null;
  tokenClient = null;
  gisInited = false;
  const mobileSyncSection = document.getElementById('mobileSyncSection');
  if (mobileSyncSection) mobileSyncSection.style.display = 'none';
  showToast('ล้างข้อมูลกุญแจ Google Drive ในเครื่องแล้ว');
}

let qrCodeInstance = null;
function updateMobileSyncQR(cfg) {
  const mobileSyncSection = document.getElementById('mobileSyncSection');
  const qrContainer = document.getElementById('qrcode');
  if (!mobileSyncSection || !qrContainer) return;

  if (!cfg || !cfg.clientId || !cfg.apiKey) {
    mobileSyncSection.style.display = 'none';
    return;
  }

  // Generate URL with encoded setup payload
  const payload = btoa(encodeURIComponent(JSON.stringify({ clientId: cfg.clientId, apiKey: cfg.apiKey })));
  const syncUrl = `${window.location.origin}${window.location.pathname}#setup=${payload}`;

  mobileSyncSection.style.display = 'flex';
  qrContainer.innerHTML = '';

  if (typeof QRCode !== 'undefined') {
    try {
      qrCodeInstance = new QRCode(qrContainer, {
        text: syncUrl,
        width: 160,
        height: 160,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (e) {
      console.warn('QR Code generation warning:', e);
    }
  }

  const copySyncLinkBtn = document.getElementById('copySyncLinkBtn');
  if (copySyncLinkBtn) {
    copySyncLinkBtn.onclick = () => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(syncUrl).then(() => {
          showToast('คัดลอกลิงก์ตั้งค่าแล้ว! ส่งเข้า LINE หรือเปิดบนมือถือได้เลย');
        }).catch(() => {
          prompt('คัดลอกลิงก์ด้านล่างเพื่อเปิดบนมือถือ:', syncUrl);
        });
      } else {
        prompt('คัดลอกลิงก์ด้านล่างเพื่อเปิดบนมือถือ:', syncUrl);
      }
    };
  }
}

function checkUrlSetup() {
  if (window.location.hash && window.location.hash.startsWith('#setup=')) {
    try {
      const raw = decodeURIComponent(atob(window.location.hash.replace('#setup=', '')));
      const parsed = JSON.parse(raw);
      if (parsed.clientId && parsed.apiKey) {
        saveGdriveConfig(parsed.clientId, parsed.apiKey);
        showToast('ตั้งค่า Google Drive สำเร็จแล้ว! พร้อมใช้งานบนมือถือ');
        // Clean URL immediately so hash doesn't linger in browser history
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        } else {
          window.location.hash = '';
        }
      }
    } catch (e) {
      console.warn('URL setup parse error:', e);
    }
  }
}

function openSettingsModal() {
  const cfg = getGdriveConfig();
  if (cfg) {
    cfgClientIdInput.value = cfg.clientId || '';
    cfgApiKeyInput.value = cfg.apiKey || '';
    updateMobileSyncQR(cfg);
  } else {
    cfgClientIdInput.value = '';
    cfgApiKeyInput.value = '';
    const mobileSyncSection = document.getElementById('mobileSyncSection');
    if (mobileSyncSection) mobileSyncSection.style.display = 'none';
  }
  settingsModal.classList.add('open');
  settingsModal.setAttribute('aria-hidden', 'false');
}

function closeSettingsModal() {
  settingsModal.classList.remove('open');
  settingsModal.setAttribute('aria-hidden', 'true');
}

// Password visibility toggle
document.querySelectorAll('.btn-toggle-pw').forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    const input = document.getElementById(targetId);
    if (input) {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.style.color = isPassword ? 'var(--primary-color)' : '';
    }
  });
});

if (openSettingsBtn) openSettingsBtn.addEventListener('click', openSettingsModal);
if (closeSettingsModalBtn) closeSettingsModalBtn.addEventListener('click', closeSettingsModal);
if (cancelSettingsBtn) cancelSettingsBtn.addEventListener('click', closeSettingsModal);
if (settingsModal) {
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettingsModal();
  });
}

if (clearConfigBtn) {
  clearConfigBtn.addEventListener('click', () => {
    if (confirm('ต้องการล้างกุญแจ Google Drive ออกจากเครื่องนี้หรือไม่?')) {
      clearGdriveConfig();
      cfgClientIdInput.value = '';
      cfgApiKeyInput.value = '';
      closeSettingsModal();
    }
  });
}

if (saveConfigBtn) {
  saveConfigBtn.addEventListener('click', () => {
    const clientId = cfgClientIdInput.value.trim();
    const apiKey = cfgApiKeyInput.value.trim();

    if (!clientId || !apiKey) {
      showToast('กรุณากรอกทั้ง Client ID และ API Key ให้ครบถ้วน');
      return;
    }

    const saved = saveGdriveConfig(clientId, apiKey);
    updateMobileSyncQR(saved);
    closeSettingsModal();
    showToast('บันทึกกุญแจสำเร็จ กำลังเชื่อมต่อ Google Drive...');
    setTimeout(() => {
      openGoogleDrivePicker();
    }, 400);
  });
}

// ==========================================================================
// User Session & Authentication Manager
// ==========================================================================

function getSessionRaw() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function getSession() {
  const session = getSessionRaw();
  if (!session || !session.token) return null;

  const now = Date.now();
  // 1. Check absolute token expiry (1 hour max)
  if (now >= session.expiresAt) {
    console.info('[Session] Expired by absolute 1-hour time limit');
    clearSession(false);
    return null;
  }
  // 2. Check idle inactivity (30 minutes without touch/key/scroll)
  if (now - session.lastActiveAt >= IDLE_TIMEOUT_MS) {
    console.info('[Session] Expired by 30-minute idle inactivity');
    clearSession(false, true);
    return null;
  }
  return session;
}

function saveSession(token, expiresInSec, userInfo) {
  const now = Date.now();
  const session = {
    token,
    expiresAt: now + (expiresInSec ? expiresInSec * 1000 : ABSOLUTE_EXPIRY_MS),
    lastActiveAt: now,
    user: {
      id: userInfo.sub || userInfo.id || 'user',
      name: userInfo.name || 'Google User',
      email: userInfo.email || '',
      picture: userInfo.picture || ''
    }
  };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  gdriveAccessToken = token;
  lastUserActivityAt = now;
  return session;
}

function clearSession(revoke = true, isIdleTimeout = false) {
  const current = getSessionRaw();
  if (revoke && current && current.token && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
    try {
      google.accounts.oauth2.revoke(current.token, () => {
        console.info('[Auth] Google OAuth token revoked');
      });
    } catch (e) {
      console.warn('[Auth] Revoke token warning:', e);
    }
  }

  gdriveAccessToken = null;
  localStorage.removeItem(SESSION_STORAGE_KEY);
  closeProfilePopover();
  updateAuthUI();
  renderRecentShelf();

  if (isIdleTimeout) {
    showToast('เซสชันหมดอายุเนื่องจากไม่มีการใช้งานเกิน 30 นาที (สลับเป็น Guest)');
  }
}

function getActiveProfile() {
  const session = getSession();
  if (session && session.user && session.user.id) {
    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      picture: session.user.picture,
      isGuest: false
    };
  }
  return {
    id: 'guest',
    name: 'ผู้เยี่ยมชม (Guest)',
    email: '',
    picture: '',
    isGuest: true
  };
}

function registerUserActivity() {
  const now = Date.now();
  lastUserActivityAt = now;
  // Throttle disk update to every 30 seconds
  if (now - lastActivityUpdateSent > 30000) {
    lastActivityUpdateSent = now;
    const session = getSessionRaw();
    if (session) {
      session.lastActiveAt = now;
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  }
}

function initActivityListeners() {
  const events = ['pointerdown', 'touchstart', 'keydown', 'scroll'];
  events.forEach((evt) => {
    window.addEventListener(evt, registerUserActivity, { passive: true });
  });
}

function startSessionWatchdog() {
  if (sessionWatchdogTimer) clearInterval(sessionWatchdogTimer);
  sessionWatchdogTimer = setInterval(() => {
    const raw = getSessionRaw();
    if (raw) {
      const valid = getSession();
      if (!valid) {
        return;
      }
      updateSessionCountdownUI();
    }
  }, 30000);
}

function updateSessionCountdownUI() {
  const session = getSession();
  if (!session || !sessionCountdownText) return;
  const now = Date.now();
  const remainingMs = Math.max(0, session.expiresAt - now);
  const idleRemainingMs = Math.max(0, IDLE_TIMEOUT_MS - (now - session.lastActiveAt));
  const effectiveMs = Math.min(remainingMs, idleRemainingMs);
  const mins = Math.ceil(effectiveMs / 60000);

  if (mins <= 1) {
    sessionCountdownText.textContent = '⏱️ กำลังจะหมดอายุในไม่กี่วินาที (หากไม่เคลื่อนไหว)';
  } else {
    sessionCountdownText.textContent = `⏱️ หมดอายุใน ${mins} นาที (ตัดหากไม่ใช้งาน 30 น.)`;
  }
}

function updateAuthUI() {
  const profile = getActiveProfile();
  if (!authProfileBtn) return;

  if (profile.isGuest) {
    if (guestUserIcon) guestUserIcon.style.display = 'block';
    if (userAvatarImg) userAvatarImg.style.display = 'none';
    if (avatarStatusDot) avatarStatusDot.style.display = 'none';
    authProfileBtn.title = 'เข้าสู่ระบบ Google / โปรไฟล์';
  } else {
    if (guestUserIcon) guestUserIcon.style.display = 'none';
    if (userAvatarImg) {
      userAvatarImg.src = profile.picture || '';
      userAvatarImg.alt = profile.name || 'User Avatar';
      userAvatarImg.style.display = 'block';
    }
    if (avatarStatusDot) avatarStatusDot.style.display = 'block';
    authProfileBtn.title = `โปรไฟล์: ${profile.name} (คลิกเพื่อดูรายละเอียด)`;
  }
}

function openProfilePopover() {
  const profile = getActiveProfile();
  if (!profilePopover) return;

  if (profile.isGuest) {
    if (popoverGuestView) popoverGuestView.style.display = 'block';
    if (popoverLoggedInView) popoverLoggedInView.style.display = 'none';
  } else {
    if (popoverGuestView) popoverGuestView.style.display = 'none';
    if (popoverLoggedInView) popoverLoggedInView.style.display = 'block';

    if (popoverAvatarImg) popoverAvatarImg.src = profile.picture || '';
    if (popoverUserName) popoverUserName.textContent = profile.name || 'ผู้ใช้ Google';
    if (popoverUserEmail) popoverUserEmail.textContent = profile.email || '';

    const books = getRecentFiles();
    if (popoverBookCount) popoverBookCount.textContent = `${books.length} เล่ม`;

    updateSessionCountdownUI();
  }

  if (profileBackdrop) profileBackdrop.style.display = 'block';
  profilePopover.style.display = 'block';

  requestAnimationFrame(() => {
    if (profileBackdrop) profileBackdrop.classList.add('open');
    profilePopover.classList.add('open');
    profilePopover.setAttribute('aria-hidden', 'false');
  });
}

function closeProfilePopover() {
  if (!profilePopover) return;
  if (profileBackdrop) profileBackdrop.classList.remove('open');
  profilePopover.classList.remove('open');
  profilePopover.setAttribute('aria-hidden', 'true');

  setTimeout(() => {
    if (!profilePopover.classList.contains('open')) {
      if (profileBackdrop) profileBackdrop.style.display = 'none';
      profilePopover.style.display = 'none';
    }
  }, 200);
}

function toggleProfilePopover() {
  if (!profilePopover) return;
  if (profilePopover.classList.contains('open')) {
    closeProfilePopover();
  } else {
    openProfilePopover();
  }
}

function handleSignInClick() {
  closeProfilePopover();
  const cfg = getGdriveConfig();
  if (!cfg || !cfg.clientId) {
    showToast('กรุณากรอก Client ID ในหน้าตั้งค่าก่อนเข้าสู่ระบบ');
    openSettingsModal();
    return;
  }
  if (!tokenClient || !gisInited) {
    initGoogleClients();
  }
  if (tokenClient) {
    tokenClient.requestAccessToken({ prompt: 'select_account' });
  } else {
    showToast('กำลังเตรียมระบบ Google... กรุณากดใหม่อีกครั้ง');
    setTimeout(initGoogleClients, 1000);
  }
}

// ==========================================================================
// Google Identity Services (GIS) & Google Picker Integration
// ==========================================================================

function initGoogleClients() {
  const cfg = getGdriveConfig();

  // 1. Initialize GAPI Picker
  if (typeof gapi !== 'undefined' && !gapiInited) {
    try {
      gapi.load('picker', () => {
        gapiInited = true;
      });
    } catch (e) {
      console.warn('GAPI Picker load warning:', e);
    }
  }

  // Restore existing session token if available
  const existingSession = getSession();
  if (existingSession && existingSession.token) {
    gdriveAccessToken = existingSession.token;
  }

  // 2. Initialize GIS TokenClient if config exists
  if (cfg && cfg.clientId && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
    try {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: cfg.clientId,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email openid',
        callback: async (resp) => {
          if (resp.error !== undefined) {
            console.error('GIS Error:', resp);
            showToast('เข้าสู่ระบบไม่สำเร็จ: ' + (resp.error_description || resp.error));
            return;
          }
          gdriveAccessToken = resp.access_token;

          // Fetch Google User Profile info
          let userInfo = { name: 'Google User', email: '', picture: '' };
          try {
            const userResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${resp.access_token}` }
            });
            if (userResp.ok) {
              userInfo = await userResp.json();
            }
          } catch (err) {
            console.warn('UserInfo fetch warning:', err);
          }

          saveSession(resp.access_token, resp.expires_in, userInfo);
          updateAuthUI();
          renderRecentShelf();
          showToast(`ยินดีต้อนรับ ${userInfo.name || 'เข้าสู่ระบบสำเร็จ'}`);
          triggerDriveShelfSync(2000); // Sync Drive bookshelf after login

          if (pendingAuthCallback) {
            const cb = pendingAuthCallback;
            pendingAuthCallback = null;
            cb();
          }
        }
      });
      gisInited = true;
    } catch (err) {
      console.warn('GIS TokenClient init error:', err);
    }
  }
}

function openGoogleDrivePicker() {
  if (openDocWrap) openDocWrap.classList.remove('open');

  const cfg = getGdriveConfig();
  if (!cfg || !cfg.clientId || !cfg.apiKey) {
    showToast('กรุณากรอก Client ID และ API Key ก่อนใช้งาน');
    openSettingsModal();
    return;
  }

  if (!tokenClient || !gisInited) {
    initGoogleClients();
  }

  const session = getSession();
  if (session && session.token) {
    gdriveAccessToken = session.token;
  }

  if (!gdriveAccessToken) {
    pendingAuthCallback = () => {
      createAndShowPicker(cfg.apiKey, cfg.clientId);
    };
    showToast('กำลังขอสิทธิ์เข้าถึง Google Drive...');
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: '' });
    } else {
      showToast('กำลังโหลดระบบ Google กรุณากดใหม่อีกครั้ง');
      setTimeout(initGoogleClients, 1000);
    }
  } else {
    createAndShowPicker(cfg.apiKey, cfg.clientId);
  }
}

if (authProfileBtn) authProfileBtn.addEventListener('click', toggleProfilePopover);
if (closeProfilePopoverBtn) closeProfilePopoverBtn.addEventListener('click', closeProfilePopover);
if (closeGuestPopoverBtn) closeGuestPopoverBtn.addEventListener('click', closeProfilePopover);
if (profileBackdrop) profileBackdrop.addEventListener('click', closeProfilePopover);
if (guestSignInBtn) guestSignInBtn.addEventListener('click', handleSignInClick);

if (signOutBtn) {
  signOutBtn.addEventListener('click', () => {
    if (confirm('ต้องการออกจากระบบและสลับเป็นโหมดผู้เยี่ยมชม (Guest) หรือไม่?')) {
      clearSession(true);
      showToast('ออกจากระบบเรียบร้อยแล้ว (สลับเป็น Guest)');
    }
  });
}

if (driveOpenBtn) driveOpenBtn.addEventListener('click', openGoogleDrivePicker);
if (dropZoneDriveBtn) dropZoneDriveBtn.addEventListener('click', openGoogleDrivePicker);

function createAndShowPicker(apiKey, clientId) {
  if (typeof google === 'undefined' || !google.picker) {
    if (typeof gapi !== 'undefined') {
      gapi.load('picker', () => createAndShowPicker(apiKey, clientId));
    } else {
      showToast('กำลังโหลด Google Picker กรุณารอสักครู่');
    }
    return;
  }

  try {
    // 1. Calculate responsive dimensions for mobile / tablet / desktop
    const screenW = window.innerWidth || document.documentElement.clientWidth;
    const screenH = window.innerHeight || document.documentElement.clientHeight;
    const isMobile = screenW <= 640;

    const pickerWidth = isMobile ? Math.max(300, Math.min(screenW - 20, 560)) : Math.min(screenW - 60, 780);
    const pickerHeight = isMobile ? Math.max(400, Math.min(screenH - 30, 620)) : Math.min(screenH - 80, 560);

    // 2. View configuration: PDF filter + folder navigation + clean list mode
    const view = (google.picker.DocsView)
      ? new google.picker.DocsView(google.picker.ViewId.DOCS)
      : new google.picker.View(google.picker.ViewId.DOCS);

    if (view.setMimeTypes) view.setMimeTypes('application/pdf');
    if (view.setIncludeFolders) view.setIncludeFolders(true);
    if (view.setMode && google.picker.DocsViewMode) {
      view.setMode(google.picker.DocsViewMode.LIST);
    }

    const appId = clientId.split('-')[0];
    const builder = new google.picker.PickerBuilder()
      .enableFeature(google.picker.Feature.NAV_HIDDEN)
      .setAppId(appId)
      .setOAuthToken(gdriveAccessToken)
      .addView(view)
      .addView(new google.picker.DocsUploadView())
      .setDeveloperKey(apiKey)
      .setLocale('th')
      .setTitle('เลือกไฟล์ PDF จาก Google Drive')
      .setSize(pickerWidth, pickerHeight)
      .setCallback(pickerCallback);

    const picker = builder.build();
    picker.setVisible(true);
  } catch (err) {
    console.error('Picker create error:', err);
    showToast('เปิดหน้าต่างเลือกไฟล์ไม่สำเร็จ: ' + err.message);
  }
}

async function pickerCallback(data) {
  if (data[google.picker.Response.ACTION] === google.picker.Action.PICKED) {
    const doc = data[google.picker.Response.DOCUMENTS][0];
    const fileId = doc[google.picker.Document.ID];
    const fileName = doc[google.picker.Document.NAME];
    await openDriveFileById(fileId, fileName);
  }
}

async function openDriveFileById(fileId, fileName, targetPage = null) {
  try {
    showToast(`กำลังดึงข้อมูล "${fileName}" จาก Google Drive...`);

    if (!gdriveAccessToken) {
      showToast('กำลังขอสิทธิ์เข้าถึงเพื่อเปิดไฟล์...');
      openGoogleDrivePicker();
      return;
    }

    // 1. Fetch file metadata to get cross-device appProperties (lastReadPage)
    let cloudLastPage = null;
    try {
      const metaResp = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,appProperties,size`,
        {
          headers: { Authorization: `Bearer ${gdriveAccessToken}` }
        }
      );
      if (metaResp.ok) {
        const meta = await metaResp.json();
        if (meta.appProperties && meta.appProperties.lastReadPage) {
          cloudLastPage = parseInt(meta.appProperties.lastReadPage, 10);
        }
      }
    } catch (e) {
      console.warn('Metadata fetch warning:', e);
    }

    const pageToResume = targetPage || cloudLastPage;

    // 2. Fetch binary media content
    const mediaResp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${gdriveAccessToken}` }
      }
    );

    if (!mediaResp.ok) {
      if (mediaResp.status === 401) {
        gdriveAccessToken = null;
        showToast('เซสชันหมดอายุ กรุณากดเชื่อมต่อใหม่อีกครั้ง');
        openGoogleDrivePicker();
        return;
      }
      throw new Error(`ดาวน์โหลดไฟล์ไม่สำเร็จ (HTTP ${mediaResp.status})`);
    }

    const blob = await mediaResp.blob();
    blob.name = fileName;
    blob.driveFileId = fileId;

    await loadFile(blob, pageToResume);
  } catch (err) {
    console.error('Drive file open error:', err);
    showToast('เปิดไฟล์จาก Google Drive ไม่สำเร็จ: ' + err.message);
  }
}

// Debounced synchronization of current page to Google Drive appProperties
function debounceSyncDrivePage(fileId, pageNum) {
  clearTimeout(driveSyncTimer);
  driveSyncTimer = setTimeout(async () => {
    if (!gdriveAccessToken || !fileId) return;

    try {
      const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${gdriveAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          appProperties: {
            lastReadPage: pageNum.toString(),
            lastReadAt: new Date().toISOString()
          }
        })
      });
      if (resp.ok) {
        console.log(`[Google Drive] Synced page ${pageNum} to cloud appProperties`);
      }
    } catch (err) {
      console.warn('[Google Drive] Sync failed:', err);
    }
  }, 1500);
}

// ==========================================================================
// Upload Local Files to Google Drive (Cross-Device for locally opened PDFs)
// Locally opened files are stored only on the current device. To make the
// bookshelf + reading position sync cross-device, we upload the file to the
// user's Drive once (deduped by name + marker appProperty), then reuse the
// existing appProperties page-sync pipeline.
// ==========================================================================

let localUploadInFlight = new Set(); // file keys currently being uploaded

async function getDriveToken() {
  if (gdriveAccessToken) return gdriveAccessToken;
  const session = getSession();
  return session && session.token ? session.token : null;
}

// Find an app-managed copy of the file in Drive, or upload it once.
async function findOrCreateDriveFile(file, token) {
  // 1) Search for our app-managed copy (marker appProperty prevents matching
  //    the user's unrelated PDFs that happen to share the same name)
  const safeName = file.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const query = encodeURIComponent(
    `name='${safeName}' and mimeType='application/pdf' and trashed=false`
  );
  const fields = encodeURIComponent('files(id,name,appProperties)');
  const searchResp = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=10`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (searchResp.ok) {
    const data = await searchResp.json();
    const match = (data.files || []).find(
      (f) => f.appProperties && f.appProperties.pdfReaderLocal === '1'
    );
    if (match) return match.id;
  } else if (searchResp.status === 401) {
    showToast('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่เพื่อซิงค์ไฟล์');
    return null;
  }

  // 2) Not found -> upload once (multipart) with marker appProperty
  const metadata = {
    name: file.name,
    mimeType: 'application/pdf',
    appProperties: { pdfReaderLocal: '1' }
  };
  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', file);

  const uploadResp = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    }
  );

  if (!uploadResp.ok) {
    if (uploadResp.status === 401) {
      showToast('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่เพื่อซิงค์ไฟล์');
    }
    throw new Error(`อัปโหลดไฟล์ไม่สำเร็จ (HTTP ${uploadResp.status})`);
  }

  const uploaded = await uploadResp.json();
  return uploaded.id;
}

// Called after a locally-opened file renders. Silently no-ops when not
// signed in (user keeps local-only behavior).
async function uploadLocalToDrive(file, pageToOpen) {
  const token = await getDriveToken();
  if (!token || !file) return; // not signed in -> stay local-only

  const uploadKey = currentFileKey;
  if (localUploadInFlight.has(uploadKey)) return;
  localUploadInFlight.add(uploadKey);

  try {
    const driveFileId = await findOrCreateDriveFile(file, token);
    if (!driveFileId) return;

    // Promote this reading session to a Drive-backed one
    currentDriveFileId = driveFileId;

    // Update the shelf entry so it syncs and reopens via Drive elsewhere
    const list = getRecentFiles();
    const entry = list.find((item) => item.id === currentFileKey);
    if (entry) {
      entry.isDrive = true;
      entry.driveFileId = driveFileId;
      entry.lastReadAt = new Date().toISOString();
    }
    localStorage.setItem(getProfileRecentKey(), JSON.stringify(list));
    renderRecentShelf();

    // Sync current reading position to the uploaded copy
    debounceSyncDrivePage(driveFileId, pageToOpen);
    triggerDriveShelfSync(500);

    showToast('🔗 อัปโหลดไฟล์ขึ้น Drive แล้ว จะเปิดอ่านต่อได้จากอุปกรณ์อื่น');
  } catch (err) {
    console.warn('[DriveUpload] Local file upload failed:', err);
  } finally {
    localUploadInFlight.delete(uploadKey);
  }
}

// Boot
checkUrlSetup();
window.addEventListener('hashchange', checkUrlSetup);
initTheme();
initActivityListeners();
startSessionWatchdog();
updateAuthUI();
renderRecentShelf();
setTimeout(initGoogleClients, 600);

// Auto-sync Drive bookshelf on page load if user already has a valid session
// (covers the case: opened on mobile, refresh on PC -> shelf syncs automatically)
setTimeout(() => {
  const existingSession = getSession();
  if (existingSession && existingSession.token) {
    triggerDriveShelfSync(1000);
  }
}, 2000);

// Silent auto-connect: if config is loaded (config.js) and the user has
// logged in before on this device (session expired), reconnect automatically
// on the first user interaction. Google returns the token silently when
// consent was already granted - no settings or button press needed.
let silentConnectAttempted = false;
async function attemptSilentConnect() {
  if (silentConnectAttempted) return;
  silentConnectAttempted = true;

  const session = getSession();
  if (session && session.token) return; // already connected

  const cfg = getGdriveConfig();
  if (!cfg || !cfg.clientId) return;

  if (!tokenClient || !gisInited) initGoogleClients();
  if (!tokenClient) return;

  try {
    tokenClient.requestAccessToken({ prompt: '' });
  } catch (e) {
    console.warn('[Auth] Silent reconnect failed:', e);
  }
}

// Trigger on the first click/touch shortly after load (browsers require a
// gesture for popup-based flows the very first time)
['click', 'touchstart'].forEach((evtName) => {
  document.addEventListener(evtName, attemptSilentConnect, { once: false, passive: true });
});

// ==========================================================================
// PWA & Service Worker Manager (Add to Home Screen & Standalone Mode)
// ==========================================================================
let deferredInstallPrompt = null;
const pwaInstallDirectBtn = document.getElementById('pwaInstallDirectBtn');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      console.log('[PWA] ServiceWorker registered with scope:', reg.scope);
    }).catch((err) => {
      console.warn('[PWA] ServiceWorker registration failed:', err);
    });
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent mini-infobar on Chrome mobile and store prompt
  e.preventDefault();
  deferredInstallPrompt = e;
  if (pwaInstallDirectBtn) {
    pwaInstallDirectBtn.style.display = 'inline-flex';
  }
});

if (pwaInstallDirectBtn) {
  pwaInstallDirectBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast('กำลังเพิ่มแอปลงในหน้าจอหลัก...');
    }
    deferredInstallPrompt = null;
    pwaInstallDirectBtn.style.display = 'none';
  });
}

window.addEventListener('appinstalled', () => {
  showToast('ติดตั้งแอปลงในหน้าจอหลักสำเร็จแล้ว!');
  deferredInstallPrompt = null;
  if (pwaInstallDirectBtn) {
    pwaInstallDirectBtn.style.display = 'none';
  }
});


