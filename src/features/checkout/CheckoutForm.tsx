import { useRef, useState, type FormEvent } from "react";
import type {
  CatalogueDeliveryZone,
  CatalogueProduct,
} from "../catalogue/catalogue.service";
import type { CartLine } from "../cart/cart.types";
import {
  createGuestOrder,
  GuestOrderSubmissionError,
  type GuestOrderConfirmation,
  type GuestOrderInput,
} from "./checkout.service";
import { formatGhs } from "../../lib/format-currency";

type CheckoutFormProps = {
  cart: CartLine[];
  products: ReadonlyMap<string, CatalogueProduct>;
  deliveryZones: CatalogueDeliveryZone[];
  subtotal: number;
  onBack: () => void;
  onOrderCreated: (order: GuestOrderConfirmation) => void;
};

type OrderAttempt = {
  idempotencyKey: string;
  input: GuestOrderInput;
};

export function CheckoutForm({
  cart,
  products,
  deliveryZones,
  subtotal,
  onBack,
  onOrderCreated,
}: CheckoutFormProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryZoneId, setDeliveryZoneId] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retrySameSubmissionOnly, setRetrySameSubmissionOnly] = useState(false);
  const submissionInFlight = useRef(false);
  const orderAttempt = useRef<OrderAttempt | null>(null);

  const selectedZone = deliveryZones.find(
    (zone) => zone.id === deliveryZoneId,
  );
  const estimatedTotal =
    selectedZone === undefined ? null : subtotal + selectedZone.delivery_fee;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInFlight.current) {
      return;
    }

    if (!orderAttempt.current) {
      const trimmedName = customerName.trim();
      const trimmedAddress = deliveryAddress.trim();
      const normalizedPhoneDigits = customerPhone.replace(/\D/g, "");
      const validGhanaianPhone =
        /^0[235]\d{8}$/.test(normalizedPhoneDigits) ||
        /^233[235]\d{8}$/.test(normalizedPhoneDigits);

      if (cart.length === 0 || cart.length > 50 || !deliveryZoneId) {
        setErrorMessage("Add available sizes and choose a delivery area.");
        return;
      }
      if (trimmedName.length < 2 || trimmedName.length > 120) {
        setErrorMessage("Enter your name using 2 to 120 characters.");
        return;
      }
      if (!validGhanaianPhone) {
        setErrorMessage("Enter a valid Ghanaian phone number.");
        return;
      }
      if (trimmedAddress.length < 3 || trimmedAddress.length > 500) {
        setErrorMessage("Enter a delivery address using 3 to 500 characters.");
        return;
      }
      if (!deliveryZones.some((zone) => zone.id === deliveryZoneId)) {
        setErrorMessage(
          "Choose an available delivery area before completing your order.",
        );
        return;
      }
      if (typeof globalThis.crypto?.randomUUID !== "function") {
        setErrorMessage(
          "This browser cannot create a secure order submission key. Please use a current browser.",
        );
        return;
      }

      orderAttempt.current = {
        idempotencyKey: globalThis.crypto.randomUUID(),
        input: {
          customerName: trimmedName,
          customerPhone: customerPhone.trim(),
          deliveryZoneId,
          deliveryAddress: trimmedAddress,
          items: cart.map((item) => ({ ...item })),
        },
      };
    }

    submissionInFlight.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const order = await createGuestOrder(
        orderAttempt.current.idempotencyKey,
        orderAttempt.current.input,
      );
      orderAttempt.current = null;
      onOrderCreated(order);
    } catch (error: unknown) {
      if (
        error instanceof GuestOrderSubmissionError &&
        error.canEditOrder
      ) {
        orderAttempt.current = null;
        setRetrySameSubmissionOnly(false);
      } else {
        setRetrySameSubmissionOnly(true);
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We couldn't verify whether your order was received. Retry this same submission to check safely.",
      );
    } finally {
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  }

  const fieldsDisabled = isSubmitting || retrySameSubmissionOnly;

  return (
    <section className="checkout" aria-labelledby="checkout-heading">
      <button
        className="text-button checkout__back"
        type="button"
        onClick={onBack}
        disabled={isSubmitting || retrySameSubmissionOnly}
      >
        &lt;- Back to your bag
      </button>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Guest checkout</p>
          <h1 id="checkout-heading">Delivery details</h1>
        </div>
        <span className="checkout__payment">Cash on Delivery</span>
      </div>

      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={handleSubmit}>
          <p className="muted">
            No account needed. We only ask for the details required to deliver
            your order.
          </p>

          <div className="form-field">
            <label htmlFor="customer-name">Full name</label>
            <input
              id="customer-name"
              name="name"
              type="text"
              autoComplete="name"
              minLength={2}
              maxLength={120}
              required
              value={customerName}
              disabled={fieldsDisabled}
              onChange={(event) => setCustomerName(event.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="customer-phone">Ghana phone number</label>
            <input
              id="customer-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={24}
              placeholder="e.g. 024 123 4567"
              required
              value={customerPhone}
              disabled={fieldsDisabled}
              onChange={(event) => setCustomerPhone(event.target.value)}
              aria-describedby="phone-help"
            />
            <span className="field-help" id="phone-help">
              Include a Ghanaian mobile number so we can coordinate delivery.
            </span>
          </div>

          <div className="form-field">
            <label htmlFor="delivery-zone">Delivery area</label>
            <select
              id="delivery-zone"
              name="deliveryZone"
              required
              value={deliveryZoneId}
              disabled={fieldsDisabled || deliveryZones.length === 0}
              onChange={(event) => setDeliveryZoneId(event.target.value)}
            >
              <option value="">Choose a delivery area</option>
              {deliveryZones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name} - {formatGhs(zone.delivery_fee)}
                </option>
              ))}
            </select>
            {deliveryZones.length === 0 && (
              <span className="field-help">
                No delivery areas are available. Please try again later.
              </span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="delivery-address">Delivery address</label>
            <textarea
              id="delivery-address"
              name="address"
              autoComplete="street-address"
              minLength={3}
              maxLength={500}
              rows={3}
              required
              value={deliveryAddress}
              disabled={fieldsDisabled}
              onChange={(event) => setDeliveryAddress(event.target.value)}
              aria-describedby="address-help"
            />
            <span className="field-help" id="address-help">
              Add the street, landmark, or directions needed to find you.
            </span>
          </div>

          {errorMessage && (
            <div className="error-panel" role="alert">
              <p>{errorMessage}</p>
              {retrySameSubmissionOnly && (
                <p>
                  Your details are held for this page only. Retry uses the same
                  safe order key and will not create a duplicate.
                </p>
              )}
            </div>
          )}

          <button
            className="button button--dark button--wide"
            type="submit"
            disabled={
              isSubmitting ||
              (!retrySameSubmissionOnly && deliveryZones.length === 0)
            }
          >
            {isSubmitting
              ? "Submitting order..."
              : retrySameSubmissionOnly
                ? "Retry same submission"
                : "Complete order"}
          </button>
          <p className="checkout-form__privacy">
            Your details are used to place and deliver this order. Card details
            are never requested.
          </p>
        </form>

        <aside className="checkout-summary" aria-labelledby="summary-heading">
          <h2 id="summary-heading">Order summary</h2>
          <ul className="checkout-summary__items">
            {cart.map((item) => {
              const product = products.get(item.productId);
              const variant = product?.variants.find(
                (candidate) => candidate.id === item.variantId,
              );

              return (
                <li key={item.variantId}>
                  <span>
                    {product?.name ?? "Product"} -{" "}
                    {variant?.size ?? "Size"} x{" "}
                    {item.quantity}
                  </span>
                  <strong>
                    {product
                      ? formatGhs(product.price * item.quantity)
                      : "Unavailable"}
                  </strong>
                </li>
              );
            })}
          </ul>
          <dl className="checkout-summary__totals">
            <div>
              <dt>Subtotal estimate</dt>
              <dd>{formatGhs(subtotal)}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>
                {selectedZone
                  ? formatGhs(selectedZone.delivery_fee)
                  : "Choose an area"}
              </dd>
            </div>
            <div className="checkout-summary__grand-total">
              <dt>Estimated total</dt>
              <dd>
                {estimatedTotal === null
                  ? "-"
                  : formatGhs(estimatedTotal)}
              </dd>
            </div>
          </dl>
          <p>
            Final prices, stock, delivery fee, and total are recalculated by the
            database when you place your order.
          </p>
        </aside>
      </div>
    </section>
  );
}
