// shopify.server.js - COMPLETE UPDATED VERSION with Shopify's Usage-Based Billing Fixes
import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
  BillingInterval
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const APP_METAFIELD_NAMESPACE = "tree_planting";

// ===================================================
// SHOPIFY APP CONFIGURATION WITH USAGE-BASED BILLING
// ===================================================
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,

  // Usage-based billing config (recurring + usage with caps)
  billing: {
    essential: {
      lineItems: [
        {
          amount: 6.99,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
          terms: "$6.99 base + $0.001 per donation (usage capped at $50/month)",
          usage: {
            cappedAmount: {
              amount: 50,
              currencyCode: "USD",
            },
            terms: "Usage charges capped at $50 per month",
          },
        },
      ],
    },
    professional: {
      lineItems: [
        {
          amount: 29.99,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
          terms: "$29.99 base + $0.001 per donation (usage capped at $100/month)",
          usage: {
            cappedAmount: {
              amount: 100,
              currencyCode: "USD",
            },
            terms: "Usage charges capped at $100 per month",
          },
        },
      ],
    },
  },

  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

// ===================================================
// EXISTING HELPER FUNCTIONS (Keep these as-is)
// ===================================================

export async function getAppMetafields(admin) {
  try {
    const response = await admin.graphql(
      `#graphql
      query {
        currentAppInstallation {
          id
          metafields(first: 50) {
            edges {
              node {
                id
                namespace
                key
                value
                type
              }
            }
          }
        }
      }`
    );
    
    const json = await response.json();
    const metafields = json.data?.currentAppInstallation?.metafields?.edges || [];
    
    console.log(`Found ${metafields.length} app metafields`);
    
    return metafields;
  } catch (error) {
    console.error('Error fetching app metafields:', error);
    return [];
  }
}

