import { googleAuth, API, initGoogleApis } from "./api.js";
import { loadAppData } from "./data.js";
import { initRecords } from "./records.js";
import { initSettings } from "./settings.js";
import { updateMainDashboard, updateToggleUI, renderChart } from "./ui.js";
import { state } from "./store.js";

// === 初始化與登入驗證 ===
googleAuth.onAuthSuccess = () => {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("main-screen").classList.remove("hidden");

  const today = new Date();
  document.getElementById("input-date").valueAsDate = today;
  document.getElementById("main-month-filter").value = today
    .toISOString()
    .slice(0, 7);

  loadAppData();
};

document.getElementById("login-btn").onclick = API.login;
document.getElementById("logout-btn").onclick = () => {
  API.logout();
  document.getElementById("main-screen").classList.add("hidden");
  document.getElementById("login-screen").classList.remove("hidden");
};

// === 綁定圖表與面板切換事件 ===
document
  .getElementById("main-month-filter")
  .addEventListener("change", updateMainDashboard);
document.getElementById("toggle-expense").onclick = (e) => {
  state.currentChartType = "expense";
  updateToggleUI(e.target);
  renderChart();
};
document.getElementById("toggle-income").onclick = (e) => {
  state.currentChartType = "income";
  updateToggleUI(e.target);
  renderChart();
};

// === 全域點擊防呆 (點擊背景關閉 Modal) ===
window.addEventListener("click", (e) => {
  const detailsModal = document.getElementById("details-modal");
  const editModal = document.getElementById("edit-modal");
  const settingsModal = document.getElementById("settings-modal");
  if (e.target === detailsModal) detailsModal.classList.add("hidden");
  if (e.target === editModal) editModal.classList.add("hidden");
  if (e.target === settingsModal) settingsModal.classList.add("hidden");
});

// 啟動應用程式
initRecords();
initSettings();
initGoogleApis();
