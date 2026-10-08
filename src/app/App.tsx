import { useEffect, useMemo, useState } from "react";
import {
  getCatalogueDeliveryZones,
  getCatalogueProducts,
  type CatalogueDeliveryZone,
  type CatalogueProduct,
  type CatalogueVariant,
} from "../features/catalogue/catalogue.service";
import { CartPanel, type CartItemView } from "../features/cart/CartPanel";
import type { CartLine } from "../features/cart/cart.types";
import { CheckoutForm } from "../features/checkout/CheckoutForm";
import type { GuestOrderConfirmation } from "../features/checkout/checkout.service";
import { formatGhs } from "../lib/format-currency";

type View = "shop" | "checkout" | "confirmation";
const minimumProductVariantCount = 4;

export function App() {
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<CatalogueDeliveryZone[]>(
    [],
  );
  const [cart, setCart] = useState<CartLine[]>([]);
  const [view, setView] = useState<View>("shop");
  const [confirmation, setConfirmation] =
    useState<GuestOrderConfirmation | null>(null);
  const [selectedVariantIds, setSelectedVariantIds] = useState<
    Record<string, string>
  >({});
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [view]);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setCatalogueError(null);

    Promise.all([getCatalogueProducts(), getCatalogueDeliveryZones()])
      .then(([loadedProducts, loadedDeliveryZones]) => {
        if (isCurrent) {
          setProducts(loadedProducts);
          setDeliveryZones(loadedDeliveryZones);
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

  const cartItems: CartItemView[] = useMemo(
    () =>
      cart.map((item) => {
        const product = productsById.get(item.productId) ?? null;
        const variant =
          product?.variants.find(
            (productVariant) => productVariant.id === item.variantId,
          ) ?? null;
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
        } else if (variant.stock_quantity === 0) {
          availabilityIssue =
            "This size is out of stock. Remove it or choose another size.";
        } else if (item.quantity > variant.stock_quantity) {
          availabilityIssue = `Only ${variant.stock_quantity} ${
            variant.stock_quantity === 1 ? "unit is" : "units are"
          } currently available. Update the quantity.`;
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
              (deliveryZones.length === 0
                ? "No delivery areas are available right now."
                : null);
  const canProceedToCheckout =
    cartItems.length > 0 && checkoutBlockMessage === null;

  const cartQuantity = cart.reduce((total, item) => total + item.quantity, 0);

  function handleAddToCart(
    product: CatalogueProduct,
    variant: CatalogueVariant,
  ) {
    const existingItem = cart.find((item) => item.variantId === variant.id);
    const requestedQuantity = (existingItem?.quantity ?? 0) + 1;

    if (requestedQuantity > variant.stock_quantity) {
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
        (item) => item.variantId === variant.id,
      );
      if (currentItem) {
        return currentCart.map((item) =>
          item.variantId === variant.id
            ? { ...item, quantity: requestedQuantity }
            : item,
        );
      }

      return [
        ...currentCart,
        {
          productId: product.id,
          variantId: variant.id,
          quantity: 1,
        },
      ];
    });
    setCartMessage(`${product.name}, size ${variant.size}, added to your bag.`);
  }

  function handleQuantityChange(variantId: string, quantity: number) {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.variantId === variantId ? { ...item, quantity } : item,
      ),
    );
  }

  function handleRemoveItem(variantId: string) {
    setCart((currentCart) =>
      currentCart.filter((item) => item.variantId !== variantId),
    );
  }

  function handleOrderCreated(order: GuestOrderConfirmation) {
    setConfirmation(order);
    setCart([]);
    setCartMessage(null);
    setView("confirmation");
  }

  function continueShopping() {
    setConfirmation(null);
    setView("shop");
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
          onClick={() => {
            if (view === "confirmation") {
              continueShopping();
              return;
            }
            document.getElementById("bag")?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }}
          aria-label={`Your bag, ${cartQuantity} ${
            cartQuantity === 1 ? "item" : "items"
          }`}
        >
          Your bag <span>{cartQuantity}</span>
        </button>
      </header>

      <main>
        {view === "shop" && (
          <>
            <section className="hero">
              <p className="eyebrow">Everyday, considered</p>
              <h1>Made for the way you move.</h1>
              <p>
                Browse the collection, choose your size, and order with Cash
                on Delivery.
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
                    const firstAvailableVariant = product.variants.find(
                      (variant) => variant.stock_quantity > 0,
                    );
                    const selectedVariantId =
                      selectedVariantIds[product.id] ??
                      firstAvailableVariant?.id ??
                      "";
                    const selectedVariant = product.variants.find(
                      (variant) => variant.id === selectedVariantId,
                    );
                    const isAvailable = product.variants.some(
                      (variant) => variant.stock_quantity > 0,
                    );

                    return (
                      <article className="product-card" key={product.id}>
                        <div className="product-card__image-wrap">
                          {product.images[0] ? (
                            <img
                              className="product-card__image"
                              src={product.images[0].url}
                              alt={product.images[0].alt_text || product.name}
                              loading="lazy"
                            />
                          ) : (
                            <div
                              className="product-card__image-placeholder"
                              role="img"
                              aria-label={`Image unavailable for ${product.name}`}
                            >
                              Image coming soon
                            </div>
                          )}
                          {product.featured && (
                            <span className="product-card__badge">
                              Featured
                            </span>
                          )}
                        </div>
                        <div className="product-card__content">
                          <div className="product-card__title-row">
                            <h3>{product.name}</h3>
                            <span className="product-card__price">
                              {formatGhs(product.price)}
                            </span>
                          </div>
                          <p className="product-card__description">
                            {product.description}
                          </p>
                          <label
                            className="field-label"
                            htmlFor={`size-${product.id}`}
                          >
                            Size
                          </label>
                          <select
                            id={`size-${product.id}`}
                            value={selectedVariantId}
                            onChange={(event) =>
                              setSelectedVariantIds((current) => ({
                                ...current,
                                [product.id]: event.target.value,
                              }))
                            }
                            disabled={product.variants.length === 0}
                          >
                            {product.variants.length === 0 && (
                              <option value="">No sizes available</option>
                            )}
                            {product.variants.map((variant) => (
                              <option
                                key={variant.id}
                                value={variant.id}
                                disabled={variant.stock_quantity === 0}
                              >
                                {variant.size}
                                {variant.stock_quantity === 0
                                  ? " - out of stock"
                                  : ""}
                              </option>
                            ))}
                          </select>
                          <div className="product-card__footer">
                            <span
                              className={
                                isAvailable
                                  ? "stock-label"
                                  : "stock-label stock-label--unavailable"
                              }
                            >
                              {isAvailable ? "Available" : "Out of stock"}
                            </span>
                            <button
                              className="button button--dark"
                              type="button"
                              disabled={
                                !selectedVariant ||
                                selectedVariant.stock_quantity === 0
                              }
                              onClick={() =>
                                selectedVariant &&
                                handleAddToCart(product, selectedVariant)
                              }
                            >
                              Add to bag
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {cartMessage && (
              <p className="cart-feedback" role="status">
                {cartMessage}
              </p>
            )}

            <CartPanel
              items={cartItems}
              subtotal={cartSubtotal}
              canProceed={canProceedToCheckout}
              blockMessage={checkoutBlockMessage}
              onQuantityChange={handleQuantityChange}
              onRemoveItem={handleRemoveItem}
              onProceed={() => setView("checkout")}
            />
          </>
        )}

        {view === "checkout" && cartSubtotal !== null && (
          <CheckoutForm
            cart={cart}
            products={productsById}
            deliveryZones={deliveryZones}
            subtotal={cartSubtotal}
            onBack={() => setView("shop")}
            onOrderCreated={handleOrderCreated}
          />
        )}

        {view === "confirmation" && confirmation && (
          <section className="confirmation" aria-labelledby="confirmation-title">
            <p className="eyebrow">Order received</p>
            <h1 id="confirmation-title">Thank you for your order.</h1>
            <p>
              Your order has been recorded. Keep your phone available for
              delivery coordination.
            </p>
            <dl className="confirmation__details">
              <div>
                <dt>Order number</dt>
                <dd>{confirmation.orderNumber}</dd>
              </div>
              <div>
                <dt>Order total</dt>
                <dd>{formatGhs(confirmation.total)}</dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>Cash on Delivery</dd>
              </div>
            </dl>
            <button
              className="button button--dark"
              type="button"
              onClick={continueShopping}
            >
              Continue shopping
            </button>
          </section>
        )}
      </main>

      <footer className="store-footer">
        <span>Manvelle Menswear Ghana</span>
        <span>Guest checkout - Cash on Delivery</span>
      </footer>
    </div>
  );
}
