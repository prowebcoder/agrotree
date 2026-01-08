// app/routes/app.settings.jsx
import { useState, useEffect } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

// SetupGuide Component
const SetupGuide = ({ onDismiss, onStepComplete, items }) => {
  const [expanded, setExpanded] = useState(items.findIndex((item) => !item.complete));
  const [isGuideOpen, setIsGuideOpen] = useState(true);
  const completedItemsLength = items.filter((item) => item.complete).length;

  return (
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

// Setup items data
const SETUP_ITEMS = [
  {
    id: 0,
    title: "Create Tree Planting Product",
    description: "Set up a special product that allows customers to donate towards planting trees.",
    complete: true,
    primaryButton: {
      content: "Create Product",
      props: {
        onClick: () => console.log("Create product clicked"),
      },
    },
  },
  {
    id: 1,
    title: "Configure Cart Settings",
    description: "Enable the tree planting donation checkbox in the cart for your customers.",
    complete: false,
    primaryButton: {
      content: "Configure",
      props: {
        onClick: () => console.log("Configure clicked"),
      },
    },
  },
  {
    id: 2,
    title: "Set Up Pricing Plan",
    description: "Choose a pricing plan that fits your store's needs and volume.",
    complete: false,
    primaryButton: {
      content: "View Plans",
      props: {
        onClick: () => console.log("View plans clicked"),
      },
    },
  },
];

// Fixed price options
const PRICE_OPTIONS = [
  { value: "5.00", label: "$5.00" },
  { value: "10.00", label: "$10.00" },
  { value: "15.00", label: "$15.00" },
  { value: "20.00", label: "$20.00" },
  { value: "25.00", label: "$25.00" },
];

export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);

    let shopifyProduct = null;
    let exists = false;

    const response = await admin.graphql(
      `#graphql
      query {
        products(first: 5, query: "title:'Support Tree Planting'") {
          edges {
            node {
              id
              title
              handle
              status
            }
          }
        }
      }`
    );
    const responseJson = await response.json();
    shopifyProduct = responseJson.data.products.edges[0]?.node || null;
    exists = !!shopifyProduct;

    return { shopifyProduct, exists, hasError: false };
  } catch (error) {
    return {
      shopifyProduct: null,
      exists: false,
      hasError: true,
      errorMessage: error.message,
    };
  }
};

export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    const selectedPrice = formData.get("price");

    const productResponse = await admin.graphql(
      `#graphql
      mutation createTreePlantingProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product { id title handle status variants(first: 10) { edges { node { id price }}}}
        }
      }`,
      {
        variables: {
          product: { title: "Support Tree Planting" },
        },
      }
    );

    const productJson = await productResponse.json();
    const product = productJson.data.productCreate.product;
    const variantId = product.variants.edges[0].node.id;

    const variantResponse = await admin.graphql(
      `#graphql
        mutation updateVariantPrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants { id price }
          }
        }`,
      {
        variables: {
          productId: product.id,
          variants: [{ id: variantId, price: selectedPrice }],
        },
      }
    );

    const variantJson = await variantResponse.json();

    return {
      product,
      variant: variantJson.data.productVariantsBulkUpdate.productVariants,
      success: true,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export default function HomeProductCreation() {
  const fetcher = useFetcher();
  const loaderData = useLoaderData();
  const shopify = useAppBridge();

  const [selectedPrice, setSelectedPrice] = useState(PRICE_OPTIONS[0].value);
  const [productExists, setProductExists] = useState(loaderData.exists);
  const [showGuide, setShowGuide] = useState(true);
  const [items, setItems] = useState(SETUP_ITEMS);

  const isLoading = ["loading", "submitting"].includes(fetcher.state) && fetcher.formMethod === "POST";
  const hasActionError = fetcher.data?.success === false;

  useEffect(() => {
    if (fetcher.data?.success) {
      setProductExists(true);
      shopify.toast.show("Support Tree Planting product created");
    } else if (hasActionError) {
      shopify.toast.show(fetcher.data.error, { error: true });
    }
  }, [fetcher.data, hasActionError, shopify]);

  const handleCreate = () => {
    fetcher.submit({ price: selectedPrice }, { method: "POST" });
  };

  const onStepComplete = async (id) => {
    try {
      await new Promise((res) => setTimeout(() => res(), 1000));
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, complete: !item.complete } : item)));
    } catch (e) {
      console.error(e);
    }
  };

  if (loaderData.hasError) {
    return (
      <s-page heading="Tree Planting Product Manager">
        <s-section>
          <s-banner status="critical">
            <s-paragraph>{loaderData.errorMessage}</s-paragraph>
          </s-banner>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Tree Planting Product Manager">
      {/* Primary action */}
      {!productExists && (
        <s-button slot="primary-action" onClick={handleCreate} {...(isLoading ? { loading: true } : {})}>
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
          <s-button onClick={() => setShowGuide(true)}>Show Setup Guide</s-button>
        )}

        {/* Product Creation Section */}
        <s-section heading="Create Support Tree Planting Product">
          <s-heading level="h3">Help your customers give back</s-heading>
          
          <s-paragraph>
            Create a special "Support Tree Planting" product that allows customers
            to donate towards planting trees.
          </s-paragraph>

          <s-stack direction="block" gap="base">
            {/* Price selector */}
            <label>
              <s-text>Select Donation Amount</s-text>
              <s-select
                value={selectedPrice}
                onChange={(value) => setSelectedPrice(value)}
                disabled={productExists}
                style={{ marginTop: "8px", width: "200px" }}
              >
                {PRICE_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </s-select>
            </label>

            {productExists && (
              <s-banner status="info">
                <s-paragraph>
                  This product already exists. Delete it in Shopify to recreate.
                </s-paragraph>
                <s-button
                  variant="tertiary"
                  onClick={() =>
                    shopify.intents.invoke?.("edit:shopify/Product", {
                      value: loaderData.shopifyProduct.id,
                    })
                  }
                >
                  View Product in Shopify
                </s-button>
              </s-banner>
            )}

            {hasActionError && (
              <s-banner status="critical">
                <s-paragraph>{fetcher.data?.error}</s-paragraph>
              </s-banner>
            )}
          </s-stack>
        </s-section>

        {fetcher.data?.success && (
          <s-section heading="Product Created">
            <s-banner status="success">
              <s-paragraph>Product successfully created in Shopify.</s-paragraph>
            </s-banner>

            <s-stack direction="inline" gap="base">
              <s-button
                variant="tertiary"
                onClick={() =>
                  shopify.intents.invoke?.("edit:shopify/Product", {
                    value: fetcher.data.product.id,
                  })
                }
              >
                Edit in Shopify
              </s-button>

              <s-button
                variant="tertiary"
                onClick={() =>
                  shopify.intents.invoke?.("preview:shopify/Product", {
                    value: fetcher.data.product.id,
                  })
                }
              >
                Preview Product
              </s-button>
            </s-stack>

            <s-divider />

            <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
              <pre style={{ margin: 0 }}>
                <code>{JSON.stringify(fetcher.data.product, null, 2)}</code>
              </pre>
            </s-box>
          </s-section>
        )}
      </s-stack>
    </s-page>
  );
}