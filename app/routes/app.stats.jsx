// app/routes/app.stats.jsx
import React, { useState, useEffect } from 'react';
import { useLoaderData, useFetcher, useNavigate } from 'react-router';
import { useAppBridge } from '@shopify/app-bridge-react';
import { authenticate, getAppMetafields, parseMetafields } from '../shopify.server';

// Client-only Sparkline component
const ClientSparkline = ({ data }) => {
  const [ChartComponent, setChartComponent] = useState(null);

  useEffect(() => {
    // Dynamically import on client side only
    import('@shopify/polaris-viz').then((module) => {
      setChartComponent(() => module.SparkLineChart);
    });
  }, []);

  if (!ChartComponent) {
    // Render a placeholder on server and during loading
    return (
      <div style={{ 
        height: '40px', 
        width: '100%', 
        marginTop: '8px',
        background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
        backgroundSize: '200% 100%',
        animation: 'loading 1.5s infinite',
        borderRadius: '4px'
      }} />
    );
  }

  return (
    <ChartComponent 
      data={[{ data: data.map((value, index) => ({ key: index, value })) }]}
      offsetLeft={0}
      offsetRight={0}
      theme="Light"
    />
  );
};

// Add CSS for loading animation
const loadingStyles = `
  @keyframes loading {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;

// Sparkline StatBox Component
const SparklineStatBox = ({ title, value, data = [], percentageChange, href = null }) => {
  const [isClient, setIsClient] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  const hasData = data && data.length;
  const isPositive = percentageChange > 0;
  const isNegative = percentageChange < 0;

  const content = (
    <s-grid gap="small-300">
      <s-heading level="h4">{title}</s-heading>
      <s-stack direction="inline" gap="small-200" alignItems="center">
        <s-text as="p" variant="headingMd" fontWeight="bold">
          {value}
        </s-text>
        {percentageChange !== undefined && (
          <s-badge 
            tone={isPositive ? "success" : isNegative ? "critical" : "warning"}
            icon={isPositive ? "arrow-up" : isNegative ? "arrow-down" : undefined}
          >
            {isPositive ? '+' : ''}{percentageChange}%
          </s-badge>
        )}
      </s-stack>
      {hasData && isClient && (
        <div style={{ height: '40px', width: '100%', marginTop: '8px' }}>
          <ClientSparkline data={data} />
        </div>
      )}
    </s-grid>
  );

  if (href) {
    return (
      <s-clickable
        onClick={() => navigate(href)}
        paddingBlock="small-400"
        paddingInline="small-100"
        borderRadius="base"
        background="surface"
        hoverable
        style={{ cursor: 'pointer' }}
      >
        {content}
      </s-clickable>
    );
  }

  return (
    <s-box
      paddingBlock="small-400"
      paddingInline="small-100"
      borderRadius="base"
      background="surface"
    >
      {content}
    </s-box>
  );
};

// Metrics Grid Component
const MetricsGrid = ({ metrics }) => {
  return (
    <s-section padding="base">
      <s-grid
        gridTemplateColumns="1fr auto 1fr auto 1fr"
        gap="small"
      >
        {metrics.map((metric, index) => (
          <React.Fragment key={metric.id}>
            <SparklineStatBox
              title={metric.title}
              value={metric.value}
              data={metric.data}
              percentageChange={metric.percentageChange}
              href={metric.href}
            />
            {index < metrics.length - 1 && <s-divider direction="block" />}
          </React.Fragment>
        ))}
      </s-grid>
    </s-section>
  );
};

// Dashboard Card Component
const DashboardCard = ({ title, children, action = null }) => (
  <s-card>
    <s-stack direction="block" gap="400">
      <s-stack direction="inline" justifyContent="space-between" alignItems="center">
        <s-heading level="h3">{title}</s-heading>
        {action && (
          <s-button variant="tertiary" size="small" onClick={action.onClick}>
            {action.content}
          </s-button>
        )}
      </s-stack>
      {children}
    </s-stack>
  </s-card>
);

// Helper function to calculate metrics from orders
const calculateMetrics = (orders) => {
  const totalAmount = orders.reduce((sum, order) => sum + parseFloat(order.amount || 0), 0);
  const treesPlanted = totalAmount / 30; // $30 per tree
  
  return {
    orders: orders.length,
    contributed: totalAmount,
    trees: {
      integer: Math.floor(treesPlanted),
      decimal: parseFloat(treesPlanted.toFixed(2))
    },
    averageDonation: orders.length > 0 ? totalAmount / orders.length : 0
  };
};

// Fetch orders from Shopify that contain the donation product
const fetchDonationOrders = async (admin, productId) => {
  try {
    if (!productId) {
      console.log('No product ID found, returning empty orders');
      return [];
    }

    // Query orders that contain the donation product
    const ordersResponse = await admin.graphql(
      `#graphql
      query {
        orders(first: 100, reverse: true, query: "status:any") {
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
          customer: order.customer?.displayName || 'Customer',
          customerEmail: order.customer?.defaultEmailAddress?.emailAddress || '',
          amount: donationAmount,
          trees: treesPlanted,
          status: order.displayFinancialStatus?.toLowerCase() || 'paid',
          product: donationLineItem?.node?.product?.title || 'Donation',
          quantity: donationQuantity,
          unitPrice: donationUnitPrice,
        };
      });

    return donationOrders;
  } catch (error) {
    console.error('Error fetching donation orders:', error);
    return [];
  }
};

