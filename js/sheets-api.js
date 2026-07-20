/**
 * Google Sheets Real-time Integration & Robust CSV/API Service
 */

const DEFAULT_SHEET_ID = "1rFnB1qoZKJETCuHqy0KgF-9XqPx8GHd3bsmz_m5uVns";

class SheetsApiService {
  /**
   * ดึงข้อมูลจาก Google Sheet ID หรือ Apps Script URL
   */
  static async fetchRealtimeData(sourceUrlOrId) {
    const target = (sourceUrlOrId || DEFAULT_SHEET_ID).trim();

    if (target.includes("script.google.com")) {
      return await this.fetchFromAppsScript(target);
    }

    let sheetId = target;
    if (target.includes("spreadsheets/d/")) {
      const match = target.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match) sheetId = match[1];
    }

    return await this.fetchFromGoogleSheetCSV(sheetId);
  }

  static async fetchFromAppsScript(scriptUrl) {
    const urlWithCacheBuster = scriptUrl + (scriptUrl.includes("?") ? "&" : "?") + "t=" + Date.now();
    const response = await fetch(urlWithCacheBuster, { method: "GET" });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const result = await response.json();
    return result.transactions || [];
  }

  /**
   * ดึงข้อมูลตรงจาก Google Sheet CSV Endpoint (gviz/tq)
   */
  static async fetchFromGoogleSheetCSV(sheetId) {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&t=${Date.now()}`;

    try {
      const response = await fetch(csvUrl);
      if (!response.ok) throw new Error(`ไม่สามารถดึงข้อมูลจาก Google Sheet ID: ${sheetId}`);
      
      const csvText = await response.text();
      return this.parseCSVToTransactions(csvText);
    } catch (error) {
      console.error("CSV Fetch Error:", error);
      throw error;
    }
  }

  /**
   * แปลง CSV Text เป็น Array of Transaction Objects แบบฉลาดและยืดหยุ่น
   */
  static parseCSVToTransactions(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length <= 1) return [];

    const parseCSVLine = (line) => {
      const result = [];
      let start = 0;
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          let val = line.substring(start, i).trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/""/g, '"');
          result.push(val);
          start = i + 1;
        }
      }
      let lastVal = line.substring(start).trim();
      if (lastVal.startsWith('"') && lastVal.endsWith('"')) lastVal = lastVal.slice(1, -1).replace(/""/g, '"');
      result.push(lastVal);
      return result;
    };

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    
    // Helper ค้นหาตำแหน่งคอลัมน์แบบแม่นยำ
    const findIndex = (keywords) => headers.findIndex(h => keywords.some(k => h === k || h.includes(k)));

    const dateIdx = findIndex(["date", "วันที่", "เวลา", "timestamp"]);
    const noteIdx = findIndex(["detail", "รายละเอียด", "รายการ", "note", "หมายเหตุ"]);
    const categoryIdx = findIndex(["category", "หมวดหมู่", "ประเภทวิชา"]);
    const typeIdx = findIndex(["type", "ประเภท", "ประเภทรายการ", "รายรับ/รายจ่าย", "รายรับ-รายจ่าย"]);
    const amountIdx = findIndex(["amount", "จำนวน", "จำนวนเงิน", "ราคา"]);
    const incomeIdx = findIndex(["income", "รายรับ"]);
    const expenseIdx = findIndex(["expense", "รายจ่าย"]);
    const methodIdx = findIndex(["payment", "ช่องทาง", "วิธีจ่าย"]);

    const transactions = [];

    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (!row || row.length === 0) continue;

      let date = dateIdx >= 0 && row[dateIdx] ? row[dateIdx] : "";
      let note = noteIdx >= 0 && row[noteIdx] ? row[noteIdx] : (row[1] || row[0] || "-");
      let category = categoryIdx >= 0 && row[categoryIdx] ? row[categoryIdx] : "ทั่วไป";
      let paymentMethod = methodIdx >= 0 && row[methodIdx] ? row[methodIdx] : "เงินสด";

      let type = "expense";
      let amount = 0;

      // กรณีมีแยกคอลัมน์ Income / Expense
      if (incomeIdx >= 0 && row[incomeIdx] && parseFloat(row[incomeIdx].replace(/,/g, '')) > 0) {
        type = "income";
        amount = parseFloat(row[incomeIdx].replace(/,/g, ''));
      } else if (expenseIdx >= 0 && row[expenseIdx] && parseFloat(row[expenseIdx].replace(/,/g, '')) > 0) {
        type = "expense";
        amount = parseFloat(row[expenseIdx].replace(/,/g, ''));
      } else if (amountIdx >= 0 && row[amountIdx]) {
        const rawAmt = parseFloat(row[amountIdx].replace(/,/g, '')) || 0;
        amount = Math.abs(rawAmt);

        if (typeIdx >= 0 && row[typeIdx]) {
          const typeStr = row[typeIdx].toLowerCase();
          if (typeStr.includes("รับ") || typeStr.includes("income") || typeStr.includes("in")) {
            type = "income";
          } else {
            type = "expense";
          }
        } else if (rawAmt < 0) {
          type = "expense";
        }
      } else {
        // ลองค้นหาคอลัมน์ที่เป็นตัวเลข
        for (let j = 0; j < row.length; j++) {
          const num = parseFloat((row[j] || "").replace(/,/g, ''));
          if (!isNaN(num) && num !== 0 && j !== dateIdx) {
            amount = Math.abs(num);
            if (typeIdx >= 0 && row[typeIdx]) {
              type = row[typeIdx].includes("รับ") ? "income" : "expense";
            }
            break;
          }
        }
      }

      if (amount === 0 && !note) continue;

      // จัดการฟอร์แมตวันที่
      if (date) {
        date = date.split(' ')[0].replace(/\//g, '-');
      } else {
        date = new Date().toISOString().split('T')[0];
      }

      transactions.push({
        id: `row_${i}_${Date.now()}`,
        date: date,
        type: type,
        category: category || "ทั่วไป",
        amount: amount,
        note: note || "-",
        paymentMethod: paymentMethod,
        createdAt: new Date().toISOString()
      });
    }

    return transactions;
  }
}

window.SheetsApiService = SheetsApiService;
