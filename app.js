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

// DOM Elements - Shelf / Recent Files
const shelfBtn = document.getElementById('shelfBtn');
const shelfSection = document.getElementById('shelfSection');
const recentGrid = document.getElementById('recentGrid');
const clearRecentsBtn = document.getElementById('clearRecentsBtn');
const emptyShelf = document.getElementById('emptyShelf');
const resumeCard = document.getElementById('resumeCard');
const resumeName = document.getElementById('resumeName');
const resumeSub = document.getElementById('resumeSub');
const resumeContinueBtn = document.getElementById('resumeContinueBtn');
const resumeDismissBtn = document.getElementById('resumeDismissBtn');
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
let currentFileSize = 0;
let currentPage = 1;
let totalPages = 0;
let docGen = 0; // render generation: guards async renders across doc switches
let thumbnailsBuiltFor = null; // file key thumbnails were built for (deferred build)
let userZoomed = false; // true once the user zooms manually (resize preserves it)
let pageTopsCache = null; // cached absolute page tops for binary-search lookup

function invalidatePageTops() {
  pageTopsCache = null;
}
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

// DOM Elements - Google Drive Open Buttons
const driveOpenBtn = document.getElementById('driveOpenBtn');
const dropZoneDriveBtn = document.getElementById('dropZoneDriveBtn');

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
// Marks that this device has logged in before -> silent reconnect is allowed.
// Never set for pure guests, cleared on explicit sign-out.
const HAD_SESSION_KEY = 'pdf_reader_had_session';
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

const PAGE_INVERT_KEY = 'pdf_reader_page_invert'; // '1' force | '0' off | unset = auto (dark only)

function isPageInvertEffective() {
  try {
    const v = localStorage.getItem(PAGE_INVERT_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch (e) { /* ignore -> auto */ }
  return document.body.classList.contains('theme-dark');
}

function refreshPageInvert() {
  const on = isPageInvertEffective();
  document.body.classList.toggle('page-invert', on);
  const toggle = document.getElementById('pageInvertToggle');
  if (toggle) toggle.checked = on;
}

function initTheme() {
  const savedTheme = localStorage.getItem('pdf_reader_theme') || 'default';
  applyTheme(savedTheme);
  refreshPageInvert();
  const pageInvertToggle = document.getElementById('pageInvertToggle');
  if (pageInvertToggle) {
    pageInvertToggle.checked = document.body.classList.contains('page-invert');
    pageInvertToggle.addEventListener('change', () => {
      try {
        localStorage.setItem(PAGE_INVERT_KEY, pageInvertToggle.checked ? '1' : '0');
      } catch (e) { /* ignore */ }
      refreshPageInvert();
    });
  }

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
      const themes = ['default', 'sepia', 'dark'];
      const currentTheme = themes.find((t) => document.body.classList.contains(`theme-${t}`)) || 'default';
      const nextTheme = themes[(themes.indexOf(currentTheme) + 1) % themes.length];
      applyTheme(nextTheme);
      localStorage.setItem('pdf_reader_theme', nextTheme);
      showToast(`โหมด: ${nextTheme === 'default' ? 'สว่างปกติ' : nextTheme === 'sepia' ? 'ถนอมสายตา' : 'โหมดมืด'}`);
    });
  }
}

