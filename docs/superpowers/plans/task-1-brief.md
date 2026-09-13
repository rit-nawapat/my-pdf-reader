# Task 1 Brief: Semantic HTML Markup Overhaul

## Objective
Update index.html to establish the new Zen Canvas semantic markup. Replace the rigid, cluttered full-width top #toolbar with the #floatingCapsule toolbar, add the #flyoutMenu container, and replace the old #dropZoneCard with the clean #openDocDropdown and #shelfSection.

## Files to Modify
- :/Project/pdf-reader/index.html

## Requirements
1. **Floating Capsule Toolbar (#floatingCapsule)**:
   - Replace <header class=toolbar id=toolbar> with:
     `html
     <header class=floating-capsule id=floatingCapsule style=display: none;>
       <button class=btn btn-icon capsule-btn id=shelfBtn title=กลับไปคลังหนังสือ (หน้าหลัก) aria-label=คลังหนังสือ>
         <svg class=icon viewBox=0 0 24 24><polyline points=15 18 9 12 15 6></polyline></svg>
       </button>
       <span class=capsule-title id=fileName title=ยังไม่ได้เลือกไฟล์>เอกสาร</span>
       <div class=capsule-nav>
         <button class=btn btn-icon capsule-btn id=prevPageBtn title=หน้าก่อนหน้า aria-label=หน้าก่อนหน้า>
           <svg class=icon viewBox=0 0 24 24><polyline points=15 18 9 12 15 6></polyline></svg>
         </button>
         <div class=capsule-page-indicator>
           <input type=number id=pageNumberInput min=1 value=1 aria-label=เลขหน้า>
           <span class=page-slash>/</span>
           <span id=pageCount>0</span>
         </div>
         <button class=btn btn-icon capsule-btn id=nextPageBtn title=หน้าถัดไป aria-label=หน้าถัดไป>
           <svg class=icon viewBox=0 0 24 24><polyline points=9 18 15 12 9 6></polyline></svg>
         </button>
       </div>
       <button class=btn btn-icon capsule-btn id=capsuleMenuBtn title=เมนูเพิ่มเติม aria-label=เมนูเพิ่มเติม>
         <svg class=icon viewBox=0 0 24 24>
           <circle cx=12 cy=12 r=1.75></circle>
           <circle cx=19 cy=12 r=1.75></circle>
           <circle cx=5 cy=12 r=1.75></circle>
         </svg>
       </button>
     </header>
     `

2. **Unified Flyout Menu (#flyoutMenu)**:
   - Insert right below #floatingCapsule:
     `html
     <div class=flyout-backdrop id=flyoutBackdrop></div>
     <div class=flyout-menu id=flyoutMenu>
       <div class=flyout-drag-handle mobile-only></div>
       <div class=flyout-header>
         <span class=flyout-title>การควบคุมและมุมมอง</span>
         <button class=btn btn-icon flyout-close-btn id=closeFlyoutBtn aria-label=ปิด>
           <svg class=icon viewBox=0 0 24 24><line x1=18 y1=6 x2=6 y2=18></line><line x1=6 y1=6 x2=18 y2=18></line></svg>
         </button>
       </div>
       <div class=flyout-section>
         <span class=flyout-section-label>โหมดการอ่าน</span>
         <div class=flyout-swatches>
           <button class=swatch-btn active data-theme=default title=โหมดสว่างปกติ>
             <span class=swatch-circle swatch-default></span>
             <span>สว่าง</span>
           </button>
           <button class=swatch-btn data-theme=sepia title=โหมดถนอมสายตา ซีเปีย>
             <span class=swatch-circle swatch-sepia></span>
             <span>ซีเปีย</span>
           </button>
           <button class=swatch-btn data-theme=dark title=โหมดมืดสนิท>
             <span class=swatch-circle swatch-dark></span>
             <span>มืด</span>
           </button>
         </div>
       </div>
       <div class=flyout-section>
         <span class=flyout-section-label>การซูม</span>
         <div class=flyout-zoom-group>
           <button class=btn btn-icon id=zoomOutBtn title=ซูมออก>
             <svg class=icon viewBox=0 0 24 24><circle cx=11 cy=11 r=8></circle><line x1=21 y1=21 x2=16.65 y2=16.65></line><line x1=8 y1=11 x2=14 y2=11></line></svg>
           </button>
           <button class=btn btn-text id=zoomFitBtn title=พอดีจอ>พอดีจอ</button>
           <button class=btn btn-icon id=zoomInBtn title=ซูมเข้า>
             <svg class=icon viewBox=0 0 24 24><circle cx=11 cy=11 r=8></circle><line x1=21 y1=21 x2=16.65 y2=16.65></line><line x1=11 y1=8 x2=11 y2=14></line><line x1=8 y1=11 x2=14 y2=11></line></svg>
           </button>
         </div>
       </div>
       <div class=flyout-section flyout-actions>
         <button class=flyout-action-item id=flyoutSidebarBtn>
           <svg class=icon viewBox=0 0 24 24><rect x=3 y=3 width=18 height=18 rx=2 ry=2></rect><line x1=9 y1=3 x2=9 y2=21></line></svg>
           <span>ภาพตัวอย่างและสารบัญ</span>
         </button>
         <button class=flyout-action-item id=fullscreenBtn>
           <svg class=icon viewBox=0 0 24 24><polyline points=15 3 21 3 21 9></polyline><polyline points=9 21 3 21 3 15></polyline><line x1=21 y1=3 x2=14 y2=10></line><line x1=3 y1=21 x2=10 y2=14></line></svg>
           <span>เต็มหน้าจอ</span>
         </button>
         <button class=flyout-action-item id=flyoutSettingsBtn>
           <svg class=icon viewBox=0 0 24 24><circle cx=12 cy=12 r=3></circle><path d=M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z></path></svg>
           <span>ตั้งค่า Google Drive</span>
         </button>
       </div>
     </div>
     `

3. **Minimal Bookshelf (#shelfWrapper in #dropZone)**:
   - Replace old #dropZoneCard with:
     `html
     <div class=shelf-wrapper id=shelfWrapper>
       <div class=library-header>
         <div class=library-brand>
           <svg class=library-logo viewBox=0 0 24 24>
             <path d=M4 19.5A2.5 2.5 0 0 1 6.5 17H20></path>
             <path d=M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z></path>
           </svg>
           <h1 class=library-title>คลังหนังสือ</h1>
         </div>
         <div class=library-actions>
           <!-- Open Document Dropdown -->
           <div class=dropdown-wrap id=openDocWrap>
             <button class=btn btn-primary capsule-action-btn id=openDocBtn title=เปิดเอกสารใหม่>
               <svg class=icon viewBox=0 0 24 24><line x1=12 y1=5 x2=12 y2=19></line><line x1=5 y1=12 x2=19 y2=12></line></svg>
               <span>เปิดเอกสาร</span>
               <svg class=icon icon-chevron viewBox=0 0 24 24><polyline points=6 9 12 15 18 9></polyline></svg>
             </button>
             <div class=dropdown-menu id=openDocMenu>
               <label class=dropdown-item id=openLocalFileItem>
                 <svg class=icon viewBox=0 0 24 24><path d=M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z></path></svg>
                 <span>เลือกไฟล์จากเครื่อง</span>
                 <input type=file id=fileInput accept=application/pdf style=display: none;>
               </label>
               <button type=button class=dropdown-item id=driveOpenBtn>
                 <svg class=icon icon-drive viewBox=0 0 24 24>
                   <path fill=#4285F4 d=M12.01 1.49L4.47 14.54l3.75 6.49 7.54-13.05z />
                   <path fill=#0F9D58 d=M4.47 14.54L.72 21.03h15.08l3.75-6.49z />
                   <path fill=#FFBB00 d=M19.55 14.54L15.8 8.05H8.22l3.75 6.49z />
                 </svg>
                 <span>เปิดจาก Google Drive</span>
               </button>
             </div>
           </div>

           <!-- Settings Button -->
           <button class=btn btn-icon library-settings-btn id=openSettingsBtn title=ตั้งค่า Google Drive>
             <svg class=icon viewBox=0 0 24 24><circle cx=12 cy=12 r=3></circle><path d=M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z></path></svg>
           </button>
         </div>
       </div>

       <!-- Bookshelf Section -->
       <section class=shelf-section id=shelfSection aria-label=หนังสือล่าสุด>
         <div class=shelf-header>
           <span class=shelf-subtitle>อ่านต่อจากที่ค้างไว้</span>
           <button class=btn btn-text text-muted id=clearRecentsBtn title=ล้างประวัติทั้งหมด>ล้างประวัติ</button>
         </div>
         <div class=recent-grid id=recentGrid>
           <!-- Dynamically populated -->
         </div>
       </section>

       <!-- Empty State (Shown when shelf has 0 items) -->
       <div class=empty-shelf id=emptyShelf style=display: none;>
         <p class=empty-text>ยังไม่มีประวัติการอ่าน เปิดเอกสารจากปุ่มด้านบน หรือลากไฟล์มาวางในหน้านี้เพื่อเริ่มอ่าน</p>
       </div>
     </div>
     `

4. **Preserve #settingsModal (Google Drive & QR Sync)**:
   - Ensure the modal and its IDs (#cfgClientId, #cfgApiKey, #saveConfigBtn, #clearConfigBtn, #qrcode, #copySyncLinkBtn) remain intact.
5. **Verify**:
   - Run powershell -Command (Invoke-WebRequest -Uri http://localhost:8080/ -UseBasicParsing).StatusCode