// Helper function to generate weekly trends from orders
function generateWeeklyTrends(orders) {
  // Generate last 7 days of data
  const trends = {
    orders: Array(7).fill(0),
    contributed: Array(7).fill(0),
    trees: Array(7).fill(0),
    currentMonth: Array(7).fill(0),
    previousMonth: Array(7).fill(0),
    allTime: Array(7).fill(0)
  };
  
  // Populate with actual order data
  orders.forEach(order => {
    const orderDate = new Date(order.date);
    const daysAgo = Math.floor((new Date() - orderDate) / (1000 * 60 * 60 * 24));
    
    if (daysAgo >= 0 && daysAgo < 7) {
      const index = 6 - daysAgo; // Reverse order: most recent on the right
      trends.orders[index] += 1;
      trends.contributed[index] += parseFloat(order.amount || 0);
      trends.trees[index] += parseFloat(order.amount || 0) / 30;
    }
  });
  
  // Calculate all time cumulative
  for (let i = 0; i < 7; i++) {
    trends.allTime[i] = trends.contributed.slice(0, i + 1).reduce((a, b) => a + b, 0);
  }
  
  return trends;
}

// Loader function - Updated to fetch real data
export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    
    // Get app metafields
    const metafields = await getAppMetafields(admin);
    const parsedFields = parseMetafields(metafields);
    
    // Get donation product ID
    const productId = parsedFields.product_id;
    
    if (!productId) {
      return {
        currentMonth: {
          orders: 0,
          contributed: 0,
          trees: { integer: 0, decimal: 0 },
          averageDonation: 0,
          conversionRate: 0,
          growthRate: 0
        },
        previousMonth: {
          orders: 0,
          contributed: 0,
          trees: { integer: 0, decimal: 0 },
          averageDonation: 0
        },
        allTime: {
          orders: 0,
          contributed: 0,
          trees: { integer: 0, decimal: 0 },
          averageDonation: 0,
          customers: 0
        },
        weeklyTrends: generateWeeklyTrends([]),
        recentOrders: [],
        hasError: false,
        productId: null
      };
    }

    // Fetch real orders from Shopify
    const allOrders = await fetchDonationOrders(admin, productId);
    
    if (allOrders.length === 0) {
      return {
        currentMonth: {
          orders: 0,
          contributed: 0,
          trees: { integer: 0, decimal: 0 },
          averageDonation: 0,
          conversionRate: 0,
          growthRate: 0
        },
        previousMonth: {
          orders: 0,
          contributed: 0,
          trees: { integer: 0, decimal: 0 },
          averageDonation: 0
        },
        allTime: {
          orders: 0,
          contributed: 0,
          trees: { integer: 0, decimal: 0 },
          averageDonation: 0,
          customers: 0
        },
        weeklyTrends: generateWeeklyTrends([]),
        recentOrders: [],
        hasError: false,
        productId
      };
    }

    // Calculate current and previous month dates
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    
    // Filter orders for current and previous month
    const currentMonthOrders = allOrders.filter(order => {
      const orderDate = new Date(order.date);
      return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
    });
    
    const previousMonthOrders = allOrders.filter(order => {
      const orderDate = new Date(order.date);
      return orderDate.getMonth() === previousMonth && orderDate.getFullYear() === previousYear;
    });

    // Calculate metrics
    const currentMonthMetrics = calculateMetrics(currentMonthOrders);
    const previousMonthMetrics = calculateMetrics(previousMonthOrders);
    const allTimeMetrics = calculateMetrics(allOrders);
    
    // Calculate unique customers
    const uniqueCustomers = new Set(allOrders.map(order => order.customerEmail)).size;
    
    // Calculate conversion rate (simplified: orders with donation / estimated total orders)
    // For simplicity, we'll use a ratio of donation orders to estimated total orders
    const estimatedConversionRate = allOrders.length > 0 ? 
      Math.min(20, (allOrders.length / 50) * 100) : 0; // Simplified estimation
    
    // Calculate growth rate
    const growthRate = previousMonthMetrics.orders > 0 ?
      Math.round(((currentMonthMetrics.orders - previousMonthMetrics.orders) / previousMonthMetrics.orders) * 100) : 
      (currentMonthMetrics.orders > 0 ? 100 : 0);

    // Get recent orders (last 5)
    const recentOrders = allOrders
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5)
      .map(order => ({
        ...order,
        date: formatRelativeTime(new Date(order.date))
      }));

    // Generate weekly trends
    const weeklyTrends = generateWeeklyTrends(allOrders);

    return {
      currentMonth: {
        ...currentMonthMetrics,
        conversionRate: estimatedConversionRate,
        growthRate: growthRate
      },
      previousMonth: previousMonthMetrics,
      allTime: {
        ...allTimeMetrics,
        customers: uniqueCustomers,
        averageDonation: allTimeMetrics.averageDonation
      },
      weeklyTrends,
      recentOrders,
      hasError: false,
      productId
    };
    
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    return {
      currentMonth: {
        orders: 0,
        contributed: 0,
        trees: { integer: 0, decimal: 0 },
        averageDonation: 0,
        conversionRate: 0,
        growthRate: 0
      },
      previousMonth: {
        orders: 0,
        contributed: 0,
        trees: { integer: 0, decimal: 0 },
        averageDonation: 0
      },
      allTime: {
        orders: 0,
        contributed: 0,
        trees: { integer: 0, decimal: 0 },
        averageDonation: 0,
        customers: 0
      },
      weeklyTrends: generateWeeklyTrends([]),
      recentOrders: [],
      hasError: true,
      errorMessage: error.message
    };
  }
};

