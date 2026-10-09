import type { CatalogueProduct } from "./catalogue.service";
import { formatGhs } from "../../lib/format-currency";

type ProductCardProps = {
  product: CatalogueProduct;
  onOpenProduct: (product: CatalogueProduct) => void;
};

export function ProductCard({ product, onOpenProduct }: ProductCardProps) {
  const firstImage = product.images[0];

  return (
    <article className="product-card">
      <button
        className="product-card__link"
        type="button"
        onClick={() => onOpenProduct(product)}
        aria-label={`View ${product.name}, ${formatGhs(product.price)}`}
      >
        <span className="product-card__image-wrap">
          {firstImage ? (
            <img
              className="product-card__image"
              src={firstImage.url}
              alt={firstImage.alt_text || product.name}
              loading="lazy"
            />
          ) : (
            <span
              className="product-card__image-placeholder"
              role="img"
              aria-label={`Image unavailable for ${product.name}`}
            >
              Image coming soon
            </span>
          )}
        </span>
        <span className="product-card__title-row">
          <span className="product-card__name">{product.name}</span>
          <span className="product-card__price">{formatGhs(product.price)}</span>
        </span>
      </button>
    </article>
  );
}
