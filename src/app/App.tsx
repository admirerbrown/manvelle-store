import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { getCategoryLabel, paths, resolveRoute } from "./routes";
import type { StorefrontPage } from "../features/analytics/analytics.service";
import {
  getCatalogueProducts,
  isVariantInStock,
  type CatalogueImage,
  type CatalogueProduct,
  type CatalogueVariant,
} from "../features/catalogue/catalogue.service";
import { BenefitsStrip } from "../features/home/BenefitsStrip";
import { CategoryTiles } from "../features/home/CategoryTiles";
import { HeroCarousel } from "../features/home/HeroCarousel";
import {
  categoryContainsProduct,
  getCollectionHeroSlide,
  getHomeHeroSlides,
  getLiveCategories,
} from "../features/home/categories";
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
import categoryData from "../../catalog/category.json";

const minimumProductVariantCount = 4;

// Dropdown: categories with subcategories are grouped in columns; categories
// without any sit in a row at the bottom.
const dropdownGroups = categoryData.categories.filter(
  (category) => category.subcategories.length > 0,
);
const dropdownSingles = categoryData.categories.filter(
  (category) => category.subcategories.length === 0,
);

export function App() {
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [confirmationCart, setConfirmationCart] = useState<CartLine[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const route = resolveRoute(location.pathname);
  const selectedCategory = route.name === "collection" ? route.categoryId : null;
  // Last home/collection page the shopper was on, so "Back" and "Continue
  // shopping" return them to the list they came from.
  const listingPath = useRef<string | null>(null);
  const [confirmation, setConfirmation] =
    useState<GuestOrderConfirmation | null>(null);
  const [selectedVariantIds, setSelectedVariantIds] = useState<
    Record<string, string>
  >({});
  const [cartMessage, setCartMessage] = useState<string | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const lastTrackedPage = useRef<StorefrontPage | null>(null);
  const handledHash = useRef("");

  const trackedPage: StorefrontPage | null =
    route.name === "checkout" || route.name === "confirmation"
      ? route.name
      : route.name === "not-found" || route.name === "collection-index"
        ? null
        : "shop";

  useEffect(() => {
    if (route.name === "home" || route.name === "collection") {
      listingPath.current = location.pathname;
    }
  }, [route.name, location.pathname]);

  useEffect(() => {
    if (trackedPage === null || lastTrackedPage.current === trackedPage) {
      return;
    }
    lastTrackedPage.current = trackedPage;
    trackStorefrontEvent({ name: "page_view", page: trackedPage });
  }, [trackedPage]);

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

  // New page -> start at the top.
  useEffect(() => {
    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [location.pathname]);

  // "/#new-arrivals" -> scroll to that section once it has rendered.
  useEffect(() => {
    if (!location.hash) {
      handledHash.current = "";
      return;
    }
    const hashKey = `${location.key}${location.hash}`;
    if (handledHash.current === hashKey) {
      return;
    }
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) {
      handledHash.current = hashKey;
      target.scrollIntoView({ behavior: "smooth" });
    }
  }, [location.key, location.hash, isLoading, route.name]);

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
  const visibleProducts = useMemo(
    () =>
      selectedCategory === null
        ? productsWithEnoughSizes
        : productsWithEnoughSizes.filter((product) =>
            categoryContainsProduct(selectedCategory, product.category),
          ),
    [productsWithEnoughSizes, selectedCategory],
  );
  const liveCategories = useMemo(
    () => getLiveCategories(productsWithEnoughSizes),
    [productsWithEnoughSizes],
  );
  // Home: one slide per category. Category/subcategory page: only that category.
  const heroSlides = useMemo(() => {
    if (route.name === "collection") {
      const slide = getCollectionHeroSlide(route.categoryId, productsWithEnoughSizes);
      return slide ? [slide] : [];
    }
    return route.name === "home" ? getHomeHeroSlides(liveCategories) : [];
  }, [route, productsWithEnoughSizes, liveCategories]);
  const selectedProduct =
    route.name === "product"
      ? products.find((product) => product.slug === route.slug)
      : undefined;
  const selectedProductId = selectedProduct?.id;

  // Fires for in-app clicks and for direct visits / refreshes of /products/<slug>.
  useEffect(() => {
    if (selectedProductId) {
      trackStorefrontEvent({ name: "product_view", productId: selectedProductId });
    }
  }, [selectedProductId]);

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
    navigate(paths.confirmation, { replace: true });
  }

  function continueShopping() {
    setConfirmation(null);
    setConfirmationCart([]);
    navigate(paths.home, { replace: true });
  }

  useEffect(() => {
    if (route.name !== "confirmation" || !confirmation) {
      return;
    }
    const timeoutId = window.setTimeout(continueShopping, 5000);
    return () => window.clearTimeout(timeoutId);
  }, [route.name, confirmation]);

  function handleProceedToCheckout() {
    if (!canProceedToCheckout) {
      return;
    }
    trackStorefrontEvent({ name: "checkout_started" });
    navigate(paths.checkout);
  }

  function goBackToShopping() {
    navigate(listingPath.current ?? paths.home);
  }

  function renderCatalogueStatus() {
    return (
      <>
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

        {!isLoading && !catalogueError && productsWithEnoughSizes.length === 0 && (
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
              Some styles are temporarily unavailable while their size options
              are updated.
            </p>
          )}
      </>
    );
  }

  function renderProductGrid(items: CatalogueProduct[]) {
    return (
      <div className="product-grid">
        {items.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    );
  }

  return (
    <div className="storefront">
      <header className="store-header">
        <div className="store-brand" aria-label="Manvelle Menswear Ghana">
          <span className="store-brand__name">Manvelle</span>
          <span className="store-brand__caption">Menswear Ghana</span>
        </div>
        <nav className="store-nav" aria-label="Main navigation">
          <Link
            to={paths.home}
            onClick={() => {
              if (route.name === "home") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
          >
            Home
          </Link>
          <div className="store-nav__dropdown">
            <button className="store-nav__trigger" type="button">
              Categories <span aria-hidden="true">⌄</span>
            </button>
            <div className="store-nav__menu">
              <div className="store-nav__menu-inner">
              <div className="store-nav__groups">
                {dropdownGroups.map((category) => (
                  <div className="store-nav__menu-group" key={category.id}>
                    <Link
                      className="store-nav__group-title"
                      to={paths.collection(category.id)}
                    >
                      {category.name}
                    </Link>
                    <div className="store-nav__submenu">
                      {category.subcategories.map((subcategory) => (
                        <Link
                          key={`${category.id}/${subcategory.id}`}
                          to={paths.collection(`${category.id}/${subcategory.id}`)}
                        >
                          {subcategory.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {dropdownSingles.length > 0 && (
                <div className="store-nav__menu-footer">
                  {dropdownSingles.map((category) => (
                    <Link
                      className="store-nav__footer-link"
                      key={category.id}
                      to={paths.collection(category.id)}
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              )}
              </div>
            </div>
          </div>
        </nav>
        <button
          className="bag-link"
          type="button"
          disabled={route.name === "checkout"}
          onClick={() => navigate(paths.bag)}
          aria-label={`Your bag, ${cartQuantity} ${
            cartQuantity === 1 ? "item" : "items"
          }`}
        >
          Your bag <span>{cartQuantity}</span>
        </button>
      </header>

      <main>
        {route.name === "product" && selectedProduct && (
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
            onBack={() =>
              navigate(
                listingPath.current ??
                  (selectedProduct.category
                    ? paths.collection(selectedProduct.category)
                    : paths.home),
              )
            }
            cartMessage={cartMessage}
          />
        )}

        {route.name === "product" && !selectedProduct && isLoading && (
          <p className="status-message" role="status">
            Loading the product...
          </p>
        )}

        {route.name === "product" && !selectedProduct && !isLoading && (
          <div className="error-panel" role="alert">
            <p>
              {catalogueError ??
                "We could not find that product. It may have been removed."}
            </p>
            {catalogueError ? (
              <button
                className="button button--secondary"
                type="button"
                onClick={() => setRefreshVersion((version) => version + 1)}
              >
                Try again
              </button>
            ) : (
              <Link className="button button--secondary" to={paths.home}>
                Back to the collection
              </Link>
            )}
          </div>
        )}

        {(route.name === "home" || route.name === "collection") && (
          <>
            {heroSlides.length > 0 ? (
              <HeroCarousel slides={heroSlides} />
            ) : (
              isLoading && (
                <div className="home-hero home-hero--loading" aria-hidden="true" />
              )
            )}

            {route.name === "home" && (
              <>
                {renderCatalogueStatus()}
                {!isLoading && !catalogueError && liveCategories.length > 0 && (
                  <>
                    <CategoryTiles categories={liveCategories} />
                    <BenefitsStrip />
                  </>
                )}
              </>
            )}

            {route.name === "collection" && (
              <section
                className="catalogue-section"
                id="collection"
                aria-labelledby="catalogue-heading"
              >
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">The collection</p>
                    <h2 id="catalogue-heading">
                      {getCategoryLabel(route.categoryId)}
                    </h2>
                  </div>
                  <div className="catalogue-tools">
                    <span className="muted">
                      {visibleProducts.length}{" "}
                      {visibleProducts.length === 1 ? "style" : "styles"}
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

                {renderCatalogueStatus()}

                {!catalogueError && !isLoading && visibleProducts.length > 0 && (
                  renderProductGrid(visibleProducts)
                )}
                {!catalogueError && !isLoading && productsWithEnoughSizes.length > 0 && visibleProducts.length === 0 && (
                  <p className="status-message">No products are assigned to this category yet.</p>
                )}
              </section>
            )}
          </>
        )}

        {route.name === "bag" && (
          <>
            <button
              className="text-button bag-page__back"
              type="button"
              onClick={goBackToShopping}
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

        {route.name === "checkout" &&
          (cartSubtotal !== null && cart.length > 0 ? (
            <CheckoutForm
              cart={cart}
              products={productsById}
              subtotal={cartSubtotal}
              onBack={goBackToShopping}
              onOrderCreated={handleOrderCreated}
            />
          ) : confirmation ? null : isLoading ? (
            <p className="status-message" role="status">
              Loading your order...
            </p>
          ) : (
            // Nothing to check out (e.g. the page was refreshed or opened directly).
            <Navigate to={paths.bag} replace />
          ))}

        {route.name === "confirmation" && !confirmation && (
          <Navigate to={paths.home} replace />
        )}

        {route.name === "collection-index" && (
          <Navigate to={paths.home} replace />
        )}

        {route.name === "not-found" && (
          <section className="error-panel" role="alert">
            <p>We could not find that page.</p>
            <Link className="button button--secondary" to={paths.home}>
              Back to the collection
            </Link>
          </section>
        )}

        {route.name === "confirmation" && confirmation && (
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
