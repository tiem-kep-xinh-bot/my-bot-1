# Memory Bank - Dự án Chatbot Facebook Tiệm Kẹp Xinh

### 4.1. Mục đích dự án
- **Mô tả:** Hệ thống trợ lý âm thầm bắt đơn tự động (Silent Order Capture) từ tin nhắn Messenger Fanpage Facebook "Tiệm Kẹp Xinh", hỗ trợ 100% khách hàng ngoài/khách lạ thông qua cầu nối **AhaChat** (Meta Business Partner).
- **Cách thức hoạt động:** 
  - Fanpage được kết nối qua AhaChat $\rightarrow$ AhaChat tiếp nhận 100% tin nhắn của mọi khách hàng (không bị Meta chặn ở Dev mode).
  - AhaChat chuyển tiếp tin nhắn qua Webhook (`/ahachat-webhook`) sang server Node.js trên Render.
  - Người thật (chủ shop / nhân viên) trò chuyện, tư vấn và chốt đơn tự nhiên với khách hàng.
  - Hệ thống tự động ghi nhận hội thoại, khi phát hiện tín hiệu chốt đơn (SĐT + Địa chỉ hoặc nhân viên gõ lệnh `#chot`), hệ thống sẽ gửi ngữ cảnh hội thoại cho Gemini API để trích xuất dữ liệu có cấu trúc (JSON).
  - Tự động ghi đơn hàng vào Google Sheets theo đúng định dạng mẫu file Excel nhập hàng loạt của **SPX Express (spx.vn)**.
  - Hàng ngày chỉ cần 1 thao tác tải file Excel từ Google Sheets về và tải lên spx.vn để tạo mã vận đơn hàng loạt.
- **Công nghệ chính:** Node.js, Express, Axios, Gemini API (`gemini-3.5-flash-lite`), AhaChat Webhook Bridge, Google Sheets (Apps Script Webhook / CSV).

### 4.2. Kế hoạch chi tiết
1. **Bước 1: Thiết lập cấu trúc Google Sheet & Webhook ghi đơn** [x]
   - Thiết kế các cột chuẩn mẫu nhập đơn hàng loạt của SPX Express.
   - Cung cấp mã Google Apps Script trong `google_apps_script.js` để nhận đơn và ghi dòng mới vào Sheet.
   - Tạo module `services/sheetService.js` để đẩy dữ liệu lên Google Sheets và lưu bản sao dự phòng `orders_backup.json`.
2. **Bước 2: Xây dựng module Gemini Extractor** [x]
   - Tạo file `services/geminiExtractor.js`.
   - Cấu hình prompt chuyên dụng bóc tách: Họ tên, Số điện thoại, Địa chỉ chi tiết, Tỉnh/Thành, Quận/Huyện, Phường/Xã, Tên sản phẩm, Số lượng, Tiền COD, Ghi chú.
   - Tối ưu dùng `gemini-3.5-flash-lite` cho tốc độ xử lý ~1.1s và ổn định tuyệt đối (không bị lỗi 503).
3. **Bước 3: Cập nhật Webhook Server (`server.js`) & Cổng AhaChat** [x]
   - Thêm endpoint `/ahachat-webhook` tiếp nhận sự kiện từ AhaChat.
   - Lưu trữ ngữ cảnh tin nhắn giữa khách và shop (15 tin nhắn gần nhất).
   - Bắt trigger tự động: Khách gửi SĐT (10 số) kèm từ khóa địa chỉ (debounce 4s).
   - Bắt trigger thủ công: Nhân viên gõ lệnh `#chot`, `#chotdon`, `#lendon`.
   - Cơ chế chống trùng đơn (khoá trùng đơn trong 15 phút).
   - Chế độ im lặng (Silent mode): không gửi tin nhắn tự động ra chat Messenger.
4. **Bước 4: Kết nối AhaChat & Kiểm thử thực tế** [/]
   - Đẩy code lên GitHub/Render.
   - Cấu hình chuyển tiếp Webhook trên AhaChat sang `/ahachat-webhook`.
   - Kiểm thử thực tế với khách hàng ngoài.

### 4.3. Tiến độ dự án
- [x] Thống nhất định hướng dự án với người dùng.
- [x] Bước 1: Google Sheet Service & Google Apps Script Webhook.
- [x] Bước 2: Gemini Extractor (Structured JSON).
- [x] Bước 3: Cập nhật `server.js` (Bộ đệm tin nhắn, Auto trigger, Manual trigger #chot, Silent mode).
- [x] Bước 3.1: Bổ sung endpoint `/ahachat-webhook` để hỗ trợ 100% khách hàng ngoài qua AhaChat.
- [/] Đang tiến hành Bước 4: Hướng dẫn kết nối AhaChat và kiểm thử thực tế.

### 4.4. Thông tin bổ sung
- **Hệ thống vận chuyển mục tiêu:** SPX Express ngoài sàn (`spx.vn`).
- **Mẫu Excel SPX Express bao gồm:**
  1. Mã đơn hàng (Shop Order ID - VD: `TKX_261113_570`)
  2. Tên người nhận
  3. Số điện thoại người nhận (được thêm tiền tố `'` để không mất số 0 đầu)
  4. Tỉnh / Thành phố
  5. Quận / Huyện
  6. Phường / Xã
  7. Địa chỉ chi tiết (Số nhà, đường...)
  8. Tên sản phẩm & số lượng
  9. Khối lượng (gram - mặc định 150g)
  10. Tiền thu hộ COD (VNĐ)
  11. Giá trị hàng hóa
  12. Ghi chú đơn hàng / Ghi chú cho shipper
  13. Thời gian tạo
  14. Facebook PSID (đối soát khi cần)
- **Tài liệu hướng dẫn:** Xem chi tiết tại [HUONG_DAN_SU_DUNG.md](file:///d:/Dự%20án%20chat%20bot%20faceboook/HUONG_DAN_SU_DUNG.md).
