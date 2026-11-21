// Tu dong nap file .env neu chua co trong bien moi truong
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = (match[2] || "").trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}
loadEnv();

const express = require("express");
const axios = require("axios");
const { extractOrderFromConversation } = require("./services/geminiExtractor");
const { appendOrderToSheet } = require("./services/sheetService");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "MY_VERIFY_TOKEN_123";
const SHEET_CSV_URL = process.env.SHEET_CSV_URL;

// Luu tru lich su hoi thoai trong bo nho (toi da 15 tin nhan gan nhat moi khach)
// Key: customerPsid, Value: [{ sender: "Khách hàng" | "Shop", text: string, timestamp: number }]
const conversationHistory = new Map();

// Timer gom tin nhan de tu dong phan tich (debounce)
const autoTriggerTimers = new Map();

// Danh sach don hang vua len de chong trung lap (khoa trong 15 phut)
// Key: customerPsid, Value: { orderCode: string, timestamp: number }
const recentOrders = new Map();

// Cache danh muc san pham tu Google Sheets (neu co)
let productCatalogCache = "";
let lastCatalogFetchTime = 0;

/**
 * Lay danh muc san pham de Gemini doi chieu
 */
async function getCatalog() {
  if (!SHEET_CSV_URL) return "";
  const now = Date.now();
  if (!productCatalogCache || now - lastCatalogFetchTime > 10 * 60 * 1000) {
    try {
      const res = await axios.get(SHEET_CSV_URL, { timeout: 10000 });
      productCatalogCache = res.data;
      lastCatalogFetchTime = now;
      console.log("[Catalog] Da cap nhat cache danh muc san pham.");
    } catch (err) {
      console.warn("[Catalog] Khong tai duoc Sheet danh muc:", err.message);
    }
  }
  return productCatalogCache;
}

/**
 * Ghi nhan tin nhan vao lich su cuoc tro chuyen
 */
function recordMessage(customerPsid, sender, text) {
  if (!text || !text.trim()) return;

  if (!conversationHistory.has(customerPsid)) {
    conversationHistory.set(customerPsid, []);
  }

  const history = conversationHistory.get(customerPsid);
  history.push({
    sender: sender,
    text: text.trim(),
    timestamp: Date.now()
  });

  // Chi giu toi da 15 tin nhan gan nhat
  if (history.length > 15) {
    history.shift();
  }
}

/**
 * Kiem tra tin nhan co chua so dien thoai va tu khoa dia chi khong
 */
function containsPhoneAndAddress(customerPsid) {
  const history = conversationHistory.get(customerPsid) || [];
  // Gom noi dung cac tin nhan gan nhat tu phia khach hang
  const customerTexts = history
    .filter(m => m.sender === "Khách hàng")
    .slice(-4)
    .map(m => m.text)
    .join(" ");

  // Regex tim so dien thoai VN (10 so bat dau bang 0 hoac +84)
  const phoneRegex = /(?:0|\+84)(?:3[2-9]|5[2689]|7[06-9]|8[1-9]|9\d)\d{7}\b/;
  // Regex tim tu khoa dia chi
  const addressRegex = /(phường|xã|quận|huyện|tỉnh|thành phố|\btp\b|đường|ngõ|ngách|thôn|ấp|xóm|số nhà|toà|tòa|chung cư|kđt|p\.|q\.)/i;

  return phoneRegex.test(customerTexts) && addressRegex.test(customerTexts);
}

/**
 * Xu ly tao don hang tu doan hoi thoai
 */
