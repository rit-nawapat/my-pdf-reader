# Google Auth, Secure Session & Profile-Isolated Reading History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Implement client-side Google Authentication, secure 30-minute idle session management, a responsive user profile popover, and profile-isolated reading history and page positions for the Minimal PDF Reader.

**Architecture:** Integrate Google Identity Services (GIS) with userinfo scopes to retrieve Google profile metadata, maintain a monitored session state with activity-based 30-minute idle timeout and 1-hour absolute expiry, namespace local reading state and recent bookshelf files by profile ID, and render a touch-friendly glassmorphic profile card.

**Tech Stack:** Vanilla JavaScript (ES2022+), HTML5, CSS3 Glassmorphism, Google Identity Services (GIS) TokenClient & UserInfo API, IndexedDB.

## Global Constraints

- Platform: Vanilla HTML5 / CSS3 / JavaScript running on static hosting (GitHub Pages compatible).
- Security: No client secrets in code. Google Access tokens expire within 1 hour; inactive sessions auto-terminate after 30 minutes. Explicit token revocation on sign-out.
- Offline-First: Document rendering must never crash or evict the user if a session expires while viewing a book.
- Mobile First: Header buttons and profile popover must display cleanly on mobile screens down to 360px without layout shifts or text overflow.

---

### Task 1: Add HTML Structure for Auth Button & Profile Popover Card

**Files:**
- Modify: index.html:175-210 (Header actions)
- Modify: index.html:280-320 (Modal / Popover container area)

**Interfaces:**
- Produces:
  - #authProfileContainer: Wrapper in .library-actions containing guest sign-in button and logged-in avatar trigger.
  - #authActionBtn: Button for guest users to sign in.
  - #authProfileBtn: Avatar button with status badge for logged-in users.
  - #profilePopover: Floating card / bottom sheet markup with user avatar, name, email, countdown badge, and #signOutBtn.

- [ ] **Step 1: Add Auth elements into .library-actions in index.html**
  Add #authActionBtn and #authProfileBtn adjacent to #openSettingsBtn.
- [ ] **Step 2: Add Profile Popover markup in index.html**
  Add #profilePopover and backdrop #profileBackdrop containing avatar, user details, session badge, bookshelf stats, and sign out button.
- [ ] **Step 3: Verify HTML validity**
  Check DOM structure and ensure no broken tags or unclosed containers.
- [ ] **Step 4: Commit Task 1 changes**
  git add index.html; git commit -m 'feat(auth): add markup for header auth button and profile popover'

---

### Task 2: Implement Glassmorphic CSS Styling & Mobile Responsiveness

**Files:**
- Modify: style.css:350-450 (Header styles)
- Modify: style.css:950-1050 (Popover & modal styles)
- Modify: style.css:1200-1350 (Media queries for <= 768px, <= 480px, <= 360px)

**Interfaces:**
- Produces:
  - .auth-btn: Pill button style matching .capsule-action-btn.
  - .auth-avatar-btn: Circular button containing img.user-avatar-img and .avatar-status-badge.
  - .profile-popover: Glassmorphic floating card for desktop, centered / bottom-sheet modal for mobile.
  - .session-badge: High-visibility status indicator displaying session remaining time.

- [ ] **Step 1: Add styling for .auth-btn and .auth-avatar-btn**
  Match glassmorphic dark/light theme variables with smooth hover/focus transitions.
- [ ] **Step 2: Add styling for .profile-popover and popover content**
  Avatar ring glow, typography, session pill, and danger-styled sign out button.
- [ ] **Step 3: Add responsive media queries**
  - Desktop: Floating dropdown anchored to right edge under avatar.
  - Mobile (<= 480px): Fixed bottom-sheet / centered modal with backdrop blur.
  - Header (<= 480px): Hide text in #authActionBtn, show compact Google icon.
- [ ] **Step 4: Commit Task 2 changes**
  git add style.css; git commit -m 'style(auth): add glassmorphic styles and mobile responsive rules for profile UI'

---

### Task 3: Implement Session Management, Inactivity Watchdog & UserInfo Flow

