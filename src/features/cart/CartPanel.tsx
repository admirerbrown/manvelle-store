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
  return (
    <section className="cart-panel" aria-labelledby="cart-heading" id="bag">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Your selection</p>
          <h2 id="cart-heading">Your bag</h2>
        </div>
        <span className="muted">
          {items.length} {items.length === 1 ? "size" : "sizes"}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="cart-empty">
          Your bag is empty. Choose a size from the collection to get started.
        </p>
      ) : (
        <>
          <ul className="cart-list">
            {items.map(({ item, product, variant, availabilityIssue }) => (
              <li className="cart-item" key={getCartLineKey(item)}>
                <div className="cart-item__details">
                  <h3>{product?.name ?? "Unavailable product"}</h3>
                  <p>
                    Size: {variant?.size ?? "Unavailable"}
                    {product &&
                      item.imageId &&
                      ` - Color: ${
                        product.images.find(
                          (image) => image.id === item.imageId,
                        )?.colorName ?? "Unavailable"
                      }`}
                    {product && ` - ${formatGhs(product.price)} each`}
                  </p>
                  {availabilityIssue && (
                    <p className="cart-item__issue">{availabilityIssue}</p>
                  )}
                </div>
                <div className="cart-item__controls">
                  <label
                    className="visually-hidden"
                    htmlFor={`quantity-${getCartLineKey(item)}`}
                  >
                    Quantity for {product?.name ?? "unavailable product"}
                  </label>
                  <input
                    id={`quantity-${getCartLineKey(item)}`}
                    aria-label={`Quantity for ${
                      product?.name ?? "unavailable product"
                    }`}
                    type="number"
                    min={1}
                    max={variant?.stock_quantity ?? undefined}
                    step={1}
                    value={item.quantity}
                    disabled={
                      !variant ||
                      !product ||
                      !isVariantInStock(product, variant)
                    }
                    onChange={(event) => {
                      const quantity = Number.parseInt(
                        event.currentTarget.value,
                        10,
                      );
                      if (
                        Number.isInteger(quantity) &&
                        quantity >= 1 &&
                        variant &&
                        (variant.stock_quantity === null ||
                          quantity <= variant.stock_quantity)
                      ) {
                        onQuantityChange(getCartLineKey(item), quantity);
                      }
                    }}
                  />
                  {product && (
                    <strong>
                      {formatGhs(product.price * item.quantity)}
                    </strong>
                  )}
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => onRemoveItem(getCartLineKey(item))}
                    aria-label={`Remove ${
                      product?.name ?? "unavailable product"
                    } from your bag`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="cart-summary">
            <div>
              <span>Subtotal estimate</span>
              <strong>
                {subtotal === null ? "Unavailable" : formatGhs(subtotal)}
              </strong>
            </div>
            <p>
              The delivery fee and final total will be confirmed with you on
              WhatsApp.
            </p>
          </div>

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
        </>
      )}
    </section>
  );
}
