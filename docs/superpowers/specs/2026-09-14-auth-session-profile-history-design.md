# Design Specification: Google Auth, Secure Session & Profile-Isolated Reading History

- **Date**: 2026-09-14
- **Status**: Approved
- **Target Platform**: Minimal PDF Reader (Web / Mobile PWA, GitHub Pages compatible)
- **Author**: Antigravity Pair Programmer & User

---

## 1. Overview & Objectives

Implement an enterprise-grade, lightweight client-side authentication and session management system for the Minimal PDF Reader, featuring:
1. **Google Identity Services (GIS) Authentication**: Sign in with Google using OAuth2 token client with scopes drive.file, userinfo.profile, userinfo.email, and openid.
2. **Strict Security Model & Session Lifecycle**:
   - Token lifetime aligned with Google\'s 1-hour absolute expiry.
   - 30-minute idle inactivity timeout with activity detection (pointerdown, touchstart, keydown, scroll).
   - Graceful offline-first fallback: If a session expires while reading an offline or cached document, the user can continue reading uninterrupted while cloud-scoped capabilities revert to Guest.
3. **Profile-Isolated Reading History (Approach A)**:
   - Reading progress (<fileKey>_<userId>) and recent books (pdf_reader_recents_<userId>) are segregated per user profile.
   - Distinct guest profile for unauthenticated / offline use.
   - Backward compatibility: Existing pdf_reader_recent_files entries are automatically migrated to pdf_reader_recents_guest so existing reading history is never lost.
4. **Responsive Mobile-First UI**:
   - Compact Google Sign-in / Avatar button in the Bookshelf header adjacent to settings.
   - Glassmorphic Profile Popover / Bottom Sheet with live session countdown, profile information, and Sign Out button.
   - Fully optimized for desktop, tablet, and mobile screens (down to <= 360px).

---

## 2. Architecture & Data Flow

### 2.1 Data Models

#### Session Object (pdf_reader_session)
Stored in localStorage under pdf_reader_session:
\\	ypescript
interface UserSession {
  token: string;              // Google OAuth2 Access Token
  expiresAt: number;          // Epoch ms: issued time + (expires_in * 1000) (max 1 hr)
  lastActiveAt: number;       // Epoch ms: last detected user interaction
  user: {
    id: string;               // Google unique ID (sub)
    name: string;             // User display name
    email: string;            // User email address
    picture: string;          // Google avatar image URL
  };
}
\
#### Active Profile
\\	ypescript
interface ActiveProfile {
  id: string;                 // Google sub or 'guest'
  name: string;               // 'Guest' or user name
  email: string;
  picture: string;
  isGuest: boolean;
}
\
### 2.2 Storage Namespacing Strategy

1. **Recent Files Shelf Key**:
   - Logged-in user: pdf_reader_recents_   - Guest user: pdf_reader_recents_guest
   - Migration: On initialization, if pdf_reader_recents_guest is empty and legacy pdf_reader_recent_files exists, copy entries to pdf_reader_recents_guest.

2. **Per-Book Progress Key**:
   - Logged-in user: \_   - Guest user: \_guest (with fallback to \ for legacy state).

3. **Drive Cloud Sync**:
   - When a Google Drive file is read by a logged-in user, progress is saved to both local namespaced storage and Google Drive appProperties.lastReadPage for seamless cross-device synchronization.

---

## 3. Component Details & Behavior

### 3.1 Session Manager & Inactivity Watchdog

- **Throttled Activity Listener**:
  - Events: pointerdown, touchstart, keydown, scroll.
  - Throttle window: 30 seconds.
  - Action: Update currentSession.lastActiveAt = Date.now() and persist to localStorage.
- **Periodic Health Check**:
  - Runs every 60 seconds (setInterval).
  - Checks two conditions:
    1. Absolute Expiry: Date.now() >= currentSession.expiresAt
    2. Idle Timeout: Date.now() - currentSession.lastActiveAt >= 30 * 60 * 1000 (30 minutes).
  - If either condition is met:
    - Perform automatic logout: Revoke token via google.accounts.oauth2.revoke, clear pdf_reader_session, switch profile to guest, update UI to Guest state, and display security toast notification.
    - If user is in reading mode, keep reading canvas intact (no forced eviction from reading view).

### 3.2 User Profile & Auth UI

1. **Header Action Elements**:
   - Location: .library-actions in .library-header (next to #openSettingsBtn).
   - Guest State:
     - Desktop: Glassmorphic pill button #authActionBtn with Google icon and text 'เข้าสู่ระบบ'.
     - Mobile (<= 480px): Compact circle or icon button to prevent header crowding.
   - Logged-in State:
     - Avatar button #authProfileBtn displaying user circular profile photo (img.user-avatar-img, 36px diameter desktop, 32px mobile) with an active green presence dot (span.avatar-status-badge).

2. **Profile Popover Card (#profilePopover)**:
   - Position: Desktop pops below avatar aligned to right edge; Mobile displays as a centered modal / bottom sheet with glassmorphic backdrop.
   - Content:
     - User Avatar (large, 64px) with subtle glow ring.
     - User Name (.profile-name) & Email (.profile-email).
     - Session Badge: 🛡️ ปลอดภัย • เซสชันเหลืออีก X นาที (live countdown timer updated every minute).
     - Bookshelf Stats: 📚 บันทึกการอ่านในโปรไฟล์นี้: N เล่ม.
     - Action Buttons:
       - 'สลับบัญชี Google' (optional / re-auth).
       - 'ออกจากระบบ' (#signOutBtn) with immediate graceful logout.

---

## 4. Mobile & Touch Screen Optimizations

1. **Touch Targets**: All clickable targets meet or exceed WCAG 2.1 AA requirement (minimum 44x44px touch area).
2. **Backdrop Dismissal**: Tapping outside the profile popover dismisses it smoothly.
3. **Orientation & Viewport Handling**: Popover uses max-width: 90vw and max-height: 80vh with overflow-y: auto to prevent clipping on landscape mobile devices.
4. **Zero-Layout Shift**: Header controls use flexbox with fixed alignment so logging in or out does not shift the library title or layout.

---

## 5. Security & Privacy Guarantees

1. **Zero Secret Leaks**: No Client Secrets or sensitive tokens committed to git or printed in logs. Client ID and API Key remain user-configurable.
2. **Explicit Revocation**: Logging out triggers google.accounts.oauth2.revoke(token) to invalidate the access token on Google authorization servers.
3. **Isolated Cache**: IndexedDB cached PDFs remain available locally; deletion of a book in one profile cleans up that book profile reference safely.

---

## 6. Verification Plan

1. **Authentication Flow**:
   - Click Sign In -> GIS OAuth dialog -> Grant -> Fetch UserInfo -> Avatar and Session displayed.
2. **Session Lifespan & Inactivity**:
   - Test idle timer -> Verify automatic fallback to Guest and security toast.
3. **History Segmentation**:
   - Open PDF A as Guest -> verify stored in pdf_reader_recents_guest.
   - Sign in as User A -> verify clean/distinct bookshelf -> Open PDF B -> verify stored in pdf_reader_recents_<UserA>.
   - Sign out -> verify Guest bookshelf shows PDF A and NOT PDF B.
   - Sign back in as User A -> verify PDF B is restored with exact page progress.
4. **Mobile Responsiveness**:
   - Emulate iPhone SE (375px) and Android (360px) in Chrome DevTools -> verify header layout, touch buttons, and profile modal.
5. **Code Syntax & Build**:
   - Run node -c app.js to ensure zero syntax errors.
