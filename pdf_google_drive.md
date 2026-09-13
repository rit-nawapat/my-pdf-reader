# แผนการพัฒนาระบบเว็บอ่าน PDF ส่วนตัว เชื่อมต่อ Google Drive (Implementation Plan)

เอกสารแผนการพัฒนาระบบเว็บอ่านไฟล์ PDF ส่วนตัวที่เชื่อมต่อกับ Google Drive จำลองประสบการณ์การใช้งานสไตล์ Google Drive รองรับการจำหน้าที่อ่านค้างไว้แบบข้ามอุปกรณ์ (Cross-Device Sync) การเปิดอ่านไฟล์ขนาดใหญ่ และการข้ามหน้าจำนวนมากโดยไม่กระตุก โดยใช้เทคโนโลยีฝั่ง Client-side ร่วมกับ Google APIs ภายใต้เงื่อนไข **ฟรี 100%** ไม่ต้องตั้งเซิร์ฟเวอร์ Backend แยก

---

## สรุปภาพรวมสถาปัตยกรรม (System Architecture Overview)

* **Client Engine:** HTML5 Canvas + Mozilla `PDF.js` (WebAssembly/Worker)
* **Auth & Permissions:** Google Identity Services (GIS) OAuth 2.0 (Testing Mode)
* **File Picker:** Google Drive Picker API
* **File Storage:** Google Drive (เข้าถึงผ่าน Google Drive REST API v3)
* **Cross-Device State Sync:** `appProperties` metadata บนไฟล์ Google Drive (ไม่ต้องใช้ Database)
* **Local Caching:** `localStorage` (Local-First Sync)
* **Web Hosting:** Vercel / GitHub Pages / Cloudflare Pages (Static Free Tier พร้อม HTTPS)

```
+-------------------------------------------------------------------------+
|                              Web Browser                                |
|                                                                         |
|  +--------------------+    +------------------+    +-----------------+  |
|  | Google Picker UI   |    | PDF.js Engine    |    | LocalStorage    |  |
|  | (File Selection)   |    | (Virtual Scroll) |    | (Instant Cache) |  |
|  +---------+----------+    +--------+---------+    +--------+--------+  |
|            |                        |                       |           |
+------------|------------------------|-----------------------|-----------+
             |                        |                       |
             | OAuth 2.0 Token        | Binary Stream (Blob)  | Debounced PATCH
             v                        v                       v
+-------------------------------------------------------------------------+
|                           Google Cloud Ecosystem                        |
|                                                                         |
|  +--------------------+    +------------------+    +-----------------+  |
|  | Google Auth Server |    | Google Drive API |    | appProperties   |  |
|  | (Testing / GIS)    |    | (files.get)      |    | (files.patch)   |  |
|  +--------------------+    +------------------+    +-----------------+  |
+-------------------------------------------------------------------------+
```

---

## Phase 1: การเตรียมโครงสร้างพื้นฐานและระบบความปลอดภัย (Setup & Authentication)

### เป้าหมาย
สร้างโปรเจกต์ จัดเตรียมกุญแจเข้าถึง Google Cloud และทำระบบล็อกอินรับ Access Token

