// app/routes/app.pricing.jsx - UPDATED VERSION WITH EXTERNAL API INTEGRATION
import React, { useState, useEffect } from 'react';
import { useNavigate, useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

// Loader function - runs on server only
export async function loader({ request }) {
  try {
    // Try to authenticate
    const { authenticate, getCurrentUsage, getPricingPlan } = await import("../shopify.server");
    
    let admin;
    let shopDomain = null;
    
    try {
      const authResult = await authenticate.admin(request);
      admin = authResult.admin;
      
      // Get shop domain for reference
      const shopResponse = await admin.graphql(
        `#graphql
        query {
          shop {
            myshopifyDomain
          }
        }`
      );
      
      const shopJson = await shopResponse.json();
      shopDomain = shopJson.data?.shop?.myshopifyDomain;
    } catch (authError) {
      console.log("Authentication failed, returning default data");
      return {
        shopDomain: null,
        currentPlan: 'free',
        donationCount: 0,
        totalDonations: 0,
        totalAmount: 0,
        billingStatus: { hasActiveSubscription: false, subscriptions: [] },
        usageLimit: 5000,
        monthlyPrice: 0,
        hasError: false,
        isAuthenticated: false
      };
    }
    
    // Get current plan from metafields
    const currentPlan = await getPricingPlan(admin);
    
    // Use getBillingStatus function
    const billingStatus = await getBillingStatus(admin);
    
    // Fetch usage data from external API
    let externalUsageData = null;
    let donationCount = 0;
    let totalDonations = 0;
    let totalAmount = 0;
    
    if (shopDomain) {
      try {
        const externalApiUrl = `https://tree-backend-navy.vercel.app/api/usage/${shopDomain}`;
        const response = await fetch(externalApiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          externalUsageData = await response.json();
          
          // Calculate current month's donations
          const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
          donationCount = externalUsageData.data
            ?.filter(order => {
              const orderMonth = new Date(order.createdAt).toISOString().slice(0, 7);
              return orderMonth === currentMonth;
            })
            ?.reduce((sum, order) => sum + (order.treesPlanted || 0), 0) || 0;
          
          // Get total donations
          totalDonations = externalUsageData.totalTrees || 0;
          
          // Get total amount
          totalAmount = externalUsageData.totalAmount || 0;
        } else {
          console.log('External API not available, using metafield data');
          // Fallback to metafield data
          donationCount = await getCurrentUsage(admin);
        }
      } catch (error) {
        console.log('Error fetching external API data:', error);
        // Fallback to metafield data
        donationCount = await getCurrentUsage(admin);
      }
    } else {
      // No shop domain, use metafield data
      donationCount = await getCurrentUsage(admin);
    }
    
    return {
      shopDomain,
      currentPlan,
      donationCount,
      totalDonations,
      totalAmount,
      billingStatus,
      usageLimit: currentPlan === 'free' ? 5000 : 'unlimited',
      monthlyPrice: currentPlan === 'free' ? 0 : currentPlan === 'essential' ? 6.99 : 29.99,
      hasError: false,
      isAuthenticated: true
    };
    
  } catch (error) {
    console.error('Error loading pricing data:', error);
    
    return {
      shopDomain: null,
      currentPlan: 'free',
      donationCount: 0,
      totalDonations: 0,
      totalAmount: 0,
      billingStatus: { hasActiveSubscription: false, subscriptions: [] },
      usageLimit: 5000,
      monthlyPrice: 0,
      hasError: true,
      errorMessage: error.message,
      isAuthenticated: false
    };
  }
}

// Action function for free plan updates
export async function action({ request }) {
  try {
    const { authenticate, updatePricingPlan, cancelActiveSubscription } =
      await import("../shopify.server");

    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const plan = formData.get("plan");

    if (plan !== "free") {
      return { success: false, error: "Invalid plan" };
    }

    // 🔑 CANCEL SHOPIFY SUBSCRIPTION FIRST
    await cancelActiveSubscription(admin);

    // 🔑 THEN update metafield
    await updatePricingPlan(admin, "free");

    return { success: true, plan: "free" };
  } catch (error) {
    console.error("Error downgrading to free:", error);
    return { success: false, error: error.message };
  }
}

// Add this missing import at the top (after the React imports)
async function getBillingStatus(admin) {
  try {
    const response = await admin.graphql(
      `#graphql
      query {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            test
            lineItems {
              plan {
                pricingDetails {
                  ... on AppRecurringPricing {
                    interval
                    price {
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
    const subscriptions = data?.data?.currentAppInstallation?.activeSubscriptions || [];
    
    return {
      hasActiveSubscription: subscriptions.length > 0,
      subscriptions
    };
  } catch (error) {
    console.error('Error getting billing status:', error);
    return {
      hasActiveSubscription: false,
      subscriptions: []
    };
  }
}

// PricingCard Component (same as before)
const PricingCard = ({
  title,
  description,
  price,
  features,
  featuredText,
  button,
  frequency,
  isCurrentPlan = false,
  isBillingActive = false,
}) => {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: '15.6rem',
        boxShadow: featuredText ? '0px 0px 15px 4px #CDFEE1' : isCurrentPlan ? '0px 0px 15px 4px #e3f2ff' : 'none',
        borderRadius: '.75rem',
        position: 'relative',
        backgroundColor: '#FFFFFF',
        padding: '24px',
        zIndex: '0',
        gap: '16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        border: isCurrentPlan ? '2px solid #0B69FF' : featuredText ? '2px solid #CDFEE1' : '1px solid #E1E3E5',
      }}
    >
      {/* Featured Badge */}
      {featuredText && (
        <div style={{ 
          position: 'absolute', 
          top: '-15px', 
          right: '6px', 
          zIndex: '100' 
        }}>
          <s-badge size="large" tone="success">
            {featuredText}
          </s-badge>
        </div>
      )}
      
      {/* Current Plan Badge */}
      {isCurrentPlan && (
        <div style={{ 
          position: 'absolute', 
          top: '-15px', 
          left: '6px', 
          zIndex: '100' 
        }}>
          <s-badge size="large" tone="info">
            {isBillingActive ? 'Active Subscription' : 'Current Plan'}
          </s-badge>
        </div>
      )}

      <s-stack direction="block" gap="large">
        {/* Title & Description */}
        <s-stack direction="block" gap="base" alignItems="start">
          <h1 style={{ 
            fontSize: "20px", 
            fontWeight: "bold",
            margin: 0 
          }}>
            {title}
          </h1>
          {description && (
            <s-text tone="subdued">
              {description}
            </s-text>
          )}
        </s-stack>

        {/* Price */}
        <s-stack direction="inline" gap="small-400" alignItems="baseline">
          <h2 style={{ 
            fontSize: "28px", 
            fontWeight: "bold",
            margin: 0 
          }}>
            {price}
          </h2>
          {frequency && (
            <s-text tone="subdued">
              / {frequency}
            </s-text>
          )}
        </s-stack>

        {/* Features */}
        <s-stack direction="block" gap="small-400">
          {features?.map((feature, id) => (
            <s-stack direction="inline" gap="200" key={id}>
              <div style={{ 
                width: '20px', 
                flexShrink: 0, 
                marginTop: '4px',
                display: 'flex',
                alignItems: 'center'
              }}>
                <s-icon 
                  source="check" 
                  tone={isCurrentPlan ? "primary" : "success"}
                />
              </div>
              <s-text tone={isCurrentPlan ? "default" : "subdued"}>
                {feature}
              </s-text>
            </s-stack>
          ))}
        </s-stack>
      </s-stack>
      
      <s-stack alignItems="start" marginTop="large">
        <s-button 
          onClick={button.onClick}
          variant={button.variant}
          disabled={button.disabled}
          loading={button.loading}
          style={{ width: '100%' }}
        >
          {button.content}
        </s-button>
        
        {button.secondaryAction && (
          <s-button 
            onClick={button.secondaryAction.onClick}
            variant="tertiary"
            style={{ width: '100%', marginTop: '8px' }}
          >
            {button.secondaryAction.content}
          </s-button>
        )}
      </s-stack>
    </div>
  );
};

// Main Pricing Page Component
export default function PricingPage() {
  const navigate = useNavigate();
  const loaderData = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  
  const { 
    currentPlan, 
    donationCount, 
    totalDonations,
    totalAmount,
    billingStatus,
    usageLimit,
    shopDomain
  } = loaderData;
  
  const [externalData, setExternalData] = useState({
    donationCount: donationCount,
    totalDonations: totalDonations,
    totalAmount: totalAmount
  });
  
  const [isLoading, setIsLoading] = useState(false);
  
  const [urlParams] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search);
    }
    return new URLSearchParams();
  });
  
  const updated = urlParams.get('updated') === 'true';
  const urlPlan = urlParams.get('plan');
  const error = urlParams.get('error');
  
  // Show success/error messages from URL params
  useEffect(() => {
    if (updated && urlPlan) {
      shopify.toast.show(`Successfully updated to ${urlPlan} plan!`, { tone: 'success' });
      // Clean URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
    
    if (error) {
      shopify.toast.show(`Error: ${error}`, { tone: 'critical' });
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [updated, urlPlan, error, shopify]);
  
  // Fetch external API data on component mount
  useEffect(() => {
    const fetchExternalData = async () => {
      if (!shopDomain) return;
      
      setIsLoading(true);
      try {
        const externalApiUrl = `https://tree-backend-navy.vercel.app/api/usage/${shopDomain}`;
        const response = await fetch(externalApiUrl);
        
        if (response.ok) {
          const data = await response.json();
          
          // Calculate current month's donations
          const currentMonth = new Date().toISOString().slice(0, 7);
          const monthlyDonations = data.data
            ?.filter(order => {
              const orderMonth = new Date(order.createdAt).toISOString().slice(0, 7);
              return orderMonth === currentMonth;
            })
            ?.reduce((sum, order) => sum + (order.treesPlanted || 0), 0) || 0;
          
          setExternalData({
            donationCount: monthlyDonations,
            totalDonations: data.totalTrees || 0,
            totalAmount: data.totalAmount || 0
          });
        }
      } catch (error) {
        console.error('Error fetching external data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchExternalData();
  }, [shopDomain]);
  
  const getCurrentPlanViewsText = () => {
    if (currentPlan === 'free') {
      return `${externalData.donationCount.toLocaleString()} of ${usageLimit.toLocaleString()} monthly donations`;
    }
    return `${externalData.donationCount.toLocaleString()} donations this month`;
  };
  
  const handlePlanSelect = (plan) => {
    if (plan === 'free') {
      fetcher.submit(
        { plan },
        { method: 'post' }
      );
    } else {
      navigate(`/app/billing/${plan}`);
    }
  };
  
  // Check if billing is active for each plan
  const isBillingActive = (plan) => {
    if (plan === 'free') return currentPlan === 'free';
    
    return (
      currentPlan === plan &&
      billingStatus.subscriptions.some(sub => sub.status === 'ACTIVE')
    );
  };
  
  const handleFreePlanSelect = () => {
    if (currentPlan !== 'free' && window.confirm('Are you sure you want to switch to the free plan? This will limit you to 5,000 donations per month.')) {
      handlePlanSelect('free');
    } else if (currentPlan === 'free') {
      handlePlanSelect('free');
    }
  };
  
  const isPlanSelected = (planId) => {
    if (planId === 'free') {
      return currentPlan === 'free';
    }
    return isBillingActive(planId);
  };
  
  const plans = [
    {
      id: 'free',
      title: 'Free Plan',
      description: 'Up to 5,000 monthly donations',
      price: 'Free',
      frequency: '',
      features: [
        'Tree planting donation product',
        'Cart page integration',
        'Cart drawer integration',
        '5,000 monthly donations included',
        'Basic analytics dashboard',
        'Email support'
      ],
      button: {
        content: isPlanSelected('free') ? 'Current Plan' : 'Switch to Free',
        onClick: handleFreePlanSelect,
        variant: 'secondary',
        disabled: isPlanSelected('free') || fetcher.state === 'submitting',
        loading:
          fetcher.state === 'submitting' &&
          fetcher.formData?.get('plan') === 'free',
      },
    },
    {
      id: 'essential',
      title: 'Essential',
      description: 'For growing stores',
      price: '$6.99',
      frequency: 'month',
      featuredText: 'Most Popular',
      features: [
        'Everything in Free',
        'Unlimited monthly donations',
        'Advanced analytics',
        'Order tracking dashboard',
        'Custom donation amounts',
        'Multiple language support',
        'Priority email support',
        'Monthly impact reports'
      ],
      button: {
        content: isPlanSelected('essential')
          ? 'Active Subscription'
          : 'Upgrade to Essential',
        onClick: () => handlePlanSelect('essential'),
        variant: 'primary',
        disabled: isPlanSelected('essential'),
      },
    },
    {
      id: 'professional',
      title: 'Professional',
      description: 'For high-volume stores',
      price: '$29.99',
      frequency: 'month',
      features: [
        'Everything in Essential',
        'Custom branding options',
        'API access for custom integrations',
        'Advanced targeting rules',
        'A/B testing capabilities',
        'Dedicated account manager',
        'Phone & priority support',
        'Custom reporting'
      ],
      button: {
        content: isPlanSelected('professional')
          ? 'Active Subscription'
          : 'Upgrade to Professional',
        onClick: () => handlePlanSelect('professional'),
        variant: 'secondary',
        disabled: isPlanSelected('professional'),
      },
    },
  ];
  
  // Calculate progress percentage
  const progressPercentage = currentPlan === 'free' 
    ? Math.min((externalData.donationCount / usageLimit) * 100, 100)
    : 0;

  return (
    <s-page heading="Tree Planting Donation Pricing" inlineSize="base">
      <s-button 
        slot="primary-action" 
        variant="tertiary" 
        onClick={() => navigate('/app')}
      >
        Back to Setup
      </s-button>
      
      <s-stack direction="block" gap="600">
        {/* Success/Error Banners */}
        {fetcher.data?.success && (
          <s-banner tone="success">
            <s-text>
              Plan updated successfully!
            </s-text>
          </s-banner>
        )}
        
        {fetcher.data?.error && (
          <s-banner tone="critical">
            <s-text>
              Error: {fetcher.data.error}
            </s-text>
          </s-banner>
        )}

        {/* Current Plan Section */}
        {/* {currentPlan && (
          <s-box padding="base"
            background="base"
            borderRadius="base"
            borderWidth="base"
            borderColor="base">
            <s-stack direction="block" gap="base">
              <s-heading level="h3">Current Plan</s-heading>
              
              <s-stack gap="base">
                <s-box
                  accessibilityRole="status"
                  borderRadius="base"
                >
                  <s-stack direction="block">
                    <s-text tone="subdued">Active subscription</s-text>
                    
                    <s-stack direction="inline" gap="200" alignItems="center">
                      <s-heading level="h2">
                        {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} plan
                      </s-heading>
                      <s-badge tone="info">Active</s-badge>
                    </s-stack>
                    
                    <s-stack direction="block" gap="small" style={{ marginTop: '12px' }}>
                      <s-text tone="subdued">
                        <strong>Total Impact:</strong> {externalData.totalDonations} trees planted
                      </s-text>
                      <s-text tone="subdued">
                        <strong>Total Contributions:</strong> ${externalData.totalAmount.toFixed(2)}
                      </s-text>
                      <s-text tone="subdued">
                        <strong>Monthly Usage:</strong> {getCurrentPlanViewsText()}
                      </s-text>
                    </s-stack>
                    
                    {currentPlan !== 'free' && (
                      <s-text tone="subdued" variant="bodySm" style={{ marginTop: '8px' }}>
                        ${currentPlan === 'essential' ? '6.99' : '29.99'} per month • Unlimited donations
                      </s-text>
                    )}
                    
                    {billingStatus.hasActiveSubscription && (
                      <s-button 
                        variant="tertiary" 
                        size="small"
                        onClick={() => shopify.intents.invoke?.('admin:shopify:settings:billing')}
                        style={{ marginTop: '8px' }}
                      >
                        Manage Subscription in Shopify
                      </s-button>
                    )}
                  </s-stack>
                </s-box>
              </s-stack>
            </s-stack>
          </s-box>
        )} */}
        
        {/* Usage Progress Bar for Free Plan */}
        {currentPlan === 'free' && (
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                <s-text fontWeight="medium">Monthly Usage Progress</s-text>
                <s-stack direction="inline" gap="small" alignItems="center">
                  {isLoading && <s-spinner size="small" />}
                  <s-text tone="subdued" variant="bodySm">
                    {externalData.donationCount.toLocaleString()} / {usageLimit.toLocaleString()} donations
                  </s-text>
                </s-stack>
              </s-stack>
              
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'var(--p-color-border-secondary)',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div
                  style={{
                    width: `${progressPercentage}%`,
                    height: '100%',
                    backgroundColor: externalData.donationCount >= usageLimit 
                      ? 'var(--p-color-bg-critical)' 
                      : 'var(--p-color-bg-success)',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease-in-out'
                  }}
                />
              </div>
              
             
              
              {externalData.donationCount >= usageLimit && (
                <s-banner tone="warning">
                  <s-text variant="bodySm">
                    You've reached your monthly limit! Upgrade to continue accepting donations.
                  </s-text>
                </s-banner>
              )}
            </s-stack>
          </s-box>
        )}

        {/* Impact Summary */}
        {/* {(externalData.totalDonations > 0 || externalData.totalAmount > 0) && (
          <s-box padding="base" background="success-subdued" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-heading level="h4">Your Environmental Impact</s-heading>
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <s-box padding="small" background="surface" borderRadius="base">
                  <s-stack direction="block" gap="extra-small">
                    <s-text tone="subdued" variant="bodySm">Trees Planted</s-text>
                    <s-text variant="headingLg" fontWeight="bold">{externalData.totalDonations}</s-text>
                    <s-text tone="success" variant="bodySm">Making a difference!</s-text>
                  </s-stack>
                </s-box>
                <s-box padding="small" background="surface" borderRadius="base">
                  <s-stack direction="block" gap="extra-small">
                    <s-text tone="subdued" variant="bodySm">Total Contributions</s-text>
                    <s-text variant="headingLg" fontWeight="bold">${externalData.totalAmount.toFixed(2)}</s-text>
                    <s-text tone="success" variant="bodySm">Supporting reforestation</s-text>
                  </s-stack>
                </s-box>
              </s-grid>
            </s-stack>
          </s-box>
        )} */}

        {/* Pricing Cards */}
        <s-box>
          <s-stack direction="block" gap="large-100">
            <s-stack direction="inline" gap="large-100" wrap justifyContent="center">
              {plans.map((plan) => (
                <PricingCard
                  key={plan.id}
                  title={plan.title}
                  description={plan.description}
                  price={plan.price}
                  frequency={plan.frequency}
                  features={plan.features}
                  featuredText={plan.featuredText}
                  button={plan.button}
                  isCurrentPlan={currentPlan === plan.id}
                  isBillingActive={isBillingActive(plan.id)}
                />
              ))}
            </s-stack>
          </s-stack>
        </s-box>
        
        {/* Billing Information */}
       
        
        {/* Refresh Button */}
        <s-box textAlign="center">
          <s-button 
            variant="tertiary" 
            onClick={() => window.location.reload()}
            loading={isLoading}
            icon="refresh"
          >
            Refresh Usage Data
          </s-button>
        </s-box>
      </s-stack>
    </s-page>
  );
}