function applyTheme(theme) {
  // Preserve non-theme body classes (e.g. page-invert)
  document.body.classList.remove('theme-default', 'theme-sepia', 'theme-dark');
  document.body.classList.add(`theme-${theme}`);
  refreshPageInvert(); // auto invert follows dark unless user overrode it

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

// ==========================================================================
// Content fingerprint: stable local identity independent of filename.
// Old keys (pdf_pos_<name>_<size>) collide when two PDFs share name+size.
// ==========================================================================

async function fingerprintBuffer(buffer, size) {
  const bytes = new Uint8Array(buffer);
  const n = bytes.length;
  const sample = Math.min(65536, n);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const mix = (b) => {
    h1 = (Math.imul(h1 ^ b, 16777619)) >>> 0;
    h2 = (Math.imul(h2 + b, 31)) >>> 0;
  };
  for (let i = 0; i < sample; i++) mix(bytes[i]);
  for (let i = Math.max(0, n - sample); i < n; i++) mix(bytes[i]);
  const sizeStr = String(size || n);
  for (let i = 0; i < sizeStr.length; i++) mix(sizeStr.charCodeAt(i));
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

// ==========================================================================
// Reading State v2: { page, offset, at } with legacy plain-number migration
// ==========================================================================

const READING_STATE_VERSION = 2;

function readSavedPosition(fileKey) {
  const raw = localStorage.getItem(getUserScopedKey(fileKey)) || localStorage.getItem(fileKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Number.isFinite(parsed.page)) {
      return {
        page: Math.max(1, Math.floor(parsed.page)),
        offset: Math.max(0, Math.floor(parsed.offset || 0))
      };
    }
  } catch (e) { /* legacy plain number below */ }
  const pageNum = parseInt(raw, 10);
  return Number.isFinite(pageNum) && pageNum >= 1
    ? { page: pageNum, offset: 0 }
    : null;
}

function getPageScrollOffset(pageNum) {
  try {
    const rec = pageElements.get(pageNum);
    if (!rec || !rec.container || !viewerContainer) return 0;
    const cRect = viewerContainer.getBoundingClientRect();
    const pRect = rec.container.getBoundingClientRect();
    const pageTopAbs = pRect.top - cRect.top + viewerContainer.scrollTop;
    return Math.max(0, Math.round(viewerContainer.scrollTop - pageTopAbs));
  } catch (e) {
    return 0;
  }
}

// Synchronous flush: safe to call from pagehide / visibilitychange / unload
function flushReadingState(opts = {}) {
  if (!currentPdf || !currentFileKey) return;
  const { cloud = true } = opts;
  try {
    const state = {
      v: READING_STATE_VERSION,
      page: currentPage,
      offset: getPageScrollOffset(currentPage),
      at: new Date().toISOString()
    };
    localStorage.setItem(getUserScopedKey(currentFileKey), JSON.stringify(state));
    saveRecentFile({
      id: currentFileKey,
      name: (typeof fileNameEl !== 'undefined' && (fileNameEl.title || fileNameEl.textContent)) || 'เอกสารไม่มีชื่อ',
      lastPage: currentPage,
      totalPages: totalPages,
      fileSize: currentFileSize || 0,
      isDrive: !!currentDriveFileId,
      driveFileId: currentDriveFileId
    });
    setActiveReader({ id: currentFileKey, lastPage: currentPage });
    if (cloud && currentDriveFileId) {
      syncDrivePageBeacon(currentDriveFileId, currentPage);
    }
  } catch (e) {
    console.warn('[State] Flush failed:', e);
  }
}

// Best-effort cloud write that survives tab close (keepalive PATCH)
function syncDrivePageBeacon(fileId, pageNum) {
  try {
    const session = (typeof getSession === 'function') ? getSession() : null;
    const token = (session && session.token) || gdriveAccessToken;
    if (!token || !fileId) return;
    fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'PATCH',
      keepalive: true,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        appProperties: {
          lastReadPage: pageNum.toString(),
          lastReadAt: new Date().toISOString()
        }
      })
    }).catch(() => { /* best effort only */ });
  } catch (e) { /* ignore */ }
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
  const marker = getActiveReader();
  if (marker && marker.id === id) clearActiveReader();
  deletePdfFromIDB(id);
  renderRecentShelf();
  showToast('ลบออกจากประวัติแล้ว');
}

function clearAllRecents() {
  const profile = getActiveProfile();
  const label = profile.isGuest ? 'โหมดทั่วไป (Guest)' : `โปรไฟล์ "${profile.name}"`;
  if (confirm(`ต้องการล้างประวัติการอ่านของ ${label} ทั้งหมดหรือไม่?`)) {
    localStorage.removeItem(getProfileRecentKey());
    clearActiveReader();
    clearAllPdfFromIDB();
    renderRecentShelf();
    showToast('ล้างประวัติเรียบร้อย');
  }
}

// ==========================================================================
// Active Reader Marker + Resume Card (refresh vs fresh launch)
// A marker records the book open in the viewer. Reload -> auto-resume it.
// Fresh launch -> show an explicit resume card instead of hijacking.
// ==========================================================================

const ACTIVE_READER_KEY = 'pdf_reader_active';

function getActiveReaderKey() {
  return `${ACTIVE_READER_KEY}_${getActiveProfile().id}`;
}

function setActiveReader(item) {
  if (!item || !item.id) return;
  try {
    localStorage.setItem(getActiveReaderKey(), JSON.stringify({
      id: item.id,
      lastPage: item.lastPage || 1
    }));
  } catch (e) {
    console.warn('[Resume] Cannot save active reader marker:', e);
  }
}

function getActiveReader() {
  try {
    const raw = localStorage.getItem(getActiveReaderKey());
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function clearActiveReader() {
  try {
    localStorage.removeItem(getActiveReaderKey());
  } catch (e) { /* ignore */ }
  if (resumeCard) resumeCard.style.display = 'none';
}

// Remove pre-fingerprint shelf entries for the same file (same name + size).
// Runs once per file after upgrade; orphaned IDB blobs are harmless.
function dropLegacyLocalEntries(fileName, fileSize, keepId) {
  try {
    const list = getRecentFiles();
    const filtered = list.filter((item) => !(
      item.id && item.id.startsWith('pdf_pos_') &&
      item.name === fileName &&
      (item.fileSize || 0) === (fileSize || 0) &&
      item.id !== keepId
    ));
    if (filtered.length !== list.length) {
      localStorage.setItem(getProfileRecentKey(), JSON.stringify(filtered));
    }
  } catch (e) { /* ignore */ }
}

function isReloadNavigation() {
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav && nav.type) return nav.type === 'reload';
  } catch (e) { /* ignore */ }
  return false;
}

