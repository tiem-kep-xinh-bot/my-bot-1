/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: TỰ ĐỘNG GHI ĐƠN HÀNG SPX TỪ WEBHOOK NODE.JS
 * =========================================================================
 * 
 * HƯỚNG DẪN CÀI ĐẶT TRONG 1 PHÚT:
 * 1. Mở file Google Sheets quản lý đơn hàng của bạn.
 * 2. Trên thanh menu, chọn: Tiện ích mở rộng (Extensions) -> Apps Script.
 * 3. Xóa hết code cũ trong đó và dán toàn bộ đoạn mã bên dưới vào.
 * 4. Bấm "Triển khai" (Deploy) -> "Tùy chọn triển khai mới" (New deployment).
 * 5. Chọn loại: "Ứng dụng web" (Web app).
 *    - Mô tả: Webhook Đơn Hàng SPX
 *    - Thực thi dưới dạng (Execute as): Tôi (tài khoản của bạn)
 *    - Ai có quyền truy cập (Who has access): Bất kỳ ai (Anyone)  <--- BẮT BUỘC ĐỂ NHẬN ĐƯỢC POST TỪ NODEJS
 * 6. Bấm "Triển khai" (Deploy) -> Cấp quyền truy cập nếu Google hỏi.
 * 7. Sao chép "URL ứng dụng web" (Web App URL) và dán vào file .env:
 *    ORDER_SHEET_WEBHOOK_URL=https://script.google.com/macros/s/.../exec
 * =========================================================================
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // Khoa 10 giay de tranh xung dot khi co nhieu don dong thoi

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("DonHang");

    // Neu chua co sheet "DonHang", tu dong tao moi va chen tieu de chuan SPX
    if (!sheet) {
      sheet = ss.insertSheet("DonHang");
      var headers = [
        "Mã đơn hàng",
        "Tên người nhận",
        "Số điện thoại",
        "Tỉnh / Thành phố",
        "Quận / Huyện",
        "Phường / Xã",
        "Địa chỉ chi tiết",
        "Tên sản phẩm",
        "Khối lượng (g)",
        "Tiền thu hộ COD (VNĐ)",
        "Giá trị hàng hóa (VNĐ)",
        "Ghi chú giao hàng",
        "Thời gian tạo",
        "Facebook PSID"
      ];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e0f2fe");
      sheet.setFrozenRows(1);
    }

    var data = JSON.parse(e.postData.contents);

    // Chuan hoa so dien thoai (them dau nhay don de khong bi mat so 0 dau)
    var phoneStr = data.phone ? String(data.phone).trim() : "";
    if (phoneStr && !phoneStr.startsWith("'")) {
      phoneStr = "'" + phoneStr;
    }

    // Chen dong du lieu moi
    sheet.appendRow([
      data.orderCode || ("TKX_" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd_HHmmss")),
      data.customerName || "Khách Facebook",
      phoneStr,
      data.province || "",
      data.district || "",
      data.ward || "",
      data.addressDetail || "",
      data.productName || "Kẹp tóc",
      data.weight || 150,
      data.codAmount || 0,
      data.itemValue || data.codAmount || 0,
      data.note || "Cho xem hàng, không cho thử",
      data.createdAt || Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss"),
      data.psid || ""
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Da them don hang thanh cong",
      orderCode: data.orderCode
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Webhook SPX Google Sheets is active!");
}

