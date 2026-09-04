const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "MY_VERIFY_TOKEN_123";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SHEET_CSV_URL = process.env.SHEET_CSV_URL;
const PORT = process.env.PORT || 3000;
const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_TIMEOUT_MS = 60000; // 60 giay timeout cho Gemini API (free tier co the cham)
const MAX_RETRIES = 3; // So lan thu lai khi bi rate-limit hoac server error

let productCatalogCache = "";
let lastCatalogFetchTime = 0;

const conversationHistory = new Map();
const messageBuffers = new Map();
const humanTakeoverMap = new Map();

app.get("/ping", (req, res) => {
  res.status(200).send("Server is alive.");
});

app.get("/webhook", (req, res) => {
  console.log("[Webhook] Nhan duoc yeu cau xac thuc tu Facebook:", req.query);
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[Webhook] Xac thuc thanh cong.");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook", (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    res.status(200).send("EVENT_RECEIVED");

    body.entry.forEach(entry => {
      if (!entry.messaging || entry.messaging.length === 0) return;
      const event = entry.messaging[0];

      if (event.message && event.message.is_echo) {
        const customerPsid = event.recipient.id;
        if (!event.message.app_id) {
          const pauseUntil = Date.now() + 5 * 60 * 1000;
          humanTakeoverMap.set(customerPsid, pauseUntil);
          console.log(`[Human Takeover] Tam dung bot cho ${customerPsid} trong 5 phut.`);
        }
        return;
      }

      if (event.message && !event.message.is_echo) {
        const senderPsid = event.sender.id;
        const pauseUntil = humanTakeoverMap.get(senderPsid);
        if (pauseUntil) {
          if (Date.now() < pauseUntil) {
            console.log(`[Bot Ignored] Khach ${senderPsid} dang duoc nhan vien ho tro.`);
            return;
          } else {
            humanTakeoverMap.delete(senderPsid);
          }
        }

        const text = event.message.text || "";
        const attachments = event.message.attachments || [];
        queueMessageProcessing(senderPsid, text, attachments);
      }
    });
  } else {
    res.sendStatus(404);
  }
});

function queueMessageProcessing(senderPsid, text, attachments) {
  sendSenderAction(senderPsid, "typing_on");

  if (!messageBuffers.has(senderPsid)) {
    messageBuffers.set(senderPsid, { texts: [], attachments: [], timer: null });
  }

  const buffer = messageBuffers.get(senderPsid);
  if (text) buffer.texts.push(text);
  if (attachments.length > 0) buffer.attachments.push(...attachments);

  if (buffer.timer) clearTimeout(buffer.timer);

  buffer.timer = setTimeout(async () => {
    const combinedText = buffer.texts.join("\n");
    const combinedAttachments = buffer.attachments;
    messageBuffers.delete(senderPsid);

    try {
      await processChatWithGemini(senderPsid, combinedText, combinedAttachments);
    } catch (error) {
      const errDetail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      console.error(`[Gemini Error] PSID=${senderPsid} | Status=${error.response?.status || 'N/A'} | Detail: ${errDetail}`);
      await sendSenderAction(senderPsid, "typing_off");
      await sendFbMessage(senderPsid, { text: "Xin lỗi bạn, hệ thống đang bận hoặc gặp lỗi kết nối. Bạn vui lòng thử lại sau nhé! 🌸" });
    }
  }, 2500);
}

async function getCatalog() {
  const now = Date.now();
  if (!productCatalogCache || now - lastCatalogFetchTime > 5 * 60 * 1000) {
    try {
      const res = await axios.get(SHEET_CSV_URL, { timeout: 10000 });
      productCatalogCache = res.data;
      lastCatalogFetchTime = now;
      console.log("[Catalog] Da cap nhat cache tu Google Sheets.");
    } catch (err) {
      console.error("[Catalog] Khong tai duoc du lieu Sheet:", err.message);
    }
  }
  return productCatalogCache;
}

