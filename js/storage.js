/**
 * Local Data Management & Storage Service
 */

const STORAGE_KEYS = {
  TRANSACTIONS: "expense_tracker_transactions",
  APPS_SCRIPT_URL: "expense_tracker_script_url",
  THEME: "expense_tracker_theme"
};

// ข้อมูลตัวอย่างเริ่มต้นสำหรับสร้างสถิติให้เห็นภาพทันที
const SAMPLE_TRANSACTIONS = [
  { id: "tx_1", date: "2026-07-20", type: "income", category: "เงินเดือน", amount: 45000, note: "เงินเดือนประจำเดือน", paymentMethod: "โอนเงิน", createdAt: "2026-07-20T08:00:00.000Z" },
  { id: "tx_2", date: "2026-07-20", type: "expense", category: "อาหาร", amount: 150, note: "อาหารเที่ยง ข้าวมันไก่", paymentMethod: "พร้อมเพย์", createdAt: "2026-07-20T12:30:00.000Z" },
  { id: "tx_3", date: "2026-07-19", type: "expense", category: "การเดินทาง", amount: 550, note: "เติมน้ำมันรถยนต์", paymentMethod: "บัตรเครดิต", createdAt: "2026-07-19T17:10:00.000Z" },
  { id: "tx_4", date: "2026-07-18", type: "expense", category: "ที่พัก/บิล", amount: 3500, note: "ค่าไฟฟ้า + ค่าน้ำประปา", paymentMethod: "โอนเงิน", createdAt: "2026-07-18T10:00:00.000Z" },
  { id: "tx_5", date: "2026-07-15", type: "income", category: "งานนอก/ฟรีแลนซ์", amount: 8500, note: "รับทำเว็บไซต์คลินิก", paymentMethod: "โอนเงิน", createdAt: "2026-07-15T15:20:00.000Z" },
  { id: "tx_6", date: "2026-07-14", type: "expense", category: "ช้อปปิ้ง", amount: 1290, note: "หูฟังบลูทูธไร้สาย", paymentMethod: "บัตรเครดิต", createdAt: "2026-07-14T19:45:00.000Z" },
  { id: "tx_7", date: "2026-07-10", type: "expense", category: "ความบันเทิง", amount: 399, note: "สมาชิก Netflix / Spotify", paymentMethod: "บัตรเครดิต", createdAt: "2026-07-10T09:00:00.000Z" }
];

class StorageService {
  static getTransactions() {
    const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!data) {
      this.saveTransactions(SAMPLE_TRANSACTIONS);
      return SAMPLE_TRANSACTIONS;
    }
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("Failed to parse transactions from LocalStorage", e);
      return SAMPLE_TRANSACTIONS;
    }
  }

  static saveTransactions(transactions) {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }

  static addTransaction(tx) {
    const transactions = this.getTransactions();
    transactions.unshift(tx);
    this.saveTransactions(transactions);
    return transactions;
  }

  static deleteTransaction(id) {
    let transactions = this.getTransactions();
    transactions = transactions.filter(t => String(t.id) !== String(id));
    this.saveTransactions(transactions);
    return transactions;
  }

  static getAppsScriptUrl() {
    return localStorage.getItem(STORAGE_KEYS.APPS_SCRIPT_URL) || "";
  }

  static saveAppsScriptUrl(url) {
    localStorage.setItem(STORAGE_KEYS.APPS_SCRIPT_URL, url.trim());
  }

  static getTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || "light";
  }

  static saveTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }
}

window.StorageService = StorageService;