// Shared opener for shelf cards + resume card (never triggers file picker)
// Note: the active-reader marker is written by loadFile on success only,
// so a failed/cancelled open never poisons the resume state.
async function openShelfItem(item) {
  if (!item) return;
  resumeGen++; // cancel any pending auto-resume
  if (resumeCard) resumeCard.style.display = 'none';

  if (item.isDrive && item.driveFileId) {
    const cachedBlob = await getPdfFromIDB(item.id);
    if (cachedBlob) {
      cachedBlob.name = item.name;
      cachedBlob.driveFileId = item.driveFileId;
      loadFile(cachedBlob, item.lastPage);
    } else {
      const session = getSession();
      if (session && session.token) {
        openDriveFileById(item.driveFileId, item.name, item.lastPage);
      } else {
        showToast(`ต้องเข้าสู่ระบบก่อนจึงจะเปิด "${item.name}" จาก Drive ได้`);
      }
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
}

function renderResumeCard() {
  if (!resumeCard) return;
  // Only meaningful while the viewer is on the shelf
  if (currentPdf || (dropZone && dropZone.style.display === 'none')) {
    resumeCard.style.display = 'none';
    return;
  }
  const marker = getActiveReader();
  if (!marker) {
    resumeCard.style.display = 'none';
    return;
  }
  const item = getRecentFiles().find((entry) => entry.id === marker.id);
  if (!item) {
    clearActiveReader();
    return;
  }
  if (resumeName) resumeName.textContent = item.name || 'เอกสารไม่มีชื่อ';
  if (resumeSub) {
    resumeSub.textContent = `หน้า ${item.lastPage || 1} / ${item.totalPages || '?'}` +
      (item.lastReadAt ? ` • ${formatRelativeTime(item.lastReadAt)}` : '');
  }
  resumeCard.style.display = 'flex';
}

if (resumeContinueBtn) {
  resumeContinueBtn.addEventListener('click', () => {
    clearResumeCountdown();
    const marker = getActiveReader();
    if (!marker) return;
    const item = getRecentFiles().find((entry) => entry.id === marker.id);
    if (item) openShelfItem(item);
    else clearActiveReader();
  });
}

if (resumeDismissBtn) {
  resumeDismissBtn.addEventListener('click', () => {
    clearActiveReader(); // stay on shelf, pick another book freely
  });
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
    renderResumeCard();
    return;
  }

  shelfSection.style.display = 'flex';
  if (emptyShelf) emptyShelf.style.display = 'none';

  renderResumeCard();

  recentGrid.innerHTML = '';
  list.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'recent-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    // DOM property assignment (never HTML parsing) -> filename cannot inject markup
    card.title = `คลิกเพื่อเปิดอ่านต่อ (${item.name})`;

    const lastPage = Number.isFinite(+item.lastPage) ? +item.lastPage : 1;
    const totalPagesNum = Number.isFinite(+item.totalPages) ? +item.totalPages : 1;
    const pct = Math.min(100, Math.max(0, Math.round((lastPage / Math.max(1, totalPagesNum)) * 100)));

    const top = document.createElement('div');
    top.className = 'recent-top';
    const info = document.createElement('div');
    info.className = 'recent-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'recent-name';
    nameEl.textContent = item.name || 'เอกสารไม่มีชื่อ';
    nameEl.title = item.name || '';
    if (item.isDrive) {
      const badge = document.createElement('span');
      badge.className = 'drive-badge';
      badge.textContent = 'Drive';
      nameEl.append(' ', badge);
    } else {
      const badge = document.createElement('span');
      badge.className = 'local-badge';
      badge.textContent = 'เครื่องนี้';
      nameEl.append(' ', badge);
    }
    const sub = document.createElement('div');
    sub.className = 'recent-sub';
    const subPage = document.createElement('span');
    subPage.textContent = `หน้า ${lastPage} / ${item.totalPages || '?'} (${pct}%)`;
    const dot = document.createElement('span');
    dot.textContent = '•';
    const subTime = document.createElement('span');
    subTime.textContent = formatRelativeTime(item.lastReadAt);
    sub.append(subPage, dot, subTime);
    info.append(nameEl, sub);
    const removeBtn = document.createElement('button');
    removeBtn.className = 'recent-remove-btn';
    removeBtn.title = 'ลบออกจากประวัติ';
    removeBtn.setAttribute('aria-label', 'ลบ');
    const removeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    removeSvg.setAttribute('viewBox', '0 0 24 24');
    removeSvg.setAttribute('width', '14');
    removeSvg.setAttribute('height', '14');
    removeSvg.innerHTML = '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>';
    removeBtn.appendChild(removeSvg);
    top.append(info, removeBtn);
    const bar = document.createElement('div');
    bar.className = 'recent-progress-bar';
    const fill = document.createElement('div');
    fill.className = 'recent-progress-fill';
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);
    card.append(top, bar);

    // Click card -> load instantly from IndexedDB or Google Drive!
    card.addEventListener('click', () => openShelfItem(item));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openShelfItem(item);
      }
    });

    removeBtn.addEventListener('click', (e) => removeRecentFile(item.id, e));

    recentGrid.appendChild(card);
  });
}

// ==========================================================================
// ==========================================================================
// Auto-Resume: reopen the most recently read book on page load (Kindle-style)
// Never hijacks the user: only runs while the viewer is still on the shelf,
// never triggers a file picker, and needs no network when the file is cached.
// ==========================================================================

const bootTime = Date.now();
let resumeGen = 0; // bumped on every user-initiated open; stale resumes abort
let driveSyncDoneOnce = false;

const RESUME_COUNTDOWN_SEC = 4;
let resumeCountdownTimer = null;

function clearResumeCountdown() {
  if (resumeCountdownTimer) {
    clearInterval(resumeCountdownTimer);
    resumeCountdownTimer = null;
  }
  if (resumeContinueBtn) resumeContinueBtn.textContent = 'อ่านต่อ';
}