async function callGeminiWithRetry(payload, retries = MAX_RETRIES) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(url, payload, { timeout: GEMINI_TIMEOUT_MS });
      return response;
    } catch (err) {
      const status = err.response?.status;
      // Retry chi khi bi rate-limit (429) hoac server error (500, 503)
      if ((status === 429 || status >= 500) && attempt < retries) {
        const waitMs = Math.min(2000 * Math.pow(2, attempt), 15000); // 2s, 4s, 8s, max 15s
        console.log(`[Gemini Retry] Attempt ${attempt + 1}/${retries} - Status ${status} - Wait ${waitMs}ms`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }
      throw err; // Re-throw neu het retry hoac loi khac
    }
  }
}

async function processChatWithGemini(senderPsid, text, attachments) {
  const catalog = await getCatalog();
  let userParts = [];

  if (text) userParts.push({ text: text });

  for (const item of attachments) {
    if (item.type === "image" && item.payload && item.payload.url) {
      try {
        const imgRes = await axios.get(item.payload.url, { responseType: "arraybuffer", timeout: 10000 });
        userParts.push({
          inlineData: {
            data: Buffer.from(imgRes.data).toString("base64"),
            mimeType: "image/jpeg"
          }
        });
        userParts.push({ text: "(Khach gui kem anh, doi chieu voi danh muc de tu van)" });
      } catch (err) {
        console.error("[Image] Loi tai anh:", err.message);
      }
    }
  }

  if (userParts.length === 0) return;

  let historyData = conversationHistory.get(senderPsid) || { messages: [], lastUpdated: Date.now() };
  let history = historyData.messages;
  history.push({ role: "user", parts: userParts });

  if (history.length > 8) history = history.slice(-8);

  const systemInstruction = {
    parts: [{
      text: `Ban la tro ly tu van ban kep toc nhiet tinh, duyen dang cua tiem "Kep Xinh".
Xung ho: Em - Chi. Dung emoji dang yeu (🌸, ✨, 🎀).
Danh sach san pham:\n${catalog}

Nguyen tac:
1. Tu van ngan gon, ho tro chon theo chat toc va phong cach.
2. Neu co anh san pham, chen link anh o CUOI CUNG: [IMAGE: url_anh].
3. Neu khach gui anh, quan sat va doi chieu xem co mau tuong tu khong.`
    }]
  };

  const geminiResponse = await callGeminiWithRetry({
    contents: history,
    system_instruction: systemInstruction
  });

  const candidates = geminiResponse.data.candidates;
  if (!candidates || candidates.length === 0 || !candidates[0].content) {
    console.error("[Gemini] Khong co candidates hop le:", JSON.stringify(geminiResponse.data));
    throw new Error("Gemini returned no valid candidates");
  }

  const replyText = candidates[0].content.parts[0].text;
  history.push({ role: "model", parts: [{ text: replyText }] });
  conversationHistory.set(senderPsid, { messages: history, lastUpdated: Date.now() });

  const imageMatch = replyText.match(/\[IMAGE:\s*(https?:\/\/[^\]]+)\]/);
  const cleanText = replyText.replace(/\[IMAGE:\s*(https?:\/\/[^\]]+)\]/g, "").trim();

  await sendSenderAction(senderPsid, "typing_off");
  if (cleanText) {
    await sendFbMessage(senderPsid, { text: cleanText });
  }

  if (imageMatch && imageMatch[1]) {
    await sendFbMessage(senderPsid, {
      attachment: {
        type: "image",
        payload: { url: imageMatch[1].trim(), is_reusable: true }
      }
    });
  }
}

async function sendFbMessage(senderPsid, messagePayload) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      { recipient: { id: senderPsid }, message: messagePayload }
    );
  } catch (err) {
    console.error("Loi gui tin nhan:", err.response?.data || err.message);
  }
}

async function sendSenderAction(senderPsid, action) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      { recipient: { id: senderPsid }, sender_action: action }
    );
  } catch (err) {}
}

setInterval(() => {
  const now = Date.now();
  for (const [psid, data] of conversationHistory.entries()) {
    if (now - data.lastUpdated > 30 * 60 * 1000) {
      conversationHistory.delete(psid);
    }
  }
}, 15 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Server dang chay tai cong ${PORT}`);
});
