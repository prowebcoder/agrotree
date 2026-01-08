// app/routes/app.orders.jsx
import React, { useState, useEffect } from 'react';
import { useLoaderData, useFetcher } from 'react-router';
import { useAppBridge } from '@shopify/app-bridge-react';
import { authenticate, getAppMetafields, parseMetafields } from '../shopify.server';

// Helper function to format date
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Helper function to format time ago
const formatTimeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
};

// Fetch orders from Shopify that contain the donation product
const fetchDonationOrders = async (admin, productId) => {
  try {
    if (!productId) {
      console.log('No product ID found, returning empty orders');
      return [];
    }

    // First, get the product to verify it exists
    const productResponse = await admin.graphql(
      `#graphql
      query GetProduct($id: ID!) {
        product(id: $id) {
          id
          title
        }
      }`,
      { variables: { id: productId } }
    );
    
    const productData = await productResponse.json();
    if (!productData.data?.product) {
      console.log('Product not found');
      return [];
    }

    // Query orders that contain the donation product
    // Using correct GraphQL fields for October25 API
    const ordersResponse = await admin.graphql(
      `#graphql
      query {
        orders(first: 50, reverse: true, query: "status:any") {
          edges {
            node {
              id
              name
              createdAt
              displayFulfillmentStatus
              displayFinancialStatus
              customer {
                displayName
                defaultEmailAddress {
                  emailAddress
                }
                defaultPhoneNumber {
                  phoneNumber
                }
              }
              lineItems(first: 10) {
                edges {
                  node {
                    product {
                      id
                      title
                    }
                    quantity
                    originalUnitPriceSet {
                      shopMoney {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
              totalPriceSet {
                shopMoney {
                  amount
                }
              }
              currencyCode
            }
          }
        }
      }`
    );

    const ordersData = await ordersResponse.json();
    const orders = ordersData.data?.orders?.edges || [];

    // Filter orders to only include those with the donation product
    const donationOrders = orders
      .map(edge => edge.node)
      .filter(order => {
        const lineItems = order.lineItems.edges || [];
        return lineItems.some(item => 
          item.node.product && item.node.product.id === productId
        );
      })
      .map(order => {
        // Find the donation line item
        const donationLineItem = order.lineItems.edges.find(item => 
          item.node.product && item.node.product.id === productId
        );
        
        const donationQuantity = donationLineItem ? donationLineItem.node.quantity : 0;
        const donationUnitPrice = donationLineItem 
          ? parseFloat(donationLineItem.node.originalUnitPriceSet?.shopMoney?.amount || 0) 
          : 0;
        const donationAmount = donationQuantity * donationUnitPrice;
        
        // Calculate trees planted
        const treesPlanted = donationAmount / 30;
        
        return {
          id: order.id,
          orderNumber: `#${order.name}`,
          date: order.createdAt,
          formattedDate: formatDate(order.createdAt),
          timeAgo: formatTimeAgo(order.createdAt),
          customer: order.customer?.displayName || 'Customer',
          customerEmail: order.customer?.defaultEmailAddress?.emailAddress || '',
          customerPhone: order.customer?.defaultPhoneNumber?.phoneNumber || '',
          amount: donationAmount,
          trees: treesPlanted,
          status: order.displayFinancialStatus?.toLowerCase() || 'paid',
          product: productData.data.product.title,
          quantity: donationQuantity,
          unitPrice: donationUnitPrice,
          orderStatus: order.displayFulfillmentStatus,
          currency: order.currencyCode
        };
      });

    return donationOrders;
  } catch (error) {
    console.error('Error fetching donation orders:', error);
    return [];
  }
};

