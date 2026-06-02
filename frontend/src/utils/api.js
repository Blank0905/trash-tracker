// 儲存探測完後的最終極致網址，避免每次 fetch 都要重新探測
let cachedBackendUrl = null;

export const getBackendUrl = async () => {
  // 如果已經探測過，直接回傳快取結果
  if (cachedBackendUrl) return cachedBackendUrl;

  const publicUrl = "http://knsdmty.sytes.net:8000";
  const localUrl = "http://localhost:8000";

  try {
    // 💡 核心機制：1秒快攻探測
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000); // 超過 1 秒沒回應就強制中斷

    // 戳組員寫的 Flask 原生 /health 健康檢查節點
    await fetch(`${publicUrl}/health`, { 
      signal: controller.signal,
      mode: 'cors' 
    });
    
    clearTimeout(timeoutId);
    cachedBackendUrl = publicUrl; // 公網活著！全面使用公網
    console.log("📡 [智慧探測] 成功連線至 No-IP 公網後端伺服器");
  } catch (e) {
    cachedBackendUrl = localUrl; // 公網不通，自動降級回同學本機
    console.log("🏠 [智慧探測] 公網未啟動或逾時，自動無縫切換回本機 localhost");
  }

  return cachedBackendUrl;
};