// Helper function to format relative time
function formatRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

// Action function to refresh stats
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
    const allOrders = await fetchDonationOrders(admin, productId);
    
    // Calculate current and previous month dates
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    
    // Filter orders for current and previous month
    const currentMonthOrders = allOrders.filter(order => {
      const orderDate = new Date(order.date);
      return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
    });
    
    const previousMonthOrders = allOrders.filter(order => {
      const orderDate = new Date(order.date);
      return orderDate.getMonth() === previousMonth && orderDate.getFullYear() === previousYear;
    });

    // Calculate metrics
    const currentMonthMetrics = calculateMetrics(currentMonthOrders);
    const previousMonthMetrics = calculateMetrics(previousMonthOrders);
    const allTimeMetrics = calculateMetrics(allOrders);
    
    // Calculate unique customers
    const uniqueCustomers = new Set(allOrders.map(order => order.customerEmail)).size;
    
    // Calculate growth rate
    const growthRate = previousMonthMetrics.orders > 0 ?
      Math.round(((currentMonthMetrics.orders - previousMonthMetrics.orders) / previousMonthMetrics.orders) * 100) : 
      (currentMonthMetrics.orders > 0 ? 100 : 0);

    // Get recent orders
    const recentOrders = allOrders
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5)
      .map(order => ({
        ...order,
        date: formatRelativeTime(new Date(order.date))
      }));

    // Generate weekly trends
    const weeklyTrends = generateWeeklyTrends(allOrders);

    return {
      success: true,
      data: {
        currentMonth: {
          ...currentMonthMetrics,
          growthRate: growthRate
        },
        previousMonth: previousMonthMetrics,
        allTime: {
          ...allTimeMetrics,
          customers: uniqueCustomers
        },
        weeklyTrends,
        recentOrders
      },
      message: 'Dashboard data refreshed successfully!'
    };
    
  } catch (error) {
    console.error('Error refreshing dashboard:', error);
    return {
      success: false,
      error: error.message || "Failed to refresh dashboard data."
    };
  }
};