// Reload-while-reading: show the resume card with a visible countdown, then
// open automatically. Fresh launches show the card with no countdown.
// ANY user interaction cancels the countdown (card stays for manual continue).
function scheduleResumeCountdown() {
  clearResumeCountdown();
  if (!isReloadNavigation()) return;
  if (currentPdf) return;
  if (!dropZone || dropZone.style.display === 'none') return;
  const marker = getActiveReader();
  const list = getRecentFiles();
  if (!marker || !list || list.length === 0) return;
  const item = list.find((entry) => entry.id === marker.id) || list[0];
  const gen = resumeGen;
  renderResumeCard();

  let remain = RESUME_COUNTDOWN_SEC;
  const cancelOnInteract = () => clearResumeCountdown();
  document.addEventListener('pointerdown', cancelOnInteract, { once: true });
  document.addEventListener('keydown', cancelOnInteract, { once: true });

  const tick = () => {
    // Abort if the user opened something or left the shelf meanwhile
    if (currentPdf || !dropZone || dropZone.style.display === 'none' || gen !== resumeGen) {
      clearResumeCountdown();
      return;
    }
    if (remain <= 0) {
      clearResumeCountdown();
      openShelfItem(item);
      return;
    }
    if (resumeContinueBtn) resumeContinueBtn.textContent = `อ่านต่อ (${remain})`;
    remain--;
  };
  tick();
  resumeCountdownTimer = setInterval(tick, 1000);
}

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
    // Using drive.file scope means we can only see files the app has opened before.
    // Paginate so large libraries are not silently truncated at 50 files.
    const query = encodeURIComponent("mimeType='application/pdf' and trashed=false");
    const fields = encodeURIComponent('files(id,name,size,modifiedTime,appProperties)');
    const driveFiles = [];
    let pageToken = null;
    for (let page = 0; page < 5; page++) {
      let url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields},nextPageToken&pageSize=100&orderBy=modifiedTime desc`;
      if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!resp.ok) {
        if (resp.status === 401) {
          // Token expired silently - don't disrupt user
          console.info('[DriveSync] Token expired during shelf sync');
        }
        driveSyncDoneOnce = true;
        return;
      }

      const data = await resp.json();
      (data.files || []).forEach((f) => {
        if (f.appProperties && f.appProperties.lastReadPage) driveFiles.push(f);
      });
      pageToken = data.nextPageToken || null;
      if (!pageToken) break;
    }

    if (driveFiles.length === 0) {
      driveSyncDoneOnce = true;
      return;
    }

    // Merge Drive files into local shelf with last-write-wins by read timestamp.
    // Cloud read time lives in appProperties.lastReadAt (modifiedTime is upload
    // time, NOT read time). When local is newer, push it back up to converge.
    const currentList = getRecentFiles();
    const existingIds = new Set(currentList.map((item) => item.id));
    let mergedCount = 0;

    driveFiles.forEach((f) => {
      const itemId = `pdf_drive_${f.id}`;
      const cloudPage = parseInt(f.appProperties.lastReadPage, 10) || 1;
      const cloudAt = f.appProperties.lastReadAt || f.modifiedTime || null;
      if (existingIds.has(itemId)) {
        const localIdx = currentList.findIndex((item) => item.id === itemId);
        if (localIdx >= 0) {
          const entry = currentList[localIdx];
          const localPage = entry.lastPage || 1;
          const localAt = entry.lastReadAt || null;
          const cloudTime = cloudAt ? Date.parse(cloudAt) : NaN;
          const localTime = localAt ? Date.parse(localAt) : NaN;
          if (Number.isFinite(cloudTime) && (!Number.isFinite(localTime) || cloudTime > localTime)) {
            // Cloud is newer -> adopt it
            if (cloudPage !== localPage) {
              entry.lastPage = cloudPage;
              entry.percentage = Math.min(
                100,
                Math.round((cloudPage / (entry.totalPages || 1)) * 100)
              );
            }
            entry.lastReadAt = cloudAt;
          } else if (Number.isFinite(localTime) && (!Number.isFinite(cloudTime) || localTime > cloudTime)) {
            // Local is newer -> push it back up so devices converge
            debounceSyncDrivePage(f.id, localPage);
          }
        }
      } else {
        // New file from Drive (read on another device) - add to shelf
        currentList.unshift({
          id: itemId,
          name: f.name || 'เอกสาร Google Drive',
          lastPage: cloudPage,
          totalPages: 0, // Will be updated when opened
          fileSize: parseInt(f.size, 10) || 0,
          percentage: 0, // Unknown until opened (totalPages = 0)
          isDrive: true,
          driveFileId: f.id,
          lastReadAt: cloudAt || new Date().toISOString(),
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
    driveSyncDoneOnce = true;

    if (mergedCount > 0) {
      showToast(`🔄 ซิงค์คลังหนังสือจาก Drive: พบ ${mergedCount} ไฟล์ใหม่จากอุปกรณ์อื่น`);
    }

    // If this sync ran right after page load and the user is still on the
    // shelf, a book read on another device may now be the most recent one.
    if (Date.now() - bootTime < 10000) {
      scheduleResumeCountdown();
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
    // Deferred thumbnail build: only pay the cost when the user opens it
    if (thumbnailsBuiltFor !== currentFileKey) {
      createThumbnails();
      setupThumbnailObserver();
      thumbnailsBuiltFor = currentFileKey;
    }
    updateActiveThumbnail(currentPage);
  }
}

// Global Escape: close flyout first, then sidebar
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (flyoutMenu && flyoutMenu.classList.contains('open')) {
    e.stopPropagation();
    closeFlyoutMenu();
  } else if (sidebar && sidebar.classList.contains('open')) {
    closeSidebar();
  }
});

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
  tabThumbnails.setAttribute('aria-selected', 'true');
  tabOutline.classList.remove('active');
  tabOutline.setAttribute('aria-selected', 'false');
  thumbnailsPanel.classList.add('active');
  outlinePanel.classList.remove('active');
  updateActiveThumbnail(currentPage);
});

tabOutline.addEventListener('click', () => {
  tabOutline.classList.add('active');
  tabOutline.setAttribute('aria-selected', 'true');
  tabThumbnails.classList.remove('active');
  tabThumbnails.setAttribute('aria-selected', 'false');
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
    // Flush the previous book's position before replacing it
    flushReadingState();
    resumeGen++;
    showToast('กำลังเปิดเอกสาร...');
    fileNameEl.textContent = file.name;
    fileNameEl.title = file.name;

    currentFileSize = file.size || 0;
    const arrayBuffer = await file.arrayBuffer();

    if (file.driveFileId) {
      currentDriveFileId = file.driveFileId;
      currentFileKey = `pdf_drive_${file.driveFileId}`;
    } else {
      currentDriveFileId = null;
      const fp = await fingerprintBuffer(arrayBuffer, currentFileSize);
      currentFileKey = `pdf_local_${fp}`;
      // Drop legacy pdf_pos_ entries for the same file (one-time migration)
      dropLegacyLocalEntries(file.name, currentFileSize, currentFileKey);
    }

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

    // Determine target page to open (v2 state with legacy migration)
    const saved = readSavedPosition(currentFileKey);
    let savedOffset = 0;
    let pageToOpen = 1;
    if (targetPage && targetPage >= 1 && targetPage <= totalPages) {
      pageToOpen = targetPage;
    } else if (saved && saved.page >= 1 && saved.page <= totalPages) {
      pageToOpen = saved.page;
      savedOffset = saved.offset || 0;
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
    invalidatePageTops();
    setupViewerObserver();

    // Thumbnails are built lazily on first sidebar open (fast initial load)
    thumbnailsBuiltFor = null;
    thumbnailsGrid.innerHTML = '';
    loadOutline();

    await requestWakeLock();

    // Cache file in IndexedDB for instant reopening without picking again
    savePdfToIDB(currentFileKey, file);

    // Save reading state to shelf and storage (v2: page + scroll offset)
    flushReadingState();

    // Push a history entry so system Back returns to the shelf (PWA)
    try {
      history.pushState({ view: 'reader', key: currentFileKey }, '');
      readerHistoryPushed = true;
    } catch (e) { /* ignore */ }

    if (currentDriveFileId) {
      if (gdriveAccessToken) {
        debounceSyncDrivePage(currentDriveFileId, pageToOpen);
      }
    } else {
      // Local file: upload to Drive (if signed in) so other devices can see it
      uploadLocalToDrive(file, pageToOpen);
    }

    // Jump directly to the target page, then restore intra-page offset
    const restoreOffset = () => {
      if (savedOffset > 0 && viewerContainer) {
        viewerContainer.scrollTop += savedOffset;
      }
    };
    if (pageToOpen > 1) {
      setTimeout(() => {
        scrollToPage(pageToOpen, false);
        restoreOffset();
        showToast(`เปิดหน้าที่ ${pageToOpen} ที่อ่านค้างไว้`);
        setTimeout(() => {
          isJumpingToPage = false;
        }, 500);
      }, 50);
    } else {
      restoreOffset();
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
  const gen = docGen;
  const pdf = currentPdf;

  try {
    const pdfPage = await currentPdf.getPage(pageNum);
    // Abort if the document changed or a newer render cycle started meanwhile
    if (gen !== docGen || pdf !== currentPdf || pageElements.get(pageNum) !== pageData) {
      try { pdfPage.cleanup(); } catch (e) { /* ignore */ }
      return;
    }
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
    if (gen !== docGen || pdf !== currentPdf || pageElements.get(pageNum) !== pageData) return;
    pageData.isRendered = true;
    pageData.renderTask = null;
  } catch (err) {
    if (err && err.name !== 'RenderingCancelledException') {
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
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', `ไปหน้า ${i}`);
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
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        scrollToPage(i);
        if (window.innerWidth <= 1024) closeSidebar();
      }
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
  const gen = docGen;
  const pdf = currentPdf;

  try {
    const pdfPage = await currentPdf.getPage(pageNum);
    if (gen !== docGen || pdf !== currentPdf || thumbnailElements.get(pageNum) !== thumbData) {
      try { pdfPage.cleanup(); } catch (e) { /* ignore */ }
      return;
    }
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
    if (gen !== docGen || pdf !== currentPdf || thumbnailElements.get(pageNum) !== thumbData) return;
    thumbData.isRendered = true;
    thumbData.renderTask = null;
    pdfPage.cleanup();
  } catch (err) {
    if (err && err.name !== 'RenderingCancelledException') {
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

// Desktop bottom hover reveal (capsule toolbar lives at the bottom now)
document.addEventListener('mousemove', (e) => {
  if (!currentPdf || dropZone.style.display !== 'none') return;
  if (window.innerHeight - e.clientY <= 110) {
    if (floatingCapsule && (!flyoutMenu || !flyoutMenu.classList.contains('open'))) {
      floatingCapsule.classList.remove('hidden');
    }
  }
});

function updateCurrentPageFromScroll() {
  if (!currentPdf || isJumpingToPage) return;

  const containerRect = viewerContainer.getBoundingClientRect();
  const centerY = containerRect.top + containerRect.height / 2;

  // Cached absolute page tops + binary search (no per-event full DOM scan)
  let tops = pageTopsCache && pageTopsCache.scale === currentScale && pageTopsCache.total === totalPages
    ? pageTopsCache.tops
    : null;
  if (!tops) {
    tops = new Array(totalPages + 1);
    const cTop = containerRect.top;
    const st = viewerContainer.scrollTop;
    pageElements.forEach(({ container }, pageNum) => {
      tops[pageNum] = container.getBoundingClientRect().top - cTop + st;
    });
    pageTopsCache = { scale: currentScale, total: totalPages, tops };
  }
  const absCenter = centerY - containerRect.top + viewerContainer.scrollTop;
  let lo = 1, hi = totalPages, closestPage = currentPage;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const top = tops[mid];
    const nextTop = mid < totalPages ? tops[mid + 1] : Infinity;
    if (absCenter < top) {
      hi = mid - 1;
    } else if (absCenter >= nextTop) {
      lo = mid + 1;
    } else {
      closestPage = mid;
      break;
    }
  }

  if (closestPage !== currentPage) {
    currentPage = closestPage;
    pageNumberInput.value = currentPage;
    pageSlider.value = currentPage;
    updateScrubberVisuals(currentPage);
    updateActiveThumbnail(currentPage);

    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (currentFileKey && !isJumpingToPage) {
        flushReadingState({ cloud: false }); // v2 state; cloud sync debounced below
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
    flushReadingState({ cloud: false }); // v2 state; cloud sync debounced below
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

function normalizePageInput(commit) {
  const val = parseInt(pageNumberInput.value, 10);
  if (commit && !isNaN(val)) {
    scrollToPage(val);
  } else {
    // Revert invalid/empty/out-of-range input to the actual page
    pageNumberInput.value = currentPage;
  }
  pageNumberInput.blur();
}

pageNumberInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    normalizePageInput(true);
  } else if (e.key === 'Escape') {
    normalizePageInput(false);
  }
});
pageNumberInput.addEventListener('change', () => normalizePageInput(true));
pageNumberInput.addEventListener('blur', () => {
  if (document.activeElement !== pageNumberInput) normalizePageInput(false);
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
  const flyoutSeekLabel = document.getElementById('flyoutSeekLabel');
  if (flyoutSeekLabel) flyoutSeekLabel.textContent = `หน้า ${pageNum} / ${totalPages}`;
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
  invalidatePageTops();
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

if (zoomInBtn) zoomInBtn.addEventListener('click', () => { userZoomed = true; applyZoom(currentScale * 1.2); });
if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => { userZoomed = true; applyZoom(currentScale / 1.2); });
if (zoomFitBtn) zoomFitBtn.addEventListener('click', () => {
  calculateFitWidthScale();
  userZoomed = false;
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

  if (mZoomInBtn) mZoomInBtn.addEventListener('click', () => { userZoomed = true; applyZoom(currentScale * 1.2); });
  if (mZoomOutBtn) mZoomOutBtn.addEventListener('click', () => { userZoomed = true; applyZoom(currentScale / 1.2); });
  if (mZoomFitBtn) {
    mZoomFitBtn.addEventListener('click', () => {
      calculateFitWidthScale();
      userZoomed = false;
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
  docGen++; // invalidate in-flight async renders for the old document
  if (viewerObserver) viewerObserver.disconnect();
  if (thumbnailObserver) thumbnailObserver.disconnect();

  pageElements.forEach((_, pageNum) => unrenderMainPage(pageNum));
  pageElements.clear();

  thumbnailElements.forEach((_, pageNum) => unrenderThumbnail(pageNum));
  thumbnailElements.clear();
  thumbnailsBuiltFor = null;

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
let pendingPinchScale = null;
let touchLockedAxis = null; // gesture arbitration: 'x' | 'y' | null

function getFitScale() {
  if (!baseViewport || !viewerContainer) return 1;
  return (viewerContainer.clientWidth - (window.innerWidth <= 768 ? 16 : 48)) / baseViewport.width;
}

viewerContainer.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    // 2 Fingers: Start Pinch Zoom (visual preview; real render on touchend)
    initialPinchDistance = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    initialScaleOnPinch = currentScale;
    pendingPinchScale = null;
    isJumpingToPage = true; // suppress scroll tracking during the gesture
  } else if (e.touches.length === 1) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
    touchLockedAxis = null;
  }
}, { passive: true });

viewerContainer.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2 && initialPinchDistance) {
    const currentDistance = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    const factor = currentDistance / initialPinchDistance;
    pendingPinchScale = Math.min(Math.max(initialScaleOnPinch * factor, 0.35), 3.5);
    // Cheap CSS preview only - no canvas re-render until the gesture ends
    if (viewer) {
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const vRect = viewer.getBoundingClientRect();
      viewer.style.transformOrigin = `${midX - vRect.left}px ${midY - vRect.top}px`;
      viewer.style.transform = `scale(${pendingPinchScale / currentScale})`;
    }
  } else if (e.touches.length === 1 && !touchLockedAxis && touchStartTime) {
    // Lock to the dominant axis once movement passes the threshold
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    if (Math.abs(dx) > 24 || Math.abs(dy) > 24) {
      touchLockedAxis = Math.abs(dx) > Math.abs(dy) * 1.4 ? 'x' : 'y';
    }
  }
}, { passive: true });

viewerContainer.addEventListener('touchend', (e) => {
  if (initialPinchDistance) {
    // Commit pinch: single real re-render, then release the scroll lock
    initialPinchDistance = null;
    if (viewer) viewer.style.transform = '';
    if (pendingPinchScale && currentPdf) {
      userZoomed = true;
      applyZoom(pendingPinchScale);
    } else {
      isJumpingToPage = false;
    }
    pendingPinchScale = null;
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
        userZoomed = false;
        applyZoom(currentScale);
        showToast('ซูมพอดีจอ');
      } else {
        userZoomed = true;
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

  // 2. Horizontal Swipe for Next/Prev Page (only when locked to X axis
  // and not zoomed beyond fit width, so zoomed panning never flips pages)
  const zoomedBeyondFit = baseViewport && currentScale > getFitScale() * 1.05;
  if (!zoomedBeyondFit && touchLockedAxis === 'x' &&
      Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.6 && duration < 400) {
    if (deltaX < 0 && currentPage < totalPages) {
      scrollToPage(currentPage + 1);
    } else if (deltaX > 0 && currentPage > 1) {
      scrollToPage(currentPage - 1);
    }
  }
  touchLockedAxis = null;
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
      userZoomed = true;
      applyZoom(currentScale * 1.2);
      break;
    case '-':
      e.preventDefault();
      userZoomed = true;
      applyZoom(currentScale / 1.2);
      break;
    case '0':
      e.preventDefault();
      calculateFitWidthScale();
      userZoomed = false;
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
      // Preserve a deliberate user zoom; only refit when never zoomed manually
      if (!userZoomed) calculateFitWidthScale();
      invalidatePageTops();
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
let flyoutTriggerEl = null;
function openFlyoutMenu() {
  if (flyoutMenu && flyoutMenu.classList.contains('open')) return;
  flyoutTriggerEl = document.activeElement;
  if (flyoutMenu) flyoutMenu.classList.add('open');
  if (flyoutBackdrop) flyoutBackdrop.classList.add('open');
  if (capsuleMenuBtn) capsuleMenuBtn.setAttribute('aria-expanded', 'true');
  if (bottomBar) bottomBar.classList.add('hidden');
}

function closeFlyoutMenu() {
  if (flyoutMenu && !flyoutMenu.classList.contains('open')) return;
  if (flyoutMenu) flyoutMenu.classList.remove('open');
  if (flyoutBackdrop) flyoutBackdrop.classList.remove('open');
  if (capsuleMenuBtn) capsuleMenuBtn.setAttribute('aria-expanded', 'false');
  if (flyoutTriggerEl && typeof flyoutTriggerEl.focus === 'function') {
    try { flyoutTriggerEl.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  flyoutTriggerEl = null;
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

// Shelf and Recents controls
// History integration: opening a book pushes a history entry so the system
// back gesture/button (standalone PWA on mobile) returns to the shelf
// instead of closing the app.
let readerHistoryPushed = false;

function goToShelf(opts = {}) {
  flushReadingState(); // save exact position before leaving the viewer
  clearActiveReader(); // back to shelf intentionally -> no resume prompt
  dropZone.style.display = 'flex';
  viewer.classList.remove('active');
  if (floatingCapsule) floatingCapsule.style.display = 'none';
  if (bottomBar) bottomBar.classList.remove('visible');
  closeFlyoutMenu();
  fileNameEl.textContent = 'คลังหนังสือ';
  fileNameEl.title = 'คลังหนังสือ';
  renderRecentShelf();
  closeSidebar();
  // Consume the reader history entry so Back stays inside the app
  if (!opts.fromPopstate && readerHistoryPushed) {
    readerHistoryPushed = false;
    try {
      history.back();
    } catch (e) { /* ignore */ }
  }
}

if (shelfBtn) {
  shelfBtn.addEventListener('click', () => goToShelf());
}

window.addEventListener('popstate', (e) => {
  const view = e.state && e.state.view;
  // Backed into shelf (or an unknown entry): show the shelf if reading
  if ((view === 'shelf' || !view) && (currentPdf || (dropZone && dropZone.style.display === 'none'))) {
    goToShelf({ fromPopstate: true });
  }
});

if (clearRecentsBtn) {
  clearRecentsBtn.addEventListener('click', clearAllRecents);
}

// ==========================================================================
// Google Drive Config (auto-injected at build time via GitHub Secrets)
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
  localStorage.setItem(HAD_SESSION_KEY, '1');
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
    showToast('Google Drive ยังไม่พร้อมใช้งานบนอุปกรณ์นี้');
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
    showToast('Google Drive ยังไม่พร้อมใช้งานบนอุปกรณ์นี้');
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
      localStorage.removeItem(HAD_SESSION_KEY); // explicit logout -> no silent reconnect
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
const DRIVE_UPLOAD_CONSENT_KEY = 'pdf_reader_drive_upload_consent'; // 'always' | unset

function getDriveUploadConsent() {
  try {
    return localStorage.getItem(DRIVE_UPLOAD_CONSENT_KEY);
  } catch (e) {
    return null;
  }
}

// First-time explicit consent: uploading a personal file to Drive is a
// privacy decision, so we ask once and remember "always" on approval.
// Cancel = local-only for now (asks again on the next new file).
function confirmDriveUploadOnce(fileName) {
  if (getDriveUploadConsent() === 'always') return true;
  const ok = confirm(
    `ซิงค์ "${fileName}" ขึ้น Google Drive เพื่ออ่านต่อข้ามอุปกรณ์?\n\n` +
    'กด OK = อัปโหลดและจำไว้เสมอ\nกด Cancel = อ่านเฉพาะเครื่องนี้ (ถามใหม่ไฟล์หน้า)'
  );
  if (ok) {
    try {
      localStorage.setItem(DRIVE_UPLOAD_CONSENT_KEY, 'always');
    } catch (e) { /* ignore */ }
    return true;
  }
  return false;
}

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
  if (file.size <= 0 || file.size > 500 * 1024 * 1024) return; // invalid or absurd size
  if (!confirmDriveUploadOnce(file.name || 'เอกสาร')) return; // privacy: explicit consent

  const uploadKey = currentFileKey;
  if (localUploadInFlight.has(uploadKey)) return;
  localUploadInFlight.add(uploadKey);

  try {
    const driveFileId = await findOrCreateDriveFile(file, token);
    if (!driveFileId) return;

    // Promote this reading session to a Drive-backed one
    currentDriveFileId = driveFileId;

    // Migrate local identity -> Drive identity so every device, cache key,
    // shelf entry and marker agree on `pdf_drive_<id>` from now on.
    await migrateLocalToDriveIdentity(uploadKey, driveFileId);

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

// Move shelf entry, IDB cache, reading state and marker from a local key
// to the canonical Drive key after a local file is uploaded.
async function migrateLocalToDriveIdentity(localKey, driveFileId) {
  const driveKey = `pdf_drive_${driveFileId}`;
  if (!localKey || localKey === driveKey) {
    currentFileKey = driveKey;
    return;
  }
  try {
    // 1) IDB cache: copy blob to the Drive key, drop the local key
    const blob = await getPdfFromIDB(localKey);
    if (blob) {
      await savePdfToIDB(driveKey, blob);
      await deletePdfFromIDB(localKey);
    }
  } catch (e) {
    console.warn('[DriveUpload] IDB migration warning:', e);
  }
  try {
    // 2) Reading state: move v2 state to the Drive key
    const scopedLocal = getUserScopedKey(localKey);
    const scopedDrive = getUserScopedKey(driveKey);
    const raw = localStorage.getItem(scopedLocal) || localStorage.getItem(localKey);
    if (raw) {
      localStorage.setItem(scopedDrive, raw);
      localStorage.removeItem(scopedLocal);
      localStorage.removeItem(localKey);
    }
  } catch (e) { /* ignore */ }
  try {
    // 3) Shelf entry: single canonical Drive-backed entry (drop duplicates)
    const list = getRecentFiles().filter((item) =>
      item.id !== localKey && item.id !== driveKey
    );
    const oldEntry = getRecentFiles().find((item) => item.id === driveKey)
      || getRecentFiles().find((item) => item.id === localKey)
      || {};
    list.unshift({
      id: driveKey,
      name: oldEntry.name || 'เอกสาร Google Drive',
      lastPage: oldEntry.lastPage || 1,
      totalPages: oldEntry.totalPages || totalPages || 1,
      fileSize: oldEntry.fileSize || currentFileSize || 0,
      percentage: oldEntry.percentage || 0,
      isDrive: true,
      driveFileId: driveFileId,
      lastReadAt: new Date().toISOString()
    });
    if (list.length > 12) list.splice(12);
    localStorage.setItem(getProfileRecentKey(), JSON.stringify(list));
  } catch (e) { /* ignore */ }
  // 4) Point the live session + marker at the Drive identity
  currentFileKey = driveKey;
  setActiveReader({ id: driveKey, lastPage: currentPage });
  renderRecentShelf();
}

// Boot
initTheme();
initActivityListeners();
startSessionWatchdog();
updateAuthUI();
renderRecentShelf();
// Base history entry: system Back from the shelf exits (normal), from a
// book returns to the shelf (pushed by loadFile).
try {
  history.replaceState({ view: 'shelf' }, '');
} catch (e) { /* ignore */ }
setTimeout(initGoogleClients, 600);

// Flush exact reading position when the tab hides/closes (no data loss)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushReadingState();
});
window.addEventListener('pagehide', () => flushReadingState());

// Resume decision: reload-while-reading -> card with 4s countdown, then open.
// Fresh launch -> manual card only. When signed in, wait for the first Drive
// shelf sync so a book read on another device can win before counting down.
(function scheduleBootResume() {
  const bootSession = getSession();
  if (bootSession && bootSession.token) {
    const waitStart = Date.now();
    const waitForSync = () => {
      if (currentPdf || resumeGen > 0) return; // user already acted
      if (driveSyncDoneOnce || Date.now() - waitStart > 6000) {
        scheduleResumeCountdown();
      } else {
        setTimeout(waitForSync, 300);
      }
    };
    setTimeout(waitForSync, 2200);
  } else {
    setTimeout(scheduleResumeCountdown, 600);
  }
})();

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

  // Only reconnect devices that have logged in before. Pure guests
  // (never logged in) or explicitly signed-out users stay untouched.
  try {
    if (localStorage.getItem(HAD_SESSION_KEY) !== '1') return;
  } catch (e) {
    return;
  }

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


