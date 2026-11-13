# HƯỚNG DẪN VẬN HÀNH: HỆ THỐNG TỰ ĐỘNG BẮT ĐƠN VÀ ĐẨY EXCEL SPX EXPRESS

Chào bạn! Dưới đây là tài liệu chi tiết hướng dẫn vận hành hệ thống bắt đơn tự động âm thầm cho Facebook Fanpage kết hợp xuất đơn sang **SPX Express (spx.vn)**.

---

## I. NGUYÊN LÝ HOẠT ĐỘNG
1. **Bạn và khách nhắn tin bình thường trên Messenger:**
   - Bot hoàn toàn **im lặng**, không tự động trả lời làm phiền khách.
   - Bạn tự do tư vấn, gửi ảnh, báo giá và chốt đơn tự nhiên.
2. **Kích hoạt tự động lên đơn (2 cách):**
   - **Cách 1 (Tự động):** Khách gửi tin nhắn chứa **Số điện thoại (10 số)** kèm thông tin địa chỉ (quận, huyện, xã, tỉnh, đường...) $\rightarrow$ Hệ thống tự động nhận diện và gửi đoạn chat sang Gemini bóc tách.
   - **Cách 2 (Thủ công chủ động):** Sau khi chốt đơn với khách, bạn chỉ cần gõ tin nhắn chứa `#chot` (hoặc `#chotdon`) $\rightarrow$ Hệ thống lập tức quét toàn bộ hội thoại và trích xuất đơn hàng ngay lập tức.
3. **Lưu trữ đơn hàng:**
   - Đơn hàng được tự động trích xuất thành các trường chuẩn của SPX: *Mã đơn, Tên người nhận, SĐT, Tỉnh/Thành, Quận/Huyện, Phường/Xã, Địa chỉ chi tiết, Tên sản phẩm & số lượng, Tiền thu hộ COD, Ghi chú*.
   - Đơn được đẩy thẳng lên **Google Sheets** (sheet `DonHang`) và luôn lưu 1 bản dự phòng trong file `orders_backup.json` tại máy chủ để đảm bảo **không bao giờ bị mất đơn**.

---

## II. HƯỚNG DẪN KẾT NỐI GOOGLE SHEETS TRONG 2 PHÚT

Để đơn hàng tự động nhảy vào Google Sheets của bạn:

### Bước 1: Mở Google Sheet và dán mã
1. Mở file Google Sheets bạn muốn lưu đơn (có thể dùng chung file sản phẩm hoặc tạo file mới).
2. Trên thanh menu, chọn: **Tiện ích mở rộng (Extensions)** $\rightarrow$ **Apps Script**.
3. Xóa hết code mặc định trong đó, mở file [google_apps_script.js](file:///d:/Dự%20án%20chat%20bot%20faceboook/google_apps_script.js) trong dự án này, copy toàn bộ nội dung và dán vào.
4. Bấm biểu tượng **Lưu (Save)**.

### Bước 2: Triển khai Web App (Deploy)
1. Ở góc trên bên phải của Apps Script, bấm **Triển khai (Deploy)** $\rightarrow$ **Tùy chọn triển khai mới (New deployment)**.
2. Chọn loại: biểu tượng bánh răng $\rightarrow$ **Ứng dụng web (Web app)**.
   - **Mô tả:** Webhook Bắt Đơn SPX
   - **Thực thi dưới dạng (Execute as):** Tôi (*tài khoản Google của bạn*)
   - **Ai có quyền truy cập (Who has access):** **Bất kỳ ai (Anyone)** *(Lưu ý: Bắt buộc chọn Anyone để server Node.js có quyền gửi dữ liệu đơn hàng vào)*.
3. Bấm **Triển khai (Deploy)** $\rightarrow$ Cấp quyền (Authorize access) khi Google yêu cầu.
4. Sao chép **URL ứng dụng web** (có dạng `https://script.google.com/macros/s/.../exec`).

### Bước 3: Dán vào file `.env`
Mở file [.env](file:///d:/Dự%20án%20chat%20bot%20faceboook/.env) và thêm dòng:
```env
ORDER_SHEET_WEBHOOK_URL=https://script.google.com/macros/s/DAN_LINK_CUA_BAN_VAO_DAY/exec
```

---

## III. QUY TRÌNH ĐẨY ĐƠN HÀNG LOẠT LÊN SPX EXPRESS (SPX.VN)

Hằng ngày (hoặc trước mỗi ca lấy hàng của bưu tá SPX):
1. Bạn mở bảng tính Google Sheets của bạn $\rightarrow$ Chọn tab `DonHang`.
2. Trên thanh menu Google Sheets, bấm: **Tệp (File)** $\rightarrow$ **Tải xuống (Download)** $\rightarrow$ **Microsoft Excel (.xlsx)**.
3. Truy cập website: [https://spx.vn/](https://spx.vn/) $\rightarrow$ Đăng nhập tài khoản shop.
4. Vào mục **Tạo đơn hàng loạt (Batch Create Orders)** $\rightarrow$ Tải file `.xlsx` vừa tải về lên.
5. Hệ thống SPX sẽ tự động kiểm tra địa chỉ và sinh toàn bộ mã vận đơn chỉ trong vài giây! Bạn chỉ việc bấm In phiếu gửi hoặc đợi shipper SPX qua lấy hàng.

---

## IV. CÁC LỆNH VÀ CÚ PHÁP TIỆN LỢI TRONG CHAT
- Khi chat với khách, bạn có thể gõ bất kỳ câu nào có chứa từ khóa:
  - `#chot`
  - `#chotdon`
  - `#lendon`
  *Ví dụ:* `"Dạ em cảm ơn chị nhiều ạ #chot"`, `"Chị chờ em xíu em đóng hàng gửi chị nha #chotdon"`.
- Hệ thống sẽ tự động lọc bỏ chữ `#chot` và bóc tách các thông tin trước đó để lên đơn!

