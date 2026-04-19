import { state } from "./store.js";
import { CONFIG } from "./config.js";

let chartInstance = null;

// ================= 選單與資料綁定 =================
export function populateOptions(data) {
  state.globalCategories = [];
  state.globalPayments = [];
  if (data.length > 1) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][1]) state.globalCategories.push(data[i][1]);
      if (data[i][2]) {
        const initVal =
          parseInt(String(data[i][3] || "0").replace(/,/g, ""), 10) || 0;
        state.globalPayments.push({
          name: data[i][2],
          initial: initVal,
          method: data[i][4] || "現金",
        });
      }
    }
  }
  const catHtml = state.globalCategories
    .map((c) => `<option value="${c}">${c}</option>`)
    .join("");
  document.getElementById("input-category").innerHTML = catHtml;
  document.getElementById("edit-category").innerHTML = catHtml;

  bindCascadeOptions("input-method", "input-payment", "input-transfer-target");
  bindCascadeOptions("edit-method", "edit-payment");
  document.getElementById("input-method").dispatchEvent(new Event("change"));
}

export function bindCascadeOptions(methodId, paymentId, targetId = null) {
  document.getElementById(methodId).addEventListener("change", (e) => {
    const method = e.target.value;
    const filtered = state.globalPayments.filter((p) => p.method === method);
    document.getElementById(paymentId).innerHTML = filtered
      .map((p) => `<option value="${p.name}">${p.name}</option>`)
      .join("");
    if (targetId)
      document.getElementById(targetId).innerHTML = state.globalPayments
        .map((p) => `<option value="${p.name}">${p.name}</option>`)
        .join("");
  });
}

// ================= 帳戶餘額 =================
export function renderBalances(balances) {
  const container = document.getElementById("balance-container");
  container.innerHTML = CONFIG.METHOD_TYPES.map((method) => {
    const payments = state.globalPayments.filter((p) => p.method === method);
    if (payments.length === 0) return "";
    const gridHtml = payments
      .map(
        (p) => `
            <div class="balance-item" onclick="window.openDetailsModal('${p.name}')">
                <div class="name">${p.name}</div>
                <div class="amount">$${(balances[p.name] || 0).toLocaleString()}</div>
            </div>`,
      )
      .join("");
    return `<div class="method-group"><h4 class="method-title">${method}</h4><div class="balance-grid">${gridHtml}</div></div>`;
  }).join("");
}

// ================= 儀表板數據 =================
export function updateMainDashboard() {
  const selectedMonth = document.getElementById("main-month-filter").value;
  if (!selectedMonth) return;

  let incomeTotal = 0;
  let expenseTotal = 0;
  state.monthlyExpensesData = {};
  state.monthlyIncomesData = {};

  const monthRecords = state.allRecords.filter((r) =>
    r.date.startsWith(selectedMonth),
  );

  monthRecords.forEach((r) => {
    if (r.type === "收入" && !r.desc.includes("[轉入]")) {
      incomeTotal += r.amount;
      state.monthlyIncomesData[r.category] =
        (state.monthlyIncomesData[r.category] || 0) + r.amount;
    } else if (r.type === "支出" && !r.desc.includes("[轉出]")) {
      expenseTotal += r.amount;
      state.monthlyExpensesData[r.category] =
        (state.monthlyExpensesData[r.category] || 0) + r.amount;
    }
  });

  document.getElementById("summary-income").innerText =
    `$${incomeTotal.toLocaleString()}`;
  document.getElementById("summary-expense").innerText =
    `$${expenseTotal.toLocaleString()}`;
  document.getElementById("summary-net").innerText =
    `$${(incomeTotal - expenseTotal).toLocaleString()}`;
  document.getElementById("summary-net").style.color =
    incomeTotal - expenseTotal < 0
      ? "var(--expense-color)"
      : "var(--net-color)";

  renderChart();
  renderMainHistory(monthRecords);
}

