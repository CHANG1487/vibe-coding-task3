import { state } from "./store.js";
import { API } from "./api.js";
import { loadAppData } from "./data.js";
import { refreshModalList } from "./ui.js";

export function initRecords() {
  // Modal Toggles
  document.getElementById("close-modal").onclick = () =>
    document.getElementById("details-modal").classList.add("hidden");
  document.getElementById("close-edit-modal").onclick = () =>
    document.getElementById("edit-modal").classList.add("hidden");
  document
    .getElementById("details-month-filter")
    .addEventListener("change", (e) => {
      state.currentDetailFilter.month = e.target.value;
      refreshModalList();
    });

  // 表單連動與送出
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

  document
    .getElementById("record-form")
    .addEventListener("submit", async (e) => {
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
          state.globalPayments.find((p) => p.name === targetPayment)?.method ||
          "";
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
        valuesToAppend = [
          [
            timestamp,
            date,
            type,
            document.getElementById("input-category").value,
            amount,
            desc,
            method,
            payment,
          ],
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
      document.getElementById("edit-modal").classList.add("hidden");
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
}

// 暴露給 HTML onClick 的全域函式
window.openDetailsModal = (accountName) => {
  state.currentDetailFilter = {
    type: "payment",
    value: accountName,
    month: document.getElementById("main-month-filter").value,
  };
  document.getElementById("modal-title").innerText = `${accountName}`;
  document.getElementById("details-month-filter").value =
    state.currentDetailFilter.month;
  refreshModalList();
  document.getElementById("details-modal").classList.remove("hidden");
};

window.openCategoryDetailsModal = (categoryName) => {
  state.currentDetailFilter = {
    type: "category",
    value: categoryName,
    month: document.getElementById("main-month-filter").value,
  };
  document.getElementById("modal-title").innerText = `${categoryName}`;
  document.getElementById("details-month-filter").value =
    state.currentDetailFilter.month;
  refreshModalList();
  document.getElementById("details-modal").classList.remove("hidden");
};

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
  const r = state.allRecords.find((x) => x.rowId === rowId);
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
  document.getElementById("edit-modal").classList.remove("hidden");
};
