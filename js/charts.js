/**
 * Chart Visualization Manager for Real-time Dashboard
 */

class ChartManager {
  constructor() {
    this.unifiedBarChart = null;
    this.categoryChart = null;
  }

  getColors(isDark) {
    return {
      text: isDark ? '#94a3b8' : '#475569',
      grid: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
      income: '#10b981',   // สีเขียว
      expense: '#f43f5e',  // สีแดง
      balance: '#6366f1',  // สีม่วง/อินดิโก้
      categories: [
        '#f43f5e', '#3b82f6', '#10b981', '#f59e0b', 
        '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'
      ]
    };
  }

  /**
   * กราฟแท่งรวม 3 ค่า (1. รายรับ 2. รายจ่าย 3. ยอดคงเหลือ) ต่อช่วงเวลา
   */
  renderUnifiedBarChart(ctx, groupedData, isDark = false) {
    const colors = this.getColors(isDark);
    const labels = groupedData.map(item => item.label);
    const incomeData = groupedData.map(item => item.income);
    const expenseData = groupedData.map(item => item.expense);
    const balanceData = groupedData.map(item => item.balance);

    if (this.unifiedBarChart) {
      this.unifiedBarChart.destroy();
    }

    this.unifiedBarChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: '1. รายรับ',
            data: incomeData,
            backgroundColor: colors.income,
            borderRadius: 6,
            barPercentage: 0.75,
            categoryPercentage: 0.8
          },
          {
            label: '2. รายจ่าย',
            data: expenseData,
            backgroundColor: colors.expense,
            borderRadius: 6,
            barPercentage: 0.75,
            categoryPercentage: 0.8
          },
          {
            label: '3. ยอดคงเหลือ',
            data: balanceData,
            backgroundColor: colors.balance,
            borderRadius: 6,
            barPercentage: 0.75,
            categoryPercentage: 0.8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: colors.text,
              font: { family: 'Prompt', size: 13, weight: '500' },
              padding: 16,
              usePointStyle: true
            }
          },
          tooltip: {
            padding: 12,
            titleFont: { family: 'Prompt', size: 14, weight: 'bold' },
            bodyFont: { family: 'Prompt', size: 13 },
            callbacks: {
              label: context => ` ${context.dataset.label}: ฿${context.raw.toLocaleString('th-TH')}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.text, font: { family: 'Prompt', size: 12 } }
          },
          y: {
            grid: { color: colors.grid },
            ticks: {
              color: colors.text,
              font: { family: 'Prompt', size: 12 },
              callback: v => '฿' + v.toLocaleString('th-TH')
            }
          }
        }
      }
    });
  }

  /**
   * กราฟสัดส่วนหมวดหมู่รายจ่าย (Category Donut Chart)
   */
  renderCategoryChart(ctx, categoryTotals, isDark = false) {
    const colors = this.getColors(isDark);
    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    if (this.categoryChart) {
      this.categoryChart.destroy();
    }

    if (labels.length === 0) return;

    this.categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors.categories.slice(0, labels.length),
          borderWidth: 2,
          borderColor: isDark ? '#131b2e' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: colors.text, font: { family: 'Prompt', size: 12 }, padding: 14, usePointStyle: true }
          },
          tooltip: {
            callbacks: {
              label: context => ` ${context.label}: ฿${context.raw.toLocaleString('th-TH')}`
            }
          }
        },
        cutout: '70%'
      }
    });
  }
}

window.ChartManager = ChartManager;
