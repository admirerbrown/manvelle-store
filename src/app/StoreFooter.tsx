import { Link } from "react-router-dom";
import categoryData from "../../catalog/category.json";
import { paths } from "./routes";
import "./StoreFooter.css";

const whatsappUrl = `https://wa.me/${
  import.meta.env.VITE_WHATSAPP_NUMBER ?? "233209123895"
}`;
const facebookUrl =
  import.meta.env.VITE_FACEBOOK_URL ??
  "https://web.facebook.com/p/Manvelle-Menswear-61589687605375/";

export function StoreFooter() {
  return (
    <footer className="site-footer" id="about">
      <div className="site-footer__grid">
        <div className="site-footer__brand">
          <p className="site-footer__logo">MANVELLE</p>
          <p className="site-footer__tagline">
            Everyday menswear for Ghana, selected with intention and delivered
            with a personal touch.
          </p>
          <a
            className="site-footer__cta"
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
          >
            Chat with us on WhatsApp <span aria-hidden="true">↗</span>
          </a>
        </div>

        <nav className="site-footer__column" aria-label="Shop">
          <h3>Shop</h3>
          <Link to={paths.home}>All styles</Link>
          {categoryData.categories.map((category) => (
            <Link key={category.id} to={paths.collection(category.id)}>
              {category.name}
            </Link>
          ))}
        </nav>

        <nav className="site-footer__column" aria-label="Help">
          <h3>Help</h3>
          <Link to={paths.faq}>FAQs</Link>
          <Link to={`${paths.faq}#delivery`}>Delivery &amp; payment</Link>
          <Link to={paths.contact}>Contact us</Link>
        </nav>

        <div className="site-footer__column site-footer__find-us">
          <h3>Find us</h3>
          <p>Accra-Tudu, Ghana</p>
          <div className="site-footer__socials">
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
          </div>
        </div>
      </div>

      <div className="site-footer__bottom">
        <span>© {new Date().getFullYear()} Manvelle Menswear Ghana</span>
        <span>Guest checkout · Delivery confirmed on WhatsApp</span>
      </div>
    </footer>
  );
}