export async function cancelActiveSubscription(admin) {
  const billingStatus = await getBillingStatus(admin);

  if (!billingStatus.hasActiveSubscription) {
    return { cancelled: false, reason: "No active subscription" };
  }

  const subscriptionId = billingStatus.subscriptions[0].id;

  const mutation = `
    mutation AppSubscriptionCancel($id: ID!) {
      appSubscriptionCancel(id: $id) {
        appSubscription {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await admin.graphql(mutation, {
    variables: { id: subscriptionId },
  });

  const json = await response.json();

  if (json.data?.appSubscriptionCancel?.userErrors?.length) {
    throw new Error(
      json.data.appSubscriptionCancel.userErrors[0].message
    );
  }

  return {
    cancelled: true,
    subscriptionId,
  };
}

export async function setAppMetafield(
  admin,
  {
    namespace = 'tree_planting',
    key,
    type,
    value,
    ownerId,
  },
) {
  try {
    if (!ownerId) {
      const ownerIdResponse = await admin.graphql(
        `#graphql
        query CurrentAppInstallationId {
          currentAppInstallation {
            id
          }
        }`,
      );

      const ownerIdJson = await ownerIdResponse.json();
      ownerId = ownerIdJson?.data?.currentAppInstallation?.id;

      if (!ownerId) {
        throw new Error('Unable to resolve current app installation ID');
      }
    }

    let preparedValue;
    
    if (type === 'boolean') {
      if (typeof value === 'boolean') {
        preparedValue = value ? 'true' : 'false';
      } else if (typeof value === 'string') {
        const lowerValue = value.toLowerCase();
        preparedValue = lowerValue === 'true' ? 'true' : 'false';
      } else {
        preparedValue = 'false';
      }
    } else if (typeof value === 'object') {
      preparedValue = JSON.stringify(value);
    } else {
      preparedValue = String(value);
    }

    const response = await admin.graphql(
      `#graphql
      mutation SetMetafield($input: MetafieldsSetInput!) {
        metafieldsSet(metafields: [$input]) {
          metafields {
            id
            namespace
            key
            value
            type
          }
          userErrors {
            field
            message
            code
          }
        }
      }`,
      {
        variables: {
          input: {
            namespace,
            key,
            type,
            value: preparedValue,
            ownerId,
          },
        },
      },
    );

    const responseJson = await response.json();
    const result = responseJson?.data?.metafieldsSet;

    if (!result) {
      console.error('Unexpected metafieldsSet response:', responseJson);
      throw new Error('No metafieldsSet payload returned from API');
    }

    if (result.userErrors?.length) {
      console.error('MetafieldsSet errors:', result.userErrors);
      throw new Error(result.userErrors[0].message);
    }

    const createdMetafield = result.metafields?.[0] ?? null;
    return createdMetafield;
  } catch (error) {
    console.error('Error setting metafield:', error);
    throw error;
  }
}

export async function getThemeAppExtensionConfig(admin) {
  try {
    const metafields = await getAppMetafields(admin);
    const parsedFields = parseMetafields(metafields);
    
    const themeConfig = parsedFields.theme_extension_config || parsedFields.tree_planting || {};
    
    return {
      donation_enabled: themeConfig.donation_enabled === true || themeConfig.donation_enabled === 'true',
      donation_amount: themeConfig.donation_amount || "5.00",
      donation_product_id: themeConfig.donation_product_id || themeConfig.product_id,
      donation_variant_id: themeConfig.donation_variant_id,
    };
  } catch (error) {
    console.error('Error getting theme app extension config:', error);
    return {
      donation_enabled: false,
      donation_amount: "5.00",
      donation_product_id: null,
      donation_variant_id: null,
    };
  }
}

export async function updateThemeAppExtensionConfig(admin, config) {
  try {
    await setAppMetafield(admin, {
      namespace: 'tree_planting',
      key: 'donation_enabled',
      type: 'boolean',
      value: config.donation_enabled,
    });
    
    await setAppMetafield(admin, {
      namespace: 'tree_planting',
      key: 'donation_amount',
      type: 'single_line_text_field',
      value: config.donation_amount,
    });
    
    await setAppMetafield(admin, {
      namespace: 'tree_planting',
      key: 'donation_product_id',
      type: 'single_line_text_field',
      value: config.donation_product_id,
    });
    
    await setAppMetafield(admin, {
      namespace: 'tree_planting',
      key: 'donation_variant_id',
      type: 'single_line_text_field',
      value: config.donation_variant_id,
    });
    
    await setAppMetafield(admin, {
      key: 'theme_extension_config',
      type: 'json',
      value: config,
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating theme app extension config:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteAppMetafield(admin, key) {
  try {
    const getID = await admin.graphql(`
      query {
        currentAppInstallation {
          id
        }
      }
    `);

    const renderId = await getID.json();
    const ownerId = renderId.data.currentAppInstallation.id;

    const mutation = `
      mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
        metafieldsDelete(metafields: $metafields) {
          deletedMetafields {
            ownerId
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      metafields: [
        {
          key,
          namespace: APP_METAFIELD_NAMESPACE,
          ownerId,
        },
      ],
    };

    const response = await admin.graphql(mutation, { variables });
    return await response.json();
  } catch (error) {
    console.error('Error deleting app metafield:', error);
    return { errors: [error.message] };
  }
}

export function parseMetafields(metafields) {
  try {
    const parsed = {};
    
    if (!Array.isArray(metafields)) {
      console.error('Metafields is not an array:', metafields);
      return parsed;
    }
    
    metafields.forEach(edge => {
      const node = edge.node || edge;
      if (node && node.key && node.value !== undefined && node.value !== null) {
        if (node.type === 'json' || node.value.startsWith('{') || node.value.startsWith('[')) {
          try {
            parsed[node.key] = JSON.parse(node.value);
          } catch (e) {
            parsed[node.key] = node.value;
          }
        } else if (node.type === 'boolean') {
          parsed[node.key] = node.value === 'true' || node.value === true;
        } else if (node.type === 'number_integer' || node.type === 'number_decimal') {
          parsed[node.key] = Number(node.value);
        } else {
          parsed[node.key] = node.value;
        }
        
        if (node.namespace) {
          if (!parsed[node.namespace]) {
            parsed[node.namespace] = {};
          }
          parsed[node.namespace][node.key] = parsed[node.key];
        }
      }
    });
    
    return parsed;
  } catch (error) {
    console.error('Error parsing metafields:', error);
    return {};
  }
}

