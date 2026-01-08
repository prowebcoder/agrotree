// app/routes/app.cart-settings.jsx
import { useState, useEffect } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate, getAppMetafields, setAppMetafield, parseMetafields } from "../shopify.server";

export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    
    // Get app metafields
    const metafields = await getAppMetafields(admin);
    const parsedFields = parseMetafields(metafields);
    
    // Check if product exists before allowing cart settings
    let productExists = false;
    let shopifyProduct = null;
    
    if (parsedFields.product_id) {
      const response = await admin.graphql(
        `#graphql
        query GetProduct($id: ID!) {
          product(id: $id) {
            id
            title
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                }
              }
            }
          }
        }`,
        { variables: { id: parsedFields.product_id } }
      );
      const responseJson = await response.json();
      productExists = !!responseJson.data.product;
      shopifyProduct = responseJson.data.product;
    }

    return {
      cartEnabled: parsedFields.cart_enabled === 'true' || parsedFields.cart_enabled === true,
      donationAmount: parsedFields.donation_amount || "0.00",
      productExists,
      productId: parsedFields.product_id || null,
      shopifyProduct,
    };
  } catch (error) {
    console.error('Error loading cart settings:', error);
    return {
      cartEnabled: false,
      donationAmount: "0.00",
      productExists: false,
      productId: null,
      shopifyProduct: null,
    };
  }
};

export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const enabled = formData.get('enabled') === 'true';
    
    // Check if product exists before enabling cart
    if (enabled) {
      const metafields = await getAppMetafields(admin);
      const parsedFields = parseMetafields(metafields);
      
      if (!parsedFields.product_id) {
        return { 
          success: false, 
          error: "Please create the Tree Planting product first before enabling cart donations." 
        };
      }
      
      // Verify product still exists
      const response = await admin.graphql(
        `#graphql
        query GetProduct($id: ID!) {
          product(id: $id) {
            id
            status
          }
        }`,
        { variables: { id: parsedFields.product_id } }
      );
      const responseJson = await response.json();
      if (!responseJson.data.product) {
        return { 
          success: false, 
          error: "Product not found. Please recreate the Tree Planting product." 
        };
      }
    }
    
    // Update cart settings in app metafields
    await setAppMetafield(admin, {
      key: 'cart_enabled',
      type: 'boolean',
      value: enabled.toString(),
    });
    
    return { success: true, enabled };
  } catch (error) {
    console.error('Error updating cart settings:', error);
    return { success: false, error: error.message };
  }
};

// Custom Toggle Switch Component
const ToggleSwitch = ({ enabled, onChange, disabled, label }) => {
  return (
    <s-stack direction="inline" gap="base" alignItems="center">
      <button
        onClick={onChange}
        disabled={disabled}
        style={{
          width: '60px',
          height: '30px',
          borderRadius: '15px',
          border: 'none',
          position: 'relative',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.3s ease',
          backgroundColor: enabled ? 'var(--p-color-bg-success)' : 'var(--p-color-border)',
          padding: '3px',
          outline: 'none',
          opacity: disabled ? 0.5 : 1
        }}
        aria-label={label}
        role='switch'
        type='button'
        aria-checked={enabled}
      >
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: 'white',
            transition: 'transform 0.3s ease',
            transform: enabled ? 'translateX(30px)' : 'translateX(0)',
            boxShadow: 'var(--p-shadow-sm)'
          }}
        />
      </button>
      <s-text fontWeight="medium">
        {enabled ? 'Enabled' : 'Disabled'}
      </s-text>
    </s-stack>
  );
};