// Main Dashboard Component
export default function DashboardPage() {
  const initialData = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const navigate = useNavigate();

  const [data, setData] = useState(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Update data when loader data changes
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // Update data when action completes
  useEffect(() => {
    if (fetcher.data?.success) {
      setData(prev => ({
        ...prev,
        ...fetcher.data.data
      }));
      setIsRefreshing(false);
      shopify.toast.show(fetcher.data.message || 'Dashboard refreshed successfully!');
    } else if (fetcher.data?.success === false) {
      setIsRefreshing(false);
      shopify.toast.show(fetcher.data.error || 'Failed to refresh dashboard.', { error: true });
    }
  }, [fetcher.data, shopify]);

  // Calculate percentage changes
  const currentMonthPercentage = data.previousMonth.orders > 0 
    ? Math.round(((data.currentMonth.orders - data.previousMonth.orders) / data.previousMonth.orders) * 100)
    : (data.currentMonth.orders > 0 ? 100 : 0);

  // Handle export data function
  const handleExportData = () => {
    if (data.allTime.orders === 0) {
      shopify.toast.show('No data to export.', { error: true });
      return;
    }
    
    const csvData = [
      ['Metric', 'Value'],
      ['Total Orders', data.allTime.orders],
      ['Total Contributed', `$${data.allTime.contributed.toFixed(2)}`],
      ['Trees Planted', data.allTime.trees.integer],
      ['Average Donation', `$${data.allTime.averageDonation.toFixed(2)}`],
      ['Unique Customers', data.allTime.customers],
      ['Current Month Orders', data.currentMonth.orders],
      ['Current Month Contribution', `$${data.currentMonth.contributed.toFixed(2)}`],
      ['Month-over-Month Growth', `${data.currentMonth.growthRate}%`]
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `tree-planting-stats-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    shopify.toast.show('Dashboard data exported to CSV');
  };

  // Handle refresh data function
  const handleRefreshData = () => {
    setIsRefreshing(true);
    fetcher.submit({}, { method: 'POST' });
  };

  // Handle view reports function
  const handleViewReports = () => {
    navigate('/app/orders');
  };

  // Main metrics for the top grid
  const mainMetrics = [
    {
      id: 'orders',
      title: 'Orders with Donation',
      value: data.currentMonth.orders,
      data: data.weeklyTrends.orders,
      percentageChange: Math.min(100, Math.max(-100, currentMonthPercentage)),
      href: '/app/orders'
    },
    {
      id: 'contributed',
      title: 'Total Contributed',
      value: `$${data.currentMonth.contributed.toFixed(2)}`,
      data: data.weeklyTrends.contributed,
      percentageChange: 0 // Will be calculated based on trends
    },
    {
      id: 'trees',
      title: 'Trees Planted',
      value: data.currentMonth.trees.integer,
      data: data.weeklyTrends.trees,
      percentageChange: 0 // Will be calculated based on trends
    }
  ];

  // Time period metrics
  const timePeriodMetrics = [
    {
      id: 'current-month',
      title: 'Current Month',
      value: `$${data.currentMonth.contributed.toFixed(2)}`,
      data: data.weeklyTrends.currentMonth,
      percentageChange: currentMonthPercentage,
      href: '/app/orders'
    },
    {
      id: 'previous-month',
      title: 'Previous Month',
      value: `$${data.previousMonth.contributed.toFixed(2)}`,
      data: data.weeklyTrends.previousMonth,
      percentageChange: 0,
      href: '/app/orders'
    },
    {
      id: 'all-time',
      title: 'All Time',
      value: `$${data.allTime.contributed.toFixed(2)}`,
      data: data.weeklyTrends.allTime,
      percentageChange: 0,
      href: '/app/orders'
    }
  ];

  // Conversion metrics
  const conversionMetrics = [
    {
      id: 'customers',
      title: 'Unique Donors',
      value: data.allTime.customers,
      data: Array(7).fill(0), // Placeholder for customer trend
      percentageChange: 0
    },
    {
      id: 'growth',
      title: 'Month-over-Month Growth',
      value: `${data.currentMonth.growthRate}%`,
      data: [0, 0, 0, 0, 0, 0, data.currentMonth.growthRate], // Simple trend
      percentageChange: data.currentMonth.growthRate
    },
    {
      id: 'average',
      title: 'Average Donation',
      value: `$${data.allTime.averageDonation.toFixed(2)}`,
      data: Array(7).fill(data.allTime.averageDonation), // Flat trend
      percentageChange: 0
    }
  ];

  if (data.hasError) {
    return (
      <s-page heading="Tree Planting Dashboard">
        <s-section>
          <s-banner status="critical">
            <s-paragraph>Error loading dashboard data: {data.errorMessage || 'Please try again.'}</s-paragraph>
          </s-banner>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page 
      heading="Tree Planting Dashboard" 
      inlineSize="large"
      fullWidth
    >
      {/* Add loading animation styles */}
      <style>{loadingStyles}</style>
      
      {/* Secondary Actions */}
      <s-button 
        slot="secondary-actions" 
        variant="secondary"
        onClick={handleRefreshData}
        icon="refresh"
        loading={isRefreshing}
      >
        Refresh
      </s-button>
      <s-button 
        slot="secondary-actions" 
        variant="secondary"
        onClick={handleViewReports}
        icon="analytics"
      >
        View Reports
      </s-button>
      
      {/* Primary Action */}
      <s-button 
        slot="primary-action" 
        variant="primary"
        onClick={handleExportData}
        icon="download"
        disabled={data.allTime.orders === 0}
      >
        Export Data
      </s-button>

      {!data.productId ? (
        <s-banner status="warning" style={{ marginBottom: '24px' }}>
          <s-stack direction="block" gap="small">
            <s-paragraph>
              No donation product found. Please create the "Support Tree Planting" product first to start tracking donations.
            </s-paragraph>
            <s-button
              variant="tertiary"
              onClick={() => navigate('/app')}
            >
              Create Product
            </s-button>
          </s-stack>
        </s-banner>
      ) : data.allTime.orders === 0 ? (
        <s-banner status="info" style={{ marginBottom: '24px' }}>
          <s-stack direction="block" gap="small">
            <s-paragraph>
              No donation orders yet. Statistics will appear here once customers start adding the donation product to their orders.
            </s-paragraph>
            <s-button
              variant="tertiary"
              onClick={handleRefreshData}
              loading={isRefreshing}
            >
              Refresh Data
            </s-button>
          </s-stack>
        </s-banner>
      ) : (
        <s-stack direction="block" gap="600">
          {/* Main Metrics Grid */}
          <MetricsGrid metrics={mainMetrics} />
          <br />

          {/* Time Period Metrics Grid */}
          <MetricsGrid metrics={timePeriodMetrics} />
          <br />

          {/* Conversion Metrics Grid */}
          <MetricsGrid metrics={conversionMetrics} />
          <br />

          {/* Recent Orders */}
          <DashboardCard 
            title="Recent Orders with Donations"
            action={{ 
              content: 'View All Orders', 
              onClick: () => navigate('/app/orders') 
            }}
          >
            <s-section padding="none">
              <s-table>
                <s-table-header-row>
                  <s-table-header listSlot="primary">Customer / Product</s-table-header>
                  <s-table-header listSlot="labeled">Donation Amount</s-table-header>
                  <s-table-header listSlot="labeled">Trees Planted</s-table-header>
                  <s-table-header listSlot="inline">Date</s-table-header>
                  <s-table-header listSlot="inline">Status</s-table-header>
                </s-table-header-row>
                <s-table-body>
                  {data.recentOrders.map((order) => (
                    <s-table-row key={order.id}>
                      <s-table-cell>
                        <s-stack direction="block" gap="none">
                          <s-text fontWeight="medium">{order.customer}</s-text>
                          <s-text tone="subdued" variant="bodySm">{order.product}</s-text>
                        </s-stack>
                      </s-table-cell>
                      <s-table-cell>
                        <s-text fontWeight="bold">${order.amount.toFixed(2)}</s-text>
                      </s-table-cell>
                      <s-table-cell>
                        <s-badge tone="success">{order.trees.toFixed(2)} trees</s-badge>
                      </s-table-cell>
                      <s-table-cell>
                        <s-text tone="subdued">{order.date}</s-text>
                      </s-table-cell>
                      <s-table-cell>
                        <s-badge tone={order.status === 'paid' ? 'success' : 'warning'}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </s-badge>
                      </s-table-cell>
                    </s-table-row>
                  ))}
                </s-table-body>
              </s-table>
            </s-section>
          </DashboardCard>
        </s-stack>
      )}
    </s-page>
  );
}