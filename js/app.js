import { CONFIG } from "./config.js";
import { googleAuth, API, initGoogleApis } from "./api.js";

let chartInstance = null;
let allRecords = [];
let monthlyExpensesData = {};
let monthlyIncomesData = {};
let currentChartType = "expense";
let currentDetailFilter = { type: "", value: "", month: "" };

let globalCategories = [];
let globalPayments = [];
let tempCategories = [];
let tempPayments = [];

// === 初始化 ===
googleAuth.onAuthSuccess = () => {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("main-screen").classList.remove("hidden");
  document.getElementById("input-date").valueAsDate = new Date();
  loadAppData();
};

document.getElementById("login-btn").onclick = API.login;
document.getElementById("logout-btn").onclick = () => {
  API.logout();
  document.getElementById("main-screen").classList.add("hidden");
  document.getElementById("login-screen").classList.remove("hidden");
};

initGoogleApis();

// === 資料載入 ===
async function loadAppData(showLoading = true) {
  if (showLoading)
    Swal.fire({
      title: "資料同步中...",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });
  try {
    const response = await API.batchGet(["欄位表!A:E", "記帳紀錄!A:H"]);
    populateOptions(response.result.valueRanges[0].values || []);
    processRecords(response.result.valueRanges[1].values || []);
    if (showLoading) Swal.close();
  } catch (err) {
    console.error(err);
    if (showLoading)
      Swal.fire({ icon: "error", title: "連線失敗", text: "請確認授權。" });
    if (err.status === 401) API.refreshToken();
  }
}

function populateOptions(data) {
  globalCategories = [];
  globalPayments = [];
  if (data.length > 1) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][1]) globalCategories.push(data[i][1]);
      if (data[i][2]) {
        const initVal =
          parseInt(String(data[i][3] || "0").replace(/,/g, ""), 10) || 0;
        globalPayments.push({
          name: data[i][2],
          initial: initVal,
          method: data[i][4] || "現金",
        });
      }
    }
  }
  const catHtml = globalCategories
    .map((c) => `<option value="${c}">${c}</option>`)
    .join("");
  document.getElementById("input-category").innerHTML = catHtml;
  document.getElementById("edit-category").innerHTML = catHtml;
  bindCascadeOptions("input-method", "input-payment", "input-transfer-target");
  bindCascadeOptions("edit-method", "edit-payment");
  document.getElementById("input-method").dispatchEvent(new Event("change"));
}

function bindCascadeOptions(methodId, paymentId, targetId = null) {
  document.getElementById(methodId).addEventListener("change", (e) => {
    const method = e.target.value;
    const filtered = globalPayments.filter((p) => p.method === method);
    document.getElementById(paymentId).innerHTML = filtered
      .map((p) => `<option value="${p.name}">${p.name}</option>`)
      .join("");
    if (targetId)
      document.getElementById(targetId).innerHTML = globalPayments
        .map((p) => `<option value="${p.name}">${p.name}</option>`)
        .join("");
  });
}

function processRecords(data) {
  const balances = {};
  monthlyExpensesData = {};
  monthlyIncomesData = {};
  const currentMonth = new Date().toISOString().slice(0, 7);
  allRecords = [];

  globalPayments.forEach((p) => {
    balances[p.name] = p.initial;
  });

  if (data.length > 1) {
    for (let i = 1; i < data.length; i++) {
      const row = data[i] || [];
      const timestampStr = String(row[0] || "");
      const date = String(row[1] || "");
      const type = String(row[2] || "");
      const category = String(row[3] || "");
      const amountStr = String(row[4] || "");
      const desc = String(row[5] || "");
      const method = String(row[6] || "");
      const payment = String(row[7] || "");
      const amount = parseInt(amountStr.replace(/,/g, ""), 10);

      if (isNaN(amount) || !payment) continue;
      const rowId = i + 1;
      allRecords.push({
        rowId,
        timestamp: timestampStr,
        date,
        type,
        category,
        amount,
        desc,
        method,
        payment,
      });

      if (balances[payment] === undefined) balances[payment] = 0;
      if (type === "收入") {
        balances[payment] += amount;
        if (date.startsWith(currentMonth) && !desc.includes("[轉入]"))
          monthlyIncomesData[category] =
            (monthlyIncomesData[category] || 0) + amount;
      } else if (type === "支出") {
        balances[payment] -= amount;
        if (date.startsWith(currentMonth) && !desc.includes("[轉出]"))
          monthlyExpensesData[category] =
            (monthlyExpensesData[category] || 0) + amount;
      }
    }
  }
  renderBalances(balances);
  renderChart();
  if (!document.getElementById("details-modal").classList.contains("hidden"))
    refreshModalList();
}

