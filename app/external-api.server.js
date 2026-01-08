const EXTERNAL_API = "https://tree-backend-navy.vercel.app/api";

/**
 * ✅ Store sync → correct endpoint
 */
export async function syncStoreToExternalAPI(storeData) {
  return fetch(`${EXTERNAL_API}/store/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(storeData),
  }).then(res => res.json());
}

/**
 * ✅ Order usage sync → correct endpoint
 */
export async function sendOrderToExternalAPI(orderData) {
  try {
    const res = await fetch(`${EXTERNAL_API}/usage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData),
    });

    const text = await res.text();

    console.log("🌍 External API response:", {
      status: res.status,
      ok: res.ok,
      body: text,
    });

    if (!res.ok) {
      throw new Error(`External API failed: ${res.status}`);
    }

    return JSON.parse(text);
  } catch (err) {
    console.error("❌ External API call failed:", err);
    throw err;
  }
}


/**
 * (optional dashboard usage)
 */
export async function getUsageFromExternalAPI(shopDomain) {
  return fetch(`${EXTERNAL_API}/usage/${shopDomain}`)
    .then(res => res.json());
}