export async function getAllAppMetafields(admin) {
  try {
    const response = await admin.graphql(
      `#graphql
      query {
        currentAppInstallation {
          metafields(first: 100) {
            edges {
              node {
                id
                namespace
                key
                value
                type
              }
            }
          }
        }
      }`
    );
    
    const json = await response.json();
    const edges = json.data?.currentAppInstallation?.metafields?.edges || [];
    
    return edges.map(edge => edge.node);
  } catch (error) {
    console.error('Error fetching all metafields:', error);
    return [];
  }
}

export async function getShopDomain(admin) {
  try {
    const shopResponse = await admin.graphql(`
      #graphql
      query {
        shop {
          myshopifyDomain
        }
      }
    `);
    
    const shopData = await shopResponse.json();
    return shopData?.data?.shop?.myshopifyDomain || null;
  } catch (error) {
    console.error('Error fetching shop domain:', error);
    return null;
  }
}

// ===================================================
// FIXED: getMetafieldValue function (Shopify's version)
// ===================================================
export function getMetafieldValue(metafields, key) {
  const field = metafields.find((f) => f.key === key);
  if (!field) return null;

  try {
    return field.type === "json" ? JSON.parse(field.value) : field.value;
  } catch {
    return field.value;
  }
}

export async function updateCartAttributes(admin, session) {
  try {
    const metafields = await getAppMetafields(admin);
    const parsedFields = parseMetafields(metafields);
    
    const productId = parsedFields.product_id;
    const donationAmount = parsedFields.donation_amount || "5.00";
    const cartEnabled = parsedFields.cart_enabled === 'true' || parsedFields.cart_enabled === true;
    
    if (!productId || !cartEnabled) {
      return null;
    }
    
    const productResponse = await admin.graphql(
      `#graphql
      query GetProduct($id: ID!) {
        product(id: $id) {
          variants(first: 1) {
            edges {
              node {
                id
                price
              }
            }
          }
        }
      }`,
      { variables: { id: productId } }
    );
    
    const productJson = await productResponse.json();
    const variantId = productJson.data?.product?.variants?.edges[0]?.node?.id;
    
    return {
      donation_enabled: cartEnabled.toString(),
      donation_amount: donationAmount,
      donation_product_id: productId,
      donation_variant_id: variantId
    };
  } catch (error) {
    console.error('Error getting cart attributes:', error);
    return null;
  }
}

export async function syncCartAttributes(admin) {
  try {
    const metafields = await getAppMetafields(admin);
    const parsedFields = parseMetafields(metafields);
    
    const productId = parsedFields.product_id;
    const donationAmount = parsedFields.donation_amount || "5.00";
    const cartEnabled = parsedFields.cart_enabled === 'true' || parsedFields.cart_enabled === true;
    
    if (!productId || !cartEnabled) {
      return { success: false, error: "Product not created or cart not enabled" };
    }
    
    const productResponse = await admin.graphql(
      `#graphql
      query GetProduct($id: ID!) {
        product(id: $id) {
          variants(first: 1) {
            edges {
              node {
                id
                price
              }
            }
          }
        }
      }`,
      { variables: { id: productId } }
    );
    
    const productJson = await productResponse.json();
    const variantId = productJson.data?.product?.variants?.edges[0]?.node?.id;
    
    if (!variantId) {
      return { success: false, error: "Product variant not found" };
    }
    
    await setAppMetafield(admin, {
      key: 'cart_attributes',
      type: 'json',
      value: {
        donation_enabled: cartEnabled.toString(),
        donation_amount: donationAmount,
        donation_product_id: productId,
        donation_variant_id: variantId,
        last_updated: new Date().toISOString()
      }
    });
    
    return { 
      success: true, 
      cartAttributes: {
        donation_enabled: cartEnabled.toString(),
        donation_amount: donationAmount,
        donation_product_id: productId,
        donation_variant_id: variantId
      }
    };
  } catch (error) {
    console.error('Error syncing cart attributes:', error);
    return { success: false, error: error.message };
  }
}