// Preview Card Component
const PreviewCard = ({ enabled, donationAmount }) => {
  return (
    <s-card>
      <s-stack direction="block" gap="400">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-heading level="h3">Preview</s-heading>
          <s-badge 
            tone={enabled ? "success" : "subdued"}
            icon={enabled ? "check" : "cancel"}
          >
            {enabled ? 'Live preview' : 'Disabled state'}
          </s-badge>
        </s-stack>

        <div style={{
          padding: '24px',
          backgroundColor: enabled ? 'var(--p-color-bg-success-subdued)' : 'var(--p-color-bg-surface-secondary)',
          borderRadius: 'var(--p-border-radius-300)',
          border: enabled ? '1px solid var(--p-color-border-success)' : '1px solid var(--p-color-border)',
          transition: 'all 0.3s ease'
        }}>
          <s-stack direction="block" gap="300">
            {/* Cart Header */}
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text fontWeight="medium" variant="headingSm">Sample Product</s-text>
              <s-text fontWeight="bold">$29.99</s-text>
            </s-stack>
            
            {/* Donation Option */}
            <s-stack direction="inline" gap="200" alignItems="center">
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: 'var(--p-border-radius-100)',
                border: enabled ? '2px solid var(--p-color-border-success)' : '1px solid var(--p-color-border)',
                backgroundColor: enabled ? 'var(--p-color-bg-success)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s ease'
              }}>
                {enabled && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M11.6666 3.5L5.24998 9.91667L2.33331 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <s-stack direction="block" gap="50">
                <s-text 
                  fontWeight="medium"
                  style={{ color: enabled ? 'var(--p-color-text)' : 'var(--p-color-text-subdued)' }}
                >
                  Add ${parseFloat(donationAmount).toFixed(2)} to plant a tree
                </s-text>
                <s-text 
                  tone="subdued" 
                  variant="bodySm"
                >
                  Support reforestation with your purchase
                </s-text>
              </s-stack>
            </s-stack>

            {/* Total */}
            <s-divider />
            <s-stack direction="inline" justifyContent="space-between">
              <s-text fontWeight="bold">Total</s-text>
              <s-text variant="headingMd" fontWeight="bold">
                ${(29.99 + parseFloat(donationAmount)).toFixed(2)}
              </s-text>
            </s-stack>
          </s-stack>
        </div>

        <s-text tone="subdued" variant="bodySm" align="center">
          This is how the donation option appears in your cart
        </s-text>
      </s-stack>
    </s-card>
  );
};

