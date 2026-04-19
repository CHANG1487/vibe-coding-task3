import { CONFIG } from "./config.js";

export const googleAuth = {
  gapiInited: false,
  gisInited: false,
  tokenClient: null,
  onAuthSuccess: null,
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

// 新增：確保模組載入後，才動態生成標籤去抓取 Google 的腳本
export function initGoogleApis() {
  const gapiScript = document.createElement("script");
  gapiScript.src = "https://apis.google.com/js/api.js";
  gapiScript.async = true;
  gapiScript.defer = true;
  gapiScript.onload = () => {
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
  document.body.appendChild(gapiScript);

  const gisScript = document.createElement("script");
  gisScript.src = "https://accounts.google.com/gsi/client";
  gisScript.async = true;
  gisScript.defer = true;
  gisScript.onload = () => {
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
  document.body.appendChild(gisScript);
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
