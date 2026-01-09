// app/routes/webhooks.orders.jsx
import { authenticate } from "../shopify.server";
import { sendOrderToExternalAPI } from "../external-api.server";

export async function action({ request }) {
  try {
    /* ----------------------------------------------------
     * 1️⃣ Authenticate webhook
     * -------------------------------------------------- */
    const { shop, payload } = await authenticate.webhook(request);
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
     * 2️⃣ Get admin client for this shop
     * -------------------------------------------------- */
    // Create a new request context to get an admin client
    let admin;
    try {
      // Try to get admin client from the authenticated request
      const adminContext = await authenticate.admin(request);
      admin = adminContext.admin;
    } catch (error) {
      console.log("⚠️ Could not get admin client directly:", error.message);
      admin = null;
    }

    /* ----------------------------------------------------
     * 3️⃣ Load server helpers
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
     * 4️⃣ Check if we have admin access
     * -------------------------------------------------- */
    let donationProductId = null;
    let donationVariantId = null;
    let parsedFields = {};

    if (admin && admin.graphql) {
      /* ----------------------------------------------------
       * 5️⃣ Load app metafields (with admin access)
       * -------------------------------------------------- */
      const metafields = await getAppMetafields(admin);
      parsedFields = parseMetafields(metafields);

      donationProductId =
        parsedFields.tree_planting?.donation_product_id ||
        parsedFields.tree_planting?.product_id;

      donationVariantId =
        parsedFields.tree_planting?.donation_variant_id;

      if (!donationProductId || !donationVariantId) {
        console.log("ℹ️ No donation product configured in metafields");
      }
    } else {
      console.log("⚠️ No admin access, checking order properties only");
    }

    /* ----------------------------------------------------
     * 6️⃣ Helpers - ID NORMALIZATION
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

    const productId = donationProductId ? normalizeId(donationProductId) : null;
    const variantId = donationVariantId ? normalizeId(donationVariantId) : null;
    const orderId = extractOrderId(order.id);

    console.log("🔍 Looking for donation product:", { 
      productId, 
      variantId,
      hasAdmin: !!(admin && admin.graphql)
    });

    /* ----------------------------------------------------
     * 7️⃣ Detect donation line item
     * -------------------------------------------------- */
    let donationQty = 0;
    let donationItem = null;
    let unitPrice = 0;

    for (const item of order.line_items || []) {
      // Check by custom property (always works, even without admin)
      const hasDonationProperty = item.properties?.some(p => 
        p.name === "_tree_donation" && 
        (p.value === "true" || p.value === true || p.value === "1")
      );

      // If we have admin access, also check by product/variant ID
      if (admin && productId && variantId) {
        const itemProductId = normalizeId(item.product_id);
        const itemVariantId = normalizeId(item.variant_id);
        
        // Check by variant ID (most reliable)
        if (variantId && itemVariantId && itemVariantId === variantId) {
          console.log("✅ Found by variant ID match!");
          donationQty += item.quantity || 1;
          donationItem = item;
          unitPrice = parseFloat(item.price || item.price_set?.shop_money?.amount || "0");
          break;
        }
        
        // Check by product ID
        if (productId && itemProductId && itemProductId === productId) {
          console.log("✅ Found by product ID match!");
          donationQty += item.quantity || 1;
          donationItem = item;
          unitPrice = parseFloat(item.price || item.price_set?.shop_money?.amount || "0");
          break;
        }
      }
      
      // Check by custom property (fallback)
      if (hasDonationProperty) {
        console.log("✅ Found by custom property!");
        donationQty += item.quantity || 1;
        donationItem = item;
        unitPrice = parseFloat(item.price || item.price_set?.shop_money?.amount || "0");
        break;
      }
    }

    if (!donationItem || donationQty === 0) {
      console.log("ℹ️ No donation item found in order");
      return new Response(null, { status: 200 });
    }

    console.log(`🌱 Donation detected → ${donationQty} tree(s)`, {
      itemName: donationItem.name,
      price: unitPrice
    });

    /* ----------------------------------------------------
     * 8️⃣ Process donation (with or without admin access)
     * -------------------------------------------------- */
    if (admin && admin.graphql) {
      /* ----------------------------------------------------
       * 9️⃣ Enforce free-plan usage limits (requires admin)
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

        // Still send to external API even if limit reached
        await sendToExternalAPI();
        return new Response(null, { status: 200 });
      }

      /* ----------------------------------------------------
       * 🔟 Increment Shopify-side usage (requires admin)
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
        console.error('⚠️ Usage increment failed:', error.message);
        // Don't fail, just continue
      }

      /* ----------------------------------------------------
       * 1️⃣1️⃣ Store order snapshot in metafields (requires admin)
       * -------------------------------------------------- */
      try {
        await setAppMetafield(admin, {
          namespace: "tree_planting",
          key: `order_${orderId}`,
          type: "json",
          value: JSON.stringify({
            orderId: order.id,
            orderName: order.name,
            trees: donationQty,
            amount: unitPrice * donationQty,
            currency: order.currency || "USD",
            createdAt: new Date().toISOString(),
          }),
        });
      } catch (error) {
        console.error('⚠️ Failed to store order snapshot:', error.message);
      }
    } else {
      console.log("ℹ️ Skipping admin-only operations (no admin access)");
    }

    /* ----------------------------------------------------
     * 1️⃣2️⃣ SEND TO EXTERNAL BACKEND (always do this)
     * -------------------------------------------------- */
    await sendToExternalAPI();

    return new Response(null, { status: 200 });

    /* ----------------------------------------------------
     * Helper function: Send to external API
     * -------------------------------------------------- */
    async function sendToExternalAPI() {
      try {
        const externalResult = await sendOrderToExternalAPI({
          shopDomain: shop,
          orderId: order.id,
          orderName: order.name || orderId,
          treesPlanted: donationQty,
          amount: unitPrice * donationQty,
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
      }
    }

  } catch (error) {
    console.error("🔥 Webhook processing error:", {
      error: error.message,
      stack: error.stack
    });
    return new Response(null, { status: 200 });
  }
}