// Alternative approach: Use the same pattern as in your working examples
const fetchAllOrders = async (admin) => {
  try {
    const response = await admin.graphql(
      `#graphql
      query {
        orders(first: 50, reverse: true) {
          edges {
            cursor
            node {
              id
              name
              createdAt
              displayFulfillmentStatus
              displayFinancialStatus
              customer {
                displayName
                defaultEmailAddress {
                  emailAddress
                }
                defaultPhoneNumber {
                  phoneNumber
                }
              }
              lineItems(first: 10) {
                edges {
                  node {
                    product {
                      id
                      title
                    }
                    quantity
                    originalUnitPriceSet {
                      shopMoney {
                        amount
                      }
                    }
                  }
                }
              }
              totalPriceSet {
                shopMoney {
                  amount
                }
              }
              currencyCode
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }`
    );
    
    const json = await response.json();
    return json.data?.orders?.edges || [];
  } catch (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
};

// Loader function - Updated to fetch real orders
export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    
    // Get app metafields
    const metafields = await getAppMetafields(admin);
    const parsedFields = parseMetafields(metafields);
    
    // Get donation product ID
    const productId = parsedFields.product_id;
    
    let orders = [];
    
    if (productId) {
      // Method 1: Fetch orders and filter for donation product
      const allOrders = await fetchAllOrders(admin);
      
      // Filter orders to only include those with the donation product
      orders = allOrders
        .map(edge => edge.node)
        .filter(order => {
          const lineItems = order.lineItems.edges || [];
          return lineItems.some(item => 
            item.node.product && item.node.product.id === productId
          );
        })
        .map(order => {
          // Find the donation line item
          const donationLineItem = order.lineItems.edges.find(item => 
            item.node.product && item.node.product.id === productId
          );
          
          const donationQuantity = donationLineItem ? donationLineItem.node.quantity : 0;
          const donationUnitPrice = donationLineItem 
            ? parseFloat(donationLineItem.node.originalUnitPriceSet?.shopMoney?.amount || 0) 
            : 0;
          const donationAmount = donationQuantity * donationUnitPrice;
          
          // Calculate trees planted
          const treesPlanted = donationAmount / 30;
          
          return {
            id: order.id,
            orderNumber: `#${order.name}`,
            date: order.createdAt,
            formattedDate: formatDate(order.createdAt),
            timeAgo: formatTimeAgo(order.createdAt),
            customer: order.customer?.displayName || 'Customer',
            customerEmail: order.customer?.defaultEmailAddress?.emailAddress || '',
            customerPhone: order.customer?.defaultPhoneNumber?.phoneNumber || '',
            amount: donationAmount,
            trees: treesPlanted,
            status: order.displayFinancialStatus?.toLowerCase() || 'paid',
            product: donationLineItem?.node?.product?.title || 'Donation',
            quantity: donationQuantity,
            unitPrice: donationUnitPrice,
            orderStatus: order.displayFulfillmentStatus,
            currency: order.currencyCode
          };
        });
      
      // Sort by latest first
      orders.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    
    // Calculate summary stats from real orders
    const totalOrders = orders.length;
    const totalAmount = orders.reduce((sum, order) => sum + order.amount, 0);
    const totalTrees = orders.reduce((sum, order) => sum + order.trees, 0);
    const averageDonation = totalOrders > 0 ? totalAmount / totalOrders : 0;
    
    return {
      orders,
      stats: {
        totalOrders,
        totalAmount: totalAmount.toFixed(2),
        totalTrees: totalTrees.toFixed(2),
        averageDonation: averageDonation.toFixed(2),
        totalQuantity: orders.reduce((sum, order) => sum + (order.quantity || 0), 0)
      },
      productId,
      hasError: false
    };
    
  } catch (error) {
    console.error('Error loading orders:', error);
    return {
      orders: [],
      stats: {
        totalOrders: 0,
        totalAmount: "0.00",
        totalTrees: "0.00",
        averageDonation: "0.00",
        totalQuantity: 0
      },
      productId: null,
      hasError: true,
      errorMessage: error.message
    };
  }
};

// Action function to refresh orders
export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    
    // Get app metafields
    const metafields = await getAppMetafields(admin);
    const parsedFields = parseMetafields(metafields);
    
    const productId = parsedFields.product_id;
    
    if (!productId) {
      return {
        success: false,
        error: "No donation product found. Please create the tree planting product first."
      };
    }
    
    // Fetch fresh orders from Shopify
    const allOrders = await fetchAllOrders(admin);
    
    // Filter for donation orders
    const orders = allOrders
      .map(edge => edge.node)
      .filter(order => {
        const lineItems = order.lineItems.edges || [];
        return lineItems.some(item => 
          item.node.product && item.node.product.id === productId
        );
      })
      .map(order => {
        const donationLineItem = order.lineItems.edges.find(item => 
          item.node.product && item.node.product.id === productId
        );
        
        const donationQuantity = donationLineItem ? donationLineItem.node.quantity : 0;
        const donationUnitPrice = donationLineItem 
          ? parseFloat(donationLineItem.node.originalUnitPriceSet?.shopMoney?.amount || 0) 
          : 0;
        const donationAmount = donationQuantity * donationUnitPrice;
        const treesPlanted = donationAmount / 30;
        
        return {
          id: order.id,
          orderNumber: `#${order.name}`,
          date: order.createdAt,
          formattedDate: formatDate(order.createdAt),
          timeAgo: formatTimeAgo(order.createdAt),
          customer: order.customer?.displayName || 'Customer',
          customerEmail: order.customer?.defaultEmailAddress?.emailAddress || '',
          customerPhone: order.customer?.defaultPhoneNumber?.phoneNumber || '',
          amount: donationAmount,
          trees: treesPlanted,
          status: order.displayFinancialStatus?.toLowerCase() || 'paid',
          product: donationLineItem?.node?.product?.title || 'Donation',
          quantity: donationQuantity,
          unitPrice: donationUnitPrice,
          orderStatus: order.displayFulfillmentStatus,
          currency: order.currencyCode
        };
      });
    
    // Sort by latest first
    orders.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return {
      success: true,
      orders: orders,
      message: `Successfully refreshed ${orders.length} donation orders.`
    };
    
  } catch (error) {
    console.error('Error refreshing orders:', error);
    return {
      success: false,
      error: error.message || "Failed to refresh orders."
    };
  }
};

