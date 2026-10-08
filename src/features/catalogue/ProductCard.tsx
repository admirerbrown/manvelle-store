import { useEffect, useRef } from "react";
import type {
  CatalogueProduct,
  CatalogueVariant,
} from "./catalogue.service";
import { trackStorefrontEvent } from "../analytics/analytics.service";
import { formatGhs } from "../../lib/format-currency";

type ProductCardProps = {
  product: CatalogueProduct;
  selectedVariantId: string;
  onVariantChange: (variantId: string) => void;
  onAddToCart: (product: CatalogueProduct, variant: CatalogueVariant) => void;
};

export function ProductCard({
  product,
  selectedVariantId,
  onVariantChange,
  onAddToCart,
}: ProductCardProps) {
  const cardElement = useRef<HTMLElement | null>(null);
  const hasReportedView = useRef(false);

  useEffect(() => {
    const element = cardElement.current;
    if (!element || hasReportedView.current) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      hasReportedView.current = true;
      trackStorefrontEvent({ name: "product_view", productId: product.id });
      return;
    }

    const observer = new IntersectionObserver(
      (entries, activeObserver) => {
        if (
          entries.some(
            (entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5,
          )
        ) {
          hasReportedView.current = true;
          trackStorefrontEvent({
            name: "product_view",
            productId: product.id,
          });
          activeObserver.unobserve(element);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [product.id]);

  const firstAvailableVariant = product.variants.find(
    (variant) => variant.stock_quantity > 0,
  );
  const currentVariantId =
    product.variants.some((variant) => variant.id === selectedVariantId)
      ? selectedVariantId
      : firstAvailableVariant?.id ?? "";
  const selectedVariant = product.variants.find(
    (variant) => variant.id === currentVariantId,
  );
  const isAvailable = product.variants.some(
    (variant) => variant.stock_quantity > 0,
  );

  return (
    <article className="product-card" ref={cardElement}>
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
          <span className="product-card__badge">Featured</span>
        )}
      </div>
      <div className="product-card__content">
        <div className="product-card__title-row">
          <h3>{product.name}</h3>
          <span className="product-card__price">{formatGhs(product.price)}</span>
        </div>
        <p className="product-card__description">{product.description}</p>
        <label className="field-label" htmlFor={`size-${product.id}`}>
          Size
        </label>
        <select
          id={`size-${product.id}`}
          value={currentVariantId}
          onChange={(event) => {
            const variantId = event.target.value;
            onVariantChange(variantId);
            if (product.variants.some((variant) => variant.id === variantId)) {
              trackStorefrontEvent({
                name: "product_variant_selected",
                productId: product.id,
                variantId,
              });
            }
          }}
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
              {variant.stock_quantity === 0 ? " - out of stock" : ""}
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
            disabled={!selectedVariant || selectedVariant.stock_quantity === 0}
            onClick={() =>
              selectedVariant && onAddToCart(product, selectedVariant)
            }
          >
            Add to bag
          </button>
        </div>
      </div>
    </article>
  );
}
