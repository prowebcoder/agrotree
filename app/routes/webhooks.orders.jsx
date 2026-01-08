// app/routes/webhooks.orders.jsx
import { authenticate } from "../shopify.server";
import { sendOrderToExternalAPI } from "../external-api.server";

export async function action({ request }) {
  try {
    /* ----------------------------------------------------
     * 1️⃣ Authenticate webhook AND get parsed body
     * -------------------------------------------------- */
    const { admin, shop, payload } = await authenticate.webhook(request);

    // 'payload' already contains the parsed order data!
    const order = payload;

    console.log("📦 Order webhook received:", {
      shop,
      orderId: order.id,
      orderName: order.name,
      orderIdType: typeof order.id,
      orderIdValue: order.id,
      items: order.line_items?.length || 0,
    });

    /* ----------------------------------------------------
     * 2️⃣ Load server helpers
     * -------------------------------------------------- */
    const {
      getAppMetafields,
      getAllAppMetafields,
      parseMetafields,
      isUsageLimitReached,
      setAppMetafield,
      updateStatistics,
    } = await import("../shopify.server");

    /* ----------------------------------------------------
     * 3️⃣ Load app metafields
     * -------------------------------------------------- */
    const metafields = await getAppMetafields(admin);
    const parsedFields = parseMetafields(metafields);

    const donationProductId =
      parsedFields.tree_planting?.donation_product_id ||
      parsedFields.tree_planting?.product_id;

    const donationVariantId =
      parsedFields.tree_planting?.donation_variant_id;

    if (!donationProductId || !donationVariantId) {
      console.log("ℹ️ No donation product configured");
      return new Response(null, { status: 200 });
    }

    /* ----------------------------------------------------
     * 4️⃣ Helpers - IMPROVED ID NORMALIZATION
     * -------------------------------------------------- */
    const normalizeId = (gid) => {
      if (!gid) return null;
      if (typeof gid === 'number') return gid.toString();
      if (typeof gid === 'string' && gid.includes('gid://')) {
        const parts = gid.split('/');
        return parts[parts.length - 1];
      }
      return gid?.toString() || null;
    };

    // Helper to extract order ID safely
    const extractOrderId = (orderId) => {
      if (!orderId) return 'unknown';
      if (typeof orderId === 'number') return orderId.toString();
      if (typeof orderId === 'string') {
        if (orderId.includes('gid://')) {
          const parts = orderId.split('/');
          return parts[parts.length - 1];
        }
        return orderId;
      }
      return String(orderId);
    };

    const productId = normalizeId(donationProductId);
    const variantId = normalizeId(donationVariantId);
    const orderId = extractOrderId(order.id);

    console.log("🔍 Looking for donation product:", { productId, variantId });

    /* ----------------------------------------------------
     * 5️⃣ Detect donation line item - FIXED LOGIC
     * -------------------------------------------------- */
    let donationQty = 0;
    let donationItem = null;

    for (const item of order.line_items || []) {
      // Debug log to see what we're checking
      console.log("🔍 Checking line item:", {
        itemId: item.id,
        itemProductId: item.product_id,
        itemVariantId: item.variant_id,
        normalizedItemProductId: normalizeId(item.product_id),
        normalizedItemVariantId: normalizeId(item.variant_id),
        properties: item.properties
      });

      // Get IDs from the line item
      const itemProductId = normalizeId(item.product_id);
      const itemVariantId = normalizeId(item.variant_id);
      
      // Check by variant ID (most reliable)
      if (variantId && itemVariantId && itemVariantId === variantId) {
        console.log("✅ Found by variant ID match!");
        donationQty += item.quantity || 1;
        donationItem = item;
        break;
      }
      
      // Check by product ID
      if (productId && itemProductId && itemProductId === productId) {
        console.log("✅ Found by product ID match!");
        donationQty += item.quantity || 1;
        donationItem = item;
        break;
      }
      
      // Check by custom property
      if (item.properties?.some(p => 
        p.name === "_tree_donation" && 
        (p.value === "true" || p.value === true || p.value === "1")
      )) {
        console.log("✅ Found by custom property!");
        donationQty += item.quantity || 1;
        donationItem = item;
        break;
      }
    }

    if (!donationItem || donationQty === 0) {
      console.log("ℹ️ No donation item found in order. Order line items:", 
        order.line_items?.map(item => ({
          name: item.name,
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: item.quantity
        }))
      );
      return new Response(null, { status: 200 });
    }

    console.log(`🌱 Donation detected → ${donationQty} tree(s)`, {
      itemName: donationItem.name,
      price: donationItem.price
    });

    /* ----------------------------------------------------
     * 6️⃣ Enforce free-plan usage limits
     * -------------------------------------------------- */
    const limitReached = await isUsageLimitReached(admin);

    if (limitReached) {
      console.log("🚫 Usage limit reached");

      await setAppMetafield(admin, {
        namespace: "tree_planting",
        key: `limit_exceeded_${Date.now()}`,
        type: "json",
        value: JSON.stringify({
          orderId: orderId,
          attempted: donationQty,
          timestamp: new Date().toISOString(),
        }),
      });

      return new Response(null, { status: 200 });
    }

    /* ----------------------------------------------------
     * 7️⃣ Increment Shopify-side usage (FIXED VERSION)
     * -------------------------------------------------- */
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const usageKey = `usage_${currentMonth}`;
      
      // Get all metafields to calculate current usage
      const allMetafields = await getAllAppMetafields(admin);
      const allParsedFields = parseMetafields(allMetafields);
      
      // Get current monthly usage
      const currentUsage = parseInt(allParsedFields[usageKey]) || 0;
      const newUsage = currentUsage + donationQty;
      
      // Update monthly usage
      await setAppMetafield(admin, {
        key: usageKey,
        type: 'number_integer',
        value: newUsage.toString(),
      });
      
      // Get total usage
      const totalUsage = parseInt(allParsedFields.total_usage) || 0;
      const newTotalUsage = totalUsage + donationQty;
      
      // Update total usage
      await setAppMetafield(admin, {
        key: 'total_usage',
        type: 'number_integer',
        value: newTotalUsage.toString(),
      });
      
      // Update statistics
      await updateStatistics(admin, donationQty);
      
      console.log(`📈 Shopify usage updated → Monthly: ${newUsage}, Total: ${newTotalUsage}`);
    } catch (error) {
      console.error('⚠️ Usage increment failed, but continuing with external API:', error.message);
      // Don't fail the webhook, just log and continue
    }

    /* ----------------------------------------------------
     * 8️⃣ Store order snapshot in metafields (FIXED - no .split())
     * -------------------------------------------------- */
    const unitPrice = parseFloat(
      donationItem.price || donationItem.price_set?.shop_money?.amount || "0"
    );

    // Use the extracted order ID instead of trying to split
    await setAppMetafield(admin, {
      namespace: "tree_planting",
      key: `order_${orderId}`,
      type: "json",
      value: JSON.stringify({
        orderId: order.id, // Keep original ID
        orderName: order.name,
        trees: donationQty,
        amount: unitPrice * donationQty,
        currency: order.currency || "USD",
        createdAt: new Date().toISOString(),
      }),
    });

    /* ----------------------------------------------------
     * 9️⃣ SEND TO EXTERNAL BACKEND
     * -------------------------------------------------- */
    try {
      const externalResult = await sendOrderToExternalAPI({
     shopDomain: shop,
  orderId: order.id,
  orderName: order.name || orderId,
  treesPlanted: donationQty,
  amount: unitPrice * donationQty, // ACTUAL AMOUNT, not $1 per tree
  currency: order.currency || "USD",
  customerEmail: order.customer?.email,
  timestamp: new Date().toISOString()
      });

      console.log("🌍 External API sync success:", externalResult);
    } catch (err) {
      console.error("❌ External API sync FAILED:", {
        shop,
        orderId: orderId,
        error: err.message,
        stack: err.stack
      });
      // DO NOT throw — webhook must always return 200
    }

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("🔥 Webhook processing error:", {
      error: error.message,
      stack: error.stack
    });
    return new Response(null, { status: 200 });
  }
}