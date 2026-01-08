// app/routes/app._index.jsx
import { useState, useEffect } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate, getAppMetafields, setAppMetafield, parseMetafields } from "../shopify.server";
import { syncStoreToExternalAPI } from "../external-api.server";
// SetupGuide Component
const SetupGuide = ({ onDismiss, onStepComplete, items }) => {
  const [expanded, setExpanded] = useState(items.findIndex((item) => !item.complete));
  const [isGuideOpen, setIsGuideOpen] = useState(true);
  const completedItemsLength = items.filter((item) => item.complete).length;

  return (
    <>
      <s-section padding="none">
        <s-box padding="base" paddingBlockEnd="none">
          <s-stack direction="block" gap="none">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-heading level="h3">
                Setup Guide
              </s-heading>
              <s-stack direction="inline" gap="extra-tight" wrap={false}>
                <s-button
                  variant="tertiary"
                  icon="menu-horizontal"
                  onClick={() => onDismiss()}
                />
                <s-button
                  variant="tertiary"
                  icon={isGuideOpen ? "chevron-up" : "chevron-down"}
                  onClick={() => {
                    setIsGuideOpen((prev) => {
                      if (!prev) setExpanded(items.findIndex((item) => !item.complete));
                      return !prev;
                    });
                  }}
                />
              </s-stack>
            </s-stack>
            <s-text>
              Use this personalized guide to get your app up and running.
            </s-text>
            <div style={{ marginTop: '.8rem' }}>
              <s-stack direction="inline" alignItems="center" gap="small-300" paddingBlockEnd={!isGuideOpen ? 'small' : 'none'}>
                {completedItemsLength === items.length ? (
                  <s-stack direction="inline" wrap={false} gap="extra-small">
                    <s-icon
                      source="check"
                      tone="subdued"
                    />
                    <s-text tone="subdued">
                      Done
                    </s-text>
                  </s-stack>
                ) : (
                  <s-text tone="subdued">
                    {`${completedItemsLength} / ${items.length} completed`}
                  </s-text>
                )}

                {completedItemsLength !== items.length ? (
                  <div style={{ width: '100px' }}>
                    <div
                      style={{
                        width: '100%',
                        height: '8px',
                        backgroundColor: 'var(--p-color-border-secondary)',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        style={{
                          width: `${(items.filter((item) => item.complete).length / items.length) * 100}%`,
                          height: '100%',
                          backgroundColor: 'var(--p-color-bg-inverse)',
                          borderRadius: '4px',
                          transition: 'width 0.3s ease-in-out'
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </s-stack>
            </div>
          </s-stack>
        </s-box>
        <div
          style={{
            display: 'grid',
            gridTemplateRows: isGuideOpen ? '1fr' : '0fr',
            transition: 'grid-template-rows 0.1s ease-out',
            paddingBlockStart: isGuideOpen ? '20px' : '0px'
          }}
        >
          <div style={{ overflow: 'hidden' }}>
            <s-box padding="small-300">
              <s-stack direction="block" gap="small-400">
                {items.map((item) => (
                  <SetupItem
                    key={item.id}
                    expanded={expanded === item.id}
                    setExpanded={() => setExpanded(item.id)}
                    onComplete={onStepComplete}
                    {...item}
                  />
                ))}
              </s-stack>
            </s-box>
          </div>
        </div>
        {completedItemsLength === items.length ? (
          <s-box
            background="subdued"
            borderBlockStartWidth="small"
            borderColor="border-secondary"
            padding="base"
          >
            <s-stack direction="inline" justifyContent="end">
              <s-button onClick={onDismiss}>Dismiss Guide</s-button>
            </s-stack>
          </s-box>
        ) : null}
      </s-section>
      <br></br>
    </>
  );
};

const SetupItem = ({
  complete,
  onComplete,
  expanded,
  setExpanded,
  title,
  description,
  primaryButton,
  secondaryButton,
  id
}) => {
  const [loading, setLoading] = useState(false);

  const completeItem = async () => {
    setLoading(true);
    await onComplete(id);
    setLoading(false);
  };

  const outlineSvg = (
    <svg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
      <path
        fillRule='evenodd'
        clipRule='evenodd'
        d='M10.5334 2.10692C11.0126 2.03643 11.5024 2 12 2C12.4976 2 12.9874 2.03643 13.4666 2.10692C14.013 2.18729 14.3908 2.6954 14.3104 3.2418C14.23 3.78821 13.7219 4.166 13.1755 4.08563C12.7924 4.02927 12.3999 4 12 4C11.6001 4 11.2076 4.02927 10.8245 4.08563C10.2781 4.166 9.76995 3.78821 9.68958 3.2418C9.6092 2.6954 9.987 2.18729 10.5334 2.10692ZM7.44122 4.17428C7.77056 4.61763 7.67814 5.24401 7.23479 5.57335C6.603 6.04267 6.04267 6.603 5.57335 7.23479C5.24401 7.67814 4.61763 7.77056 4.17428 7.44122C3.73094 7.11188 3.63852 6.4855 3.96785 6.04216C4.55386 5.25329 5.25329 4.55386 6.04216 3.96785C6.4855 3.63852 7.11188 3.73094 7.44122 4.17428ZM16.5588 4.17428C16.8881 3.73094 17.5145 3.63852 17.9578 3.96785C18.7467 4.55386 19.4461 5.25329 20.0321 6.04216C20.3615 6.4855 20.2691 7.11188 19.8257 7.44122C19.3824 7.77056 18.756 7.67814 18.4267 7.23479C17.9573 6.603 17.397 6.04267 16.7652 5.57335C16.3219 5.24401 16.2294 4.61763 16.5588 4.17428ZM3.2418 9.68958C3.78821 9.76995 4.166 10.2781 4.08563 10.8245C4.02927 11.2076 4 11.6001 4 12C4 12.3999 4.02927 12.7924 4.08563 13.1755C4.166 13.7219 3.78821 14.23 3.2418 14.3104C2.6954 14.3908 2.18729 14.013 2.10692 13.4666C2.03643 12.9874 2 12.4976 2 12C2 11.5024 2.03643 11.0126 2.10692 10.5334C2.18729 9.987 2.6954 9.6092 3.2418 9.68958ZM20.7582 9.68958C21.3046 9.6092 21.8127 9.987 21.8931 10.5334C21.9636 11.0126 22 11.5024 22 12C22 12.4976 21.9636 12.9874 21.8931 13.4666C21.8127 14.013 21.3046 14.3908 20.7582 14.3104C20.2118 14.23 19.834 13.7219 19.9144 13.1755C19.9707 12.7924 20 12.3999 20 12C20 11.6001 19.9707 11.2076 19.9144 10.8245C19.834 10.2781 20.2118 9.76995 20.7582 9.68958ZM4.17428 16.5588C4.61763 16.2294 5.24401 16.3219 5.57335 16.7652C6.04267 17.397 6.603 17.9573 7.23479 18.4267C7.67814 18.756 7.77056 19.3824 7.44122 19.8257C7.11188 20.2691 6.4855 20.3615 6.04216 20.0321C5.25329 19.4461 4.55386 18.7467 3.96785 17.9578C3.63852 17.5145 3.73094 16.8881 4.17428 16.5588ZM19.8257 16.5588C20.2691 16.8881 20.3615 17.5145 20.0321 17.9578C19.4461 18.7467 18.7467 19.4461 17.9578 20.0321C17.5145 20.3615 16.8881 20.2691 16.5588 19.8257C16.2294 19.3824 16.3219 18.756 16.7652 18.4267C17.397 17.9573 17.9573 17.397 18.4267 16.7652C18.756 16.3219 19.3824 16.2294 19.8257 16.5588ZM9.68958 20.7582C9.76995 20.2118 10.2781 19.834 10.8245 19.9144C11.2076 19.9707 11.6001 20 12 20C12.3999 20 12.7924 19.9707 13.1755 19.9144C13.7219 19.834 14.23 20.2118 14.3104 20.7582C14.3908 21.3046 14.013 21.8127 13.4666 21.8931C12.9874 21.9636 12.4976 22 12 22C11.5024 22 11.0126 21.9636 10.5334 21.8931C9.987 21.8127 9.6092 21.3046 9.68958 20.7582Z'
        fill='#8A8A8A'
      />
    </svg>
  );

  const checkSvg = (
    <svg xmlns="http://www.w3.org/2000/svg" height="12" width="12" viewBox="0 0 16 16">
      <path fillRule="evenodd" d="M13.71 3.156a.75.75 0 0 1 .128 1.053l-6.929 8.846-.01.013c-.045.057-.104.134-.163.197a1 1 0 0 1-.382.263 1 1 0 0 1-.714-.005 1 1 0 0 1-.38-.268 6 6 0 0 1-.17-.212l-2.932-3.84a.75.75 0 1 1 1.193-.91l2.657 3.48 6.65-8.489a.75.75 0 0 1 1.052-.128"></path>
    </svg>
  );

  return (
    <s-clickable borderRadius='small'>
      <s-box borderRadius="small" background={expanded ? 'subdued' : undefined} paddingBlockStart="small-400" paddingInline="small-300" paddingBlockEnd="small-400">
        <s-grid gridTemplateColumns='auto 1fr' alignItems='start' columnGap='small'>
          <s-grid-item>
            <s-tooltip>
              {complete ? 'Mark as not done' : 'Mark as done'}
            </s-tooltip>
            <s-clickable onClick={completeItem}>
              <div style={{ width: '1.5rem', height: '1.5rem' }}>
                {loading ? (
                  <s-spinner size="small" />
                ) : complete ? (
                  <div style={{
                    width: '1.25rem',
                    height: '1.25rem',
                    borderRadius: '100%',
                    background: '#303030',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fill: '#fff',
                    color: "#fff",
                  }}>
                    {checkSvg}
                  </div>
                ) : (
                  outlineSvg
                )}
              </div>
            </s-clickable>
          </s-grid-item>
          <s-grid-item>
            <div
              onClick={expanded ? () => null : setExpanded}
              style={{
                cursor: expanded ? 'default' : 'pointer',
                paddingBlockStart: '2px'
              }}
            >
              <s-stack direction="block">
                {
                  expanded ? (
                    <s-heading level="h4">
                      {title}
                    </s-heading>
                  ) : (
                    <s-text>
                      {title}
                    </s-text>
                  )
                }
                <div
                  style={{
                    display: 'grid',
                    gridTemplateRows: expanded ? '1fr' : '0fr',
                    transition: 'grid-template-rows 0.1s ease-out',
                  }}
                >
                  <div style={{ overflow: 'hidden' }}>
                    <s-box paddingBlockStart="small" paddingBlockEnd="small">
                      <s-stack direction="block" gap="large">
                        <s-text>
                          {description}
                        </s-text>
                        {primaryButton || secondaryButton ? (
                          <s-stack direction="inline" gap="base">
                            {primaryButton ? (
                              <s-button variant="primary" {...primaryButton.props}>
                                {primaryButton.content}
                              </s-button>
                            ) : null}
                            {secondaryButton ? (
                              <s-button variant="tertiary" {...secondaryButton.props}>
                                {secondaryButton.content}
                              </s-button>
                            ) : null}
                          </s-stack>
                        ) : null}
                      </s-stack>
                    </s-box>
                  </div>
                </div>
              </s-stack>
            </div>
          </s-grid-item>
        </s-grid>
      </s-box>
    </s-clickable>
  );
};

// Cart Toggle Component
const CartToggle = ({ enabled, onChange, disabled, donationAmount }) => {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" background="surface">
      <s-stack direction="block" gap="300">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <div>
            <s-heading level="h4">Cart Donation Checkbox</s-heading>
            <s-text tone="subdued" variant="bodySm">
              Enable the donation checkbox in cart page and cart drawer
            </s-text>
          </div>
          <s-badge 
            tone={enabled ? "success" : "subdued"}
            icon={enabled ? "check" : "cancel"}
          >
            {enabled ? 'Enabled' : 'Disabled'}
          </s-badge>
        </s-stack>

       

        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <div>
            <s-text fontWeight="medium">Status</s-text>
            <s-text tone="subdued" variant="bodySm">
              {enabled 
                ? 'Customers can add donations to cart' 
                : 'Donation checkbox is hidden'
              }
            </s-text>
          </div>
          
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
            aria-label={enabled ? 'Disable donation option' : 'Enable donation option'}
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
        </s-stack>

        {/* Preview */}
        {enabled && (
          <>
         
            <div style={{
              padding: '0px',
              backgroundColor: 'var(--p-color-bg-success-subdued)',
              borderRadius: 'var(--p-border-radius-300)',
              border: '1px solid var(--p-color-border-success)',
            }}>
              <s-stack direction="inline" gap="200" alignItems="center">
                
                <s-stack direction="block" gap="50">
                  <s-text fontWeight="bold">
                    Add ${parseFloat(donationAmount || "0.00").toFixed(2)} to plant a tree
                  </s-text>
                  <s-text tone="subdued" variant="bodySm">
                    Support reforestation with your purchase
                  </s-text>
                </s-stack>
              </s-stack>
            </div>
          </>
        )}
      </s-stack>
    </s-box>
  );
};

// Price Modal Component
const PriceModal = ({ isOpen, onClose, onSubmit, loading }) => {
  const [selectedPrice, setSelectedPrice] = useState('5.00');
  
  const priceOptions = [
    { value: '5.00', label: '$5.00' },
    { value: '10.00', label: '$10.00' },
    { value: '15.00', label: '$15.00' },
    { value: '20.00', label: '$20.00' },
    { value: '25.00', label: '$25.00' },
  ];

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(selectedPrice);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        width: '90%',
        maxWidth: '400px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      }}>
        <s-stack direction="block" gap="400">
          <s-stack direction="inline" justifyContent="space-between" alignItems="center">
            <s-heading level="h2">Select Donation Price</s-heading>
            <s-button
              variant="tertiary"
              onClick={onClose}
              icon="cancel"
              accessibilityLabel="Close modal"
            />
          </s-stack>

          <form onSubmit={handleSubmit}>
            <s-stack direction="block" gap="400">
              <s-text tone="subdued">
                Choose the amount customers will donate for each tree planted. This will be the price of the "Support Tree Planting" product.
              </s-text>

              <div style={{ margin: '16px 0' }}>
                <s-text fontWeight="medium" variant="bodyMd">Select Amount:</s-text>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  marginTop: '12px',
                }}>
                  {priceOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSelectedPrice(option.value)}
                      style={{
                        padding: '16px',
                        borderRadius: '8px',
                        border: selectedPrice === option.value 
                          ? '2px solid #008060' 
                          : '1px solid #E1E3E5',
                        backgroundColor: selectedPrice === option.value 
                          ? '#F0F9F7' 
                          : 'white',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s',
                        fontSize: '16px',
                        fontWeight: selectedPrice === option.value ? '600' : '400',
                        color: selectedPrice === option.value ? '#008060' : '#202223',
                        outline: 'none',
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{
                padding: '16px',
                backgroundColor: '#F6F6F7',
                borderRadius: '8px',
                margin: '16px 0',
              }}>
                <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                  <s-text fontWeight="medium">Selected Price:</s-text>
                  <s-text variant="headingLg" fontWeight="bold">
                    ${parseFloat(selectedPrice).toFixed(2)}
                  </s-text>
                </s-stack>
                <s-text tone="subdued" variant="bodySm" style={{ marginTop: '8px' }}>
                  This price will be set for the "Support Tree Planting" product
                </s-text>
              </div>

              <s-stack direction="inline" gap="200" justifyContent="end">
                <s-button
                  type="button"
                  variant="tertiary"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </s-button>
                <s-button
                  type="submit"
                  variant="primary"
                  loading={loading}
                >
                  Create Product
                </s-button>
              </s-stack>
            </s-stack>
          </form>
        </s-stack>
      </div>
    </div>
  );
};

// DeepLinkButton Component for Theme App Extension
const DeepLinkButton = ({ shopDomain, apiKey, disabled = false, productExists, cartEnabled, donationAmount, productId, variantId }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  
  // Define app block handle - this should match your theme app extension handle
  const appBlockHandle = 'tree-planting-donation';
  
  const handleConfigureThemeExtension = async () => {
    if (!shopDomain || !apiKey || !productId || !variantId) {
      // console.error('Missing required configuration');
      shopify.toast.show('Missing configuration. Please refresh the page.', { error: true });
      return;
    }
    
    setIsConfiguring(true);
    
    try {
      // Open theme editor for cart page
      const deeplinkUrl = `https://${shopDomain}/admin/themes/current/editor?context=apps&template=cart&activateAppId=${apiKey}/${appBlockHandle}`;
      
      // Open in new tab
      window.open(deeplinkUrl, '_blank', 'noopener,noreferrer');
      
      shopify.toast.show('Theme editor opened. Add the "Tree Planting Donation" block to your cart page.');
      
    } catch (error) {
      // console.error('Error configuring theme extension:', error);
      shopify.toast.show('Error opening theme editor', { error: true });
    } finally {
      setIsConfiguring(false);
    }
  };
  
  const handleOpenCartDrawer = () => {
    if (!shopDomain || !apiKey) {
      shopify.toast.show('Missing configuration. Please refresh the page.', { error: true });
      return;
    }
    
    // Open theme editor for index template (where cart drawer is usually located)
    const deeplinkUrl = `https://${shopDomain}/admin/themes/current/editor?context=apps&template=index&activateAppId=${apiKey}/${appBlockHandle}`;
    window.open(deeplinkUrl, '_blank', 'noopener,noreferrer');
    
    shopify.toast.show('Theme editor opened. Add the "Cart Drawer Donation" block to your theme.');
  };
  
  const handleViewInstructions = () => {
    navigate('/app/instructions');
  };
  
  if (!productExists || !cartEnabled) {
    return null;
  }
  
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" background="surface">
      <s-stack direction="block" gap="400">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <div>
            <s-heading level="h4">Theme App Extension</s-heading>
            <s-text tone="subdued" variant="bodySm">
              Add donation checkbox directly to your theme
            </s-text>
          </div>
          <s-badge tone="success" icon="theme">
            Recommended
          </s-badge>
        </s-stack>
        
      
        
        <s-stack direction="block" gap="200">
          <s-text>
            Use our theme app extension to add the donation checkbox directly to your cart page or cart drawer for better integration.
          </s-text>
          
          <s-text tone="subdued" variant="bodySm">
            This provides a more seamless experience and allows for better customization.
          </s-text>
          <br></br>
          {productId && variantId && cartEnabled && (
            <s-banner status="success">
              <s-stack direction="block" gap="small">
                <s-text fontWeight="medium">Theme Extension Ready!</s-text>
                <s-text variant="bodySm">
                  Configuration: ${donationAmount} donation, product ID: {productId.substring(productId.lastIndexOf('/') + 1)}
                </s-text>
              </s-stack>
            </s-banner>
          )}
        </s-stack>
        <br></br>
        <s-stack direction="inline" gap="200" justifyContent="space-between" alignItems="center">
          <s-button
            variant="primary"
            onClick={handleConfigureThemeExtension}
            loading={isConfiguring}
            disabled={disabled || !shopDomain || !apiKey || !productId || !variantId || !cartEnabled}
            icon="theme"
          >
            {isConfiguring ? 'Opening...' : 'Add to Cart Page'}
          </s-button>
          
         
          <s-stack direction="inline" gap="200" justifyContent="end">
          <s-button
            variant="tertiary"
            onClick={handleViewInstructions}
            icon="help"
          >
            View Instructions
          </s-button>
           <s-button
            variant="secondary"
            onClick={handleOpenCartDrawer}
            disabled={disabled || !shopDomain || !apiKey || !productId || !variantId || !cartEnabled}
            icon="cart"
          >
            Add to Cart Drawer
          </s-button>
        </s-stack>
        </s-stack>
        
        
        
        {(!shopDomain || !apiKey) && (
          <s-banner status="warning">
            <s-text variant="bodySm">
              Unable to generate deep link. Please refresh the page or contact support.
            </s-text>
          </s-banner>
        )}
        
        {(!productId || !variantId) && (
          <s-banner status="critical">
            <s-text variant="bodySm">
              Product configuration incomplete. Please create the donation product first.
            </s-text>
          </s-banner>
        )}
        
        {productId && variantId && !cartEnabled && (
          <s-banner status="warning">
            <s-text variant="bodySm">
              Please enable cart donations first to use theme extension.
            </s-text>
          </s-banner>
        )}
      </s-stack>
    </s-box>
  );
};

export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);

    /* ----------------------------------------------------
     * 1️⃣ FETCH SHOP INFO (ADMIN GRAPHQL – VALID SCHEMA)
     * -------------------------------------------------- */
    const shopResponse = await admin.graphql(
      `#graphql
      query {
        shop {
          id
          name
          email
          myshopifyDomain
          currencyCode
          billingAddress {
            country
          }
          plan {
            displayName
          }
        }
      }`
    );

    const shopJson = await shopResponse.json();

   
    const shop = shopJson.data?.shop;

    const shopDomain = shop?.myshopifyDomain || null;
    const shopId = shop?.id || null;
    const apiKey = process.env.SHOPIFY_API_KEY || "";

    /* ----------------------------------------------------
     * 2️⃣ SYNC STORE → EXTERNAL BILLING API (SAFE)
     * -------------------------------------------------- */
    if (shopDomain) {
      try {
        await syncStoreToExternalAPI({
          shopDomain,
          name: shop?.name,
          email: shop?.email,
          country: shop?.billingAddress?.country,
          currency: shop?.currencyCode,
          planName: shop?.plan?.displayName
        });

        //  console.log("Fetched shop DOMAINNNN:");
      } catch (err) {
        // IMPORTANT: never break the app if external API fails
        console.error("External billing sync failed:", err);
      }
    }

    /* ----------------------------------------------------
     * 3️⃣ LOAD APP METAFIELDS
     * -------------------------------------------------- */
    const metafields = await getAppMetafields(admin);
    const parsedFields = parseMetafields(metafields);

    // console.log("Loaded metafields:", parsedFields);

    /* ----------------------------------------------------
     * 4️⃣ PRODUCT / VARIANT DETECTION
     * -------------------------------------------------- */
    let shopifyProduct = null;
    let exists = false;
    let productId = parsedFields.product_id || null;
    let variantId = null;
    let productPrice = parsedFields.donation_amount || "5.00";

    // Try loading product by stored ID
    if (productId) {
      try {
        const response = await admin.graphql(
          `#graphql
          query GetProduct($id: ID!) {
            product(id: $id) {
              id
              title
              handle
              status
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

        const responseJson = await response.json();

        if (responseJson.data?.product) {
          shopifyProduct = responseJson.data.product;
          exists = true;
          variantId = shopifyProduct.variants.edges[0]?.node?.id || null;
          productPrice =
            shopifyProduct.variants.edges[0]?.node?.price || "5.00";

          // Sync donation amount metafield
          if (parsedFields.donation_amount !== productPrice) {
            await setAppMetafield(admin, {
              key: "donation_amount",
              type: "string",
              value: productPrice
            });
          }
        } else {
          await setAppMetafield(admin, {
            key: "product_id",
            type: "string",
            value: ""
          });
          productId = null;
        }
      } catch (err) {
        console.error("Error loading product by ID:", err);
      }
    }

    // Fallback: search product by title
    if (!shopifyProduct) {
      try {
        const response = await admin.graphql(
          `#graphql
          query {
            products(first: 5, query: "title:'Support Tree Planting'") {
              edges {
                node {
                  id
                  title
                  status
                  variants(first: 1) {
                    edges {
                      node {
                        id
                        price
                      }
                    }
                  }
                }
              }
            }
          }`
        );

        const responseJson = await response.json();
        const product = responseJson.data?.products?.edges?.[0]?.node;

        if (product) {
          shopifyProduct = product;
          exists = true;
          productId = product.id;
          variantId = product.variants.edges[0]?.node?.id || null;
          productPrice = product.variants.edges[0]?.node?.price || "5.00";

          await setAppMetafield(admin, {
            key: "product_id",
            type: "string",
            value: productId
          });

          await setAppMetafield(admin, {
            key: "donation_amount",
            type: "string",
            value: productPrice
          });
        }
      } catch (err) {
        console.error("Error searching product by title:", err);
      }
    }

    /* ----------------------------------------------------
     * 5️⃣ CART + FRONTEND CONFIG
     * -------------------------------------------------- */
    const cartEnabled =
      parsedFields.cart_enabled === true ||
      parsedFields.cart_enabled === "true";

    if (exists && cartEnabled && productId && variantId && shopDomain) {
      const frontendConfig = {
        enabled: true,
        donation_amount: productPrice,
        product_id: productId,
        variant_id: variantId,
        shop_domain: shopDomain,
        last_updated: new Date().toISOString()
      };

      await setAppMetafield(admin, {
        key: "frontend_config",
        type: "json",
        value: JSON.stringify(frontendConfig)
      });

      await setAppMetafield(admin, {
        key: "theme_extension_config",
        type: "json",
        value: JSON.stringify(frontendConfig)
      });
    } else {
      await setAppMetafield(admin, {
        key: "frontend_config",
        type: "json",
        value: JSON.stringify({
          enabled: false,
          donation_amount: "5.00",
          product_id: null,
          variant_id: null,
          shop_domain: shopDomain
        })
      });
    }

    /* ----------------------------------------------------
     * 6️⃣ RETURN DATA TO UI
     * -------------------------------------------------- */
    return {
      shopifyProduct,
      exists,
      productExists: exists, // alias for UI
      hasError: false,
      donationAmount: productPrice,
      cartEnabled,
      productData: parsedFields.product_data || null,
      metafields: parsedFields,
      shopDomain,
      apiKey,
      productId,
      variantId,
      shopId
    };
  } catch (error) {
    console.error("Index loader error:", error);

    return {
      shopifyProduct: null,
      exists: false,
      productExists: false,
      hasError: true,
      errorMessage: error.message || "Failed to load app data",
      donationAmount: "5.00",
      cartEnabled: false,
      shopDomain: null,
      apiKey: process.env.SHOPIFY_API_KEY || "",
      productId: null,
      variantId: null,
      shopId: null
    };
  }
};

// app/routes/app._index.jsx - Complete Action Function with Strict Boolean Handling
export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const actionType = formData.get("actionType");
    const price = formData.get("price");
    const cartEnabled = formData.get("cartEnabled");

    // console.log(`Action received: ${actionType}, price: ${price}, cartEnabled: ${cartEnabled}`);

    if (actionType === "create") {
      // Check if product already exists
      const metafields = await getAppMetafields(admin);
      const parsedFields = parseMetafields(metafields);
      
      if (parsedFields.tree_planting?.product_id || parsedFields.product_id) {
        const productId = parsedFields.tree_planting?.product_id || parsedFields.product_id;
        try {
          const checkResponse = await admin.graphql(
            `#graphql
            query GetProduct($id: ID!) {
              product(id: $id) {
                id
                title
                status
              }
            }`,
            { variables: { id: productId } }
          );
          const checkJson = await checkResponse.json();
          if (checkJson.data?.product && checkJson.data.product.status !== 'ARCHIVED') {
            return { 
              success: false, 
              error: "Product already exists. Please delete it in Shopify first.",
              productId: productId
            };
          }
        } catch (error) {
          console.log('Product not found by ID, continuing with creation');
        }
      }

      // Create the donation product
      const productResponse = await admin.graphql(
        `#graphql
        mutation createTreePlantingProduct($product: ProductCreateInput!) {
          productCreate(product: $product) {
            product {
              id
              title
              handle
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
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            product: {
              title: "Support Tree Planting",
              productType: "Donation",
              vendor: "Tree Planting",
              descriptionHtml: "<p>Support tree planting with your purchase. Every donation helps plant trees and restore our environment.</p>",
              tags: ["donation", "tree-planting", "charity"],
              status: "ACTIVE"
            },
          },
        }
      );

      const productJson = await productResponse.json();
      
      if (productJson.data.productCreate.userErrors?.length > 0) {
        return { 
          success: false, 
          error: productJson.data.productCreate.userErrors[0].message 
        };
      }

      const product = productJson.data.productCreate.product;
      const variantId = product.variants.edges[0]?.node?.id;
      const currentPrice = price || "5.00";

      // console.log(`Product created: ${product.id}, Variant: ${variantId}, Price: ${currentPrice}`);

      // Update variant price if specified
      if (price && variantId) {
        const variantResponse = await admin.graphql(
          `#graphql
          mutation updateVariantPrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkUpdate(productId: $productId, variants: $variants) {
              productVariants {
                id
                price
              }
              userErrors {
                field
                message
              }
            }
          }`,
          {
            variables: {
              productId: product.id,
              variants: [
                {
                  id: variantId,
                  price: price
                }
              ]
            }
          }
        );
        
        const variantJson = await variantResponse.json();
        if (variantJson.data.productVariantsBulkUpdate.userErrors?.length > 0) {
          console.error('Variant price update errors:', variantJson.data.productVariantsBulkUpdate.userErrors);
        }
      }

      // SET METAFIELDS FOR THEME APP EXTENSION (tree_planting namespace)
      // console.log('Setting theme app extension metafields...');
      
      // Delete existing boolean metafields to ensure clean slate
      try {
        await deleteAppMetafield(admin, 'donation_enabled');
        await deleteAppMetafield(admin, 'cart_enabled');
      } catch (error) {
        console.log('Error deleting existing metafields:', error);
        // Continue anyway
      }

      // Set all metafields with CORRECT boolean handling
      // For Shopify boolean metafields, we MUST use type: 'boolean' and string values "true"/"false"
      await Promise.all([
        // 1. donation_enabled as BOOLEAN (false initially)
        setAppMetafield(admin, {
          namespace: 'tree_planting',
          key: 'donation_enabled',
          type: 'boolean', // This tells Shopify it's a boolean type
          value: false, // This will be converted to string "false" by setAppMetafield
        }),

        // 2. cart_enabled as BOOLEAN (false initially)
        setAppMetafield(admin, {
          namespace: 'tree_planting',
          key: 'cart_enabled',
          type: 'boolean',
          value: false,
        }),

        // 3. product_id as single_line_text_field
        setAppMetafield(admin, {
          namespace: 'tree_planting',
          key: 'product_id',
          type: 'single_line_text_field',
          value: product.id,
        }),

        // 4. donation_amount as single_line_text_field
        setAppMetafield(admin, {
          namespace: 'tree_planting',
          key: 'donation_amount',
          type: 'single_line_text_field',
          value: currentPrice,
        }),

        // 5. donation_product_id as single_line_text_field
        setAppMetafield(admin, {
          namespace: 'tree_planting',
          key: 'donation_product_id',
          type: 'single_line_text_field',
          value: product.id,
        }),

        // 6. donation_variant_id as single_line_text_field
        setAppMetafield(admin, {
          namespace: 'tree_planting',
          key: 'donation_variant_id',
          type: 'single_line_text_field',
          value: variantId,
        }),
      ]);

      // 7. Store product data as JSON (for app internal use)
      await setAppMetafield(admin, {
        key: 'product_data',
        type: 'json',
        value: JSON.stringify({
          productId: product.id,
          title: product.title,
          handle: product.handle,
          price: currentPrice,
          variantId: variantId,
          createdAt: new Date().toISOString(),
          status: product.status,
        }),
      });

      // console.log('Product creation complete with all metafields set');

      // Verify the boolean was set correctly
      const verifyResponse = await admin.graphql(
        `#graphql
        query {
          currentAppInstallation {
            metafield(namespace: "tree_planting", key: "donation_enabled") {
              key
              namespace
              type
              value
            }
          }
        }`
      );
      
      const verifyJson = await verifyResponse.json();
      const metafield = verifyJson.data?.currentAppInstallation?.metafield;
      // console.log('✅ Created boolean metafield verification:', metafield);

      return {
        product,
        variantId,
        success: true,
      };
    } 
    
    else if (actionType === "updateCart") {
      // console.log(`Updating cart: cartEnabled = ${cartEnabled}`);
      
      // Convert string to boolean
      const isCartEnabled = cartEnabled === 'true';
      
      // Get existing product_id to verify product exists
      const getProductIdQuery = await admin.graphql(
        `#graphql
        query {
          currentAppInstallation {
            metafield(namespace: "tree_planting", key: "product_id") {
              value
            }
          }
        }`
      );
      
      const productIdJson = await getProductIdQuery.json();
      const productId = productIdJson.data?.currentAppInstallation?.metafield?.value;
      
      if (!productId) {
        return { 
          success: false, 
          error: "Please create the Tree Planting product first before enabling cart donations." 
        };
      }
      
      // console.log(`Product found: ${productId}`);
      
      // Fetch product details to get current price and variant
      let variantId, currentPrice;
      try {
        const productResponse = await admin.graphql(
          `#graphql
          query GetProduct($id: ID!) {
            product(id: $id) {
              id
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
        variantId = productJson.data?.product?.variants?.edges[0]?.node?.id;
        currentPrice = productJson.data?.product?.variants?.edges[0]?.node?.price || "5.00";
        
        if (!variantId) {
          return { 
            success: false, 
            error: "Product variant not found. Please check the product in Shopify." 
          };
        }
        
        // console.log(`Product verified: ${productJson.data.product.title}, Variant: ${variantId}, Current Price: ${currentPrice}`);
      } catch (error) {
        console.error('Error verifying product:', error);
        return { 
          success: false, 
          error: "Error verifying product. Please try again." 
        };
      }

      // Delete existing boolean metafields first (important for type consistency)
      try {
        await deleteAppMetafield(admin, 'donation_enabled');
        await deleteAppMetafield(admin, 'cart_enabled');
      } catch (error) {
        console.log('Error deleting existing metafields:', error);
        // Continue anyway
      }

      // Set all updated metafields with boolean type
      await Promise.all([
        // Set boolean metafields with type: 'boolean'
        setAppMetafield(admin, {
          namespace: 'tree_planting',
          key: 'donation_enabled',
          type: 'boolean',
          value: isCartEnabled,
        }),

        setAppMetafield(admin, {
          namespace: 'tree_planting',
          key: 'cart_enabled',
          type: 'boolean',
          value: isCartEnabled,
        }),

        // Set text metafields
        setAppMetafield(admin, {
          namespace: 'tree_planting',
          key: 'donation_amount',
          type: 'single_line_text_field',
          value: currentPrice,
        }),

        setAppMetafield(admin, {
          namespace: 'tree_planting',
          key: 'donation_product_id',
          type: 'single_line_text_field',
          value: productId,
        }),

        setAppMetafield(admin, {
          namespace: 'tree_planting',
          key: 'donation_variant_id',
          type: 'single_line_text_field',
          value: variantId,
        }),
      ]);

      console.log(`Set donation_enabled (boolean) = ${isCartEnabled}`);

      // Also update theme extension configuration
      await setAppMetafield(admin, {
        namespace: 'tree_planting',
        key: 'theme_extension_config',
        type: 'json',
        value: JSON.stringify({
          enabled: isCartEnabled,
          donation_amount: currentPrice,
          product_id: productId,
          variant_id: variantId,
          last_updated: new Date().toISOString()
        })
      });

      // Verify the boolean metafield was set correctly
      const verifyResponse = await admin.graphql(
        `#graphql
        query {
          currentAppInstallation {
            metafield(namespace: "tree_planting", key: "donation_enabled") {
              key
              namespace
              type
              value
            }
          }
        }`
      );
      
      const verifyJson = await verifyResponse.json();
      const metafield = verifyJson.data?.currentAppInstallation?.metafield;
      
      console.log('✅ Updated boolean metafield verification:', {
        exists: !!metafield,
        type: metafield?.type,
        value: metafield?.value,
        isCorrectType: metafield?.type === 'boolean',
        willWorkInLiquid: metafield?.value === 'true'
      });
      
      return {
        success: true,
        cartEnabled: isCartEnabled,
        donationAmount: currentPrice,
        productId: productId,
        variantId: variantId
      };
    }

    return { success: false, error: "Invalid action type" };
  } catch (error) {
    console.error('Action error:', error);
    return { 
      success: false, 
      error: error.message || "An error occurred. Please try again." 
    };
  }
};
// Main Component
export default function HomeProductCreation() {
  const fetcher = useFetcher();
  const loaderData = useLoaderData();
  const shopify = useAppBridge();
  const navigate = useNavigate();

  const [productExists, setProductExists] = useState(loaderData.exists);
  const [showGuide, setShowGuide] = useState(true);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [cartEnabled, setCartEnabled] = useState(loaderData.cartEnabled);
  const [isUpdatingCart, setIsUpdatingCart] = useState(false);
  const [productId, setProductId] = useState(loaderData.productId);
  const [variantId, setVariantId] = useState(loaderData.variantId);
  // Update the items initialization and useEffect
const [items, setItems] = useState([
  {
    id: 0,
    title: "Create Tree Planting Product",
    description: "Set up a special product that allows customers to donate towards planting trees.",
    complete: loaderData.exists || false,
  },
  {
    id: 1,
    title: "Enable Cart Donation Checkbox",
    description: "Allow customers to add donations to their cart.",
    complete: loaderData.cartEnabled || false,
  },
  {
    id: 2,
    title: "Add to Theme (Optional)",
    description: "Use theme app extension for better integration with your theme.",
    complete: loaderData.productExists && loaderData.cartEnabled,
  },
  {
    id: 3,
    title: "Set Up Pricing Plan",
    description: "Choose a pricing plan that fits your store's needs and volume.",
    complete: false,
  },
]);

// Update the useEffect for step 2
useEffect(() => {
  const updatedItems = items.map(item => {
    if (item.id === 0) {
      return { 
        ...item, 
        complete: productExists,
        primaryButton: productExists ? undefined : {
          content: "Create Product",
          props: {
            onClick: () => setShowPriceModal(true),
            disabled: fetcher.state === 'submitting'
          }
        }
      };
    }
    if (item.id === 1) {
      return { 
        ...item, 
        complete: cartEnabled || false,
        description: !productExists 
          ? "Please create the Tree Planting product first to enable cart donations."
          : "Enable the tree planting donation checkbox in the cart for your customers.",
        primaryButton: productExists && !cartEnabled ? {
          content: "Enable Now",
          props: {
            onClick: () => handleToggleCart(true),
          }
        } : undefined
      };
    }
    if (item.id === 2) {
      const themeExtensionReady = productExists && cartEnabled && productId && variantId;
      return { 
        ...item,
        description: themeExtensionReady 
          ? "Theme extension is ready! You can add the donation checkbox to your cart page or drawer."
          : "Complete steps 1 and 2 first to enable theme app extension.",
        complete: themeExtensionReady,
        primaryButton: themeExtensionReady ? {
          content: "Add to Theme",
          props: {
            onClick: () => {
              if (loaderData.shopDomain && loaderData.apiKey && productId && variantId) {
                const deeplinkUrl = `https://${loaderData.shopDomain}/admin/themes/current/editor?context=apps&template=cart&activateAppId=${loaderData.apiKey}/tree-planting-donation`;
                window.open(deeplinkUrl, '_blank', 'noopener,noreferrer');
              }
            }
          }
        } : undefined,
        secondaryButton: themeExtensionReady ? {
          content: "View Instructions",
          props: {
            onClick: () => navigate('/app/instructions'),
          }
        } : undefined
      };
    }
    if (item.id === 3) {
      return { 
        ...item,
        primaryButton: {
          content: "View Plans",
          props: {
            onClick: () => navigate('/app/pricing'),
          }
        }
      };
    }
    return item;
  });
  setItems(updatedItems);
}, [productExists, cartEnabled, fetcher.state, navigate, loaderData.shopDomain, loaderData.apiKey, productId, variantId]);

  const isLoading = ["loading", "submitting"].includes(fetcher.state) && fetcher.formMethod === "POST";
  const hasActionError = fetcher.data?.success === false;

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.product) {
        setProductExists(true);
        setProductId(fetcher.data.product.id);
        setVariantId(fetcher.data.variantId);
        shopify.toast.show("Support Tree Planting product created successfully!");
        setShowPriceModal(false);
      }
      if (fetcher.data.cartEnabled !== undefined) {
        setCartEnabled(fetcher.data.cartEnabled);
        setIsUpdatingCart(false);
        shopify.toast.show(
          `Cart donation ${fetcher.data.cartEnabled ? 'enabled' : 'disabled'} successfully!`
        );
        
        // If cart was enabled, update theme extension config
        if (fetcher.data.cartEnabled) {
          shopify.toast.show("Theme app extension configuration updated!");
        }
      }
    } else if (hasActionError) {
      shopify.toast.show(fetcher.data?.error || "An error occurred", { error: true });
      setIsUpdatingCart(false);
    }
  }, [fetcher.data, hasActionError, shopify]);

  useEffect(() => {
    setProductExists(loaderData.exists);
    setCartEnabled(loaderData.cartEnabled);
    setProductId(loaderData.productId);
    setVariantId(loaderData.variantId);
  }, [loaderData]);

  const handleCreateProduct = (price) => {
    fetcher.submit(
      { 
        actionType: "create",
        price: price
      }, 
      { method: "POST" }
    );
  };

  const handleToggleCart = (enabled) => {
    setIsUpdatingCart(true);
    fetcher.submit(
      { 
        actionType: "updateCart",
        cartEnabled: enabled.toString()
      }, 
      { method: "POST" }
    );
  };

  const onStepComplete = async (id) => {
    try {
      // Simulate API call
      await new Promise((res) => setTimeout(() => res(), 1000));
      
      // Update the specific item's completion status
      setItems((prev) => prev.map((item) => 
        item.id === id ? { ...item, complete: !item.complete } : item
      ));
      
      // If it's the cart settings step, toggle the cart
      if (id === 1 && productExists) {
        handleToggleCart(!cartEnabled);
      }
      // If it's the theme extension step
      else if (id === 2 && productExists && cartEnabled) {
        if (loaderData.shopDomain && loaderData.apiKey && productId && variantId) {
          const deeplinkUrl = `https://${loaderData.shopDomain}/admin/themes/current/editor?context=apps&template=cart&activateAppId=${loaderData.apiKey}/tree-planting-donation`;
          window.open(deeplinkUrl, '_blank', 'noopener,noreferrer');
        }
      }
    } catch (e) {
      console.error(e);
      shopify.toast.show("Failed to update step", { error: true });
    }
  };

  if (loaderData.hasError) {
    return (
      <s-page heading="Tree Planting Product Manager">
        <s-section>
          <s-banner status="critical">
            <s-paragraph>Error loading app data: {loaderData.errorMessage}</s-paragraph>
            <s-button
              variant="tertiary"
              onClick={() => window.location.reload()}
              style={{ marginTop: '8px' }}
            >
              Retry
            </s-button>
          </s-banner>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Tree Planting Product Manager">
      {/* Price Selection Modal */}
      <PriceModal
        isOpen={showPriceModal}
        onClose={() => setShowPriceModal(false)}
        onSubmit={handleCreateProduct}
        loading={isLoading}
      />

      {/* Primary action */}
      {!productExists && (
        <s-button 
          slot="primary-action" 
          onClick={() => setShowPriceModal(true)} 
          loading={isLoading}
          disabled={isLoading}
        >
          Create Product
        </s-button>
      )}

      <s-stack direction="block" gap="600">
        {/* Setup Guide */}
        {showGuide ? (
          <SetupGuide
            onDismiss={() => setShowGuide(false)}
            onStepComplete={onStepComplete}
            items={items}
          />
        ) : (
          <s-button onClick={() => setShowGuide(true)} variant="secondary">
            Show Setup Guide
          </s-button>
        )}

        {/* Product Creation Section */}
        <s-section heading="Tree Planting Product">
          <s-heading level="h3">Help your customers give back</s-heading>
          
          <s-paragraph>
            {productExists 
              ? "Your tree planting donation product is ready! Customers can now add donations to their cart."
              : "Create a special 'Support Tree Planting' product that allows customers to donate towards planting trees."
            }
          </s-paragraph>

          <s-stack direction="block" gap="base">
            {productExists ? (
              <>
                <s-banner status="success">
                  <s-stack direction="block" gap="small">
                    <s-paragraph>
                      <div style={{display:"flex"}}> Product is active!</div>
                    </s-paragraph>
                    <s-paragraph tone="subdued" variant="bodySm">
                      Current donation amount: ${parseFloat(loaderData.donationAmount || "0.00").toFixed(2)} per tree
                    </s-paragraph>
                    <s-stack direction="inline" gap="small">
                      <s-button
                        variant="primary"
                        onClick={() =>
                          shopify.intents.invoke?.("edit:shopify/Product", {
                            value: loaderData.shopifyProduct.id,
                          })
                        }
                      >
                        Edit Product in Shopify
                      </s-button>
                      <s-button
                        variant="tertiary"
                        onClick={() =>
                          shopify.intents.invoke?.("preview:shopify/Product", {
                            value: loaderData.shopifyProduct.id,
                          })
                        }
                      >
                        View Product
                      </s-button>
                    </s-stack>
                  </s-stack>
                </s-banner>

                {/* Product Details */}
                {/* {loaderData.shopifyProduct && (
                  <s-box 
                    padding="base" 
                    borderWidth="base" 
                    borderRadius="base" 
                    background="subdued"
                  >
                    <s-stack direction="block" gap="small">
                      <s-text fontWeight="medium">Product Details:</s-text>
                      <s-stack direction="block" gap="extra-small">
                        <s-stack direction="inline" justifyContent="space-between">
                          <s-text tone="subdued">Title:</s-text>
                          <s-text>{loaderData.shopifyProduct.title}</s-text>
                        </s-stack>
                        <s-stack direction="inline" justifyContent="space-between">
                          <s-text tone="subdued">Status:</s-text>
                          <s-badge tone={loaderData.shopifyProduct.status === 'ACTIVE' ? 'success' : 'warning'}>
                            {loaderData.shopifyProduct.status}
                          </s-badge>
                        </s-stack>
                        <s-stack direction="inline" justifyContent="space-between">
                          <s-text tone="subdued">Donation Amount:</s-text>
                          <s-text>
                            ${parseFloat(loaderData.donationAmount || "0.00").toFixed(2)}
                          </s-text>
                        </s-stack>
                        {productId && (
                          <s-stack direction="inline" justifyContent="space-between">
                            <s-text tone="subdued">Product ID:</s-text>
                            <s-text variant="bodySm">{productId.substring(productId.lastIndexOf('/') + 1)}</s-text>
                          </s-stack>
                        )}
                      </s-stack>
                    </s-stack>
                  </s-box>
                )} */}

                {/* Cart Settings Section - Integrated below product */}
                <CartToggle
                  enabled={cartEnabled}
                  onChange={() => handleToggleCart(!cartEnabled)}
                  disabled={isUpdatingCart || !productExists}
                  donationAmount={loaderData.donationAmount}
                />

                {/* Theme App Extension Section */}
                {cartEnabled && productExists && (
                  <>
                    {/* <s-divider /> */}
                    <DeepLinkButton 
                      shopDomain={loaderData.shopDomain}
                      apiKey={loaderData.apiKey}
                      disabled={!productExists || !cartEnabled}
                      productExists={productExists}
                      cartEnabled={cartEnabled}
                      donationAmount={loaderData.donationAmount}
                      productId={productId}
                      variantId={variantId}
                    />
                  </>
                )}
              </>
            ) : (
              <s-banner status="info">
                <s-paragraph>
                  Click "Create Product" to add a "Support Tree Planting" product to your Shopify store.
                  You'll be able to select the donation amount before creation.
                </s-paragraph>
              </s-banner>
            )}

            {hasActionError && (
              <s-banner status="critical">
                <s-paragraph>{fetcher.data?.error}</s-paragraph>
              </s-banner>
            )}

            {/* Next Steps */}
            {productExists && (
              <>
                {/* <s-divider /> */}
                {/* <s-stack direction="block" gap="small">
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
                    <s-button
                      variant="tertiary"
                      onClick={() => navigate('/app/instructions')}
                    >
                      Setup Instructions
                    </s-button>
                  </s-stack>
                </s-stack> */}
              </>
            )}
          </s-stack>
        </s-section>

        {/* Success Message for New Product */}
        {fetcher.data?.success && fetcher.data?.product && (
          <s-section heading="Product Created Successfully">
            <s-banner status="success">
              <s-stack direction="block" gap="small">
                <s-paragraph fontWeight="bold">
                  ✓ "Support Tree Planting" product has been created in your Shopify store.
                </s-paragraph>
                <s-paragraph>
                  Now you can enable the donation checkbox in cart for your customers.
                </s-paragraph>
              </s-stack>
            </s-banner>

            <s-stack direction="inline" gap="base" style={{ marginTop: '16px' }}>
              <s-button
                variant="primary"
                onClick={() =>
                  shopify.intents.invoke?.("edit:shopify/Product", {
                    value: fetcher.data.product.id,
                  })
                }
              >
                Edit Product in Shopify
              </s-button>
              <s-button
                variant="secondary"
                onClick={() => handleToggleCart(true)}
                loading={isUpdatingCart}
              >
                Enable Cart Donations
              </s-button>
            </s-stack>
          </s-section>
        )}
      </s-stack>
    </s-page>
  );
}