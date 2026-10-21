import { useState } from "react";
import type {
  CatalogueImage,
  CatalogueProduct,
  CatalogueVariant,
} from "./catalogue.service";
import {
  getLocalProductImageUrl,
  isVariantInStock,
} from "./catalogue.service";
import { formatGhs } from "../../lib/format-currency";

type ProductPageProps = {
  product: CatalogueProduct;
  selectedVariantId: string;
  onVariantChange: (variantId: string) => void;
  canProceedToCheckout: boolean;
  cartMessage: string | null;
  onAddToCart: (
    product: CatalogueProduct,
    variant: CatalogueVariant,
    image: CatalogueImage | null,
  ) => void;
  onProceedToCheckout: () => void;
  onBack: () => void;
};

export function ProductPage({
  product,
  selectedVariantId,
  onVariantChange,
  canProceedToCheckout,
  cartMessage,
  onAddToCart,
  onProceedToCheckout,
  onBack,
}: ProductPageProps) {
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const firstAvailableVariant = product.variants.find((variant) =>
    isVariantInStock(product, variant),
  );
  const currentVariantId = product.variants.some(
    (variant) => variant.id === selectedVariantId,
  )
    ? selectedVariantId
    : firstAvailableVariant?.id ?? "";
  const selectedVariant = product.variants.find(
    (variant) => variant.id === currentVariantId,
  );
  const selectedImage =
    product.images.find((image) => image.id === selectedImageId) ??
    product.images[0] ??
    null;
  const isAvailable = product.variants.some((variant) =>
    isVariantInStock(product, variant),
  );

  return (
    <section className="product-page" aria-labelledby="product-page-title">
      <button className="text-button" type="button" onClick={onBack}>
        &lt;- Back to collection
      </button>
      <div className="product-page__layout">
        <div className="product-page__gallery">
          <div className="product-page__image-wrap">
            {selectedImage ? (
              <img
                src={selectedImage.url}
                srcSet={selectedImage.srcSet}
                sizes="(max-width: 780px) 100vw, 52vw"
                alt={selectedImage.alt_text || product.name}
                fetchPriority="high"
                decoding="async"
                onError={(event) => {
                  const fallbackUrl =
                    selectedImage.fallbackUrl ?? getLocalProductImageUrl(product.slug);
                  if (
                    !fallbackUrl ||
                    event.currentTarget.src.endsWith(fallbackUrl)
                  ) {
                    return;
                  }
                  event.currentTarget.src = fallbackUrl;
                  event.currentTarget.removeAttribute("srcset");
                }}
              />
            ) : (
              <div className="product-card__image-placeholder" role="img">
                Image coming soon
              </div>
            )}
          </div>
          {product.images.length > 0 && (
            <div
              className="product-page__colors"
              role="group"
              aria-label="Available colors"
            >
              <p>
                Color: <strong>{selectedImage?.colorName ?? "Unavailable"}</strong>
              </p>
              <div className="product-page__color-options">
                {product.images.map((image) => (
                  <button
                    className="product-page__color-option"
                    key={image.id}
                    type="button"
                    aria-label={`Choose ${image.colorName}`}
                    aria-pressed={selectedImage?.id === image.id}
                    onClick={() => setSelectedImageId(image.id)}
                  >
                    <img
                      src={image.url}
                      srcSet={image.srcSet}
                      sizes="5rem"
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={(event) => {
                        if (!image.fallbackUrl) {
                          return;
                        }
                        event.currentTarget.src = image.fallbackUrl;
                        event.currentTarget.removeAttribute("srcset");
                      }}
                    />
                    <span>{image.colorName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="product-page__details">
          <h1 id="product-page-title">{product.name}</h1>
          <p className="product-page__price">{formatGhs(product.price)}</p>
          <p className="product-page__description">{product.description}</p>
          <div className="form-field">
            <label htmlFor={`product-size-${product.id}`}>Size</label>
            <select
              id={`product-size-${product.id}`}
              value={currentVariantId}
              onChange={(event) => onVariantChange(event.target.value)}
              disabled={product.variants.length === 0}
            >
              {product.variants.length === 0 && (
                <option value="">No sizes available</option>
              )}
              {product.variants.map((variant) => (
                <option
                  key={variant.id}
                  value={variant.id}
                  disabled={!isVariantInStock(product, variant)}
                >
                  {variant.size}
                  {!isVariantInStock(product, variant) ? " - out of stock" : ""}
                </option>
              ))}
            </select>
          </div>

          <p
            className={
              isAvailable
                ? "stock-label"
                : "stock-label stock-label--unavailable"
            }
          >
            {isAvailable ? "Available" : "Out of stock"}
          </p>
          <div className="product-page__actions">
            <button
              className="button button--dark"
              type="button"
              disabled={
                !selectedVariant || !isVariantInStock(product, selectedVariant)
              }
              onClick={() =>
                selectedVariant &&
                onAddToCart(product, selectedVariant, selectedImage)
              }
            >
              Add to bag
            </button>
            {canProceedToCheckout && (
              <button
                className="button button--secondary"
                type="button"
                onClick={onProceedToCheckout}
              >
                Proceed to checkout
              </button>
            )}
          </div>
          {cartMessage && (
            <p className="cart-feedback" role="status">
              {cartMessage}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