export async function createAppProxyEndpoint(admin, session) {
  try {
    const { shop } = session;
    
    const metafields = await getAppMetafields(admin);
    const parsedFields = parseMetafields(metafields);
    
    const productId = parsedFields.product_id;
    const donationAmount = parsedFields.donation_amount || "5.00";
    const cartEnabled = parsedFields.cart_enabled === 'true' || parsedFields.cart_enabled === true;
    
    if (!productId || !cartEnabled) {
      return {
        enabled: false,
        message: "Tree planting donation is not configured. Please enable it in the app settings."
      };
    }
    
    const productResponse = await admin.graphql(
      `#graphql
      query GetProduct($id: ID!) {
        product(id: $id) {
          title
          variants(first: 1) {
            edges {
              node {
                id
                price
              }
            }
          }
        }
      }`,
      { variables: { id: productId } }
    );
    
    const productJson = await productResponse.json();
    const variantId = productJson.data?.product?.variants?.edges[0]?.node?.id;
    
    return {
      enabled: true,
      shop: shop,
      donation_amount: donationAmount,
      product_id: productId,
      variant_id: variantId,
      product_title: productJson.data?.product?.title || "Support Tree Planting"
    };
  } catch (error) {
    console.error('Error creating app proxy endpoint:', error);
    return {
      enabled: false,
      error: error.message
    };
  }
}

// ===================================================
// UPDATED BILLING AND USAGE FUNCTIONS (Shopify's version)
// ===================================================

// FIXED: getCurrentUsage - uses parseMetafields correctly
export async function getCurrentUsage(admin) {
  try {
    const metafields = await getAllAppMetafields(admin);
    const parsedFields = parseMetafields(metafields);

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const usageKey = `usage_${currentMonth}`;

    let usageCount = 0;

    if (parsedFields[usageKey]) {
      usageCount = parseInt(parsedFields[usageKey]) || 0;
    } else {
      usageCount =
        parseInt(parsedFields.total_usage) ||
        parseInt(parsedFields.donation_count) ||
        0;
    }

    return usageCount;
  } catch (error) {
    console.error("Error getting current usage:", error);
    return 0;
  }
}

// FIXED: incrementUsage - uses getMetafieldValue correctly
export async function incrementUsage(admin, amount = 1) {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const usageKey = `usage_${currentMonth}`;

    const currentUsage = await getCurrentUsage(admin);
    const newUsage = currentUsage + amount;

    // Store per-month usage
    await setAppMetafield(admin, {
      key: usageKey,
      type: "number_integer",
      value: newUsage.toString(),
    });

    // Store total usage across all time
    const allMetafields = await getAllAppMetafields(admin);
    const totalUsageVal = getMetafieldValue(allMetafields, "total_usage");
    const totalUsage = (parseInt(totalUsageVal || "0") || 0) + amount;

    await setAppMetafield(admin, {
      key: "total_usage",
      type: "number_integer",
      value: totalUsage.toString(),
    });

    await updateStatistics(admin, amount);

    return newUsage;
  } catch (error) {
    console.error("Error incrementing usage:", error);
    throw error;
  }
}

export async function getPricingPlan(admin) {
  try {
    const metafields = await getAllAppMetafields(admin);
    const parsedFields = parseMetafields(metafields);
    
    const billingStatus = await getBillingStatus(admin);
    
    if (billingStatus.hasActiveSubscription) {
      const subscriptions = billingStatus.subscriptions;
      const essentialSub = subscriptions.find(s => 
        s.name.includes('Essential') || s.lineItems[0]?.plan?.pricingDetails?.price?.amount === '6.99'
      );
      const proSub = subscriptions.find(s => 
        s.name.includes('Professional') || s.lineItems[0]?.plan?.pricingDetails?.price?.amount === '29.99'
      );
      
      if (proSub) return 'professional';
      if (essentialSub) return 'essential';
    }
    
    return parsedFields.current_plan || 'free';
  } catch (error) {
    console.error('Error getting pricing plan:', error);
    return 'free';
  }
}

export async function updatePricingPlan(admin, plan) {
  try {
    await setAppMetafield(admin, {
      key: 'current_plan',
      type: 'single_line_text_field',
      value: plan,
    });
    
    await setAppMetafield(admin, {
      key: 'plan_last_updated',
      type: 'date_time',
      value: new Date().toISOString(),
    });
    
    return { success: true, plan };
  } catch (error) {
    console.error('Error updating pricing plan:', error);
    return { success: false, error: error.message };
  }
}

export async function isUsageLimitReached(admin) {
  try {
    const currentPlan = await getPricingPlan(admin);
    
    if (currentPlan !== 'free') {
      return false;
    }
    
    const currentUsage = await getCurrentUsage(admin);
    const FREE_PLAN_LIMIT = 5000;
    
    return currentUsage >= FREE_PLAN_LIMIT;
  } catch (error) {
    console.error('Error checking usage limit:', error);
    return false;
  }
}

