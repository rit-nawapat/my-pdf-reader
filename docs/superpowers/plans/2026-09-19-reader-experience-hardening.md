# PDF Reader Experience Hardening

## Goal

ทำให้ PDF Reader เหมาะกับการอ่านนิยายส่วนตัวเป็นหลัก: กลับมาอ่านต่อได้อย่างน่าเชื่อถือ, กระโดดหน้าในเอกสารยาวได้เร็ว, ไม่รบกวนสมาธิ, ซิงค์ข้ามอุปกรณ์อย่างโปร่งใส และทำงานได้ดีบนมือถือ

## Scope

- ปรับ flow การเปิดเล่มล่าสุดและ resume
- ปรับ navigation/capsule/scrubber
- ทำให้การบันทึกตำแหน่งอ่านทนต่อ refresh, ปิดแท็บ และสลับแอป
- แก้ identity ของไฟล์ local และความขัดแย้งของ state บน Drive
- เพิ่มความปลอดภัยของชื่อไฟล์และความถูกต้องของ input
- ลดภาระ DOM/rendering สำหรับ PDF ขนาดใหญ่
- ปรับ gesture, accessibility และ reduced motion
- ทำให้การอัปโหลด local PDF ขึ้น Drive เป็นการตัดสินใจที่ชัดเจนของผู้ใช้

## Non-goals

- ไม่เปลี่ยน PDF.js engine หรือย้ายไป framework ใหม่
- ไม่เพิ่ม backend/database ใหม่
- ไม่เปลี่ยนรูปแบบการเก็บไฟล์หลักของผู้ใช้จาก Google Drive
- ไม่ push หรือ deploy จนกว่าจะทดสอบครบตาม acceptance criteria

## Phase 1: Reading Resume Flow

### Behavior

1. แยกกรณี `refresh ระหว่างอ่าน` ออกจาก `เปิดเว็บใหม่` โดยใช้ navigation type และ session marker
2. เมื่อ refresh ระหว่างอ่าน ให้เปิดเล่มเดิมต่ออัตโนมัติ
3. เมื่อเปิดเว็บใหม่ ให้แสดง resume card บน shelf ก่อน โดยมี:
   - ชื่อหนังสือ
   - หน้าที่อ่านค้างไว้
   - ปุ่ม `อ่านต่อ`
   - ปุ่ม `เลือกหนังสืออื่น`
4. ห้ามเปิด file picker อัตโนมัติเมื่อ cache หาย
5. รอ Drive shelf sync ก่อนตัดสินใจ resume ถ้าผู้ใช้มี session และไฟล์ local cache ยังไม่พร้อม
6. ถ้าผู้ใช้เริ่มเปิดเล่มอื่นแล้ว ให้ยกเลิก auto-resume ทันที

### Implementation

- แยก `autoResumeTop()` เป็น `resumeLastSession()` และ `renderResumePrompt()`
- เพิ่ม session marker สำหรับ `activeReaderFile` และ `lastReaderPage`
- ป้องกัน race ระหว่าง `syncDriveShelf()` กับ local resume ด้วย request token/generation id
- ใช้ `pagehide` และ `visibilitychange` เป็นจุด flush state

### Acceptance criteria

- Refresh ระหว่างอ่านกลับเข้าหน้าเดิมโดยไม่ต้องเลือกเล่ม
- เปิดเว็บใหม่เห็น resume card และไม่ถูก hijack ทันที
- Cache หายแล้วไม่เด้ง file picker
- เปิดเล่มใหม่ก่อน resume สำเร็จแล้ว resume เก่าจะไม่เขียนทับ

## Phase 2: Navigation และ Bottom Capsule

### Behavior

1. คง capsule ไว้ด้านล่างตามการออกแบบล่าสุด
2. แสดงข้อมูลแบบกะทัดรัด ไม่ใช้ชื่อไฟล์เต็ม:
   - ปุ่มกลับ shelf
   - หน้า `current / total`
   - ปุ่มก่อนหน้า/ถัดไป
   - เมนูเพิ่มเติม
