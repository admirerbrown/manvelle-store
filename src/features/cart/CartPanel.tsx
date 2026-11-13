import type {
  CatalogueProduct,
  CatalogueVariant,
} from "../catalogue/catalogue.service";
import { isVariantInStock } from "../catalogue/catalogue.service";
import { formatGhs } from "../../lib/format-currency";
import type { CartLine } from "./cart.types";
import { getCartLineKey } from "./cart.types";

export type CartItemView = {
  item: CartLine;
  product: CatalogueProduct | null;
  variant: CatalogueVariant | null;
  availabilityIssue: string | null;
};

type CartPanelProps = {
  items: CartItemView[];
  subtotal: number | null;
  canProceed: boolean;
  blockMessage: string | null;
  onQuantityChange: (lineKey: string, quantity: number) => void;
  onRemoveItem: (lineKey: string) => void;
  onProceed: () => void;
};

export function CartPanel({
  items,
  subtotal,
  canProceed,
  blockMessage,
  onQuantityChange,
  onRemoveItem,
  onProceed,
}: CartPanelProps) {
  const pieces = items.reduce((total, { item }) => total + item.quantity, 0);

  return (
    <section className="cart-panel" aria-labelledby="cart-heading" id="bag">
      <div className="section-heading bag-heading">
        <div className="bag-title-row">
          <h2 id="cart-heading">Your selection</h2>
          {items.length > 0 && (
            <span className="bag-count">
              {pieces} {pieces === 1 ? "item" : "items"}
            </span>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="bag-empty">
          Your bag is empty. Choose a size from the collection to get started.
        </p>
      ) : (
        <div className="bag-layout">
          <ul className="bag-list">
            {items.map(({ item, product, variant, availabilityIssue }) => {
              const lineKey = getCartLineKey(item);
              const colorImage =
                product && item.imageId
                  ? product.images.find((image) => image.id === item.imageId)
                  : undefined;
              const thumb = colorImage ?? product?.images[0];
              const meta = [
                `Size ${variant?.size ?? "Unavailable"}`,
                colorImage?.colorName,
                product ? `${formatGhs(product.price)} each` : null,
              ]
                .filter(Boolean)
                .join(" · ");
              const maxQuantity = variant?.stock_quantity ?? null;
              const canEdit =
                !!variant && !!product && isVariantInStock(product, variant);

              function setQuantity(quantity: number) {
                if (
                  Number.isInteger(quantity) &&
                  quantity >= 1 &&
                  (maxQuantity === null || quantity <= maxQuantity)
                ) {
                  onQuantityChange(lineKey, quantity);
                }
              }

              return (
                <li className="bag-item" key={lineKey}>
                  <div className="bag-item__media">
                    {thumb ? (
                      <img
                        src={thumb.url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={(event) => {
                          if (
                            thumb.fallbackUrl &&
                            !event.currentTarget.src.endsWith(thumb.fallbackUrl)
                          ) {
                            event.currentTarget.src = thumb.fallbackUrl;
                          }
                        }}
                      />
                    ) : null}
                  </div>

                  <div className="bag-item__details">
                    <h3>{product?.name ?? "Unavailable product"}</h3>
                    <p>{meta}</p>
                    {availabilityIssue && (
                      <p className="cart-item__issue">{availabilityIssue}</p>
                    )}
                    <button
                      className="bag-item__remove"
                      type="button"
                      onClick={() => onRemoveItem(lineKey)}
                      aria-label={`Remove ${
                        product?.name ?? "unavailable product"
                      } from your bag`}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="bag-item__side">
                    {product && (
                      <strong className="bag-item__price">
                        {formatGhs(product.price * item.quantity)}
                      </strong>
                    )}
                    <div className="bag-qty" role="group" aria-label="Quantity">
                      <button
                        type="button"
                        aria-label={`Decrease quantity for ${
                          product?.name ?? "unavailable product"
                        }`}
                        disabled={!canEdit || item.quantity <= 1}
                        onClick={() => setQuantity(item.quantity - 1)}
                      >
                        -
                      </button>
                      <input
                        id={`quantity-${lineKey}`}
                        aria-label={`Quantity for ${
                          product?.name ?? "unavailable product"
                        }`}
                        type="number"
                        min={1}
                        max={maxQuantity ?? undefined}
                        step={1}
                        value={item.quantity}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setQuantity(
                            Number.parseInt(event.currentTarget.value, 10),
                          )
                        }
                      />
                      <button
                        type="button"
                        aria-label={`Increase quantity for ${
                          product?.name ?? "unavailable product"
                        }`}
                        disabled={
                          !canEdit ||
                          (maxQuantity !== null && item.quantity >= maxQuantity)
                        }
                        onClick={() => setQuantity(item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <aside className="bag-summary" aria-labelledby="bag-summary-heading">
            <h2 id="bag-summary-heading">Order summary</h2>
            <dl className="bag-summary__totals">
              <div>
                <dt>Subtotal</dt>
                <dd>
                  {subtotal === null ? "Unavailable" : formatGhs(subtotal)}
                </dd>
              </div>
              <div>
                <dt>Delivery</dt>
                <dd>Confirmed on WhatsApp</dd>
              </div>
              <div className="bag-summary__grand-total">
                <dt>Total before delivery</dt>
                <dd>
                  {subtotal === null ? "Unavailable" : formatGhs(subtotal)}
                </dd>
              </div>
            </dl>
            <p>
              The delivery fee and final total will be confirmed with you on
              WhatsApp.
            </p>
            {!canProceed && (
              <p className="cart-item__issue" role="status">
                {blockMessage ??
                  "Update or remove unavailable sizes before checkout."}
              </p>
            )}
            <button
              className="button button--dark button--wide"
              type="button"
              onClick={onProceed}
              disabled={!canProceed}
            >
              Proceed to checkout
            </button>
          </aside>
        </div>
      )}
    </section>
  );
}
