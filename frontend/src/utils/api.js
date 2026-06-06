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