async function processOrderCreation(customerPsid, triggerType, force = false) {
  // Kiem tra chong trung lap: Neu vua len don trong 15 phut va khong phai lenh #chot bat buoc
  const lastOrder = recentOrders.get(customerPsid);
  if (!force && lastOrder && (Date.now() - lastOrder.timestamp < 15 * 60 * 1000)) {
    console.log(`[Order Ignored] Khach ${customerPsid} vua duoc len don ${lastOrder.orderCode}. Bo qua de tranh trung don.`);
    return;
  }

  const history = conversationHistory.get(customerPsid) || [];
  if (history.length === 0) {
    console.log(`[Order Extractor] Khong co tin nhan de trich xuat cho ${customerPsid}`);
    return;
  }

  console.log(`\n--------------------------------------------------`);
  console.log(`[Order Processing] Kich hoat boi: ${triggerType} cho khach PSID: ${customerPsid}`);
  console.log(`Dang phan tich ${history.length} tin nhan gan nhat qua Gemini...`);

  const catalog = await getCatalog();
  const extracted = await extractOrderFromConversation(history, catalog);

  if (!extracted || !extracted.has_valid_order) {
    if (force) {
      console.log(`[Lệnh #chot] Chưa đủ thông tin cần thiết (cần tối thiểu SĐT, Địa chỉ, Sản phẩm).`);
    } else {
      console.log(`[Auto Detect] Chưa đủ điều kiện tạo đơn (chưa có đủ SĐT/Địa chỉ/Sản phẩm).`);
    }
    return;
  }

  // Tao ma don hang rieng cua shop: TKX_YYMMDD_XXX
  const now = new Date();
  const dateStr = now.toISOString().slice(2, 10).replace(/-/g, "");
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const orderCode = `TKX_${dateStr}_${randomSuffix}`;

  const orderData = {
    orderCode: orderCode,
    customerName: extracted.customer_name || "Khách Facebook",
    phone: extracted.phone || "",
    province: extracted.province || "",
    district: extracted.district || "",
    ward: extracted.ward || "",
    addressDetail: extracted.address_detail || "",
    productName: extracted.product_name || "Kẹp tóc",
    weight: extracted.weight || 150,
    codAmount: extracted.cod_amount || 0,
    itemValue: extracted.cod_amount || 0,
    note: extracted.note || "Cho xem hàng, không cho thử",
    createdAt: now.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
    psid: customerPsid
  };

  console.log(`==================================================`);
  console.log(`🎉 [ĐƠN HÀNG MỚI ĐÃ ĐƯỢC BẮT ĐẦU TẠO]`);
  console.log(`- Mã đơn:    ${orderData.orderCode}`);
  console.log(`- Tên khách: ${orderData.customerName}`);
  console.log(`- SĐT:       ${orderData.phone}`);
  console.log(`- Địa chỉ:   ${orderData.addressDetail}, ${orderData.ward}, ${orderData.district}, ${orderData.province}`);
  console.log(`- Sản phẩm:  ${orderData.productName}`);
  console.log(`- Tiền COD:  ${orderData.codAmount.toLocaleString("vi-VN")} đ`);
  console.log(`- Ghi chú:   ${orderData.note}`);
  console.log(`==================================================`);

  // Ghi vao Google Sheets va file luu tru du phong
  await appendOrderToSheet(orderData);

  // Danh dau da len don de tranh trung
  recentOrders.set(customerPsid, {
    orderCode: orderCode,
    timestamp: Date.now()
  });

  // CHE DO IM LANG (Option 2): Khong gui bat ky tin nhan nao ra Messenger
  console.log(`[Silent Mode] He thong giu im lang tren Messenger, cuoc tro chuyen giua khach va shop dien ra tu nhien.`);
}

// Endpoint kiem tra server hoat dong
app.get("/ping", (req, res) => {
  res.status(200).send("SPX Silent Order Assistant is running.");
});

// Endpoint tiep nhan tin nhan tu AhaChat Webhook (Ho tro 100% khach ngoai)
app.get("/ahachat-webhook", (req, res) => {
  res.status(200).send("AhaChat Webhook endpoint is ready.");
});

app.post("/ahachat-webhook", async (req, res) => {
  try {
    const body = req.body || {};
    // Tra ve 200 OK ngay lap tuc de AhaChat khong bao loi timeout
    res.status(200).json({ status: "success", message: "Event received" });

    // Trich xuat thong tin linh hoat tu AhaChat payload
    const customerId = String(body.id || body.user_id || body.psid || body.sender_id || body.chat_id || "ahachat_customer");
    const text = String(body.text || body.message || body.last_user_message || body.last_input || body.content || "").trim();
    const customerName = body.name || body.full_name || body.first_name || "Khách hàng";
    const isShop = Boolean(body.is_shop || body.is_echo || body.sender === "shop");

    if (!text) {
      console.log(`[AhaChat Webhook] Nhan event tu ${customerId} nhung khong co text.`);
      return;
    }

    console.log(`[AhaChat Webhook] Tin nhan tu ${isShop ? 'Shop' : customerName} (${customerId}): "${text}"`);

    // TRUONG HOP 1: Nhan vien hoac shop go lenh #chot
    if (isShop || /#chot\b|#chotdon\b|#lendon\b/i.test(text)) {
      recordMessage(customerId, isShop ? "Shop" : "Khách hàng", text);
      if (/#chot\b|#chotdon\b|#lendon\b/i.test(text)) {
        console.log(`[AhaChat Trigger] Phat hien lenh chot don cho khach ${customerId}`);
        if (autoTriggerTimers.has(customerId)) {
          clearTimeout(autoTriggerTimers.get(customerId));
          autoTriggerTimers.delete(customerId);
        }
        await processOrderCreation(customerId, "AHACHAT_LENH_CHOT", true);
        return;
      }
    }

    // TRUONG HOP 2: Khach hang gui tin nhan
    recordMessage(customerId, "Khách hàng", text);

    // Kiem tra tu dong: Co SĐT va dia chi hay khong
    if (containsPhoneAndAddress(customerId)) {
      console.log(`[AhaChat Auto Detect] Phat hien SDT va Dia chi tu khach ${customerId}. Dat hen gio xu ly...`);

      if (autoTriggerTimers.has(customerId)) {
        clearTimeout(autoTriggerTimers.get(customerId));
      }

      const timer = setTimeout(() => {
        autoTriggerTimers.delete(customerId);
        processOrderCreation(customerId, "AHACHAT_AUTO_DETECT", false);
      }, 4000);

      autoTriggerTimers.set(customerId, timer);
    }
  } catch (err) {
    console.error("[AhaChat Webhook Error] Loi xu ly event:", err.message);
  }
});

