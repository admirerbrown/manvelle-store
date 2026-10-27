import { useRef, useState, type FormEvent } from "react";
import type { CatalogueProduct } from "../catalogue/catalogue.service";
import type { CartLine } from "../cart/cart.types";
import { getCartLineKey } from "../cart/cart.types";
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
  subtotal: number;
  onBack: () => void;
  onOrderCreated: (
    order: GuestOrderConfirmation,
    submittedItems: CartLine[],
  ) => void;
};

type OrderAttempt = {
  idempotencyKey: string;
  input: GuestOrderInput;
};

export function CheckoutForm({
  cart,
  products,
  subtotal,
  onBack,
  onOrderCreated,
}: CheckoutFormProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryArea, setDeliveryArea] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [isAccra, setIsAccra] = useState<boolean | null>(null);
  const [acceptsAdvancePayment, setAcceptsAdvancePayment] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retrySameSubmissionOnly, setRetrySameSubmissionOnly] = useState(false);
  const submissionInFlight = useRef(false);
  const orderAttempt = useRef<OrderAttempt | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInFlight.current) {
      return;
    }

    if (!orderAttempt.current) {
      const trimmedName = customerName.trim();
      const trimmedArea = deliveryArea.trim();
      const trimmedAddress = deliveryAddress.trim();
      const normalizedPhoneDigits = customerPhone.replace(/\D/g, "");
      const validGhanaianPhone =
        /^0[235]\d{8}$/.test(normalizedPhoneDigits) ||
        /^233[235]\d{8}$/.test(normalizedPhoneDigits);

      if (cart.length === 0 || cart.length > 50) {
        setErrorMessage("Add available sizes before placing your order.");
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
      if (isAccra === null) {
        setErrorMessage("Please tell us whether you are located in Accra.");
        return;
      }
      if (
        trimmedArea.length < (isAccra ? 2 : 3) ||
        trimmedArea.length > 120
      ) {
        setErrorMessage(
          isAccra
            ? "Enter your Accra neighbourhood using 2 to 120 characters."
            : "Enter your city using 3 to 120 characters.",
        );
        return;
      }
      if (
        isAccra &&
        (trimmedAddress.length < 3 || trimmedAddress.length > 500)
      ) {
        setErrorMessage("Enter a delivery address using 3 to 500 characters.");
        return;
      }
      if (!isAccra && !acceptsAdvancePayment) {
        setErrorMessage(
          "Please confirm that you agree to arrange payment on WhatsApp before delivery.",
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
          deliveryArea: trimmedArea,
          deliveryAddress: isAccra ? trimmedAddress : trimmedArea,
          isAccra,
          acceptsAdvancePayment: !isAccra && acceptsAdvancePayment,
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
      const submittedItems = orderAttempt.current.input.items;
      orderAttempt.current = null;
      onOrderCreated(order, submittedItems);
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
        ← Back to your bag
      </button>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Guest checkout</p>
          <h1 id="checkout-heading">Delivery details</h1>
        </div>
        <span className="checkout__payment">
          {isAccra === null
            ? "Choose your delivery location"
            : isAccra
              ? "Cash on Delivery"
              : "Payment before delivery via WhatsApp"}
        </span>
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
            <fieldset className="checkout-location">
              <legend>Are you located in Accra?</legend>
              <div className="checkout-location__options">
                <label>
                  <input
                    type="radio"
                    name="isAccra"
                    value="yes"
                    required
                    checked={isAccra === true}
                    disabled={fieldsDisabled}
                    onChange={() => {
                      setIsAccra(true);
                      setAcceptsAdvancePayment(false);
                    }}
                  />
                  Yes
                </label>
                <label>
                  <input
                    type="radio"
                    name="isAccra"
                    value="no"
                    required
                    checked={isAccra === false}
                    disabled={fieldsDisabled}
                    onChange={() => setIsAccra(false)}
                  />
                  No
                </label>
              </div>
              <span className="field-help">
                Cash on Delivery is available within Accra. Outside Accra,
                payment must be arranged on WhatsApp before delivery.
              </span>
            </fieldset>
          </div>

          {isAccra === false && (
            <label className="checkout-payment-acknowledgement">
              <input
                type="checkbox"
                required
                checked={acceptsAdvancePayment}
                disabled={fieldsDisabled}
                onChange={(event) =>
                  setAcceptsAdvancePayment(event.target.checked)
                }
              />
              <span>
                I agree to arrange payment on WhatsApp before my order is
                delivered.
              </span>
            </label>
          )}

          {isAccra !== null && (
            <>
              <div className="form-field">
                <label htmlFor="delivery-area">
                  {isAccra ? "Area / neighbourhood in Accra" : "City"}
                </label>
                <input
                  id="delivery-area"
                  name="deliveryArea"
                  type="text"
                  autoComplete="address-level2"
                  minLength={isAccra ? 2 : 3}
                  maxLength={120}
                  required
                  placeholder={
                    isAccra
                      ? "e.g. Osu, Madina, East Legon"
                      : "e.g. Tamale, Kumasi"
                  }
                  value={deliveryArea}
                  disabled={fieldsDisabled}
                  onChange={(event) => setDeliveryArea(event.target.value)}
                  aria-describedby="delivery-area-help"
                />
                <span className="field-help" id="delivery-area-help">
                  We’ll confirm the delivery fee with you on WhatsApp.
                </span>
              </div>

              {isAccra && (
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
              )}
            </>
          )}

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
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Submitting order..."
              : retrySameSubmissionOnly
                ? "Retry same submission"
                : "Complete order"}
          </button>
          <p className="checkout-form__privacy">
            Your details are used to place and deliver this order. Any
            pre-delivery payment for addresses outside Accra will be arranged
            with you on WhatsApp.
          </p>
        </form>

        <aside className="checkout-summary" aria-labelledby="summary-heading">
          <div className="checkout-summary__display">
            <h2 id="summary-heading">Order summary</h2>
            <ul className="checkout-summary__items">
              {cart.map((item) => {
                const product = products.get(item.productId);
                const variant = product?.variants.find(
                  (candidate) => candidate.id === item.variantId,
                );
                const colorImage =
                  product && item.imageId
                    ? product.images.find((image) => image.id === item.imageId)
                    : undefined;
                const thumb = colorImage ?? product?.images[0];
                const meta = [
                  `Size ${variant?.size ?? "-"}`,
                  `Qty ${item.quantity}`,
                  colorImage?.colorName,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <li key={getCartLineKey(item)}>
                    {thumb && (
                      <img
                        className="checkout-summary__thumb"
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
                    )}
                    <div className="checkout-summary__info">
                      <p className="checkout-summary__name">
                        {product?.name ?? "Product"}
                      </p>
                      <p className="checkout-summary__meta">{meta}</p>
                    </div>
                    <strong>
                      {product
                        ? formatGhs(product.price * item.quantity)
                        : "Unavailable"}
                    </strong>
                  </li>
                );
              })}
            </ul>
            <p className="checkout-summary__note">
              Your delivery fee and final total will be confirmed with you on
              WhatsApp. Final prices and stock are verified when your order is
              placed.
            </p>
          </div>
          <div className="checkout-summary__footer">
            <dl className="checkout-summary__totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatGhs(subtotal)}</dd>
              </div>
              <div>
                <dt>Delivery</dt>
                <dd>Confirmed on WhatsApp</dd>
              </div>
              <div className="checkout-summary__grand-total">
                <dt>Total before delivery</dt>
                <dd>{formatGhs(subtotal)}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </section>
  );
}
