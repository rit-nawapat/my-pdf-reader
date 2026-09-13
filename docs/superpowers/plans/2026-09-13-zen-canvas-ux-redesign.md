# Zen Canvas Minimalist UX/UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the PDF reader from a cluttered interface into a modern, minimalist, distraction-free "Zen Canvas" with a floating glassmorphism capsule toolbar, clean Notion-style bookshelf, and thumb-friendly mobile flyout/bottom sheet.

**Architecture:** Vanilla HTML5 + Pure CSS + Vanilla JS. All controls are modularized into a Floating Capsule Header, Unified Flyout Menu, and Minimal Bookshelf Grid. Core rendering engine (PDF.js virtual scroll), IndexedDB caching, and Google Drive OAuth/Picker/Sync remain completely intact.

**Tech Stack:** HTML5, CSS3 (Glassmorphism & Flexbox/Grid), Vanilla JavaScript (ES6+), PDF.js 3.11, Google Identity Services (GIS), Google Picker API, QRCode.js.

## Global Constraints
* **Zero-Hardcode Security:** Never hardcode Client ID or API Key in source code. Preserve localStorage and QR-code mobile sync.
* **No Regression:** Preserve precision page jumping (Scroll Guard lock), virtual scroll observer cleanup, and Google Drive `appProperties` sync.
* **Mobile-First Responsive:** Must be fully responsive down to 300px without horizontal scrollbar or overlapping elements.
* **No Framework Dependencies:** Vanilla JS and pure CSS only.

---

### Task 1: Semantic HTML Markup Overhaul

**Files:**
- Modify: `f:/Project/pdf-reader/index.html`

**Interfaces:**
- Consumes: None
- Produces: 
  - `#floatingCapsule`: Main reading floating toolbar
  - `#shelfBtn`: Return to bookshelf button
  - `#capsuleTitle`: Document title display
  - `#prevPageBtn`, `#pageNumberInput`, `#pageCount`, `#nextPageBtn`: Navigation controls
  - `#capsuleMenuBtn`: Open flyout menu button
  - `#flyoutMenu`: Unified settings popover/bottom sheet
  - `#shelfWrapper`: Library view with `#openDocBtn`, `#openDocMenu`, `#shelfSection`, `#recentGrid`

- [ ] **Step 1: Backup current index.html and update DOM structure**
Replace the rigid `#toolbar` and `#dropZoneCard` with `#floatingCapsule`, `#flyoutMenu`, and the clean `#shelfWrapper`.

```html
<!-- Floating Capsule Toolbar (Zen Reading Mode) -->
<header class="floating-capsule" id="floatingCapsule" style="display: none;">
  <button class="btn btn-icon capsule-btn" id="shelfBtn" title="กลับไปคลังหนังสือ (หน้าหลัก)" aria-label="คลังหนังสือ">
    <svg class="icon" viewBox="0 0 24 24">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  </button>

  <span class="capsule-title" id="fileName" title="ยังไม่ได้เลือกไฟล์">เอกสาร</span>

  <div class="capsule-nav">
    <button class="btn btn-icon capsule-btn" id="prevPageBtn" title="หน้าก่อนหน้า" aria-label="หน้าก่อนหน้า">
      <svg class="icon" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>
    </button>
    <div class="capsule-page-indicator">
      <input type="number" id="pageNumberInput" min="1" value="1" aria-label="เลขหน้า">
      <span class="page-slash">/</span>
      <span id="pageCount">0</span>
    </div>
    <button class="btn btn-icon capsule-btn" id="nextPageBtn" title="หน้าถัดไป" aria-label="หน้าถัดไป">
      <svg class="icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
    </button>
  </div>

  <button class="btn btn-icon capsule-btn" id="capsuleMenuBtn" title="เมนูเพิ่มเติม" aria-label="เมนูเพิ่มเติม">
    <svg class="icon" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="1.75"></circle>
      <circle cx="19" cy="12" r="1.75"></circle>
      <circle cx="5" cy="12" r="1.75"></circle>
    </svg>
  </button>
</header>
```