export default function CartSettingsPage() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const { cartEnabled, donationAmount, productExists, productId, shopifyProduct } = useLoaderData();
  
  const [isEnabled, setIsEnabled] = useState(cartEnabled);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = () => {
    if (!productExists && !isEnabled) {
      shopify.toast.show({
        content: "Please create the Tree Planting product first",
        tone: 'warning'
      });
      return;
    }
    
    const newValue = !isEnabled;
    setIsLoading(true);
    fetcher.submit(
      { enabled: newValue.toString() },
      { method: 'POST' }
    );
  };

  useEffect(() => {
    if (fetcher.data) {
      setIsLoading(false);
      if (fetcher.data.success) {
        setIsEnabled(fetcher.data.enabled);
        shopify.toast.show({
          content: `Donation option ${fetcher.data.enabled ? 'enabled' : 'disabled'}`,
          tone: 'success'
        });
      } else if (fetcher.data.error) {
        shopify.toast.show({
          content: fetcher.data.error,
          tone: 'critical'
        });
      }
    }
  }, [fetcher.data, shopify]);

  useEffect(() => {
    setIsEnabled(cartEnabled);
  }, [cartEnabled]);

  return (
    <s-page heading="Cart Settings" inlineSize="base">
      {/* Primary Action */}
      <s-button 
        slot="primary-action" 
        variant="tertiary"
        onClick={() => navigate('/app')}
      >
        Back to Setup
      </s-button>

      <s-text as="p" tone="subdued" style={{ marginBottom: '32px' }}>
        Control how tree planting donations appear in your cart
      </s-text>

      {!productExists && (
        <s-banner status="warning" style={{ marginBottom: '24px' }}>
          <s-stack direction="block" gap="small">
            <s-paragraph>
              Please create the "Support Tree Planting" product first before enabling cart donations.
            </s-paragraph>
            <s-button
              variant="tertiary"
              onClick={() => navigate('/app')}
            >
              Create Product
            </s-button>
          </s-stack>
        </s-banner>
      )}

      <s-stack direction="block" gap="600">
        {/* Cart Settings Card */}
        <s-section heading="Cart Donation Settings">
          <s-heading level="h3">Control donation visibility in cart</s-heading>
          
          <s-paragraph>
            Enable or disable the tree planting donation checkbox that appears in your cart.
            When enabled, customers can add a donation to their order.
          </s-paragraph>

          <s-stack direction="block" gap="base">
            {/* Status Card */}
            <s-box 
              padding="base" 
              borderWidth="base" 
              borderRadius="base" 
              background="surface"
            >
              <s-stack direction="block" gap="400">
                <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                  <div>
                    <s-heading level="h4">Donation Option Status</s-heading>
                    <s-text tone="subdued" variant="bodySm">
                      Add a checkbox for customers to donate ${parseFloat(donationAmount).toFixed(2)} per tree
                    </s-text>
                  </div>
                  <s-badge 
                    size="large" 
                    tone={isEnabled ? "success" : "subdued"}
                    icon={isEnabled ? "check" : "cancel"}
                  >
                    {isEnabled ? 'Active' : 'Inactive'}
                  </s-badge>
                </s-stack>

                <s-divider />

                <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                  <s-stack direction="block" gap="100">
                    <s-text fontWeight="medium">Enable Cart Donations</s-text>
                    <s-text tone="subdued" variant="bodySm">
                      {isEnabled 
                        ? 'Customers can add donations to their orders' 
                        : 'Donation option is currently hidden'
                      }
                    </s-text>
                  </s-stack>
                  
                  <ToggleSwitch
                    enabled={isEnabled}
                    onChange={handleToggle}
                    disabled={isLoading || (!productExists && !isEnabled)}
                    label={isEnabled ? 'Disable donation option' : 'Enable donation option'}
                  />
                </s-stack>
              </s-stack>
            </s-box>

            {/* Product Info */}
            {productExists && shopifyProduct && (
              <s-box 
                padding="base" 
                borderWidth="base" 
                borderRadius="base" 
                background="subdued"
              >
                <s-stack direction="block" gap="small">
                  <s-text fontWeight="medium">Linked Product:</s-text>
                  <s-stack direction="block" gap="extra-small">
                    <s-stack direction="inline" justifyContent="space-between">
                      <s-text tone="subdued">Title:</s-text>
                      <s-text>{shopifyProduct.title}</s-text>
                    </s-stack>
                    <s-stack direction="inline" justifyContent="space-between">
                      <s-text tone="subdued">Current Price:</s-text>
                      <s-text>${parseFloat(donationAmount).toFixed(2)}</s-text>
                    </s-stack>
                    <s-stack direction="inline" justifyContent="space-between">
                      <s-text tone="subdued">Status:</s-text>
                      <s-badge tone={shopifyProduct.status === 'ACTIVE' ? 'success' : 'warning'}>
                        {shopifyProduct.status}
                      </s-badge>
                    </s-stack>
                  </s-stack>
                  <s-button
                    variant="tertiary"
                    onClick={() =>
                      shopify.intents.invoke?.("edit:shopify/Product", {
                        value: shopifyProduct.id,
                      })
                    }
                    style={{ marginTop: '8px' }}
                  >
                    Edit Product in Shopify
                  </s-button>
                </s-stack>
              </s-box>
            )}

            {/* Preview */}
            <PreviewCard enabled={isEnabled} donationAmount={donationAmount} />

            {/* Info Banner */}
            <s-card tone={productExists ? (isEnabled ? "success" : "info") : "warning"}>
              <s-stack direction="inline" gap="300" alignItems="center">
                <s-icon 
                  source={productExists ? (isEnabled ? "check" : "info") : "alert"} 
                  tone={productExists ? (isEnabled ? "success" : "info") : "warning"} 
                />
                <s-stack direction="block" gap="100">
                  <s-text fontWeight="medium">
                    {productExists 
                      ? (isEnabled ? 'Donations are active ✓' : 'Ready to enable donations')
                      : 'Product not created yet'
                    }
                  </s-text>
                  <s-text variant="bodySm">
                    {productExists 
                      ? (isEnabled 
                        ? 'Customers can now add tree planting donations to their orders.'
                        : 'Enable to allow customers to support reforestation.'
                      )
                      : 'Create the "Support Tree Planting" product first to enable donations.'
                    }
                  </s-text>
                </s-stack>
              </s-stack>
            </s-card>

            {/* Action Errors */}
            {fetcher.data?.success === false && (
              <s-banner status="critical">
                <s-paragraph>{fetcher.data?.error}</s-paragraph>
              </s-banner>
            )}

            {/* Next Steps */}
            <s-divider />
            <s-stack direction="block" gap="small">
              <s-heading level="h4">Next Steps</s-heading>
              <s-stack direction="inline" gap="base">
                <s-button
                  variant="primary"
                  onClick={() => navigate('/app/stats')}
                >
                  View Dashboard
                </s-button>
                <s-button
                  variant="secondary"
                  onClick={() => navigate('/app/orders')}
                >
                  View Orders
                </s-button>
                <s-button
                  variant="tertiary"
                  onClick={() => navigate('/app/pricing')}
                >
                  View Pricing Plans
                </s-button>
              </s-stack>
            </s-stack>
          </s-stack>
        </s-section>

        {/* Success Message */}
        {fetcher.data?.success && (
          <s-section heading="Settings Updated">
            <s-banner status="success">
              <s-stack direction="block" gap="small">
                <s-paragraph fontWeight="bold">
                  ✓ Cart donation settings updated successfully!
                </s-paragraph>
                <s-paragraph>
                  The donation option is now {fetcher.data.enabled ? 'enabled' : 'disabled'} in your cart.
                </s-paragraph>
              </s-stack>
            </s-banner>

            <s-stack direction="inline" gap="base" style={{ marginTop: '16px' }}>
              <s-button
                variant="primary"
                onClick={() => navigate('/app/stats')}
              >
                View Dashboard
              </s-button>
              <s-button
                variant="tertiary"
                onClick={() => navigate('/app')}
              >
                Back to Setup
              </s-button>
            </s-stack>
          </s-section>
        )}
      </s-stack>
    </s-page>
  );
}