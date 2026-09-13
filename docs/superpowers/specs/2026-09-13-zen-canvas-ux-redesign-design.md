# Design Specification: Zen Canvas Minimalist UX/UI Redesign

## 1. Overview & Problem Statement
The current PDF Reader interface has accumulated multiple toolbar buttons, text labels, and large drop-zone cards, creating visual clutter and distracting from the core reading experience on both PC and mobile devices.

This specification outlines the complete UX/UI redesign into the **"Zen Canvas / Minimal Capsule"** style—a distraction-free, modern, elegant design inspired by Notion, Apple Books, and modern e-readers.

## 2. Goals & Principles
* **Zero Distraction:** The document content is the primary focus. All controls exist only when needed.
* **Floating Capsule Toolbar:** Replace the rigid, full-width top header with a floating, translucent glassmorphism capsule pill.
* **Unified Control Flyout:** Group secondary controls (Themes, Zoom, Outline, Fullscreen) into a single clean Flyout popover on desktop and a thumb-friendly Bottom Sheet on mobile.
* **Clean Home & Bookshelf:** Replace oversized dashed boxes with an open document dropdown button and a clean grid of recent reading cards.
* **Seamless Mobile First:** 100% full-screen immersive reading on mobile with single-tap reveal, left/right page turn swipes, and bottom sheet menus.
* **Zero-Hardcode Security Integrity:** Maintain existing Google Drive OAuth & Picker integration and QR-code mobile sync without hardcoding any secrets.

---

## 3. UI/UX Specifications

### 3.1. Home & Bookshelf View
* **Header & Action Bar:**
  * Clean typographic header: "คลังหนังสือ" (My Library).
  * Single primary action button: `[ + เปิดเอกสาร ]` with subtle chevron.
    * Clicking opens a floating capsule dropdown:
      1. `📂 เลือกไฟล์จากเครื่อง` (Local file picker)
      2. `☁️ เปิดจาก Google Drive` (Google Picker)
  * Discrete settings icon `⚙️` on the top right for Google Drive credentials and mobile QR sync.
* **Full-Window Drag & Drop:**
  * Remove the heavy dashed card.
  * Dragging any PDF over the browser window illuminates a soft glowing accent border and subtle backdrop overlay indicating "วางไฟล์เพื่อเริ่มอ่าน".
* **Recent Bookshelf (ตู้หนังสือ):**
  * Displayed as a clean responsive grid (2-3 columns on desktop, 1 column on mobile).
  * Each card includes:
    * Subtle document icon with optional minimal `Drive` tag.
    * Clean document title (truncated cleanly if long).
    * Ultra-slim 3px progress bar.
    * Compact metadata: `หน้า 10 / 4,718 • อ่านต่อ`.
    * Remove button `×` visible on hover (desktop) or discrete tap (mobile).

### 3.2. Zen Reading View & Floating Capsule Toolbar
* **Floating Capsule (Toolbar):**
  * Positioned fixed at `top: 14px`, centered horizontally.
  * Capsule styling: `border-radius: 9999px`, `background: rgba(var(--bg-card-rgb), 0.75)`, `backdrop-filter: blur(16px)`, subtle border and box-shadow.
  * Elements inside capsule (Left to Right):
    1. Back button `‹` to return to bookshelf.
    2. File title (truncated with ellipsis, max-width ~160-240px).
    3. Direct page navigator: `‹` `[ Input: 10 ]` `/ 4,718` `›`.
    4. Action button `•••` (opens Flyout Control Panel).
* **Smart Auto-Hide Behavior:**
  * **Scrolling Down:** The floating capsule and bottom scrubber smoothly slide up/down and fade out (`opacity: 0`, `pointer-events: none`).
  * **Scrolling Up / Hover Top (Desktop):** Capsule smoothly reappears.
  * **Mobile Tap (Single Tap):** Toggles capsule and bottom scrubber visibility.
* **Bottom Scrubber:**
  * Replaced heavy black gradient with an ultra-thin 3px translucent slider bar docked at the bottom with safe-area padding.

### 3.3. Unified Flyout Panel & Sidebar Drawer
* **Flyout Control Panel (`•••`):**
  * On Desktop: Floats cleanly below the `•••` button as a glassmorphism card.
  * On Mobile: Slides up from bottom as an iOS/Android-style **Bottom Sheet**.
  * Contains grouped options:
    * **Reading Theme Selector:** 3 circular swatches:
      * ☀️ สว่างปกติ (Default)
      * 📖 ถนอมสายตา (Sepia)
      * 🌙 โหมดมืด (Dark)
    * **Zoom Controls:** Segmented pill: `[ - ] [ พอดีจอ ] [ + ]`.
    * **Sidebar Toggle:** `📑 ภาพตัวอย่างและสารบัญ`.
    * **Fullscreen Toggle:** `⛶ เต็มหน้าจอ`.
    * **Drive Settings:** `⚙️ ตั้งค่า Google Drive`.
* **Sidebar Drawer (Thumbnails & Outline):**
  * Refined slim sliding drawer from the left side with backdrop blur.
  * Tab 1: Thumbnails with smooth lazy rendering and clean active highlight.
  * Tab 2: Outline TOC tree with clean indentation.
  * Closes automatically on mobile when a page or section is selected.

---

## 4. Technical Implementation Details

### 4.1. File Modifications
* `index.html`:
  * Streamline DOM markup for `#toolbar` into `#floatingCapsule`.
  * Add `#flyoutMenu` with themed controls and action items.
  * Replace `#dropZoneCard` with clean `#openDocDropdown` and `#shelfSection`.
* `style.css`:
  * Add glassmorphism variables, floating pill styling, animation keyframes for fade/slide.
  * Add Bottom Sheet styles for mobile screens (`@media (max-width: 768px)`).
  * Refine grid layouts and eliminate cluttered borders.
* `app.js`:
  * Wire up the floating capsule show/hide behavior on scroll and mobile tap.
  * Wire up the `+ เปิดเอกสาร` dropdown and `•••` flyout menu.
  * Ensure existing Google Drive integration, IndexedDB caching, and page jump precision remain completely intact.

### 4.2. Non-Goals (YAGNI)
* No complex multi-tab document switching.
* No text annotation / drawing markup tools (keep reader lightweight and high-speed).

---

## 5. Verification Plan
* **Automated Syntax Check:** Run `node -c app.js` to ensure 100% valid JavaScript.
* **Visual & Layout Inspection:** Verify floating capsule, flyout popover, bottom sheet on mobile, bookshelf grid, and drag & drop across desktop and mobile viewports.
* **Functional Integrity:** Ensure page navigation, reading position resumption, theme switching, and Google Drive loading work seamlessly.