// Order Status Badge Component
const OrderStatusBadge = ({ status }) => {
  const getStatusConfig = (status) => {
    const statusMap = {
      'paid': { tone: 'success', icon: 'check', label: 'Paid' },
      'pending': { tone: 'warning', icon: 'clock', label: 'Pending' },
      'authorized': { tone: 'warning', icon: 'clock', label: 'Authorized' },
      'partially_paid': { tone: 'warning', icon: 'clock', label: 'Partially Paid' },
      'partially_refunded': { tone: 'warning', icon: 'refresh', label: 'Partially Refunded' },
      'refunded': { tone: 'critical', icon: 'refresh', label: 'Refunded' },
      'voided': { tone: 'subdued', icon: 'cancel', label: 'Voided' },
      'cancelled': { tone: 'subdued', icon: 'cancel', label: 'Cancelled' },
      'completed': { tone: 'success', icon: 'check', label: 'Completed' },
      'failed': { tone: 'critical', icon: 'cancel', label: 'Failed' }
    };
    
    return statusMap[status.toLowerCase()] || { tone: 'subdued', icon: 'help', label: status.charAt(0).toUpperCase() + status.slice(1) };
  };
  
  const config = getStatusConfig(status);
  
  return (
    <s-badge tone={config.tone} icon={config.icon}>
      {config.label}
    </s-badge>
  );
};

