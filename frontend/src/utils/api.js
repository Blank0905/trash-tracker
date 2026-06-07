let cachedBackendUrl = null;

export const getBackendUrl = async () => {
  if (cachedBackendUrl) return cachedBackendUrl;

  const configuredUrl = process.env.REACT_APP_BACKEND_URL?.trim();
  if (configuredUrl) {
    cachedBackendUrl = configuredUrl.replace(/\/+$/, "");
    return cachedBackendUrl;
  }

  const publicUrl = "http://knsdmty.sytes.net:8000";
  const localUrl = "http://localhost:8000";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);

    await fetch(`${publicUrl}/health`, {
      signal: controller.signal,
      mode: "cors",
    });

    clearTimeout(timeoutId);
    cachedBackendUrl = publicUrl;
  } catch (e) {
    cachedBackendUrl = localUrl;
  }

  return cachedBackendUrl;
};

// 從 localStorage 拿管理者 token，組成 Authorization header
export const authHeader = () => {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// 管理後台專用 fetch：自動帶 Authorization、收到 401 就清除登入狀態回登入頁
export const authedFetch = async (url, options = {}) => {
  const headers = {
    ...(options.headers || {}),
    ...authHeader(),
  };
  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    localStorage.clear();
    // 強制回到根路徑，App.js 會偵測 token 不存在自動切回 Login
    window.location.href = '/';
  }
  return response;
};