- [ ] **Step 2: Add Unified Flyout Menu and Clean Shelf in index.html**
Add `#flyoutMenu` with theme swatches, zoom controls, outline toggle, and settings. Replace `#dropZoneCard` with clean `#openDocDropdown` and `#shelfSection`.

- [ ] **Step 3: Verify index.html loads on server**
Run: `powershell -Command "(Invoke-WebRequest -Uri http://localhost:8080/ -UseBasicParsing).StatusCode"`
Expected: `200`

---

### Task 2: Zen Canvas & Glassmorphism Styling

**Files:**
- Modify: `f:/Project/pdf-reader/style.css`

**Interfaces:**
- Consumes: DOM classes and IDs from Task 1
- Produces:
  - `.floating-capsule`: Glassmorphism floating pill header
  - `.flyout-menu`: Desktop popover & mobile bottom sheet
  - `.shelf-container`, `.recent-card`: Clean Notion-style bookshelf grid
  - `.drop-glow`: Subtle full-window drag & drop border

- [ ] **Step 1: Add Glassmorphism and Floating Capsule Styles**
Implement floating pill with `backdrop-filter: blur(16px)`, `border-radius: 9999px`, smooth slide up/down transitions, and responsive centering.

- [ ] **Step 2: Add Flyout Menu and Mobile Bottom Sheet Styles**
Desktop: Floats right below the `•••` button.
Mobile (`@media (max-width: 768px)`): Docked at the bottom like an iOS/Android bottom sheet with smooth slide-up animation.

- [ ] **Step 3: Add Clean Bookshelf and Minimal Card Styles**
Responsive grid (`grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`), 3px progress bar, hover-to-reveal delete button, and subtle drag-and-drop glowing border.

- [ ] **Step 4: Verify CSS integrity**
Run: `powershell -Command "(Invoke-WebRequest -Uri http://localhost:8080/style.css -UseBasicParsing).StatusCode"`
Expected: `200`

---

### Task 3: Client Engine Event Wiring & Zen UX Behaviors

**Files:**
- Modify: `f:/Project/pdf-reader/app.js`

**Interfaces:**
- Consumes: DOM elements from Task 1, classes from Task 2
- Produces:
  - Floating capsule auto-hide logic on scroll and reveal on mobile tap
  - Flyout menu toggle and click-outside dismissal
  - Dropdown toggle for `+ เปิดเอกสาร`
  - Minimal bookshelf rendering in `renderRecentShelf()`

- [ ] **Step 1: Wire up DOM selectors and dropdown toggles**
Bind `#openDocBtn`, `#openDocMenu`, `#capsuleMenuBtn`, and `#flyoutMenu`.

- [ ] **Step 2: Implement Smart Auto-Hide on Scroll and Mobile Tap**
Scroll down smoothly slides out `#floatingCapsule` and `#bottomBar`. Scroll up or hover top reveals it. Mobile single-tap toggles visibility.

- [ ] **Step 3: Update renderRecentShelf for clean grid display**
Render document title, 3px progress bar, relative time, and Drive badge.

- [ ] **Step 4: Verify JavaScript Syntax**
Run: `node -c app.js`
Expected: Exits with code 0 (No syntax errors).

---

### Task 4: End-to-End Verification

**Files:**
- Verify: `http://localhost:8080`

- [ ] **Step 1: Verify Library View**
Test opening local file and Google Drive picker via `+ เปิดเอกสาร` dropdown.

- [ ] **Step 2: Verify Zen Reading View**
Test floating capsule pill, page jumping, auto-hide on scroll, flyout menu options (Themes, Zoom, Outline, Fullscreen).

- [ ] **Step 3: Verify Mobile Responsiveness**
Test layout on mobile viewport (375px width). Verify bottom sheet flyout and swipe navigation.