3. คืน fast navigation โดยฝัง accessible page scrubber ขนาดเล็กไว้ใน capsule หรือเมนูขยาย
4. ช่องเลขหน้าต้องรองรับ Enter, blur, Escape และค่าที่ไม่ถูกต้อง
5. เพิ่ม `aria-label`, `aria-expanded`, `aria-controls` และ focus state ให้ปุ่มทั้งหมด
6. เพิ่ม Escape เพื่อปิด flyout/sidebar และคืน focus ไปยังปุ่มต้นทาง

### Implementation

- ลบ CSS/JS scrubber ที่ dead code หรือย้าย logic ให้ใช้ control ใหม่จริง
- ให้ scrubber มี `input type="range"` ที่ keyboard ใช้ได้และมี label ที่อ่านได้
- ปรับตำแหน่ง toast/flyout ไม่ให้บัง capsule
- เพิ่ม reduced-motion CSS สำหรับผู้ใช้ที่เปิด `prefers-reduced-motion`

### Acceptance criteria

- เอกสาร 4,000+ หน้า กระโดดหน้าไกลได้ด้วยการลากหรือพิมพ์เลขหน้า
- ใช้ keyboard ผ่านทุก navigation control ได้
- capsule ไม่ทับเนื้อหาเกินจำเป็นบนมือถือ
- เปิด/ปิด flyout ด้วย Escape ได้และ focus ไม่หลุดไปหลัง drawer

## Phase 3: Reading State และ File Identity

### Behavior

1. บันทึก page + intra-page scroll offset
2. Flush state ทันทีเมื่อ tab ถูกซ่อน, pagehide, ก่อนเปลี่ยนไฟล์ และก่อนกลับ shelf
3. สร้าง stable local file fingerprint จาก metadata/content แทนชื่อ + ขนาดอย่างเดียว
4. แยก local identity กับ Drive identity ให้ชัดเจนหลัง upload
5. เมื่อ Drive มี state ใหม่กว่า ให้ใช้ timestamp ไม่ใช่เลือกจากเลขหน้าที่มากกว่า

### Implementation

- เพิ่ม state schema version สำหรับ migration ของ key เดิม
- เพิ่ม `lastReadAt`/revision ให้ local และ cloud state
- ปรับ `saveRecentFile`, IndexedDB key และ `currentFileKey` ให้ใช้ identity เดียวกัน
- หลัง local upload สำเร็จ ให้ migrate cache/shelf ไป Drive identity หรือเก็บ mapping ถาวร
- ทำ conflict resolution แบบ last-write-wins โดยใช้ timestamp พร้อม fallback ที่ deterministic
- รองรับ Drive API pagination ด้วย `nextPageToken`

### Acceptance criteria

- ปิดแทบทันทีหลังเลื่อนแล้วเปิดใหม่ ตำแหน่งล่าสุดยังอยู่
- PDF สองไฟล์ชื่อและขนาดเท่ากันไม่ใช้ตำแหน่งร่วมกัน
- เปิดไฟล์ local แล้วอัปโหลดขึ้น Drive จากนั้นเปิดอุปกรณ์อื่นได้โดยไม่เกิดรายการซ้ำ
- อ่านถอยหลังบนเครื่องหนึ่งไม่ถูก cloud state ที่เก่ากว่าทับเพียงเพราะเลขหน้ามากกว่า

## Phase 4: Privacy และ Security Hardening

### Behavior

1. แจ้งผู้ใช้ก่อนอัปโหลด local PDF ขึ้น Google Drive ครั้งแรก
2. มีสถานะต่อเล่มว่า `เฉพาะเครื่อง` หรือ `ซิงค์กับ Drive`
3. ให้ผู้ใช้เลือกจำการตัดสินใจได้
4. ไม่แสดงข้อมูล credential ใน UI อีกต่อไป

### Implementation

- เพิ่ม confirmation/setting แบบ opt-in สำหรับ local-to-Drive upload
- ใช้ `textContent` และ DOM property แทนการใส่ชื่อไฟล์ผ่าน `innerHTML`
- Escape ชื่อไฟล์ใน title/attribute ทุกจุดที่ยังจำเป็นต้องใช้ HTML template
- ตรวจสอบ MIME type และขนาดไฟล์ก่อน upload
- แสดง error ที่ผู้ใช้เข้าใจได้เมื่อ upload ไม่สำเร็จ

### Acceptance criteria