function renderBalances(balances) {
  const container = document.getElementById("balance-container");
  container.innerHTML = CONFIG.METHOD_TYPES.map((method) => {
    const payments = globalPayments.filter((p) => p.method === method);
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

// === 圖表切換 ===
document.getElementById("toggle-expense").onclick = (e) => {
  currentChartType = "expense";
  updateToggleUI(e.target);
  renderChart();
};
document.getElementById("toggle-income").onclick = (e) => {
  currentChartType = "income";
  updateToggleUI(e.target);
  renderChart();
};
function updateToggleUI(activeBtn) {
  document
    .querySelectorAll(".toggle-btn")
    .forEach((b) => b.classList.remove("active"));
  activeBtn.classList.add("active");
}

function renderChart() {
  if (typeof Chart === "undefined") {
    setTimeout(renderChart, 500);
    return;
  }
  const ctx = document.getElementById("expense-chart");
  if (chartInstance) chartInstance.destroy();

  const dataObj =
    currentChartType === "expense" ? monthlyExpensesData : monthlyIncomesData;
  const keys = Object.keys(dataObj);
  const isDataEmpty = keys.length === 0;

  chartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: isDataEmpty ? ["尚無資料"] : keys,
      datasets: [
        {
          data: isDataEmpty ? [1] : Object.values(dataObj),
          backgroundColor: isDataEmpty
            ? ["#e5e7eb"]
            : [
                "#3b82f6",
                "#ef4444",
                "#10b981",
                "#f59e0b",
                "#8b5cf6",
                "#ec4899",
                "#64748b",
                "#14b8a6",
              ],
          borderWidth: 0,
          hoverOffset: isDataEmpty ? 0 : 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: {
          position: "right",
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

// === 紀錄明細與操作 Modal ===
const detailsModal = document.getElementById("details-modal");
const editModal = document.getElementById("edit-modal");
document.getElementById("close-modal").onclick = () =>
  detailsModal.classList.add("hidden");
document.getElementById("close-edit-modal").onclick = () =>
  editModal.classList.add("hidden");
document
  .getElementById("details-month-filter")
  .addEventListener("change", (e) => {
    currentDetailFilter.month = e.target.value;
    refreshModalList();
  });

window.openDetailsModal = (accountName) => {
  currentDetailFilter = {
    type: "payment",
    value: accountName,
    month: new Date().toISOString().slice(0, 7),
  };
  document.getElementById("modal-title").innerText = `${accountName}`;
  document.getElementById("details-month-filter").value =
    currentDetailFilter.month;
  refreshModalList();
  detailsModal.classList.remove("hidden");
};

window.openCategoryDetailsModal = (categoryName) => {
  currentDetailFilter = {
    type: "category",
    value: categoryName,
    month: new Date().toISOString().slice(0, 7),
  };
  document.getElementById("modal-title").innerText = `${categoryName}`;
  document.getElementById("details-month-filter").value =
    currentDetailFilter.month;
  refreshModalList();
  detailsModal.classList.remove("hidden");
};

function refreshModalList() {
  let filtered = allRecords.filter((r) =>
    r.date.startsWith(currentDetailFilter.month),
  );
  if (currentDetailFilter.type === "payment") {
    filtered = filtered.filter((r) => r.payment === currentDetailFilter.value);
  } else if (currentDetailFilter.type === "category") {
    const expectedType = currentChartType === "expense" ? "支出" : "收入";
    const filterStr = expectedType === "支出" ? "[轉出]" : "[轉入]";
    filtered = filtered.filter(
      (r) =>
        r.category === currentDetailFilter.value &&
        r.type === expectedType &&
        !r.desc.includes(filterStr),
    );
  }

  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  const modalBody = document.getElementById("modal-body");
  const metaKey =
    currentDetailFilter.type === "payment" ? "category" : "payment";

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

window.deleteRecord = async (rowId) => {
  const confirm = await Swal.fire({
    title: "確定要刪除這筆紀錄？",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "刪除",
    confirmButtonColor: "#ef4444",
  });
  if (confirm.isConfirmed) {
    Swal.fire({
      title: "刪除中...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    try {
      await API.update(`記帳紀錄!A${rowId}:H${rowId}`, [
        ["", "", "", "", "", "", "", ""],
      ]);
      await Swal.fire({
        icon: "success",
        title: "已刪除！",
        timer: 1500,
        showConfirmButton: false,
      });
      loadAppData(false);
    } catch (err) {
      Swal.fire("錯誤", "刪除失敗", "error");
    }
  }
};

window.openEditRecord = (rowId) => {
  const r = allRecords.find((x) => x.rowId === rowId);
  if (!r) return;
  document.getElementById("edit-row-id").value = r.rowId;
  document.getElementById("edit-timestamp").value = r.timestamp;
  document.getElementById("edit-date").value = r.date;
  document.getElementById("edit-type").value = r.type;
  document.getElementById("edit-category").value = r.category;
  document.getElementById("edit-amount").value = r.amount;
  document.getElementById("edit-method").value = r.method;
  document.getElementById("edit-method").dispatchEvent(new Event("change"));
  document.getElementById("edit-payment").value = r.payment;
  document.getElementById("edit-desc").value = r.desc;
  editModal.classList.remove("hidden");
};

document.getElementById("edit-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  Swal.fire({
    title: "更新中...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });
  const rowId = document.getElementById("edit-row-id").value;
  const values = [
    [
      document.getElementById("edit-timestamp").value,
      document.getElementById("edit-date").value,
      document.getElementById("edit-type").value,
      document.getElementById("edit-category").value,
      document.getElementById("edit-amount").value,
      document.getElementById("edit-desc").value,
      document.getElementById("edit-method").value,
      document.getElementById("edit-payment").value,
    ],
  ];
  try {
    await API.update(`記帳紀錄!A${rowId}:H${rowId}`, values);
    editModal.classList.add("hidden");
    await Swal.fire({
      icon: "success",
      title: "更新成功！",
      timer: 1500,
      showConfirmButton: false,
    });
    loadAppData(false);
  } catch (err) {
    Swal.fire("錯誤", "更新失敗", "error");
  }
});

// === 管理欄位 (Settings) 與修改分類/付款 ===
const settingsModal = document.getElementById("settings-modal");
document.getElementById("settings-btn").onclick = () => {
  tempCategories = [...globalCategories];
  tempPayments = globalPayments.map((p) => ({ ...p }));
  renderSettingsLists();
  settingsModal.classList.remove("hidden");
};
document.getElementById("close-settings-modal").onclick = () =>
  settingsModal.classList.add("hidden");

function renderSettingsLists() {
  document.getElementById("settings-category-list").innerHTML = tempCategories
    .map(
      (item, index) => `
        <li><span>${item}</span><div class="setting-actions">
            <button class="edit-item-btn" onclick="window.editSettingCategory(${index})">✎</button>
            <button class="delete-item-btn" onclick="window.removeSettingItem('category', ${index})">✖</button>
        </div></li>`,
    )
    .join("");

  document.getElementById("settings-payment-list").innerHTML = tempPayments
    .map(
      (item, index) => `
        <li>
            <div style="display:flex; flex-direction:column; justify-content:center;">
                <span>[${item.method}] ${item.name}</span>
                <span style="color:var(--text-muted); font-size: 12px;">初始餘額 $${item.initial.toLocaleString()}</span>
            </div>
            <div class="setting-actions">
                <button class="edit-item-btn" onclick="window.editSettingPayment(${index})">✎</button>
                <button class="delete-item-btn" onclick="window.removeSettingItem('payment', ${index})">✖</button>
            </div>
        </li>`,
    )
    .join("");
}

document.getElementById("add-category-btn").onclick = () => {
  const input = document.getElementById("new-category-input");
  if (input.value.trim()) {
    tempCategories.push(input.value.trim());
    input.value = "";
    renderSettingsLists();
  }
};

document.getElementById("add-payment-btn").onclick = () => {
  const nameInput = document.getElementById("new-payment-input");
  if (nameInput.value.trim()) {
    tempPayments.push({
      name: nameInput.value.trim(),
      initial:
        parseInt(document.getElementById("new-payment-initial").value, 10) || 0,
      method: document.getElementById("new-payment-method").value,
    });
    nameInput.value = "";
    document.getElementById("new-payment-initial").value = "0";
    renderSettingsLists();
  }
};

window.removeSettingItem = (type, index) => {
  if (type === "category") tempCategories.splice(index, 1);
  else tempPayments.splice(index, 1);
  renderSettingsLists();
};

// 編輯 Category
window.editSettingCategory = async (index) => {
  const { value: newVal } = await Swal.fire({
    title: "編輯分類",
    input: "text",
    inputValue: tempCategories[index],
    showCancelButton: true,
  });
  if (newVal && newVal.trim()) {
    tempCategories[index] = newVal.trim();
    renderSettingsLists();
  }
};

// 編輯 Payment
window.editSettingPayment = async (index) => {
  const p = tempPayments[index];
  const { value: formValues } = await Swal.fire({
    title: "編輯帳戶",
    html: `
            <select id="swal-method" class="swal2-input" style="width: 80%; font-size: 16px;">
                ${CONFIG.METHOD_TYPES.map((m) => `<option value="${m}" ${m === p.method ? "selected" : ""}>${m}</option>`).join("")}
            </select>
            <input id="swal-name" class="swal2-input" placeholder="帳戶名稱" value="${p.name}" style="width: 80%;">
            <input id="swal-initial" type="number" class="swal2-input" placeholder="期初餘額" value="${p.initial}" style="width: 80%;">
        `,
    focusConfirm: false,
    showCancelButton: true,
    preConfirm: () => {
      const name = document.getElementById("swal-name").value.trim();
      if (!name) {
        Swal.showValidationMessage("請輸入帳戶名稱");
        return false;
      }
      return {
        method: document.getElementById("swal-method").value,
        name,
        initial:
          parseInt(document.getElementById("swal-initial").value, 10) || 0,
      };
    },
  });
  if (formValues) {
    tempPayments[index] = formValues;
    renderSettingsLists();
  }
};

document.getElementById("save-settings-btn").onclick = async () => {
  Swal.fire({
    title: "儲存欄位中...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });
  const values = [["Type", "Category", "Payment", "InitialBalance", "Method"]];
  const maxRows = Math.max(
    CONFIG.FIXED_TYPES.length,
    tempCategories.length,
    tempPayments.length,
    50,
  );
  for (let i = 0; i < maxRows; i++) {
    values.push([
      CONFIG.FIXED_TYPES[i] || "",
      tempCategories[i] || "",
      tempPayments[i] ? tempPayments[i].name : "",
      tempPayments[i] ? tempPayments[i].initial : "",
      tempPayments[i] ? tempPayments[i].method : "",
    ]);
  }
  try {
    await API.update("欄位表!A1:E", values);
    settingsModal.classList.add("hidden");
    await Swal.fire({
      icon: "success",
      title: "欄位更新成功！",
      text: "註：修改名稱不會自動更新過去的記帳歷史紀錄",
      timer: 2000,
      showConfirmButton: false,
    });
    loadAppData();
  } catch (err) {
    Swal.fire({ icon: "error", title: "儲存失敗" });
  }
};

// === 新增紀錄表單 ===
document.getElementById("input-type").addEventListener("change", (e) => {
  const isTransfer = e.target.value === "轉帳";
  document
    .getElementById("transfer-target-group")
    .classList.toggle("hidden", !isTransfer);
  document
    .getElementById("category-group")
    .classList.toggle("hidden", isTransfer);
  document.getElementById("payment-label").innerText = isTransfer
    ? "轉出帳戶"
    : "帳戶/卡片";
  document.getElementById("input-desc").value = isTransfer ? "帳戶互轉" : "";
});

document.getElementById("record-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("submit-btn");
  btn.disabled = true;
  Swal.fire({
    title: "儲存紀錄中...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });

  const date = document.getElementById("input-date").value;
  const type = document.getElementById("input-type").value;
  const amount = document.getElementById("input-amount").value;
  const method = document.getElementById("input-method").value;
  const payment = document.getElementById("input-payment").value;
  const desc = document.getElementById("input-desc").value;
  const timestamp = Date.now();
  let valuesToAppend = [];

  if (type === "轉帳") {
    const targetPayment = document.getElementById(
      "input-transfer-target",
    ).value;
    const targetMethod =
      globalPayments.find((p) => p.name === targetPayment)?.method || "";
    valuesToAppend = [
      [
        timestamp,
        date,
        "支出",
        "其他雜項",
        amount,
        `[轉出] ${desc}`,
        method,
        payment,
      ],
      [
        timestamp + 1,
        date,
        "收入",
        "其他雜項",
        amount,
        `[轉入] ${desc}`,
        targetMethod,
        targetPayment,
      ],
    ];
  } else {
    const category = document.getElementById("input-category").value;
    valuesToAppend = [
      [timestamp, date, type, category, amount, desc, method, payment],
    ];
  }

  try {
    await API.append("記帳紀錄!A:H", valuesToAppend);
    await Swal.fire({
      icon: "success",
      title: "紀錄成功！",
      timer: 1500,
      showConfirmButton: false,
    });
    document.getElementById("input-amount").value = "";
    if (type !== "轉帳") document.getElementById("input-desc").value = "";
    loadAppData(false);
  } catch (err) {
    Swal.fire({ icon: "error", title: "儲存失敗" });
  } finally {
    btn.disabled = false;
  }
});

window.onclick = (e) => {
  if (e.target === detailsModal) detailsModal.classList.add("hidden");
  if (e.target === editModal) editModal.classList.add("hidden");
  if (e.target === settingsModal) settingsModal.classList.add("hidden");
};
