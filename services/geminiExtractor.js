const axios = require("axios");

const GEMINI_TIMEOUT_MS = 25000;
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"];

/**
 * Goi Gemini de trich xuat thong tin don hang tu cuoc hoi thoai
 * @param {Array<{sender: string, text: string}>} messages - Danh sach tin nhan gan nhat
 * @param {string} catalogContext - Danh muc san pham va gia de doi chieu (neu co)
 * @returns {Promise<Object>} Object JSON thong tin don hang
 */
async function extractOrderFromConversation(messages, catalogContext = "") {
  if (!messages || messages.length === 0) {
    return { has_valid_order: false, reason: "NO_MESSAGES" };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[Gemini Extractor] Thieu GEMINI_API_KEY trong bien moi truong.");
    return { has_valid_order: false, reason: "MISSING_API_KEY" };
  }

  // Chuyen danh sach tin nhan thanh doan van hoi thoai
  const conversationTranscript = messages
    .map(m => `[${m.sender}]: ${m.text}`)
    .join("\n");

  const prompt = `Bạn là hệ thống AI trích xuất thực thể đơn hàng (Order Entity Extractor) chuyên nghiệp cho cửa hàng trực tuyến tại Việt Nam.

Nhiệm vụ: Đọc kỹ cuộc trò chuyện giữa Khách hàng và Shop dưới đây để bóc tách thông tin giao hàng sang định dạng JSON chuẩn phục vụ đẩy đơn hàng loạt cho đơn vị vận chuyển SPX Express.

--- DANH MỤC SẢN PHẨM & GIÁ THAM KHẢO (NẾU CÓ) ---
${catalogContext || "Chưa có danh mục cụ thể"}

--- NỘI DUNG CUỘC TRÒ CHUYỆN ---
${conversationTranscript}

--- QUY TẮC BÓC TÁCH & CHUẨN HÓA CHO SPX EXPRESS ---
1. has_valid_order: Bắt buộc trả về true NẾU cuộc trò chuyện có đủ tối thiểu:
   - Số điện thoại hợp lệ (10 chữ số tại VN).
   - Địa chỉ giao hàng (ít nhất có thông tin Tỉnh/Thành phố hoặc địa chỉ cụ thể).
   - Tên sản phẩm cần mua.
   Nếu thiếu một trong các thông tin trên (ví dụ chỉ mới hỏi thăm, chưa cho địa chỉ hoặc chưa cho SĐT), trả về false.
2. customer_name: Họ tên người nhận hàng. Nếu khách không nói rõ họ tên, lấy xưng hô hoặc để "Khách hàng".
3. phone: Số điện thoại nhận hàng. Chuẩn hóa về chuỗi 10 chữ số bắt đầu bằng 0 (VD: "0988776655").
4. Địa chỉ bắt buộc tách làm 4 trường riêng biệt để khớp với mẫu SPX:
   - province: Tỉnh / Thành phố trực thuộc trung ương (VD: "Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Bình Dương"...)
   - district: Quận / Huyện / Thị xã / TP thuộc tỉnh (VD: "Cầu Giấy", "Huyện Thanh Trì", "TP. Thủ Đức"...)
   - ward: Phường / Xã / Thị trấn (VD: "Dịch Vọng", "Phường Bến Nghé", "Xã Vĩnh Lộc A"...)
   - address_detail: Số nhà, ngõ ngách, tên đường, thôn xóm (VD: "Số 45 ngõ 195 đường Cầu Giấy")
5. product_name: Tóm tắt các sản phẩm và số lượng khách đặt (VD: "1 Kẹp càng cua hoa sứ trắng, 1 kẹp nơ nhung đỏ").
6. cod_amount: Tổng số tiền thu hộ COD (kiểu number). Nếu trong chat đã báo tổng tiền (gồm cả tiền hàng và ship nếu có), điền số tiền đó. Nếu không có, điền 0.
7. weight: Khối lượng gói hàng tính bằng gram (mặc định 150).
8. note: Ghi chú giao hàng nếu khách có dặn (VD: "Cho kiểm tra hàng trước", "Giao giờ hành chính"). Mặc định: "Cho xem hàng, không cho thử".

YÊU CẦU ĐẦU RA: Bắt buộc trả về DUY NHẤT một chuỗi JSON hợp lệ (không kèm dấu backtick markdown \`\`\`json) theo đúng schema sau:
{
  "has_valid_order": true,
  "customer_name": "...",
  "phone": "...",
  "province": "...",
  "district": "...",
  "ward": "...",
  "address_detail": "...",
  "product_name": "...",
  "cod_amount": 0,
  "weight": 150,
  "note": "..."
}`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: "application/json"
    }
  };

  // Thu lan luot cac model flash on dinh
  const candidateModels = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL, ...MODELS] : MODELS;

  for (const model of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await axios.post(url, payload, { timeout: GEMINI_TIMEOUT_MS });
      const candidates = response.data?.candidates;
      if (candidates && candidates.length > 0 && candidates[0].content) {
        const text = candidates[0].content.parts[0].text.trim();
        // Xoa markdown backticks neu co
        const cleanJson = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        const parsed = JSON.parse(cleanJson);
        return parsed;
      }
    } catch (err) {
      const status = err.response?.status;
      console.warn(`[Gemini Extractor] Model ${model} loi (status ${status || 'N/A'}): ${err.message}. Dang thu tiep...`);
    }
  }

  return { has_valid_order: false, error: "ALL_MODELS_FAILED" };
}

module.exports = {
  extractOrderFromConversation
};
