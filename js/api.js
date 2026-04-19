import { CONFIG } from "./config.js";

export const googleAuth = {
  gapiInited: false,
  gisInited: false,
  tokenClient: null,
  onAuthSuccess: null,
};

// 暴露給 HTML 載入後觸發的全域函式
window.gapiLoaded = () => {
  gapi.load("client", async () => {
    try {
      await gapi.client.init({
        discoveryDocs: [
          "https://sheets.googleapis.com/$discovery/rest?version=v4",
        ],
      });
      googleAuth.gapiInited = true;
      checkAuth();
    } catch (err) {
      console.error("GAPI 錯誤", err);
    }
  });
};

window.gisLoaded = () => {
  googleAuth.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: CONFIG.SCOPES,
    callback: (tokenResponse) => {
      if (tokenResponse.error !== undefined) return;
      localStorage.setItem("auth_time", Date.now());
      localStorage.setItem("access_token", tokenResponse.access_token);
      if (googleAuth.onAuthSuccess) googleAuth.onAuthSuccess();
    },
  });
  googleAuth.gisInited = true;
  checkAuth();
};

function checkAuth() {
  if (!googleAuth.gapiInited || !googleAuth.gisInited) return;
  const authTime = localStorage.getItem("auth_time");
  const token = localStorage.getItem("access_token");
  if (authTime && token) {
    if (
      (Date.now() - parseInt(authTime)) / (1000 * 60 * 60 * 24) <
      CONFIG.LOGIN_EXPIRY_DAYS
    ) {
      gapi.client.setToken({ access_token: token });
      if (googleAuth.onAuthSuccess) googleAuth.onAuthSuccess();
      return;
    }
  }
  document.getElementById("login-screen").classList.remove("hidden");
}

export const API = {
  login: () => googleAuth.tokenClient.requestAccessToken({ prompt: "consent" }),
  refreshToken: () => {
    if (googleAuth.tokenClient)
      googleAuth.tokenClient.requestAccessToken({ prompt: "" });
  },
  logout: () => {
    const token = gapi.client.getToken();
    if (token !== null) {
      google.accounts.oauth2.revoke(token.access_token);
      gapi.client.setToken("");
    }
    localStorage.clear();
  },
  batchGet: async (ranges) => {
    return await gapi.client.sheets.spreadsheets.values.batchGet({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      ranges: ranges,
    });
  },
  append: async (range, values) => {
    return await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: range,
      valueInputOption: "USER_ENTERED",
      resource: { values },
    });
  },
  update: async (range, values) => {
    return await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: range,
      valueInputOption: "USER_ENTERED",
      resource: { values },
    });
  },
};
