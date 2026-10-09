import { useEffect, useMemo, useRef, useState } from "react";
import {
  getCatalogueProducts,
  isVariantInStock,
  type CatalogueImage,
  type CatalogueProduct,
  type CatalogueVariant,
} from "../features/catalogue/catalogue.service";
import { ProductCard } from "../features/catalogue/ProductCard";
import { ProductPage } from "../features/catalogue/ProductPage";
import { trackStorefrontEvent } from "../features/analytics/analytics.service";
import { CartPanel, type CartItemView } from "../features/cart/CartPanel";
import {
  getCartLineKey,
  type CartLine,
} from "../features/cart/cart.types";
import { CheckoutForm } from "../features/checkout/CheckoutForm";
import type { GuestOrderConfirmation } from "../features/checkout/checkout.service";
import { formatGhs } from "../lib/format-currency";

type View = "shop" | "bag" | "checkout" | "confirmation";
const minimumProductVariantCount = 4;

export function App() {
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [confirmationCart, setConfirmationCart] = useState<CartLine[]>([]);
  const [view, setView] = useState<View>("shop");
  const [selectedProductSlug, setSelectedProductSlug] = useState<string | null>(
    null,
  );
  const [confirmation, setConfirmation] =
    useState<GuestOrderConfirmation | null>(null);
  const [selectedVariantIds, setSelectedVariantIds] = useState<
    Record<string, string>
  >({});
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const lastTrackedPage = useRef<View | null>(null);

  useEffect(() => {
    if (lastTrackedPage.current === view) {
      return;
    }
    lastTrackedPage.current = view;
    trackStorefrontEvent({
      name: "page_view",
      page: view === "bag" ? "shop" : view,
    });
  }, [view]);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setCatalogueError(null);

    getCatalogueProducts()
      .then((loadedProducts) => {
        if (isCurrent) {
          setProducts(loadedProducts);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setCatalogueError(
            error instanceof Error
              ? error.message
              : "The catalogue could not be loaded. Please try again.",
          );
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [refreshVersion]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [view, selectedProductSlug]);

  useEffect(() => {
    if (!cartMessage) {
      return;
    }
    const timeoutId = window.setTimeout(() => setCartMessage(null), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [cartMessage]);

  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const productsWithEnoughSizes = useMemo(
    () =>
      products.filter(
        (product) => product.variants.length >= minimumProductVariantCount,
      ),
    [products],
  );
  const selectedProduct = products.find(
    (product) => product.slug === selectedProductSlug,
  );

  const cartItems: CartItemView[] = useMemo(
    () =>
      cart.map((item) => {
        const product = productsById.get(item.productId) ?? null;
        const variant =
          product?.variants.find(
            (productVariant) => productVariant.id === item.variantId,
          ) ?? null;
        const quantityForVariant = cart
          .filter((cartLine) => cartLine.variantId === item.variantId)
          .reduce((quantity, cartLine) => quantity + cartLine.quantity, 0);
        let availabilityIssue: string | null = null;

        if (!product) {
          availabilityIssue =
            "This product is no longer available. Remove it from your bag.";
        } else if (product.variants.length < minimumProductVariantCount) {
          availabilityIssue =
            "This product's size options are being updated. Remove it from your bag before checkout.";
        } else if (!variant) {
          availabilityIssue =
            "This size is no longer available. Refresh the catalogue or remove it.";
        } else if (!isVariantInStock(product, variant)) {
          availabilityIssue =
            "This size is out of stock. Remove it or choose another size.";
        } else if (
          variant.stock_quantity !== null &&
          quantityForVariant > variant.stock_quantity
        ) {
          availabilityIssue = `Only ${variant.stock_quantity} ${
            variant.stock_quantity === 1 ? "unit is" : "units are"
          } currently available across this size. Update the quantity.`;
        }

        return { item, product, variant, availabilityIssue };
      }),
    [cart, productsById],
  );

  const cartSubtotal =
    cartItems.every(({ product, variant }) => product && variant) ?
      cartItems.reduce(
        (subtotal, { item, product }) =>
          subtotal + (product?.price ?? 0) * item.quantity,
        0,
      )
    : null;

  const checkoutBlockMessage =
    cartItems.length === 0
      ? null
      : isLoading
        ? "Refreshing product and stock availability."
        : catalogueError
          ? "Refresh the collection before proceeding to checkout."
          : cartItems.length > 50
            ? "A single order can include at most 50 sizes."
            : cartItems.find((item) => item.availabilityIssue)
                ?.availabilityIssue ??
              null;
  const canProceedToCheckout =
    cartItems.length > 0 && checkoutBlockMessage === null;

  const cartQuantity = cart.reduce((total, item) => total + item.quantity, 0);

  function handleAddToCart(
    product: CatalogueProduct,
    variant: CatalogueVariant,
    image: CatalogueImage | null,
  ) {
    const line = {
      productId: product.id,
      variantId: variant.id,
      imageId: image?.id ?? null,
    };
    const lineKey = getCartLineKey(line);
    const existingItem = cart.find(
      (item) => getCartLineKey(item) === lineKey,
    );
    const requestedQuantity =
      cart
        .filter((item) => item.variantId === variant.id)
        .reduce((quantity, item) => quantity + item.quantity, 0) + 1;

    if (
      !isVariantInStock(product, variant) ||
      (variant.stock_quantity !== null &&
        requestedQuantity > variant.stock_quantity)
    ) {
      if (!isVariantInStock(product, variant)) {
        setCartMessage(`${product.name}, size ${variant.size}, is out of stock.`);
        return;
      }
      setCartMessage(
        `Only ${variant.stock_quantity} ${
          variant.stock_quantity === 1 ? "unit is" : "units are"
        } currently available in size ${variant.size}.`,
      );
      return;
    }
    if (!existingItem && cart.length >= 50) {
      setCartMessage("A single order can include at most 50 sizes.");
      return;
    }

    setCart((currentCart) => {
      const currentItem = currentCart.find(
        (item) => getCartLineKey(item) === lineKey,
      );
      if (currentItem) {
        return currentCart.map((item) =>
          getCartLineKey(item) === lineKey
            ? { ...item, quantity: currentItem.quantity + 1 }
            : item,
        );
      }
      return [
        ...currentCart,
        {
          ...line,
          quantity: 1,
        },
      ];
    });
    trackStorefrontEvent({
      name: "add_to_cart",
      productId: product.id,
      variantId: variant.id,
      quantity: 1,
    });
    setCartMessage(`${product.name}, size ${variant.size}, added to your bag.`);
  }

  function handleQuantityChange(lineKey: string, quantity: number) {
    setCart((currentCart) =>
      currentCart.map((item) =>
        getCartLineKey(item) === lineKey ? { ...item, quantity } : item,
      ),
    );
  }

  function handleRemoveItem(lineKey: string) {
    setCart((currentCart) =>
      currentCart.filter((item) => getCartLineKey(item) !== lineKey),
    );
  }

  function handleOrderCreated(
    order: GuestOrderConfirmation,
    submittedItems: CartLine[],
  ) {
    trackStorefrontEvent({
      name: "order_confirmed",
      orderNumber: order.orderNumber,
    });
    setConfirmation(order);
    setConfirmationCart(submittedItems);
    setCart([]);
    setCartMessage(null);
    setSelectedProductSlug(null);
    setView("confirmation");
  }

  function continueShopping() {
    setConfirmation(null);
    setConfirmationCart([]);
    setSelectedProductSlug(null);
    setView("shop");
  }

  useEffect(() => {
    if (view !== "confirmation" || !confirmation) {
      return;
    }
    const timeoutId = window.setTimeout(continueShopping, 5000);
    return () => window.clearTimeout(timeoutId);
  }, [view, confirmation]);

  function handleProceedToCheckout() {
    if (!canProceedToCheckout) {
      return;
    }
    trackStorefrontEvent({ name: "checkout_started" });
    setSelectedProductSlug(null);
    setView("checkout");
  }

  function handleOpenProduct(product: CatalogueProduct) {
    setSelectedProductSlug(product.slug);
    const firstAvailableVariant = product.variants.find((variant) =>
      isVariantInStock(product, variant),
    );
    setSelectedVariantIds((current) => ({
      ...current,
      [product.id]: current[product.id] ?? firstAvailableVariant?.id ?? "",
    }));
    trackStorefrontEvent({ name: "product_view", productId: product.id });
  }

  function handleHeaderBagClick() {
    setSelectedProductSlug(null);
    setView("bag");
  }

  return (
    <div className="storefront">
      <header className="store-header">
        <div className="store-brand" aria-label="Manvelle Menswear Ghana">
          <span className="store-brand__name">Manvelle</span>
          <span className="store-brand__caption">Menswear Ghana</span>
        </div>
        <button
          className="bag-link"
          type="button"
          disabled={view === "checkout"}
          onClick={handleHeaderBagClick}
          aria-label={`Your bag, ${cartQuantity} ${
            cartQuantity === 1 ? "item" : "items"
          }`}
        >
          Your bag <span>{cartQuantity}</span>
        </button>
      </header>

      <main>
        {view === "shop" && selectedProduct && (
          <ProductPage
            product={selectedProduct}
            selectedVariantId={
              selectedVariantIds[selectedProduct.id] ??
              selectedProduct.variants.find((variant) =>
                isVariantInStock(selectedProduct, variant),
              )?.id ??
              ""
            }
            onVariantChange={(variantId) =>
              setSelectedVariantIds((current) => ({
                ...current,
                [selectedProduct.id]: variantId,
              }))
            }
            canProceedToCheckout={canProceedToCheckout}
            onAddToCart={handleAddToCart}
            onProceedToCheckout={handleProceedToCheckout}
            onBack={() => setSelectedProductSlug(null)}
            cartMessage={cartMessage}
          />
        )}

        {view === "shop" && !selectedProduct && (
          <>
            <section className="hero">
              <p className="eyebrow">Everyday, considered</p>
              <h1>Made for the way you move.</h1>
              <p>
                Browse the collection, choose your size, and place your order.
                We’ll confirm delivery details on WhatsApp.
              </p>
            </section>

            <section
              className="catalogue-section"
              aria-labelledby="catalogue-heading"
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">The collection</p>
                  <h2 id="catalogue-heading">Shop menswear</h2>
                </div>
                <div className="catalogue-tools">
                  <span className="muted">
                    {productsWithEnoughSizes.length}{" "}
                    {productsWithEnoughSizes.length === 1 ? "style" : "styles"}
                  </span>
                  <button
                    className="text-button"
                    type="button"
                    disabled={isLoading}
                    onClick={() => setRefreshVersion((version) => version + 1)}
                  >
                    Refresh availability
                  </button>
                </div>
              </div>

              {isLoading && (
                <p className="status-message" role="status">
                  Loading the collection...
                </p>
              )}

              {catalogueError && (
                <div className="error-panel" role="alert">
                  <p>{catalogueError}</p>
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => setRefreshVersion((version) => version + 1)}
                  >
                    Try again
                  </button>
                </div>
              )}

              {!isLoading &&
                !catalogueError &&
                productsWithEnoughSizes.length === 0 && (
                  <p className="status-message">
                    {products.length > 0
                      ? "Items are temporarily unavailable while their size options are updated."
                      : "No products are available right now."}
                  </p>
                )}

              {!catalogueError &&
                productsWithEnoughSizes.length > 0 &&
                productsWithEnoughSizes.length < products.length && (
                  <p className="status-message" role="status">
                    Some styles are temporarily unavailable while their size
                    options are updated.
                  </p>
                )}

              {!catalogueError && productsWithEnoughSizes.length > 0 && (
                <div className="product-grid">
                  {productsWithEnoughSizes.map((product) => {
                    return (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onOpenProduct={handleOpenProduct}
                      />
                    );
                  })}
                </div>
              )}
            </section>

          </>
        )}

        {view === "bag" && (
          <>
            <button
              className="text-button bag-page__back"
              type="button"
              onClick={() => setView("shop")}
            >
              &lt;- Continue shopping
            </button>
            <CartPanel
              items={cartItems}
              subtotal={cartSubtotal}
              canProceed={canProceedToCheckout}
              blockMessage={checkoutBlockMessage}
              onQuantityChange={handleQuantityChange}
              onRemoveItem={handleRemoveItem}
              onProceed={handleProceedToCheckout}
            />
          </>
        )}

        {view === "checkout" && cartSubtotal !== null && (
          <CheckoutForm
            cart={cart}
            products={productsById}
            subtotal={cartSubtotal}
            onBack={() => {
              setSelectedProductSlug(null);
              setView("shop");
            }}
            onOrderCreated={handleOrderCreated}
          />
        )}

        {view === "confirmation" && confirmation && (
          <section className="confirmation" aria-labelledby="confirmation-title">
            <p className="eyebrow">Order received</p>
            <h1 id="confirmation-title">Thank you for your order.</h1>
            <p>
              We’ll reach out to you on WhatsApp to confirm your delivery
              details and let you know the cost of delivery.
            </p>
            <ul className="confirmation__items" aria-label="Items in your order">
              {confirmation.items.map((item, index) => (
                (() => {
                  const selectedLines = confirmationCart
                    .filter((line) => {
                      const product = productsById.get(line.productId);
                      const variant = product?.variants.find(
                        (candidate) => candidate.id === line.variantId,
                      );
                      return (
                        product?.name === item.productName &&
                        variant?.size === item.size
                      );
                    })
                    .map((line) => {
                      const product = productsById.get(line.productId);
                      return {
                        quantity: line.quantity,
                        color:
                          product?.images.find(
                            (image) => image.id === line.imageId,
                          )?.colorName ?? "Unavailable",
                      };
                    });
                  return (
                    <li
                      className="confirmation__item"
                      key={`${item.productName}-${item.size}-${index}`}
                    >
                      <span className="confirmation__item-description">
                        <strong>{item.productName}</strong>
                        <span>
                          Size {item.size} x {item.quantity} -{" "}
                          {formatGhs(item.unitPrice)} each
                        </span>
                        {selectedLines.length > 0 && (
                          <span>
                            {selectedLines.length > 1 ? "Colors: " : "Color: "}
                            {selectedLines
                              .map(
                                ({ color, quantity }) =>
                                  `${color} x ${quantity}`,
                              )
                              .join(", ")}
                          </span>
                        )}
                      </span>
                      <strong>{formatGhs(item.subtotal)}</strong>
                    </li>
                  );
                })()
              ))}
            </ul>
            <dl className="confirmation__details">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatGhs(confirmation.subtotal)}</dd>
              </div>
              <div>
                <dt>Delivery</dt>
                <dd>To be confirmed on WhatsApp</dd>
              </div>
              <div>
                <dt>Order number</dt>
                <dd>{confirmation.orderNumber}</dd>
              </div>
              <div>
                <dt>Order total</dt>
                <dd>To be confirmed on WhatsApp</dd>
              </div>
              <div>
                <dt>Delivery area</dt>
                <dd>{confirmation.deliveryArea}</dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>
                  {confirmation.isAccra
                    ? "Cash on Delivery"
                    : "Payment before delivery, arranged on WhatsApp"}
                </dd>
              </div>
            </dl>
            <button
              className="button button--dark"
              type="button"
              onClick={continueShopping}
            >
              Continue shopping
            </button>
            <p className="confirmation__redirect-note" role="status">
              Returning to the collection in 5 seconds.
            </p>
          </section>
        )}
      </main>

      <footer className="store-footer">
        <span>Manvelle Menswear Ghana</span>
        <span>Guest checkout - delivery confirmed on WhatsApp</span>
      </footer>
    </div>
  );
}
