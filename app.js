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
// Shelf & Recent Files Manager
// ==========================================================================

function getRecentFiles() {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
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

  localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(list));
}

function removeRecentFile(id, e) {
  if (e) e.stopPropagation();
  let list = getRecentFiles();
  list = list.filter((item) => item.id !== id);
  localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(list));
  localStorage.removeItem(id);
  deletePdfFromIDB(id);
  renderRecentShelf();
  showToast('ลบออกจากประวัติแล้ว');
}

function clearAllRecents() {
  if (confirm('ต้องการล้างประวัติการอ่านทั้งหมดหรือไม่?')) {
    localStorage.removeItem(RECENT_STORAGE_KEY);
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
  const list = getRecentFiles();

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
    const savedPage = localStorage.getItem(currentFileKey);
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
    localStorage.setItem(currentFileKey, pageToOpen.toString());
    saveRecentFile({
      id: currentFileKey,
      name: file.name,
      lastPage: pageToOpen,
      totalPages: totalPages,
      fileSize: file.size || 0,
      isDrive: !!currentDriveFileId,
      driveFileId: currentDriveFileId
    });

    if (currentDriveFileId && gdriveAccessToken) {
      debounceSyncDrivePage(currentDriveFileId, pageToOpen);
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
      if (bottomBar) bottomBar.classList.remove('hidden');
    }
    lastScrollTop = currentScrollTop;
  }

  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    if (isJumpingToPage) return;
    updateCurrentPageFromScroll();
  }, 60);
});

// Desktop top hover reveal
document.addEventListener('mousemove', (e) => {
  if (!currentPdf || dropZone.style.display !== 'none') return;
  if (e.clientY <= 50) {
    if (floatingCapsule) floatingCapsule.classList.remove('hidden');
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
        localStorage.setItem(currentFileKey, currentPage.toString());
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

function scrollToPage(pageNum, smooth = true) {
  if (pageNum < 1) pageNum = 1;
  if (pageNum > totalPages) pageNum = totalPages;

  currentPage = pageNum;
  pageNumberInput.value = currentPage;
  pageSlider.value = currentPage;
  updateScrubberVisuals(currentPage);
  updateActiveThumbnail(currentPage);

  const targetEl = document.getElementById(`page-${pageNum}`);
  if (targetEl) {
    const containerRect = viewerContainer.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const targetTop = viewerContainer.scrollTop + (targetRect.top - containerRect.top) - 8;

    if (smooth) {
      viewerContainer.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    } else {
      viewerContainer.scrollTop = Math.max(0, targetTop);
    }
  }

  if (currentFileKey && !isJumpingToPage) {
    localStorage.setItem(currentFileKey, currentPage.toString());
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
const scrubberThumb = document.getElementById('scrubberThumb');
let isDraggingScrubber = false;

function updateScrubberVisuals(pageNum) {
  if (!totalPages || totalPages <= 1) {
    if (scrubberThumb) scrubberThumb.style.top = '0%';
    if (sliderTooltip) {
      sliderTooltip.style.top = '0%';
      sliderTooltip.textContent = `หน้า 1`;
    }
    return;
  }
  const pct = Math.max(0, Math.min(1, (pageNum - 1) / (totalPages - 1))) * 100;
  if (scrubberThumb) scrubberThumb.style.top = `${pct}%`;
  if (sliderTooltip) {
    sliderTooltip.style.top = `${pct}%`;
    sliderTooltip.textContent = `หน้า ${pageNum} / ${totalPages}`;
  }
}

function handleScrubberPointer(e) {
  if (!currentPdf || totalPages <= 1) return currentPage;
  const trackEl = scrubberTrack || bottomBar;
  const rect = trackEl.getBoundingClientRect();
  const clickY = e.clientY - rect.top;
  const pct = Math.max(0, Math.min(1, clickY / rect.height));
  const targetPage = Math.round(1 + pct * (totalPages - 1));

  updateScrubberVisuals(targetPage);
  if (sliderTooltip) sliderTooltip.classList.add('visible');
  if (pageNumberInput) pageNumberInput.value = targetPage;
  if (pageSlider) pageSlider.value = targetPage;

  return targetPage;
}

if (bottomBar) {
  bottomBar.addEventListener('pointerdown', (e) => {
    e.preventDefault();
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
            if (bottomBar) bottomBar.classList.toggle('hidden');
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

document.addEventListener('click', (e) => {
  if (openDocWrap && !openDocWrap.contains(e.target)) {
    openDocWrap.classList.remove('open');
  }
});

// Flyout Menu Controls
function openFlyoutMenu() {
  if (flyoutMenu) flyoutMenu.classList.add('open');
  if (flyoutBackdrop) flyoutBackdrop.classList.add('open');
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

  // 2. Initialize GIS TokenClient if config exists
  if (cfg && cfg.clientId && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
    try {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: cfg.clientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (resp) => {
          if (resp.error !== undefined) {
            console.error('GIS Error:', resp);
            showToast('เข้าสู่ระบบไม่สำเร็จ: ' + (resp.error_description || resp.error));
            return;
          }
          gdriveAccessToken = resp.access_token;
          showToast('เชื่อมต่อ Google Drive สำเร็จ');
          if (cfg.apiKey) {
            createAndShowPicker(cfg.apiKey, cfg.clientId);
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
  const cfg = getGdriveConfig();
  if (!cfg || !cfg.clientId || !cfg.apiKey) {
    showToast('กรุณากรอก Client ID และ API Key ก่อนใช้งาน');
    openSettingsModal();
    return;
  }

  if (!tokenClient || !gisInited) {
    initGoogleClients();
  }

  if (!gdriveAccessToken) {
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
    const view = new google.picker.View(google.picker.ViewId.DOCS);
    view.setMimeTypes('application/pdf');

    const appId = clientId.split('-')[0];
    const picker = new google.picker.PickerBuilder()
      .enableFeature(google.picker.Feature.NAV_HIDDEN)
      .setAppId(appId)
      .setOAuthToken(gdriveAccessToken)
      .addView(view)
      .addView(new google.picker.DocsUploadView())
      .setDeveloperKey(apiKey)
      .setCallback(pickerCallback)
      .build();
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

// Boot
checkUrlSetup();
window.addEventListener('hashchange', checkUrlSetup);
initTheme();
renderRecentShelf();
setTimeout(initGoogleClients, 600);