### รายละเอียดการปฏิบัติงาน
1. **Google Cloud Console Configuration:**
   * สร้างโปรเจกต์ใหม่ใน [Google Cloud Console](https://console.cloud.google.com/)
   * เปิดใช้งาน API ที่จำเป็น:
     * `Google Drive API`
     * `Google Picker API`
   * ตั้งค่า **OAuth Consent Screen**:
     * User Type: **External**
     * Publishing Status: คงสถานะเป็น **Testing** (ห้ามกด Publish เพื่อเลี่ยงกระบวนการ Verified App)
     * Test Users: เพิ่มอีเมล Gmail ของตนเองและผู้ที่ต้องการให้ทดสอบ (รองรับสูงสุด 100 บัญชี)
   * สร้าง **OAuth 2.0 Client ID**:
     * Application Type: Web application
     * Authorized JavaScript Origins: กำหนด `http://localhost:3000` (สำหรับการพัฒนา) และโดเมนที่จะ Deploy จริง
   * สร้าง **API Key** สำหรับเรียกใช้ Google Picker API
2. **Frontend Project Setup:**
   * กำหนดเทคโนโลยี: แนะนำ Single Page App (Vanilla JS + Tailwind CSS หรือ React / Vite)
   * ติดตั้งและโหลด Scripts ทางการของ Google:
     * `https://accounts.google.com/gsi/client` (Google Identity Services)
     * `https://apis.google.com/js/api.js` (Google API Client สำหรับ Picker)
3. **Authentication Workflow:**
   * สร้างปุ่ม Sign in with Google
   * ขอ Scope การใช้งาน:
     * `https://www.googleapis.com/auth/drive.file` (เข้าถึงเฉพาะไฟล์ที่เปิดผ่านแอป)

### เกณฑ์การส่งมอบ (Deliverables)
- [ ] รับ Access Token สำเร็จเมื่อล็อกอิน
- [ ] ระบบเก็บ Token ไว้ใน Memory State พร้อมใช้งาน

---

## Phase 2: ดึงไฟล์และการแสดงผลพื้นฐาน (Picker & PDF Core)

### เป้าหมาย
ผู้ใช้สามารถกดเลือกไฟล์ PDF จาก Google Drive ผ่านหน้าต่างทางการ และเปิดแสดงผลหน้าแรกได้

### รายละเอียดการปฏิบัติงาน
1. **Google Drive Picker Integration:**
   * เขียนฟังก์ชันสร้าง View สำหรับ Picker ให้กรองเฉพาะไฟล์ PDF (`application/pdf`)
   * ผูก Access Token และ API Key เข้ากับหน้าต่าง Picker
   * รับ Response กลับมาเป็น `fileId` และ `fileName` เมื่อผู้ใช้เลือกไฟล์
2. **Binary Fetching Logic:**
   * ใช้ Access Token ส่งคำขอ `GET https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
   * แปลงข้อมูล Binary ตอบกลับให้อยู่ในรูปแบบ `Blob` หรือ `ArrayBuffer`
3. **PDF.js Core Integration:**
   * นำเข้า `pdfjs-dist` (หรือโหลดผ่าน CDN)
   * กำหนด Worker Source: `pdfjsLib.GlobalWorkerOptions.workerSrc`
   * ส่ง Blob เข้าสู่ `pdfjsLib.getDocument()`
   * เรนเดอร์หน้าแรก (Page 1) ลงบน HTML5 `<canvas>` เพื่อทดสอบความคมชัด

### เกณฑ์การส่งมอบ (Deliverables)
- [ ] เปิด Google Picker แล้วแสดงเฉพาะไฟล์ PDF ใน Drive ได้
- [ ] เมื่อเลือกไฟล์ สามารถดึงเนื้อหามาเรนเดอร์หน้าแรกได้สำเร็จ

---

## Phase 3: ระบบจำหน้าอ่านค้างไว้แบบ Cross-Device Sync

### เป้าหมาย
จำหน้าที่อ่านค้างไว้และซิงก์ตรงกับ Google Drive โดยไม่ต้องมีฐานข้อมูลแยก ทำให้อ่านต่อบนเครื่องอื่นได้ทันที

### รายละเอียดการปฏิบัติงาน
1. **Metadata Reading ( هنگامเปิดไฟล์):**
   * ก่อนเรนเดอร์ ให้ดึง Metadata ของไฟล์:
     `GET https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,appProperties`
   * ตรวจสอบค่า `data.appProperties?.lastReadPage`:
     * หากมีค่า: ตั้งค่าหน้าปัจจุบันเป็นเลขหน้านั้น
     * หากไม่มีค่า: เริ่มต้นที่หน้า 1
2. **Local-First Synchronization:**
   * เมื่อผู้ใช้อ่านเปลี่ยนหน้า:
     * บันทึกเลขหน้าลง `localStorage` ทันที (`key: pdf_pos_${fileId}`) เพื่อให้ตอบสนองทันทีแม้เน็ตหลุด
3. **Cloud Synchronization (Debounced PATCH):**
   * สร้าง Debounce Function หน่วงเวลา 1.5 - 2.0 วินาที หลังจากหยุดเลื่อนหน้าจอ
   * ยิงคำสั่งอัปเดต Metadata กลับไปยัง Google Drive:
     ```http
     PATCH https://www.googleapis.com/drive/v3/files/${fileId}
     Content-Type: application/json
     Authorization: Bearer <ACCESS_TOKEN>

     {
       "appProperties": {
         "lastReadPage": "42",
         "lastReadAt": "2026-09-12T14:30:00Z"
       }
     }
     ```
4. **Resume Reading Prompt / Auto-Jump:**
   * เมื่อเข้าสู่หน้าเอกสาร เลื่อนหน้าจอไปยังตำแหน่งที่จำไว้อัตโนมัติ พร้อมแสดงข้อความแจ้งสถานะสั้นๆ (Toast Notification)

### เกณฑ์การส่งมอบ (Deliverables)
- [ ] เปิดไฟล์บนอุปกรณ์ A เลื่อนไปหน้า 50 แล้วปิด
- [ ] เปิดไฟล์เดิมบนอุปกรณ์ B หน้าเว็บกระโดดไปหน้า 50 ให้ทันที

---

## Phase 4: ประสิทธิภาพการข้ามหน้าและการเรนเดอร์ (Virtualization & Navigation)

### เป้าหมาย
เปิดไฟล์ขนาด 100-1000 หน้าได้โดยไม่กิน RAM จนเบราว์เซอร์แครช และข้ามหน้าไปยังจุดใดก็ได้ทันที

### รายละเอียดการปฏิบัติงาน
1. **Virtual Container & Lazy Rendering:**
   * ดึงจำนวนหน้าทั้งหมดจาก `pdfDoc.numPages`
   * ดึง Viewport ของหน้าแรกมาเป็นขนาดอ้างอิง
   * สร้าง Container `<div>` จำลองความสูงรวมของเอกสารทั้งหมดล่วงหน้า
   * ประยุกต์ใช้ `IntersectionObserver` เพื่อตรวจจับว่าหน้าใดกำลังอยู่ในขอบเขตสายตา (Viewport):
     * **Visible:** วาด Canvas และเรนเดอร์เฉพาะหน้าที่กำลังมองเห็น (+/- 1 หน้า)
     * **Off-screen:** เคลียร์เนื้อหาใน Canvas (ลบ Object ออกจาก DOM) เพื่อคืนหน่วยความจำ (RAM)
2. **Direct Page Navigation:**
   * สร้างช่องป้อนเลขหน้าโดยตรงบน Toolbar เช่น `[ 450 ] / 600`
   * เมื่อกด Enter ให้คำนวณตำแหน่ง Scroll หรือเรียก `element.scrollIntoView()` กระโดดไปยังหน้านั้นทันที
3. **Scrubber / Slider Navigation:**
   * ทำแถบเลื่อนความคืบหน้าด้านล่างหน้าจอ ให้ผู้ใช้สามารถลากสไลด์ข้ามหน้าอย่างรวดเร็ว
4. **Outline / Table of Contents Drawer:**
   * เรียก `pdfDoc.getOutline()` ดึงสารบัญเอกสารมาแสดงผลในเมนูด้านข้าง
   * เมื่อคลิกหัวข้อสารบัญ ให้แปลง Destination เป็นเลขหน้าแล้วสั่งข้ามหน้าทันที

### เกณฑ์การส่งมอบ (Deliverables)
- [ ] ทดสอบเปิดไฟล์ขนาด 300+ หน้า หน่วยความจำของแท็บเบราว์เซอร์ไม่เพิ่มสูงเกิน 250 MB
- [ ] สั่งพิมพ์ข้ามจากหน้า 5 ไปหน้า 280 ได้ทันทีโดยไม่ค้าง

---

## Phase 5: ประสบการณ์ผู้ใช้บนมือถือและโหมดการอ่าน (Mobile UX & Features)

### เป้าหมาย
ปรับแต่ง Layout ให้เหมาะกับการอ่านบนสมาร์ทโฟน แท็บเล็ต และคอมพิวเตอร์อย่างสะดวกสบาย

### รายละเอียดการปฏิบัติงาน
1. **Responsive Viewport & Auto-Fit:**
   * ตั้งค่า Fit-to-Width อัตโนมัติบนหน้าจอมือถือ เพื่อให้ตัวหนังสือเต็มขอบจอโดยไม่ต้องคอยซูมเข้าออก
   * รองรับ Device Pixel Ratio (`window.devicePixelRatio`) เพื่อให้การเรนเดอร์ Canvas บนหน้าจอ Retina ชัดเจน ไม่เบลอ
2. **Auto-hide Controls:**
   * ซ่อน Toolbar ด้านบนและล่างอัตโนมัติเมื่อเริ่มเลื่อนอ่าน
   * แตะหน้าจอ 1 ครั้ง (Single Tap) เพื่อเรียกแถบควบคุมกลับมา
3. **Eye-Care Themes (Reading Modes):**
   * เพิ่มปุ่มสลับธีมถนอมสายตาผ่าน CSS Filters:
     * **Default Mode:** กระดาษสีขาวปกติ
     * **Sepia Mode:** โทนสีเหลืองนวลถนอมสายตา (`sepia(0.3) contrast(0.95)`)
     * **Dark Mode:** พื้นหลังมืด ตัวหนังสือสว่าง (`invert(0.9) hue-rotate(180deg)`)
4. **Screen Wake Lock API:**
   * เรียกใช้งาน `navigator.wakeLock.request('screen')` ขณะเปิดอ่านเอกสาร เพื่อป้องกันหน้าจอดับเองขณะเพ่งอ่านหนังสือเล่มหนา

### เกณฑ์การส่งมอบ (Deliverables)
- [ ] ใช้งานบนจอมือถือได้ลื่นไหล แถบเมนูซ่อน-แสดงตามจังหวะการสัมผัส
- [ ] หน้าจอไม่ดับระหว่างอ่าน และสลับธีม Sepia/Dark ได้ทันที

---

## Phase 6: การ Deploy และการบำรุงรักษา (Deployment & Maintenance)

### เป้าหมาย
นำระบบขึ้นโฮสติ้งฟรีอย่างปลอดภัย พร้อมแนวทางการบำรุงรักษาระยะยาว

### รายละเอียดการปฏิบัติงาน
1. **Production Deployment:**
   * อัปโหลด Source Code ขึ้น GitHub
   * ผูกเข้ากับ **Vercel**, **Cloudflare Pages** หรือ **GitHub Pages**
   * บังคับใช้งาน HTTPS เสมอ (OAuth 2.0 ปฏิเสธการรันบน HTTP ปกติ)
2. **Google Cloud Origin Update:**
   * นำ URL จริง (เช่น `https://my-pdf-reader.vercel.app`) ไปกรอกเพิ่มใน:
     * **Authorized JavaScript origins** ใน Cloud Console Credentials
3. **Session & Error Management:**
   * จัดการกรณี Access Token หมดอายุ (ปกติ 1 ชั่วโมง):
     * แสดง Modal แจ้งเตือน *"เซสชันหมดอายุ กรุณากดเข้าสู่ระบบใหม่"* พร้อมปุ่ม Re-auth ที่ไม่ทำให้หน้าอ่านปัจจุบันสูญหาย
   * ตรวจจับ Error กรณี Quota หรือ Permission หลุด

### เกณฑ์การส่งมอบ (Deliverables)
- [ ] เว็บไซต์ออนไลน์ ใช้งานได้จริงผ่าน URL บนมือถือและคอมพิวเตอร์
- [ ] ผ่านเกณฑ์ทดสอบฟรี 100% ไม่มีค่าบริการแอบแฝง

---

## แผนกำหนดเวลาและการประเมินความพยายาม (Timeline Estimation)

| Phase | หัวข้อหลัก | ระยะเวลาประเมิน (สำหรับ Dev 1 คน) |
|---|---|---|
| **Phase 1** | Setup Cloud Console & OAuth 2.0 Authentication | 1 - 2 วัน |
| **Phase 2** | Google Picker API & PDF.js Base Rendering | 2 - 3 วัน |
| **Phase 3** | Cross-Device Sync (`appProperties` + Local-First) | 2 วัน |
| **Phase 4** | Virtual Scroll & High-Speed Page Jumping | 3 - 4 วัน |
| **Phase 5** | Mobile Gestures, Reading Modes & Wake Lock | 2 วัน |
| **Phase 6** | Deployment to Vercel/GitHub Pages & Verification | 1 วัน |
| **รวม** | **ระบบพร้อมใช้งานเต็มรูปแบบ** | **ประมาณ 11 - 14 วัน** |