// UPDATED: getBillingStatus - includes __typename for pricingDetails
export async function getBillingStatus(admin) {
  try {
    const response = await admin.graphql(
      `#graphql
      query GetBillingStatus {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            test
            lineItems {
              id
              plan {
                pricingDetails {
                  __typename
                  ... on AppRecurringPricing {
                    interval
                    price {
                      amount
                      currencyCode
                    }
                  }
                  ... on AppUsagePricing {
                    terms
                    balanceUsed {
                      amount
                      currencyCode
                    }
                    cappedAmount {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        }
      }`
    );

    const data = await response.json();
    const subscriptions =
      data?.data?.currentAppInstallation?.activeSubscriptions || [];

    return {
      hasActiveSubscription: subscriptions.length > 0,
      subscriptions,
    };
  } catch (error) {
    console.error("Error getting billing status:", error);
    return {
      hasActiveSubscription: false,
      subscriptions: [],
    };
  }
}

// UPDATED: createSubscription - creates recurring + usage line items
export async function createSubscription(admin, plan) {
  try {
    const returnUrl = `${process.env.SHOPIFY_APP_URL}/app/pricing`;
    const test = process.env.NODE_ENV !== "production";

    // Validated mutation
    const mutation = `
      mutation CreateSubscription(
        $name: String!
        $lineItems: [AppSubscriptionLineItemInput!]!
        $returnUrl: URL!
        $test: Boolean!
      ) {
        appSubscriptionCreate(
          name: $name
          lineItems: $lineItems
          returnUrl: $returnUrl
          test: $test
        ) {
          appSubscription {
            id
            status
            lineItems {
              id
              plan {
                pricingDetails {
                  __typename
                }
              }
            }
          }
          confirmationUrl
          userErrors {
            field
            message
          }
        }
      }
    `;

    let lineItems = [];
    let planName = "";

    if (plan === "essential") {
      planName = "Tree Planting - Essential Plan";

      lineItems = [
        // Recurring base fee
        {
          plan: {
            appRecurringPricingDetails: {
              price: { amount: 6.99, currencyCode: "USD" },
              interval: "EVERY_30_DAYS",
            },
          },
        },
        // Usage-based pricing (capped at $50/month)
        {
          plan: {
            appUsagePricingDetails: {
              terms: "$0.001 per donation, capped at $50 per month",
              cappedAmount: {
                amount: 50,
                currencyCode: "USD",
              },
            },
          },
        },
      ];
    } else if (plan === "professional") {
      planName = "Tree Planting - Professional Plan";

      lineItems = [
        // Recurring base fee
        {
          plan: {
            appRecurringPricingDetails: {
              price: { amount: 29.99, currencyCode: "USD" },
              interval: "EVERY_30_DAYS",
            },
          },
        },
        // Usage-based pricing (capped at $100/month)
        {
          plan: {
            appUsagePricingDetails: {
              terms: "$0.001 per donation, capped at $100 per month",
              cappedAmount: {
                amount: 100,
                currencyCode: "USD",
              },
            },
          },
        },
      ];
    } else {
      throw new Error("Invalid plan selected");
    }

    const variables = {
      name: planName,
      lineItems,
      returnUrl,
      test,
    };

    const response = await admin.graphql(mutation, { variables });
    const result = await response.json();

    const payload = result?.data?.appSubscriptionCreate;
    if (payload?.userErrors?.length) {
      throw new Error(payload.userErrors[0].message);
    }

    return {
      confirmationUrl: payload.confirmationUrl,
      subscriptionId: payload.appSubscription.id,
    };
  } catch (error) {
    console.error("Error creating subscription:", error);
    throw error;
  }
}