// Main Component
export default function OrdersPage() {
  const { orders, stats, productId, hasError } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [localOrders, setLocalOrders] = useState(orders);
  
  // Update local orders when loader data changes
  useEffect(() => {
    setLocalOrders(orders);
  }, [orders]);
  
  // Update local orders when action completes
  useEffect(() => {
    if (fetcher.data?.success) {
      setLocalOrders(fetcher.data.orders);
      shopify.toast.show(fetcher.data.message || 'Orders refreshed successfully!');
    } else if (fetcher.data?.success === false) {
      shopify.toast.show(fetcher.data.error || 'Failed to refresh orders.', { error: true });
    }
  }, [fetcher.data, shopify]);

  // Filter orders
  const filteredOrders = localOrders.filter(order => {
    const matchesSearch = 
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.customerPhone && order.customerPhone.includes(searchTerm));
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
  
  // Handle export CSV
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      shopify.toast.show('No orders to export.', { error: true });
      return;
    }
    
    const headers = ['Order Number', 'Date', 'Customer', 'Email', 'Donation Amount', 'Trees Planted', 'Status', 'Quantity', 'Unit Price'];
    
    const csvData = filteredOrders.map(order => [
      order.orderNumber,
      order.formattedDate,
      order.customer,
      order.customerEmail,
      `$${order.amount.toFixed(2)}`,
      order.trees.toFixed(2),
      order.status.charAt(0).toUpperCase() + order.status.slice(1),
      order.quantity,
      `$${order.unitPrice.toFixed(2)}`
    ]);
    
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `tree-planting-orders-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    shopify.toast.show(`Exported ${filteredOrders.length} orders to CSV`);
  };
  
  // Handle refresh orders
  const handleRefreshOrders = () => {
    fetcher.submit({}, { method: 'POST' });
  };
  
  // Handle view order in Shopify
  const handleViewOrder = (orderId) => {
    shopify.intents.invoke?.("edit:shopify/Order", {
      value: orderId,
    });
  };
  
  if (hasError) {
    return (
      <s-page heading="Tree Planting Orders">
        <s-section>
          <s-banner status="critical">
            <s-paragraph>Error loading orders: {stats.errorMessage || 'Please try again.'}</s-paragraph>
          </s-banner>
        </s-section>
      </s-page>
    );
  }
  
  return (
    <s-page heading="Tree Planting Orders">
      {/* Primary Actions */}
      {/* <s-button 
        slot="primary-action" 
        variant="primary" 
        onClick={handleExportCSV}
        icon="download"
        disabled={filteredOrders.length === 0}
      >
        Export CSV
      </s-button> */}
      
      <s-button 
        slot="secondary-actions" 
        variant="secondary"
        onClick={handleRefreshOrders}
        icon="refresh"
        loading={fetcher.state === 'submitting'}
      >
        Refresh Orders
      </s-button>
      
      <s-heading level="h1">Donation Orders</s-heading>
      
      {!productId ? (
        <s-banner status="warning" style={{ marginBottom: '24px' }}>
          <s-stack direction="block" gap="small">
            <s-paragraph>
              No donation product found. Please create the "Support Tree Planting" product first to start tracking orders.
            </s-paragraph>
          </s-stack>
        </s-banner>
      ) : (
        <>
          <br />
          
          {/* Stats Grid */}
          <s-section padding="none">
            <s-box padding="base">
              <s-grid gridTemplateColumns="repeat(12, 1fr)" gap="base">
                {/* Total Orders */}
                <s-grid-item gridColumn="span 3">
                  <s-box padding="base" background="surface" borderRadius="base">
                    <s-stack direction="block" gap="small">
                      <s-text tone="subdued" type="strong" variant="bodySm">Total Orders</s-text>
                      <s-text variant="headingLg" fontWeight="bold">{stats.totalOrders}</s-text>
                    </s-stack>
                  </s-box>
                </s-grid-item>
                
                {/* Total Contributed */}
                <s-grid-item gridColumn="span 3">
                  <s-box padding="base" background="surface" borderRadius="base">
                    <s-stack direction="block" gap="small">
                      <s-text tone="subdued" type="strong" variant="bodySm">Total Contributed</s-text>
                      <s-text variant="headingLg" fontWeight="bold">${stats.totalAmount}</s-text>
                    </s-stack>
                  </s-box>
                </s-grid-item>
                
                {/* Trees Planted */}
                <s-grid-item gridColumn="span 3">
                  <s-box padding="base" background="surface" borderRadius="base">
                    <s-stack direction="block" gap="small">
                      <s-text tone="subdued" type="strong" variant="bodySm">Trees Planted</s-text>
                      <s-text variant="headingLg" fontWeight="bold">{stats.totalTrees}</s-text>
                    </s-stack>
                  </s-box>
                </s-grid-item>
                
                {/* Average Donation */}
                <s-grid-item gridColumn="span 3">
                  <s-box padding="base" background="surface" borderRadius="base">
                    <s-stack direction="block" gap="small">
                      <s-text tone="subdued" type="strong" variant="bodySm">Avg Donation</s-text>
                      <s-text variant="headingLg" fontWeight="bold">${stats.averageDonation}</s-text>
                    </s-stack>
                  </s-box>
                </s-grid-item>
              </s-grid>
            </s-box>
          </s-section>
          
          {/* Orders Table Section */}
          <s-section padding="none">
            <s-box padding="base">
              <s-stack direction="block" gap="400">
                {/* Filters */}
                <s-stack direction="inline" gap="large-100" alignItems="center">
                  {/* Status Filter */}
                  {/* <s-select
                    value={statusFilter}
                    onChange={(value) => setStatusFilter(value)}
                    style={{ width: '150px' }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="authorized">Authorized</option>
                    <option value="refunded">Refunded</option>
                    <option value="cancelled">Cancelled</option>
                  </s-select> */}
                  
                  {/* Search */}
                  <s-text-field
                    placeholder="Search orders, customers, or emails..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    clearButton
                    onClearButtonClick={() => setSearchTerm('')}
                  />
                </s-stack>
                
                <br />
                
                {/* Filters Grid */}
                <s-grid gridTemplateColumns="repeat(12, 1fr)" gap="base" alignItems="end">
                  <s-grid-item gridColumn="span 6">
                    <s-heading level="h3">
                      Recent Orders {filteredOrders.length !== localOrders.length && `(${filteredOrders.length} of ${localOrders.length})`}
                    </s-heading>
                  </s-grid-item>
                  
                  <s-grid-item gridColumn="span 6" textAlign="right">
                    <s-text tone="subdued" variant="bodySm">
                      Showing donation orders only
                    </s-text>
                  </s-grid-item>
                </s-grid>
                
                {/* Orders Table */}
                <s-section>
                  <s-table>
                    <s-table-header-row>
                      <s-table-header listSlot="primary">Order Details</s-table-header>
                      <s-table-header listSlot="inline">Customer</s-table-header>
                      <s-table-header listSlot="inline">Donation</s-table-header>
                      <s-table-header listSlot="inline">Trees</s-table-header>
                      <s-table-header listSlot="inline">Qty</s-table-header>
                      <s-table-header listSlot="secondary" format="numeric">Status</s-table-header>
                      <s-table-header listSlot="inline">Actions</s-table-header>
                    </s-table-header-row>
                    
                    <s-table-body>
                      {filteredOrders.map((order) => (
                        <s-table-row key={order.id}>
                          {/* Order Details */}
                          <s-table-cell>
                            <s-stack direction="block" gap="50">
                              <s-text fontWeight="medium">{order.orderNumber}</s-text>
                              <s-text tone="subdued" variant="bodySm">
                                {order.formattedDate} • {order.timeAgo}
                              </s-text>
                              <s-text tone="subdued" variant="bodySm">
                                {order.product}
                              </s-text>
                            </s-stack>
                          </s-table-cell>
                          
                          {/* Customer */}
                          <s-table-cell>
                            <s-stack direction="block" gap="50">
                              <s-text>{order.customer}</s-text>
                              <s-text tone="subdued" variant="bodySm">
                                {order.customerEmail}
                              </s-text>
                              {order.customerPhone && (
                                <s-text tone="subdued" variant="bodySm">
                                  {order.customerPhone}
                                </s-text>
                              )}
                            </s-stack>
                          </s-table-cell>
                          
                          {/* Donation Amount */}
                          <s-table-cell>
                            <s-stack direction="block" gap="25">
                              <s-text fontWeight="bold" variant="headingSm">
                                ${order.amount.toFixed(2)}
                              </s-text>
                              <s-text tone="subdued" variant="bodySm">
                                ${order.unitPrice.toFixed(2)} each
                              </s-text>
                            </s-stack>
                          </s-table-cell>
                          
                          {/* Trees Planted */}
                          <s-table-cell>
                            <s-badge tone="success">
                              {order.trees.toFixed(2)} trees
                            </s-badge>
                          </s-table-cell>
                          
                          {/* Quantity */}
                          <s-table-cell>
                            <s-text fontWeight="medium">{order.quantity}</s-text>
                          </s-table-cell>
                          
                          {/* Status */}
                          <s-table-cell>
                            <OrderStatusBadge status={order.status} />
                          </s-table-cell>
                          
                          {/* Actions */}
                          <s-table-cell>
                            <s-stack direction="inline" gap="100">
                              <s-button
                                variant="tertiary"
                                size="small"
                                onClick={() => handleViewOrder(order.id)}
                                icon="external"
                              >
                                View
                              </s-button>
                            </s-stack>
                          </s-table-cell>
                        </s-table-row>
                      ))}
                    </s-table-body>
                  </s-table>
                  
                  {/* Empty State */}
                  {filteredOrders.length === 0 && (
                    <s-box padding="800" textAlign="center">
                      <s-stack direction="block" gap="200" alignItems="center">
                        <s-icon source="receipt" tone="subdued" size="large" />
                        <s-text tone="subdued" variant="bodyLg">
                          {searchTerm || statusFilter !== 'all' 
                            ? 'No orders match your filters'
                            : 'No donation orders found. Customers will appear here once they add the donation product to their orders.'
                          }
                        </s-text>
                        {(searchTerm || statusFilter !== 'all') && (
                          <s-button
                            variant="tertiary"
                            onClick={() => {
                              setSearchTerm('');
                              setStatusFilter('all');
                            }}
                          >
                            Clear filters
                          </s-button>
                        )}
                        {!searchTerm && statusFilter === 'all' && (
                          <s-button
                            variant="secondary"
                            onClick={handleRefreshOrders}
                            loading={fetcher.state === 'submitting'}
                          >
                            Refresh Orders
                          </s-button>
                        )}
                      </s-stack>
                    </s-box>
                  )}
                </s-section>
              </s-stack>
            </s-box>
          </s-section>
          
          {/* Info Banner */}
          {localOrders.length > 0 && (
            <s-banner status="info">
              <s-paragraph>
                Showing orders that include the "Support Tree Planting" donation product. 
                Orders are updated automatically when customers make purchases. 
                Click "Refresh Orders" to fetch the latest data from Shopify.
              </s-paragraph>
            </s-banner>
          )}
        </>
      )}
    </s-page>
  );
}