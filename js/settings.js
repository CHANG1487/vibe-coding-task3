import { state } from "./store.js";
import { API } from "./api.js";
import { loadAppData } from "./data.js";
import { CONFIG } from "./config.js";

let tempCategories = [];
let tempPayments = [];

export function initSettings() {
  document.getElementById("settings-btn").onclick = () => {
    tempCategories = [...state.globalCategories];
    tempPayments = state.globalPayments.map((p) => ({ ...p }));
    renderSettingsLists();
    document.getElementById("settings-modal").classList.remove("hidden");
  };
  document.getElementById("close-settings-modal").onclick = () =>
    document.getElementById("settings-modal").classList.add("hidden");

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
          parseInt(document.getElementById("new-payment-initial").value, 10) ||
          0,
        method: document.getElementById("new-payment-method").value,
      });
      nameInput.value = "";
      document.getElementById("new-payment-initial").value = "0";
      renderSettingsLists();
    }
  };

  document.getElementById("save-settings-btn").onclick = async () => {
    Swal.fire({
      title: "儲存欄位中...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
    const values = [
      ["Type", "Category", "Payment", "InitialBalance", "Method"],
    ];
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
      document.getElementById("settings-modal").classList.add("hidden");
      await Swal.fire({
        icon: "success",
        title: "欄位更新成功！",
        text: "註：修改名稱不會自動更新過去的記帳紀錄",
        timer: 2000,
        showConfirmButton: false,
      });
      loadAppData();
    } catch (err) {
      Swal.fire({ icon: "error", title: "儲存失敗" });
    }
  };
}

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

window.removeSettingItem = (type, index) => {
  if (type === "category") tempCategories.splice(index, 1);
  else tempPayments.splice(index, 1);
  renderSettingsLists();
};

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