export async function updateStatistics(admin, donationCount = 1) {
  try {
    const statsResponse = await admin.graphql(
      `#graphql
      query {
        currentAppInstallation {
          metafield(namespace: "tree_planting", key: "statistics") {
            value
          }
        }
      }`
    );
    
    const statsData = await statsResponse.json();
    let statistics = {
      total_donations: 0,
      total_trees: 0,
      total_revenue: 0,
      last_updated: new Date().toISOString(),
      monthly_stats: {}
    };
    
    if (statsData.data?.currentAppInstallation?.metafield?.value) {
      statistics = JSON.parse(statsData.data.currentAppInstallation.metafield.value);
    }
    
    statistics.total_donations += donationCount;
    statistics.total_trees += donationCount;
    statistics.last_updated = new Date().toISOString();
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (!statistics.monthly_stats[currentMonth]) {
      statistics.monthly_stats[currentMonth] = {
        donations: 0,
        trees: 0,
        revenue: 0
      };
    }
    statistics.monthly_stats[currentMonth].donations += donationCount;
    statistics.monthly_stats[currentMonth].trees += donationCount;
    
    await setAppMetafield(admin, {
      namespace: 'tree_planting',
      key: 'statistics',
      type: 'json',
      value: JSON.stringify(statistics),
    });
    
    return statistics;
  } catch (error) {
    console.error('Error updating statistics:', error);
  }
}

export async function getStatistics(admin) {
  try {
    const statsResponse = await admin.graphql(
      `#graphql
      query {
        currentAppInstallation {
          metafield(namespace: "tree_planting", key: "statistics") {
            value
          }
        }
      }`
    );
    
    const statsData = await statsResponse.json();
    const statsValue = statsData.data?.currentAppInstallation?.metafield?.value;
    
    if (statsValue) {
      return JSON.parse(statsValue);
    }
    
    return {
      total_donations: 0,
      total_trees: 0,
      total_revenue: 0,
      last_updated: new Date().toISOString(),
      monthly_stats: {}
    };
  } catch (error) {
    console.error('Error getting statistics:', error);
    return {
      total_donations: 0,
      total_trees: 0,
      total_revenue: 0,
      last_updated: new Date().toISOString(),
      monthly_stats: {}
    };
  }
}

// ===================================================
// UPDATED: reportUsageToShopify - bill based on numeric usage count
// ===================================================
export async function reportUsageToShopify(
  admin,
  usageQuantity,
  description = "Tree planting donation"
) {
  try {
    const billingStatus = await getBillingStatus(admin);

    if (!billingStatus.hasActiveSubscription) {
      console.log("No active subscription, skipping usage report");
      return { reported: false, reason: "No active subscription" };
    }

    const subscription = billingStatus.subscriptions[0];

    // Find the usage pricing line item
    const usageLineItem = subscription.lineItems.find((li) => {
      const typename = li.plan?.pricingDetails?.__typename;
      return typename === "AppUsagePricing";
    });

    if (!usageLineItem) {
      console.log("No usage pricing line item found for subscription");
      return { reported: false, reason: "No usage pricing line item found" };
    }

    const lineItemId = usageLineItem.id;

    const ratePerUnit = 0.001; // $0.001 per donation/usage
    const totalCharge = usageQuantity * ratePerUnit;

    if (!usageQuantity || usageQuantity <= 0 || totalCharge <= 0) {
      console.log("No positive usage to bill, skipping usage record");
      return { reported: false, reason: "No billable usage" };
    }

    const response = await admin.graphql(
      `#graphql
      mutation AppUsageRecordCreate(
        $subscriptionLineItemId: ID!
        $price: MoneyInput!
        $description: String!
      ) {
        appUsageRecordCreate(
          subscriptionLineItemId: $subscriptionLineItemId
          price: $price
          description: $description
        ) {
          appUsageRecord {
            id
            createdAt
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          subscriptionLineItemId: lineItemId,
          price: {
            amount: totalCharge, // final amount in USD
            currencyCode: "USD",
          },
          description: `${description} - ${usageQuantity} units`,
        },
      }
    );

    const result = await response.json();

    const payload = result?.data?.appUsageRecordCreate;
    if (payload?.userErrors?.length) {
      console.error("Usage reporting errors:", payload.userErrors);
      return {
        reported: false,
        errors: payload.userErrors,
      };
    }

    console.log(
      "✅ Usage reported to Shopify:",
      payload?.appUsageRecord
    );

    return {
      reported: true,
      usageRecord: payload?.appUsageRecord,
    };
  } catch (error) {
    console.error("Error reporting usage to Shopify:", error);
    return { reported: false, error: error.message };
  }
}

// ===================================================
// EXPORT SHOPIFY INSTANCE
// ===================================================

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;