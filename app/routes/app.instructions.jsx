// app/routes/app.instructions.jsx
import React from 'react';
import { useLoaderData, useNavigate } from 'react-router';

export const loader = async ({ request }) => {
  // You can reuse the authenticate and getShopDomain functions
  return {
    title: "Theme App Extension Setup",
  };
};

export default function InstructionsPage() {
  const navigate = useNavigate();
  
  const installationSteps = [
    {
      step: 1,
      title: "Enable Theme App Extension",
      description: "Click 'Add to Theme' button to open the theme editor.",
      icon: "theme"
    },
    {
      step: 2,
      title: "Select Placement",
      description: "In the theme editor, navigate to the cart page or section where you want the donation checkbox.",
      icon: "location"
    },
    {
      step: 3,
      title: "Add App Block",
      description: "Click 'Add block' and select 'Tree Planting Donation' from the app blocks list.",
      icon: "add"
    },
    {
      step: 4,
      title: "Customize & Save",
      description: "Position the block as desired, customize settings if available, and save your theme.",
      icon: "save"
    }
  ];
  
  const troubleshootingTips = [
    "Ensure you have proper permissions to edit the theme",
    "The app block may need to be enabled in your theme's app block settings",
    "Some themes may require specific sections to support app blocks",
    "Clear your browser cache if the app block doesn't appear"
  ];
  
  return (
    <s-page heading="Theme App Extension Setup">
      <s-button 
        slot="primary-action" 
        variant="tertiary"
        onClick={() => navigate('/app')}
      >
        Back to Setup
      </s-button>
      
      <s-stack direction="block" gap="600">
        <s-section heading="Installation Guide">
          <s-heading level="h3">Add Tree Planting Donation to Your Theme</s-heading>
          
          <s-paragraph>
            Follow these steps to integrate the tree planting donation checkbox directly into your Shopify theme.
            This provides a more seamless experience compared to the app embed block.
          </s-paragraph>
          
          {/* Installation Steps */}
          <s-box padding="base" borderWidth="base" borderRadius="base" background="surface">
            <s-stack direction="block" gap="400">
              {installationSteps.map((step) => (
                <s-stack direction="inline" gap="400" key={step.step} alignItems="start">
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--p-color-bg-fill-brand)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <s-text fontWeight="bold">{step.step}</s-text>
                  </div>
                  <s-stack direction="block" gap="100">
                    <s-text fontWeight="medium">{step.title}</s-text>
                    <s-text tone="subdued" variant="bodySm">{step.description}</s-text>
                  </s-stack>
                </s-stack>
              ))}
            </s-stack>
          </s-box>
          
          {/* Code Snippets for Manual Installation */}
          <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
            <s-stack direction="block" gap="300">
              <s-heading level="h4">Manual Installation (Advanced)</s-heading>
              <s-text tone="subdued" variant="bodySm">
                If the app block doesn't appear, you can manually add the code to your theme:
              </s-text>
              
              <div style={{
                backgroundColor: '#1e1e1e',
                padding: '16px',
                borderRadius: '8px',
                overflow: 'auto'
              }}>
                <code style={{ color: '#d4d4d4', fontSize: '14px' }}>
                  {`{% comment %} Add to cart-template.liquid or cart-drawer.liquid {% endcomment %}
{% if cart.attributes.donation_enabled == 'true' %}
  <div class="tree-planting-donation">
    <label>
      <input type="checkbox" 
             name="attributes[add_donation]" 
             value="yes" 
             {% if cart.attributes.add_donation == 'yes' %}checked{% endif %}>
      Add $5.00 to plant a tree
    </label>
  </div>
{% endif %}`}
                </code>
              </div>
            </s-stack>
          </s-box>
          
          {/* Troubleshooting */}
          <s-box padding="base" borderWidth="base" borderRadius="base" background="warning-subdued">
            <s-stack direction="block" gap="300">
              <s-heading level="h4">Troubleshooting</s-heading>
              <ul style={{ paddingLeft: '20px', margin: 0 }}>
                {troubleshootingTips.map((tip, index) => (
                  <li key={index} style={{ marginBottom: '8px' }}>
                    <s-text variant="bodySm">{tip}</s-text>
                  </li>
                ))}
              </ul>
            </s-stack>
          </s-box>
          
          {/* Support */}
          <s-box padding="base" borderWidth="base" borderRadius="base" background="info-subdued">
            <s-stack direction="inline" gap="300" alignItems="center">
              <s-icon source="help" tone="info" />
              <div>
                <s-text fontWeight="medium">Need Help?</s-text>
                <s-text variant="bodySm">
                  Contact our support team if you encounter any issues during installation.
                </s-text>
              </div>
            </s-stack>
          </s-box>
        </s-section>
      </s-stack>
    </s-page>
  );
}