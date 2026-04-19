import { API } from "./api.js";
import { state } from "./store.js";
import {
  populateOptions,
  renderBalances,
  updateMainDashboard,
  refreshModalList,
} from "./ui.js";

export async function loadAppData(showLoading = true) {
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

function processRecords(data) {
  const balances = {};
  state.allRecords = [];
  state.globalPayments.forEach((p) => {
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
      state.allRecords.push({
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
      if (type === "收入") balances[payment] += amount;
      else if (type === "支出") balances[payment] -= amount;
    }
  }

  renderBalances(balances);
  updateMainDashboard();
  if (!document.getElementById("details-modal").classList.contains("hidden"))
    refreshModalList();
}
