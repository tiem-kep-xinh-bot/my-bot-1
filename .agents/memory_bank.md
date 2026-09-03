# Memory Bank - Dự án Chatbot Facebook Tiệm Kẹp Xinh

### 4.1. Mục đích dự án
- Mô tả: Hệ thống chatbot thông minh, tự động hóa trả lời Fanpage Facebook bán hàng kẹp tóc bằng mô hình Gemini 3.6 Flash. Dữ liệu sản phẩm được lấy động từ Google Sheets với chi phí vận hành 0 VNĐ.
- Đối tượng sử dụng: Khách hàng nhắn tin tới Fanpage "Tiệm Kẹp Xinh".
- Công nghệ chính: Node.js, Express, Axios, Gemini API (Google Generative AI), Meta Graph API (Facebook Messenger Webhook).

### 4.2. Kế hoạch chi tiết
1. **Giai đoạn 1: Khởi tạo dự án (AI thực hiện)**
   - Cài đặt thư viện (npm install).
   - Khởi tạo Git repository.
   - Tạo file `.env` mẫu.
2. **Giai đoạn 2: Lấy dữ liệu & API (Người dùng thực hiện)**
   - Tạo Google Sheets và lấy link CSV.
   - Lấy Gemini API Key.
   - Cung cấp thông tin để điền vào `.env`.
3. **Giai đoạn 3: Chạy test cục bộ & Kết nối Facebook (Phối hợp)**
   - Chạy server local và dùng ngrok.
   - Cấu hình Facebook Developers (App, Messenger, Webhook).
   - Test nhắn tin trực tiếp trên Fanpage.
4. **Giai đoạn 4: Triển khai lên Render.com**
   - Đẩy code lên GitHub.
   - Kết nối GitHub với Render.com để treo server 24/7.

### 4.3. Tiến độ dự án
- [x] Đọc và phân tích mã nguồn hiện tại của dự án.
- `[x]` Giai đoạn 1: Khởi tạo dự án (AI thực hiện).
- `[x]` Giai đoạn 2: Lấy dữ liệu & API (Người dùng thực hiện).
- `[/]` Giai đoạn 3: Chạy test cục bộ & Kết nối Facebook (Đang mắc ở Bước 5 & 6 cấu hình Facebook App. Sẽ tiếp tục vào phiên làm việc tối nay).
- `[ ]` Giai đoạn 4: Triển khai 24/7 lên Render.com.

### 4.4. Tiến độ phiên làm việc hiện tại (Tạm dừng)
- **Tình trạng:** Dự án đã cài đặt xong Node.js, Git, thư viện. Đã cấu hình xong `.env` (CSV và Gemini API Key).
- **Vấn đề tồn đọng:** Người dùng đang mắc ở phần cấu hình Facebook Developers (Bước 5 và 6).
- **Lưu ý cho phiên tiếp theo:** Vì Cloudflare tunnel là dạng tạm thời, khi mở lại phiên làm việc cần chạy lại lệnh tunnel để lấy link Webhook mới trước khi hướng dẫn tiếp Bước 5 và 6. Server node cũng cần được khởi động lại.

### 4.4. Thông tin bổ sung
- **Cấu trúc thư mục:**
  - `server.js`: File xử lý logic chính (webhook, webhook verification, gọi API Gemini, gửi tin nhắn).
  - `prompt-system.md`: Chứa System Prompt cho Gemini.
  - `README.md` & `package.json`: Thông tin dự án và dependencies.
  - `.env.example`: Cấu hình môi trường.
- **Quyết định thiết kế / Logic hoạt động:**
  - Bộ đệm tin nhắn (`messageBuffers`): Gom nhóm nhiều tin nhắn văn bản và ảnh của người dùng gửi liên tiếp trong vòng 2.5s trước khi gọi Gemini API.
  - Xử lý ảnh đa phương thức (Multimodal): Chuyển đổi ảnh nhận được từ Facebook thành định dạng base64 `image/jpeg` để truyền vào Gemini.
  - Tự động lấy dữ liệu kho hàng: Tải file CSV từ Google Sheets 5 phút một lần để làm ngữ cảnh dữ liệu sản phẩm.
  - Cú pháp ảnh trả về: Xử lý chuỗi `[IMAGE: url]` từ phản hồi của Gemini để tách và gửi tin nhắn hình ảnh đính kèm (attachment) một cách mượt mà.
  - Quản lý trạng thái: Sử dụng `humanTakeoverMap` để tạm dừng bot trong 5 phút khi có nhân viên can thiệp (is_echo message không có app_id).
