// app/routes/app.pricing.jsx - UPDATED VERSION
import React, { useState, useEffect } from 'react';
import { useNavigate, useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

// Loader function - runs on server only
export async function loader({ request }) {
  try {
    // Dynamically import server-only code
    const { authenticate, getCurrentUsage, getPricingPlan } = await import("../shopify.server");
    
    const { admin } = await authenticate.admin(request);
    
    // Get current plan and usage from metafields
    const currentPlan = await getPricingPlan(admin);
    const donationCount = await getCurrentUsage(admin);
    
    // Use getBillingStatus function (which we just added)
    const billingStatus = await getBillingStatus(admin);
    
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
    const shopDomain = shopJson.data?.shop?.myshopifyDomain;
    
    return {
      shopDomain,
      currentPlan,
      donationCount,
      billingStatus,
      usageLimit: currentPlan === 'free' ? 5000 : 'unlimited',
      monthlyPrice: currentPlan === 'free' ? 0 : currentPlan === 'essential' ? 6.99 : 29.99
    };
    
  } catch (error) {
    console.error('Error loading pricing data:', error);
    return {
      shopDomain: null,
      currentPlan: 'free',
      donationCount: 0,
      billingStatus: { hasActiveSubscription: false, subscriptions: [] },
      usageLimit: 5000,
      monthlyPrice: 0
    };
  }
}

// Action function for free plan updates
export async function action({ request }) {
  try {
    const { authenticate, updatePricingPlan } = await import("../shopify.server");
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const plan = formData.get('plan');
    
    if (plan !== 'free') {
      return { success: false, error: 'Only free plan can be updated via this endpoint' };
    }
    
    const result = await updatePricingPlan(admin, plan);
    
    return { success: true, plan: result.plan };
    
  } catch (error) {
    console.error('Error updating plan:', error);
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
    billingStatus,
    usageLimit 
  } = loaderData;
  
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
  
  const getCurrentPlanViewsText = () => {
    if (currentPlan === 'free') {
      return `${donationCount.toLocaleString()} of ${usageLimit.toLocaleString()} monthly donations`;
    }
    return `${donationCount.toLocaleString()} donations this month`;
  };
  
  const handlePlanSelect = (plan) => {
    if (plan === 'free') {
      // For free plan, just update metafields
      fetcher.submit(
        { plan },
        { method: 'post' }
      );
    } else {
      // For paid plans, use billing API
      navigate(`/app/billing/${plan}`);
    }
  };
  
  // Check if billing is active for each plan
  const isBillingActive = (plan) => {
    if (plan === 'free') return currentPlan === 'free';
    
    const planName = `Tree Planting - ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`;
    return billingStatus.subscriptions.some(sub => 
      sub.name === planName && sub.status === 'ACTIVE'
    );
  };
  
  const handleFreePlanSelect = () => {
    // Show confirmation for downgrade
    if (currentPlan !== 'free' && window.confirm('Are you sure you want to switch to the free plan? This will limit you to 5,000 donations per month.')) {
      handlePlanSelect('free');
    } else if (currentPlan === 'free') {
      handlePlanSelect('free');
    }
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
        content: currentPlan === 'free' ? 'Current Plan' : 'Switch to Free',
        onClick: handleFreePlanSelect,
        variant: 'secondary',
        disabled: currentPlan === 'free' || fetcher.state === 'submitting',
        loading: fetcher.state === 'submitting' && fetcher.formData?.get('plan') === 'free'
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
        content: isBillingActive('essential') ? 'Active Subscription' : 'Upgrade to Essential',
        onClick: () => handlePlanSelect('essential'),
        variant: 'primary',
        disabled: isBillingActive('essential'),
        secondaryAction: isBillingActive('essential') ? {
          content: 'Manage in Shopify',
          onClick: () => shopify.intents.invoke?.('admin:shopify:settings:billing')
        } : undefined
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
        content: isBillingActive('professional') ? 'Active Subscription' : 'Upgrade to Professional',
        onClick: () => handlePlanSelect('professional'),
        variant: 'secondary',
        disabled: isBillingActive('professional'),
        secondaryAction: isBillingActive('professional') ? {
          content: 'Manage in Shopify',
          onClick: () => shopify.intents.invoke?.('admin:shopify:settings:billing')
        } : undefined
      },
    },
  ];

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
                  
                  <s-text tone="subdued">
                    {getCurrentPlanViewsText()}
                  </s-text>
                  
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
        
        {/* Usage Progress Bar for Free Plan */}
        {currentPlan === 'free' && (
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-stack direction="inline" justifyContent="space-between">
                <s-text fontWeight="medium">Monthly Usage Progress</s-text>
                <s-text tone="subdued" variant="bodySm">
                  {donationCount} / {usageLimit} donations
                </s-text>
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
                    width: `${Math.min((donationCount / usageLimit) * 100, 100)}%`,
                    height: '100%',
                    backgroundColor: donationCount >= usageLimit 
                      ? 'var(--p-color-bg-critical)' 
                      : 'var(--p-color-bg-success)',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease-in-out'
                  }}
                />
              </div>
              
              {donationCount >= usageLimit && (
                <s-banner tone="warning">
                  <s-text variant="bodySm">
                    You've reached your monthly limit! Upgrade to continue accepting donations.
                  </s-text>
                </s-banner>
              )}
            </s-stack>
          </s-box>
        )}

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
        <s-box padding="base" background="subdued" borderRadius="base">
          <s-stack direction="block" gap="small">
            <s-heading level="h4">Usage-Based Pricing</s-heading>
            <s-text tone="subdued">
              • <strong>Free Plan:</strong> 5,000 donations per month included
            </s-text>
            <s-text tone="subdued">
              • <strong>Essential Plan:</strong> Unlimited donations for ${plans[1].price}/month
            </s-text>
            <s-text tone="subdued">
              • <strong>Professional Plan:</strong> All features + priority support for ${plans[2].price}/month
            </s-text>
            <s-text tone="subdued" variant="bodySm" style={{ marginTop: '8px' }}>
              Note: One donation = one tree planting contribution. Usage resets on the 1st of each month.
            </s-text>
            <s-text tone="subdued" variant="bodySm" style={{ marginTop: '8px' }}>
              All paid plans include a 14-day free trial. Cancel anytime from your Shopify billing settings.
            </s-text>
          </s-stack>
        </s-box>
      </s-stack>
    </s-page>
  );
}