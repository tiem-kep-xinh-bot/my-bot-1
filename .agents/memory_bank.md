# Memory Bank - Dự án Chatbot Facebook Tiệm Kẹp Xinh

### 4.1. Mục đích dự án
- Mô tả: Hệ thống chatbot thông minh, tự động hóa trả lời Fanpage Facebook bán hàng kẹp tóc bằng mô hình Gemini 2.0 Flash. Dữ liệu sản phẩm được lấy động từ Google Sheets với chi phí vận hành 0 VNĐ.
- Đối tượng sử dụng: Khách hàng nhắn tin tới Fanpage "Tiệm Kẹp Xinh".
- Công nghệ chính: Node.js, Express, Axios, Gemini API (Google Generative AI), Meta Graph API (Facebook Messenger Webhook).

### 4.2. Kế hoạch chi tiết
1. **Giai đoạn 1: Khởi tạo dự án (AI thực hiện)** ✅
2. **Giai đoạn 2: Lấy dữ liệu & API (Người dùng thực hiện)** ✅
3. **Giai đoạn 3: Chạy test cục bộ & Kết nối Facebook** ✅
4. **Giai đoạn 4: Triển khai lên Render.com** ✅
5. **Giai đoạn 5: Sửa lỗi & Tối ưu** 🔄

### 4.3. Tiến độ dự án
- [x] Giai đoạn 1-4: Hoàn thành. Bot đã chạy trên Render, kết nối Facebook thành công.
- [x] Bot đã nhận tin nhắn, gửi typing indicator, trả lời được (nhưng không ổn định).
- [x] Sửa lỗi Gemini API (phiên 04/09/2026 tối):
  - Đổi model từ `gemini-3.6-flash` (không tồn tại) sang `gemini-2.0-flash`.
  - Sửa field name từ `systemInstruction` sang `system_instruction` (đúng REST API spec).
  - Bỏ `role: "system"` trong systemInstruction object (không cần cho REST API).
  - Thêm hàm `callGeminiWithRetry()` - tự động retry khi bị rate-limit (429) hoặc server error (500/503) với exponential backoff (1s, 2s, 4s, max 8s).
  - Thêm timeout 30s cho Gemini API, 10s cho Google Sheets và download ảnh.
  - Cải thiện error logging: in đầy đủ response status + body từ API lỗi.
  - Thêm check `candidates` trống trước khi truy cập `replyText`.
  - Thêm check `cleanText` không rỗng trước khi gửi tin nhắn text.

### 4.4. Việc cần làm tiếp
- [ ] Push code mới lên GitHub → Render tự động deploy.
- [ ] Test lại bot trên Fanpage để xác nhận trả lời ổn định.
- [ ] Kiểm tra log trên Render Dashboard xem còn lỗi nào không.
- [ ] Dọn file rác (`cf_tunnel.log`, `cloudflared.log`, `lhr.log`, `tunnel_url.txt`, `lt.js`).

### 4.5. Thông tin bổ sung
- **Cấu trúc thư mục:**
  - `server.js`: File xử lý logic chính (webhook, webhook verification, gọi API Gemini, gửi tin nhắn).
  - `prompt-system.md`: Chứa System Prompt cho Gemini (file tham khảo, logic thực tế nằm trong server.js).
  - `README.md` & `package.json`: Thông tin dự án và dependencies.
  - `.env.example`: Cấu hình môi trường.
- **Quyết định thiết kế / Logic hoạt động:**
  - Bộ đệm tin nhắn (`messageBuffers`): Gom nhóm nhiều tin nhắn gửi liên tiếp trong 2.5s.
  - Xử lý ảnh đa phương thức (Multimodal): base64 `image/jpeg` → Gemini.
  - Tự động lấy dữ liệu kho hàng: CSV từ Google Sheets mỗi 5 phút.
  - Cú pháp ảnh trả về: `[IMAGE: url]` → tách gửi riêng attachment.
  - Human takeover: Tạm dừng bot 5 phút khi nhân viên can thiệp.
  - **MỚI:** Retry mechanism với exponential backoff cho Gemini API.
  - **MỚI:** Timeout cho tất cả HTTP calls (Gemini 30s, Sheets/Image 10s).
- **Gemini API Key:** Format `AQ.Ab8RN6J...` - đã xác nhận hoạt động.
- **Model:** `gemini-2.0-flash` (v1beta endpoint).
