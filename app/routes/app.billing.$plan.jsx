// app/routes/app.billing.$plan.jsx

import { redirect } from "react-router";
import { useEffect } from "react";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

/* =========================================================
   SERVER LOADER
   ========================================================= */

export async function loader({ request, params }) {
  const url = new URL(request.url);
  let session;

  try {
    const auth = await authenticate.admin(request);
    const { admin, billing } = auth;
    session = auth.session;

    console.log("🔄 Checking session for shop info", session);

    /* ---------------- Session validation ---------------- */
    if (!session?.shop) {
      const shop = url.searchParams.get("shop");
      if (!shop) {
        return redirect("/app/pricing?error=Missing%20shop");
      }
      return redirect(`/auth?shop=${encodeURIComponent(shop)}`);
    }

    const { plan } = params;
    const { shop } = session;

    /* ---------------- Plan validation ---------------- */
    if (!["essential", "professional"].includes(plan)) {
      return redirect("/app/pricing?error=Invalid%20plan");
    }

    /* ---------------- Embedded admin return URL ---------------- */
    const shopSlug = shop.replace(".myshopify.com", "");
    const appHost = `https://admin.shopify.com/store/${shopSlug}/apps/plant-trees`;
    const returnUrl = `${appHost}/app/pricing`;

    console.log(`✅ Starting billing for ${shop}`);
    console.log(`↩️ Return URL: ${returnUrl}`);

    /* ---------------- Billing check ---------------- */
    await billing.require({
      plans: [plan],
      isTest: true, // 🔴 set false in production
      returnUrl,
      onFailure: async () => {
        console.log("📋 Billing inactive → requesting approval");

        // 🔑 This WILL throw a 401 with a billing confirmation URL
        return billing.request({
          plan,
          isTest: true,
          returnUrl,
        });
      },
    });

    /* ---------------- Billing already active ---------------- */
    console.log(`✅ ${plan} already active`);

    try {
      const { updatePricingPlan } = await import("../shopify.server");
      await updatePricingPlan(admin, plan);
    } catch (e) {
      console.warn("⚠️ Plan update failed", e);
    }

    return redirect(`/app/pricing?updated=true&plan=${plan}`);
  } catch (error) {
    console.error("❌ Billing error", error);

    /* =========================================================
       Shopify billing confirmation (401 case)
       ========================================================= */
    if (error?.headers?.get) {
      const billingUrl = error.headers.get(
        "X-Shopify-API-Request-Failure-Reauthorize-Url"
      );

      if (billingUrl) {
        // 🔑 Send billing URL to the client
        return {
          billingUrl,
        };
      }
    }

    return redirect(
      `/app/pricing?error=${encodeURIComponent(
        error?.message || "Billing failed"
      )}`
    );
  }
}

/* =========================================================
   CLIENT COMPONENT
   ========================================================= */

export default function BillingRedirect() {
  const data = useLoaderData();

  useEffect(() => {
    if (data?.billingUrl) {
      /**
       * 🔑 ABSOLUTE KEY
       * Break out of iframe and navigate at top level
       */
      window.open(data.billingUrl, "_top");
    }
  }, [data]);

  return (
    <s-page>
      <s-box padding="large" textAlign="center">
        <s-spinner size="large" />
        <s-text tone="subdued">
          Redirecting to billing approval…
        </s-text>
      </s-box>
    </s-page>
  );
}