- เปิด local PDF ขณะล็อกอินแล้วผู้ใช้เห็นและยืนยันการ sync ก่อน upload
- ชื่อไฟล์ที่มี `<`, `>`, quote หรือ markup ไม่ทำให้ shelf เสียหรือ execute script
- ผู้ใช้ปิดการ sync แล้วไฟล์ยังอ่านต่อ local ได้ตามปกติ

## Phase 5: Performance และ Gesture

### Implementation

1. เปลี่ยน page placeholders เป็น windowed rendering เมื่อเอกสารเกิน threshold
2. สร้าง thumbnails เมื่อเปิด sidebar หรือเฉพาะช่วงใกล้ viewport
3. ใช้ render generation id เพื่อป้องกัน async render task เก่ามาเขียนทับเอกสารใหม่
4. ยกเลิก render task อย่างถูกต้องเมื่อเปลี่ยนไฟล์/zoom
5. debounce pinch zoom ให้ render จริงครั้งเดียวเมื่อ `touchend`
6. ล็อก gesture เป็นแกนตั้งหรือแกนนอนหลังผ่าน movement threshold
7. ไม่ใช้ horizontal swipe เปลี่ยนหน้าเมื่อ zoom เกิน fit width
8. ไม่ reset zoom เมื่อ resize จาก browser chrome/orientation เว้นแต่ผู้ใช้เลือก fit width

### Acceptance criteria

- PDF 500-1,000 หน้าเปิดและเลื่อนบนมือถือได้โดยไม่สร้าง DOM ครบทุกหน้า
- pinch zoom ไม่กระตุกและไม่กระโดดกลับหน้าอื่น
- เปลี่ยนไฟล์ระหว่าง render แล้วไม่มี canvas เก่าหรือหน้าว่างถาวร
- หมุนหน้าจอไม่ reset zoom โดยไม่จำเป็น

## Phase 6: Accessibility และ UX Polish

- เปลี่ยน recent cards/thumbnails จาก clickable `div` เป็น button/link ที่ semantic
- เพิ่ม tablist/tab/panel semantics ให้ sidebar
- เพิ่ม visible focus ring และ minimum text size ที่อ่านได้บนมือถือ
- เพิ่ม `aria-live` สำหรับสถานะกำลังโหลด, sync, upload และ error
- เพิ่มปุ่มหยุด/ยกเลิกงานที่ใช้เวลานานถ้าทำได้
- ตรวจ theme dark/sepia ไม่ใช้ invert กับ PDF โดยอัตโนมัติ; แยก UI theme กับ page filter
- ตรวจ contrast และ touch target อย่างน้อย 44px

## Test Plan

### Functional

- เปิด local PDF, อ่าน, refresh, ปิดแท็บ, เปิดใหม่
- เปิด Drive PDF บนเครื่อง A และอ่านต่อบนเครื่อง B
- เปิด local PDF ที่ชื่อ/ขนาดเหมือนกันสองไฟล์
- อ่านถอยหลังและทดสอบ conflict ระหว่างสองเครื่อง
- cache ถูกล้าง, IndexedDB ใช้ไม่ได้, offline, token หมดอายุ

### Performance

- PDF 100, 500 และ 1,000+ หน้า
- mobile viewport 360px และ desktop 1440px
- pinch zoom, orientation change, browser chrome expand/collapse
- ตรวจจำนวน DOM nodes, render task ที่ค้าง และ memory เบื้องต้น

### Accessibility

- keyboard-only navigation
- screen reader labels/states
- Escape/focus restore ของ flyout/sidebar
- reduced-motion และ contrast mode

### Security

- filename ที่มี HTML/script payload
- filename ที่มี quote/backslash/unicode
- upload MIME/size validation
- ตรวจว่า credential ไม่ถูกเขียนลง source หรือ console

## Delivery Order

1. Phase 1 + Phase 3: resume/state correctness
2. Phase 2: navigation และ scrubber
3. Phase 4: privacy/security
4. Phase 5: large-document performance
5. Phase 6: accessibility/polish

แต่ละ phase ต้องผ่าน test ที่เกี่ยวข้องก่อนเริ่ม phase ถัดไป และยังไม่ push/deploy จนกว่าจะผ่าน regression test ทั้งชุด
