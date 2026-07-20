/**
 * Real-time Dashboard Controller for Google Sheet "จดจำรายจ่าย"
 */

class ExpenseApp {
  constructor() {
    this.transactions = [];
    this.chartManager = new ChartManager();
    this.sheetSource = StorageService.getAppsScriptUrl() || DEFAULT_SHEET_ID;
    this.currentTheme = StorageService.getTheme();
    this.pollingInterval = null;
    this.autoRefreshEnabled = true;

    // Chart Timeframe Selection: 'day', 'week', 'month', 'year'
    this.chartTimeframe = 'month';

    // Table Filter State
    this.filters = {
      type: 'all',
      category: 'all',
      dateRange: 'all',
      search: ''
    };

    this.init();
  }

  init() {
    this.applyTheme(this.currentTheme);
    this.transactions = StorageService.getTransactions();
    this.bindEvents();

    const sourceInput = document.getElementById('sheetSourceInput');
    if (sourceInput) sourceInput.value = this.sheetSource;

    this.updateUI();
    this.fetchRealtimeData(false);
    this.startAutoPolling();
  }

  startAutoPolling() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.pollingInterval = setInterval(() => {
      if (this.autoRefreshEnabled) {
        this.fetchRealtimeData(true);
      }
    }, 5000);
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    StorageService.saveTheme(theme);
    const themeIcon = document.getElementById('themeToggleBtn');
    if (themeIcon) themeIcon.innerHTML = theme === 'dark' ? '☀️' : '🌙';
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(this.currentTheme);
    this.updateCharts();
  }

  bindEvents() {
    document.getElementById('themeToggleBtn')?.addEventListener('click', () => this.toggleTheme());
    document.getElementById('openSettingsBtn')?.addEventListener('click', () => this.openModal('settingsModal'));
    document.getElementById('refreshBtn')?.addEventListener('click', () => this.fetchRealtimeData(false));

    document.querySelectorAll('.close-btn, .close-modal-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-overlay');
        if (modal) modal.classList.remove('active');
      });
    });

    document.getElementById('settingsForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = document.getElementById('sheetSourceInput').value;
      if (val) {
        this.sheetSource = val;
        StorageService.saveAppsScriptUrl(val);
        this.closeModal('settingsModal');
        this.showToast('บันทึกแหล่งข้อมูลเรียบร้อยแล้ว', 'success');
        this.fetchRealtimeData(false);
      }
    });

    document.getElementById('autoRefreshToggle')?.addEventListener('change', (e) => {
      this.autoRefreshEnabled = e.target.checked;
      this.showToast(this.autoRefreshEnabled ? 'เปิดการรีเฟรชเรียลไทม์แล้ว' : 'ปิดการรีเฟรชเรียลไทม์แล้ว', 'info');
    });

    // ปุ่มเลือกช่วงเวลากราฟ (1 วัน | 1 สัปดาห์ | 1 เดือน | 1 ปี)
    document.querySelectorAll('.timeframe-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.chartTimeframe = e.currentTarget.dataset.timeframe;
        this.updateCharts();
      });
    });

    // Table Filters
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        this.filters.type = e.target.dataset.filter;
        this.updateUI();
      });
    });

    document.getElementById('categoryFilter')?.addEventListener('change', (e) => {
      this.filters.category = e.target.value;
      this.updateUI();
    });

    document.getElementById('dateRangeFilter')?.addEventListener('change', (e) => {
      this.filters.dateRange = e.target.value;
      this.updateUI();
    });

    document.getElementById('searchInput')?.addEventListener('input', (e) => {
      this.filters.search = e.target.value.toLowerCase();
      this.updateUI();
    });

    document.getElementById('exportCsvBtn')?.addEventListener('click', () => this.exportToCSV());
  }

  async fetchRealtimeData(silent = false) {
    if (!silent) this.updateStatusDot('syncing', 'กำลังโหลดข้อมูลจาก Google Sheet...');

    try {
      const data = await SheetsApiService.fetchRealtimeData(this.sheetSource);
      if (Array.isArray(data) && data.length > 0) {
        this.transactions = data;
        StorageService.saveTransactions(data);
        this.updateUI();
        
        const nowStr = new Date().toLocaleTimeString('th-TH');
        this.updateStatusDot('connected', `อัปเดตสดเมื่อ ${nowStr}`);
        if (!silent) this.showToast(`ดึงข้อมูลเรียลไทม์สำเร็จ (${data.length} รายการ)`, 'success');
      } else {
        this.updateStatusDot('connected', 'ไม่มีข้อมูลใหม่ใน Sheet');
      }
    } catch (err) {
      console.warn("Real-time fetch status:", err);
      this.updateStatusDot('disconnected', 'ใช้ข้อมูลแคชในเครื่อง');
      if (!silent) this.showToast('ไม่สามารถดึงข้อมูลจาก Google Sheet ได้ จะแสดงข้อมูลล่าสุดในเครื่องแทน', 'error');
    }
  }

  getFilteredTransactions() {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const todayStr = now.toISOString().split('T')[0];

    return this.transactions.filter(tx => {
      if (this.filters.type !== 'all' && tx.type !== this.filters.type) return false;
      if (this.filters.category !== 'all' && tx.category !== this.filters.category) return false;
      if (this.filters.search) {
        const noteMatch = (tx.note || '').toLowerCase().includes(this.filters.search);
        const catMatch = (tx.category || '').toLowerCase().includes(this.filters.search);
        if (!noteMatch && !catMatch) return false;
      }
      if (this.filters.dateRange === 'month') return tx.date && tx.date.startsWith(currentYearMonth);
      if (this.filters.dateRange === 'today') return tx.date === todayStr;
      return true;
    });
  }

  updateUI() {
    const filtered = this.getFilteredTransactions();
    this.renderStats(filtered);
    this.renderTable(filtered);
    this.updateCharts();
  }

  renderStats(filteredList) {
    let totalIncome = 0;
    let totalExpense = 0;

    filteredList.forEach(tx => {
      if (tx.type === 'income') {
        totalIncome += Number(tx.amount || 0);
      } else {
        totalExpense += Number(tx.amount || 0);
      }
    });

    const netBalance = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? ((netBalance / totalIncome) * 100).toFixed(1) : 0;

    document.getElementById('totalIncomeVal').textContent = `฿${totalIncome.toLocaleString('th-TH')}`;
    document.getElementById('totalExpenseVal').textContent = `฿${totalExpense.toLocaleString('th-TH')}`;
    document.getElementById('netBalanceVal').textContent = `฿${netBalance.toLocaleString('th-TH')}`;
    document.getElementById('savingsRateVal').textContent = `${savingsRate}%`;

    const balanceElem = document.getElementById('netBalanceVal');
    if (balanceElem) {
      balanceElem.style.color = netBalance >= 0 ? 'var(--income-color)' : 'var(--expense-color)';
    }
  }

  renderTable(list) {
    const tbody = document.getElementById('transactionTbody');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="empty-state">
              <div class="empty-icon">📊</div>
              <p>ยังไม่มีรายการบันทึกจาก Google Sheet "จดจำรายจ่าย"</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const sortedList = [...list].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    tbody.innerHTML = sortedList.map(tx => {
      const isIncome = tx.type === 'income';
      const amountClass = isIncome ? 'amount-income' : 'amount-expense';
      const amountPrefix = isIncome ? '+' : '-';
      const icon = isIncome ? '📈' : '📉';

      return `
        <tr>
          <td>${this.formatDate(tx.date)}</td>
          <td>
            <span class="badge-category">
              ${icon} ${tx.category || 'ทั่วไป'}
            </span>
          </td>
          <td>${tx.note || '-'}</td>
          <td><span style="opacity: 0.8; font-size: 0.85rem;">💳 ${tx.paymentMethod || 'เงินสด'}</span></td>
          <td class="${amountClass}">${amountPrefix}฿${Number(tx.amount).toLocaleString('th-TH')}</td>
        </tr>
      `;
    }).join('');
  }

  updateCharts() {
    const isDark = this.currentTheme === 'dark';
    const filtered = this.getFilteredTransactions();

    // 1. กราฟแท่งรวม 3 ค่า (รายรับ, รายจ่าย, ยอดคงเหลือ)
    const groupedData = this.getGroupedDataByTimeframe(filtered, this.chartTimeframe);
    const mainChartCtx = document.getElementById('unifiedBarChartCanvas')?.getContext('2d');
    if (mainChartCtx) {
      this.chartManager.renderUnifiedBarChart(mainChartCtx, groupedData, isDark);
    }

    // 2. กราฟสัดส่วนหมวดหมู่รายจ่าย (Donut Chart)
    const expenseCategories = {};
    filtered.filter(tx => tx.type === 'expense').forEach(tx => {
      const cat = tx.category || 'อื่นๆ';
      expenseCategories[cat] = (expenseCategories[cat] || 0) + Number(tx.amount || 0);
    });
    const categoryCtx = document.getElementById('categoryChartCanvas')?.getContext('2d');
    if (categoryCtx) {
      this.chartManager.renderCategoryChart(categoryCtx, expenseCategories, isDark);
    }
  }

  /**
   * จัดกลุ่มรายการตามช่วงเวลาที่เลือก (1 วัน, 1 สัปดาห์, 1 เดือน, 1 ปี)
   */
  getGroupedDataByTimeframe(transactions, timeframe) {
    const groups = {};

    transactions.forEach(tx => {
      if (!tx.date) return;
      let key = "";
      let label = "";

      const d = new Date(tx.date);
      if (isNaN(d.getTime())) return;

      if (timeframe === 'day') {
        // รายวัน: YYYY-MM-DD
        key = tx.date;
        const dayNum = d.getDate();
        const monthShort = d.toLocaleDateString('th-TH', { month: 'short' });
        label = `${dayNum} ${monthShort}`;
      } else if (timeframe === 'week') {
        // รายสัปดาห์: สัปดาห์ในปีกำหนดโดยสัปดาห์แรกของเดือน
        const startOfWeek = new Date(d);
        const dayOfWeek = startOfWeek.getDay() || 7;
        startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek + 1); // จันทร์
        key = startOfWeek.toISOString().split('T')[0];
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6); // อาทิตย์

        const sDay = startOfWeek.getDate();
        const eDay = endOfWeek.getDate();
        const mStr = startOfWeek.toLocaleDateString('th-TH', { month: 'short' });
        label = `${sDay}-${eDay} ${mStr}`;
      } else if (timeframe === 'month') {
        // รายเดือน: YYYY-MM
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const monthStr = d.toLocaleDateString('th-TH', { month: 'short' });
        const yearShort = (d.getFullYear() + 543).toString().slice(-2);
        label = `${monthStr} ${yearShort}`;
      } else if (timeframe === 'year') {
        // รายปี: YYYY
        key = `${d.getFullYear()}`;
        label = `พ.ศ. ${d.getFullYear() + 543}`;
      }

      if (!groups[key]) {
        groups[key] = { key, label, income: 0, expense: 0, balance: 0 };
      }

      if (tx.type === 'income') {
        groups[key].income += Number(tx.amount || 0);
      } else {
        groups[key].expense += Number(tx.amount || 0);
      }
    });

    // เรียงตามวันที่ลำดับเวลา
    const sortedKeys = Object.keys(groups).sort();
    return sortedKeys.map(k => {
      const g = groups[k];
      g.balance = g.income - g.expense; // ยอดคงเหลือ = รายรับ - รายจ่าย
      return g;
    });
  }

  updateStatusDot(state, text) {
    const dot = document.getElementById('statusDot');
    const textElem = document.getElementById('statusText');
    if (dot) {
      dot.className = 'status-dot';
      if (state === 'connected') dot.classList.add('connected');
      if (state === 'syncing') dot.classList.add('syncing');
    }
    if (textElem) textElem.textContent = text;
  }

  openModal(id) { document.getElementById(id)?.classList.add('active'); }
  closeModal(id) { document.getElementById(id)?.classList.remove('active'); }

  exportToCSV() {
    if (this.transactions.length === 0) {
      this.showToast('ไม่มีข้อมูลสำหรับส่งออก', 'error');
      return;
    }

    let csvContent = "\uFEFFวันที่,ประเภท,หมวดหมู่,จำนวนเงิน,หมายเหตุ,ช่องทางชำระเงิน\n";
    this.transactions.forEach(t => {
      const typeText = t.type === 'income' ? 'รายรับ' : 'รายจ่าย';
      csvContent += `"${t.date}","${typeText}","${t.category}","${t.amount}","${t.note || ''}","${t.paymentMethod || ''}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `จดจำรายจ่าย_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : '⚠️'}</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0]) > 2500 ? parts[0] : (parseInt(parts[0]) + 543);
        return `${parts[2]}/${parts[1]}/${year}`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new ExpenseApp();
});
