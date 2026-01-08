// components/PriceModal.jsx
import React, { useState } from 'react';

export function PriceModal({ isOpen, onClose, onSubmit, loading }) {
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
}