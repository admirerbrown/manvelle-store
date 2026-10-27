import { Link } from "react-router-dom";
import { paths } from "../../app/routes";
import {
  getLocalProductImageUrl,
  type CatalogueProduct,
} from "./catalogue.service";
import { formatGhs } from "../../lib/format-currency";

function formatCategory(category: string | null): string {
  if (!category) {
    return "Collection";
  }
  return category
    .split("/")
    .map((part) => part.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()))
    .join(" / ");
}

type ProductCardProps = {
  product: CatalogueProduct;
};

export function ProductCard({ product }: ProductCardProps) {
  const firstImage = product.images[0];
  const localFallbackImage = getLocalProductImageUrl(product.slug, product.category);
  const localImage = firstImage?.fallbackUrl ?? localFallbackImage;
  const imageSrc = localImage ?? firstImage?.url;

  return (
    <article className="product-card">
      <Link
        className="product-card__link"
        to={paths.product(product.slug)}
        aria-label={`View ${product.name}, ${formatGhs(product.price)}`}
      >
        <span className="product-card__image-wrap">
          {imageSrc ? (
            <img
              className="product-card__image"
              src={imageSrc}
              srcSet={imageSrc === localImage ? undefined : firstImage?.srcSet}
              sizes="(max-width: 560px) 50vw, (max-width: 980px) 25vw, 20vw"
              alt={firstImage?.alt_text || product.name}
              loading="lazy"
              decoding="async"
              onError={(event) => {
                const fallbackUrl = firstImage?.fallbackUrl ?? localFallbackImage;
                if (!fallbackUrl || event.currentTarget.src.endsWith(fallbackUrl)) {
                  return;
                }
                event.currentTarget.src = fallbackUrl;
                event.currentTarget.removeAttribute("srcset");
              }}
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
        <span className="product-card__category">
          {formatCategory(product.category)}
        </span>
        <span className="product-card__title-row">
          <span className="product-card__name">{product.name}</span>
          <span className="product-card__description">
            {product.description || "Designed for everyday movement and effortless style."}
          </span>
        </span>
        <span className="product-card__footer">
          <span className="product-card__price">{formatGhs(product.price)}</span>
          <span className="product-card__swatches" aria-label="Available colours">
            {product.images.slice(0, 3).map((image) => (
              <span
                className="product-card__swatch"
                key={image.id}
                style={{ backgroundImage: `url(${image.fallbackUrl ?? image.url})` }}
                aria-hidden="true"
              />
            ))}
          </span>
        </span>
      </Link>
    </article>
  );
}