// ================= 主頁下方明細 =================
function renderMainHistory(monthRecords) {
  const container = document.getElementById("main-transaction-list");
  const displayRecords = monthRecords
    .filter((r) => r.type !== "轉帳")
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (displayRecords.length === 0) {
    container.innerHTML =
      '<p style="text-align:center; color:#64748b; padding:30px;">該月份尚無帳務紀錄</p>';
    return;
  }

  container.innerHTML = displayRecords
    .map((r) => {
      const isIncome = r.type === "收入";
      return `
        <div class="main-list-item">
            <div class="col-date">${r.date}</div>
            <div class="col-cat"><span class="${isIncome ? "income-cat" : ""}">${r.category}</span></div>
            <div class="col-desc">
                ${r.desc}
                <div class="main-list-actions">
                    <button class="tx-action-btn" onclick="window.openEditRecord(${r.rowId})">編輯</button>
                    <button class="tx-action-btn" onclick="window.deleteRecord(${r.rowId})">刪除</button>
                </div>
            </div>
            <div class="col-amt ${isIncome ? "tx-income" : "tx-expense"}">$${r.amount.toLocaleString()}</div>
            <div class="col-pay">${r.method} (${r.payment})</div>
        </div>`;
    })
    .join("");
}

// ================= 圖表渲染 =================
export function updateToggleUI(activeBtn) {
  document
    .querySelectorAll(".toggle-btn")
    .forEach((b) => b.classList.remove("active"));
  activeBtn.classList.add("active");
}

export function renderChart() {
  if (typeof Chart === "undefined") {
    setTimeout(renderChart, 500);
    return;
  }
  const ctx = document.getElementById("expense-chart");
  if (chartInstance) chartInstance.destroy();

  const dataObj =
    state.currentChartType === "expense"
      ? state.monthlyExpensesData
      : state.monthlyIncomesData;
  const keys = Object.keys(dataObj);
  const isDataEmpty = keys.length === 0;
  const colors = [
    "#8b5cf6",
    "#ef4444",
    "#f59e0b",
    "#10b981",
    "#3b82f6",
    "#ec4899",
    "#f97316",
    "#06b6d4",
    "#64748b",
  ];

  chartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: isDataEmpty ? ["尚無資料"] : keys,
      datasets: [
        {
          data: isDataEmpty ? [1] : Object.values(dataObj),
          backgroundColor: isDataEmpty ? ["#e5e7eb"] : colors,
          borderWidth: 2,
          borderColor: "#ffffff",
          hoverOffset: isDataEmpty ? 0 : 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "55%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { usePointStyle: true, padding: 20 },
        },
        tooltip: { enabled: !isDataEmpty },
      },
      onHover: (evt, el) =>
        (evt.native.target.style.cursor =
          el[0] && !isDataEmpty ? "pointer" : "default"),
      onClick: (evt, activeEl) => {
        if (activeEl.length > 0 && !isDataEmpty)
          window.openCategoryDetailsModal(
            chartInstance.data.labels[activeEl[0].index],
          );
      },
    },
  });
}

// ================= Modal 彈窗明細 =================
export function refreshModalList() {
  let filtered = state.allRecords.filter((r) =>
    r.date.startsWith(state.currentDetailFilter.month),
  );
  if (state.currentDetailFilter.type === "payment") {
    filtered = filtered.filter(
      (r) => r.payment === state.currentDetailFilter.value,
    );
  } else if (state.currentDetailFilter.type === "category") {
    const expectedType = state.currentChartType === "expense" ? "支出" : "收入";
    const filterStr = expectedType === "支出" ? "[轉出]" : "[轉入]";
    filtered = filtered.filter(
      (r) =>
        r.category === state.currentDetailFilter.value &&
        r.type === expectedType &&
        !r.desc.includes(filterStr),
    );
  }

  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  const modalBody = document.getElementById("modal-body");
  const metaKey =
    state.currentDetailFilter.type === "payment" ? "category" : "payment";

  if (filtered.length === 0) {
    modalBody.innerHTML =
      '<p style="text-align:center; color:#6b7280; padding:20px;">該月份無交易紀錄</p>';
  } else {
    modalBody.innerHTML = filtered
      .map(
        (r) => `
            <div class="tx-item">
                <div class="tx-left"><span class="tx-desc">${r.desc || r.category}</span><span class="tx-meta">${r.date} · ${r[metaKey]}</span></div>
                <div class="tx-right">
                    <span class="tx-amount ${r.type === "收入" ? "tx-income" : "tx-expense"}">${r.type === "收入" ? "+" : "-"} $${r.amount.toLocaleString()}</span>
                    <div class="tx-actions">
                        <button class="tx-action-btn" onclick="window.openEditRecord(${r.rowId})">編輯</button>
                        <button class="tx-action-btn" onclick="window.deleteRecord(${r.rowId})">刪除</button>
                    </div>
                </div>
            </div>`,
      )
      .join("");
  }
}