**Files:**
- Modify: pp.js:1750-1850 (Google Clients & Auth)

**Interfaces:**
- Consumes: Google Identity Services (google.accounts.oauth2).
- Produces:
  - getSession(): Returns current parsed session or null if expired.
  - saveSession(token, expiresIn, userInfo): Persists session to localStorage.
  - clearSession(): Clears session and revokes Google token.
  - getActiveProfile(): Returns current user object or { id: 'guest', name: 'ผู้เยี่ยมชม' }.
  - updateSessionActivity(): Throttled activity updater on touch/pointer/keyboard/scroll.
  - startSessionWatchdog(): 60-second periodic timer checking 1h absolute expiry and 30m idle timeout.

- [ ] **Step 1: Implement session persistence & watchdog functions in pp.js**
  Add SESSION_STORAGE_KEY = 'pdf_reader_session', IDLE_TIMEOUT_MS = 30 * 60 * 1000, and watchdog runner.
- [ ] **Step 2: Attach throttled event listeners for touch/pointer/keyboard/scroll**
  Throttle updates to every 30 seconds to minimize CPU/storage cycles.
- [ ] **Step 3: Update initGoogleClients to request userinfo scopes and fetch profile**
  Add scopes userinfo.profile, userinfo.email, openid. In callback, fetch https://www.googleapis.com/oauth2/v3/userinfo and create session.
- [ ] **Step 4: Implement Sign Out with token revocation**
  Call google.accounts.oauth2.revoke(token) and reset to guest profile.
- [ ] **Step 5: Commit Task 3 changes**
  git add app.js; git commit -m 'feat(auth): implement session manager, idle watchdog, and Google userinfo flow'

---

### Task 4: Profile-Isolated Reading History & Progress Namespacing

**Files:**
- Modify: pp.js:270-350 (Shelf & Recent Files Manager)
- Modify: pp.js:530-585 (Reading state restore & save)
- Modify: pp.js:1035-1120 (Continuous scroll page position update)

**Interfaces:**
- Consumes: getActiveProfile() from Task 3.
- Produces:
  - getProfileRecentStorageKey(): Returns pdf_reader_recents_.
  - getUserScopedKey(baseKey): Returns ${baseKey}_.
  - migrateLegacyGuestRecents(): Copies legacy pdf_reader_recent_files to pdf_reader_recents_guest.

- [ ] **Step 1: Refactor getRecentFiles, saveRecentFile, 
emoveRecentFile, clearAllRecents**
  Update storage access to use dynamic scoped key based on active profile.
- [ ] **Step 2: Refactor currentFileKey reading progress save and restore**
  Use getUserScopedKey(currentFileKey) for page number retrieval and persistence.
- [ ] **Step 3: Update bookshelf header label based on active profile**
  Display 'ประวัติการอ่านของ [ชื่อผู้ใช้]' or 'ประวัติการอ่าน (โหมดทั่วไป)'.
- [ ] **Step 4: Commit Task 4 changes**
  git add app.js; git commit -m 'feat(profile): isolate reading history and progress per profile with legacy migration'

---

### Task 5: UI Interaction Wiring & End-to-End Verification

**Files:**
- Modify: pp.js:1850-1960 (DOM bindings & UI state update)

**Interfaces:**
- Produces:
  - updateAuthUI(): Toggles guest button vs user avatar, updates avatar image and profile popover content.
  - openProfilePopover() / closeProfilePopover(): Controls popover visibility and live countdown refresh.

- [ ] **Step 1: Wire event listeners for auth button, avatar button, popover backdrop, and sign out**
- [ ] **Step 2: Run syntax verification on pp.js using 
ode -c app.js**
- [ ] **Step 3: Test local server on port 8080 and verify UI rendering in desktop and mobile viewports**
- [ ] **Step 4: Test session idle timeout and graceful guest fallback**
- [ ] **Step 5: Commit Task 5 changes**
  git add app.js; git commit -m 'feat(ui): wire profile popover interaction and complete end-to-end integration'