// Endpoint xac thuc Webhook voi Meta Facebook
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[Webhook] Xac thuc thanh cong voi Facebook.");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Endpoint tiep nhan tin nhan tu Facebook Messenger
app.post("/webhook", (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    res.status(200).send("EVENT_RECEIVED");

    body.entry.forEach(entry => {
      if (!entry.messaging || entry.messaging.length === 0) return;
      const event = entry.messaging[0];

      // TRUONG HOP 1: Tin nhan tu phia Shop gui cho khach (is_echo: true)
      if (event.message && event.message.is_echo) {
        const customerPsid = event.recipient.id;
        const text = event.message.text || "";

        recordMessage(customerPsid, "Shop", text);

        // Kiem tra nhan vien co go lenh #chot khong
        if (/#chot\b|#chotdon\b|#lendon\b/i.test(text)) {
          console.log(`[Trigger Manual] Nhan vien vua go lenh chot don cho khach ${customerPsid}`);
          if (autoTriggerTimers.has(customerPsid)) {
            clearTimeout(autoTriggerTimers.get(customerPsid));
            autoTriggerTimers.delete(customerPsid);
          }
          processOrderCreation(customerPsid, "LENH_CHOT_TU_NHAN_VIEN", true);
        }
        return;
      }

      // TRUONG HOP 2: Tin nhan tu phia Khach hang gui toi (!is_echo)
      if (event.message && !event.message.is_echo) {
        const customerPsid = event.sender.id;
        const text = event.message.text || "";

        recordMessage(customerPsid, "Khách hàng", text);

        // Kiem tra tu dong: Co SĐT va dia chi hay khong
        if (containsPhoneAndAddress(customerPsid)) {
          console.log(`[Trigger Auto Detect] Phat hien SDT va Dia chi tu khach ${customerPsid}. Dat hen gio xu ly...`);

          // Xoa hen gio cu neu khach dang tiep tuc go
          if (autoTriggerTimers.has(customerPsid)) {
            clearTimeout(autoTriggerTimers.get(customerPsid));
          }

          // Cho 4 giay de khach nhan xong cac tin nhan lien tiep truoc khi quet
          const timer = setTimeout(() => {
            autoTriggerTimers.delete(customerPsid);
            processOrderCreation(customerPsid, "TU_DONG_PHAT_HIEN_SDT_DIACHI", false);
          }, 4000);

          autoTriggerTimers.set(customerPsid, timer);
        }
      }
    });
  } else {
    res.sendStatus(404);
  }
});

// Don dep dinh ky bo nho sau moi 30 phut (xoa hoi thoai khong hoat dong tren 2 tieng)
setInterval(() => {
  const now = Date.now();
  for (const [psid, history] of conversationHistory.entries()) {
    if (history.length > 0 && now - history[history.length - 1].timestamp > 2 * 60 * 60 * 1000) {
      conversationHistory.delete(psid);
      recentOrders.delete(psid);
      autoTriggerTimers.delete(psid);
    }
  }
}, 30 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Tro ly Tu dong Bat Don SPX Express dang chay tren cong ${PORT}`);
  console.log(`- Che do: Im lang (Silent Mode) - Nguoi that chat`);
  console.log(`- Kich hoat: Tu dong (SDT + Dia chi) HOAC Nhan vien go #chot`);
  console.log(`- Xuat du lieu: Google Sheets theo chuan Mau Excel SPX`);
  console.log(`==================================================`);
});
