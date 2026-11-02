import { Link } from "react-router-dom";
import { paths } from "./routes";

const whatsappUrl = `https://wa.me/${
  import.meta.env.VITE_WHATSAPP_NUMBER ?? "233209123895"
}`;
const facebookUrl =
  import.meta.env.VITE_FACEBOOK_URL ??
  "https://web.facebook.com/p/Manvelle-Menswear-61589687605375/";

export function StoreFooter() {
  return (
    <>
      <section
        className="store-footer__faq"
        id="faqs"
        aria-labelledby="faq-heading"
      >
        <div>
          <p className="eyebrow">Need to know</p>
          <h2 id="faq-heading">Frequently asked questions</h2>
        </div>
        <div className="store-footer__faq-list">
          <details>
            <summary>How do I place an order?</summary>
            <p>
              Add your preferred size to the bag, enter your delivery details,
              and submit your order. We will confirm the details with you on
              WhatsApp.
            </p>
          </details>
          <details id="delivery" open>
            <summary>How does delivery work?</summary>
            <p>
              Cash on delivery is available in Accra. For locations outside
              Accra, we confirm delivery and arrange payment before delivery on
              WhatsApp.
            </p>
          </details>
          <details>
            <summary>How do I choose the right size?</summary>
            <p>
              Open a product to see its available sizes, then choose the fit
              that works best for you before adding it to your bag.
            </p>
          </details>
          <details>
            <summary>Can I change or cancel my order?</summary>
            <p>
              Message us on WhatsApp as soon as possible with your order
              number. We will do our best to help before your order is
              dispatched.
            </p>
          </details>
        </div>
      </section>

      <footer className="store-footer">
        <div className="store-footer__intro" id="about">
          <p className="eyebrow">Manvelle Menswear</p>
          <h2>
            Good clothes,
            <br />
            made easy.
          </h2>
          <p>
            Everyday menswear for Ghana, selected with intention and delivered
            with a personal touch.
          </p>
          <a
            className="store-footer__contact"
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
          >
            Chat with us on WhatsApp <span aria-hidden="true">↗</span>
          </a>
        </div>

        <div className="store-footer__columns">
          <div className="store-footer__column">
            <h3>Shop</h3>
            <Link to={paths.home}>All styles</Link>
            <Link to={paths.collection("pants")}>Pants &amp; shorts</Link>
            <Link to={paths.collection("tops")}>Tops</Link>
            <Link to={paths.collection("mens-underwear")}>
              Menswear essentials
            </Link>
          </div>
          <div className="store-footer__column">
            <h3>Help</h3>
            <a href="#faqs">FAQs</a>
            <a href="#delivery">Delivery &amp; payment</a>
            <a href="#contact">Contact us</a>
            <a href="#about">About Manvelle</a>
          </div>
          <div className="store-footer__column">
            <h3>Find us</h3>
            <p id="location">Accra-Tudu, Ghana</p>
            <div
              className="store-footer__socials"
              id="contact"
              aria-label="Follow Manvelle"
            >
              <a
                href={facebookUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Manvelle on Facebook"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M14 8h3V4h-3c-3.1 0-5 1.9-5 5v3H6v4h3v8h4v-8h3.3l.7-4H13V9c0-.7.3-1 1-1Z" />
                </svg>
                Facebook
              </a>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Manvelle on WhatsApp"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M12 3a8.8 8.8 0 0 0-7.6 13.2L3 21l4.9-1.3A8.8 8.8 0 1 0 12 3Zm0 15.9a7 7 0 0 1-3.6-1l-.3-.2.8-2.8-.2-.3A7 7 0 1 1 12 18.9Zm3.8-5.2c-.2-.1-1.2-.6-1.4-.7-.2-.1-.3-.1-.5.1l-.6.7c-.1.2-.3.2-.5.1a5.8 5.8 0 0 1-1.7-1.1 6.5 6.5 0 0 1-1.2-1.5c-.1-.2 0-.3.1-.4l.4-.5c.1-.1.1-.2.2-.4v-.3c-.1-.1-.5-1.2-.7-1.6-.2-.4-.4-.3-.5-.3h-.4c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.3c.1.1 1.5 2.4 3.7 3.3.5.2.9.3 1.2.4.5.2 1 .1 1.4.1.4-.1 1.2-.5 1.3-1 .2-.5.2-1 .1-1.1-.2-.1-.4-.2-.6-.3Z" />
                </svg>
                WhatsApp
              </a>
            </div>
          </div>
        </div>

        <div className="store-footer__bottom">
          <span>© {new Date().getFullYear()} Manvelle Menswear Ghana</span>
          <span>Guest checkout · Delivery confirmed on WhatsApp</span>
          <a href="#location">Accra, Ghana ↑</a>
        </div>
      </footer>
    </>
  );
}
