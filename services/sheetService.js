const axios = require("axios");
const fs = require("fs");
const path = require("path");

const BACKUP_FILE = path.join(__dirname, "..", "orders_backup.json");

/**
 * Luu don hang du phong vao file JSON cuc bo
 */
function saveBackupLocally(orderData) {
  try {
    let orders = [];
    if (fs.existsSync(BACKUP_FILE)) {
      const content = fs.readFileSync(BACKUP_FILE, "utf-8");
      orders = content ? JSON.parse(content) : [];
    }
    orders.push(orderData);
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(orders, null, 2), "utf-8");
    console.log(`[Backup] Da luu don hang ${orderData.orderCode} vao file du phong.`);
  } catch (err) {
    console.error("[Backup Error] Khong the luu file du phong:", err.message);
  }
}

/**
 * Day don hang len Google Sheets thong qua Google Apps Script Webhook
 * @param {Object} orderData 
 */
async function appendOrderToSheet(orderData) {
  // Luon luu ban copy cuc bo truoc de tranh mat don
  saveBackupLocally(orderData);

  const DEFAULT_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyI5pSu7mi1w5lO1meAc-WVzE6_TdHkGiDr1ykF4qOGNiJaVtUY9p15i5xW1hp8sTpf/exec";
  const webhookUrl = (process.env.ORDER_SHEET_WEBHOOK_URL && process.env.ORDER_SHEET_WEBHOOK_URL.trim()) || DEFAULT_WEBHOOK_URL;

  try {
    console.log(`[Sheet Service] Dang gui don hang ${orderData.orderCode} len Google Sheets...`);
    const response = await axios.post(webhookUrl, orderData, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
      maxRedirects: 5 // Google Apps Script Web App thuong redirect 302 sang trang ket qua
    });

    console.log(`[Sheet Service] Thanh cong: Da ghi don hang ${orderData.orderCode} vao Google Sheets.`);
    return { success: true, orderCode: orderData.orderCode, data: response.data };
  } catch (error) {
    console.error(`[Sheet Service Error] Loi khi gui len Google Sheets: ${error.message}`);
    return { success: false, reason: error.message, orderCode: orderData.orderCode };
  }
}

module.exports = {
  appendOrderToSheet,
  saveBackupLocally
};

