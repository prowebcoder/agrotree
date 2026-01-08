// app/metafields.server.js
export const METAFIELD_NAMESPACE = "tree_planting_donation";
export const METAFIELD_KEYS = {
  PRODUCT_ID: 'product_id',
  DONATION_AMOUNT: 'donation_amount',
  CART_ENABLED: 'cart_enabled',
  PRODUCT_DATA: 'product_data',
  ORDERS_DATA: 'orders_data',
  STATISTICS: 'statistics',
  SETTINGS: 'settings'
};

export const DEFAULT_SETTINGS = {
  donation_amount: "5.00",
  cart_enabled: false,
  languages: ['en', 'pt', 'es'],
  price_options: ["5.00", "10.00", "15.00", "20.00", "25.00"]
};

export async function getAppMetafield(admin, key) {
  const response = await admin.graphql(`
    query {
      currentAppInstallation {
        metafield(namespace: "${METAFIELD_NAMESPACE}", key: "${key}") {
          id
          key
          value
          type
        }
      }
    }
  `);
  
  const data = await response.json();
  return data?.data?.currentAppInstallation?.metafield;
}

export async function setAppMetafield(admin, { key, type, value }) {
  // Get app installation ID
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
    mutation CreateAppDataMetafield($metafieldsSetInput: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafieldsSetInput) {
        metafields {
          id
          namespace
          key
          value
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    metafieldsSetInput: [
      {
        namespace: METAFIELD_NAMESPACE,
        key,
        type,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        ownerId,
      },
    ],
  };

  const response = await admin.graphql(mutation, { variables });
  return await response.json();
}

export async function getAllAppMetafields(admin) {
  const response = await admin.graphql(`
    query {
      currentAppInstallation {
        metafields(first: 100, namespace: "${METAFIELD_NAMESPACE}") {
          nodes {
            id
            key
            value
            type
          }
        }
      }
    }
  `);
  
  const data = await response.json();
  return data?.data?.currentAppInstallation?.metafields?.nodes || [];
}

export function parseMetafieldValue(metafield) {
  if (!metafield) return null;
  
  try {
    if (metafield.type === 'json') {
      return JSON.parse(metafield.value);
    } else if (metafield.type === 'boolean') {
      return metafield.value === 'true';
    } else if (metafield.type === 'number_integer' || metafield.type === 'number_decimal') {
      return Number(metafield.value);
    } else {
      return metafield.value;
    }
  } catch {
    return metafield.value;
  }
}