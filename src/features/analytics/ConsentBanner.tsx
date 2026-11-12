import { useEffect, useState } from "react";
import {
  consentChangeEvent,
  getAnalyticsConsent,
  setAnalyticsConsent,
  syncGtmConsent,
} from "./consent";
import "./consent.css";

export function ConsentBanner() {
  const [consent, setConsent] = useState<boolean | null>(
    getAnalyticsConsent,
  );
  const [isOpen, setIsOpen] = useState(consent === null);

  useEffect(() => {
    const syncConsent = () => {
      const currentConsent = getAnalyticsConsent();
      setConsent(currentConsent);
      setIsOpen(currentConsent === null);
      if (currentConsent !== null) {
        syncGtmConsent(currentConsent);
      }
    };

    window.addEventListener(consentChangeEvent, syncConsent);
    if (consent !== null) {
      syncGtmConsent(consent);
    }
    return () => window.removeEventListener(consentChangeEvent, syncConsent);
  }, []);

  function chooseConsent(nextConsent: boolean) {
    setAnalyticsConsent(nextConsent);
    setConsent(nextConsent);
    setIsOpen(false);
  }

  return (
    <aside className="consent" aria-label="Privacy choices">
      {isOpen ? (
        <section
          className="consent__panel"
          role="dialog"
          aria-labelledby="consent-heading"
          aria-describedby="consent-description"
        >
          <div className="consent__copy">
            <p className="consent__eyebrow">Your privacy</p>
            <h2 id="consent-heading">Your visit, your choice.</h2>
            <p id="consent-description">
              Allow optional analytics and advertising cookies to help us
              understand visits and measure campaigns. Your order works either
              way.
            </p>
          </div>
          <div className="consent__actions">
            <button
              className="consent__button consent__button--quiet"
              type="button"
              onClick={() => chooseConsent(false)}
            >
              Reject optional
            </button>
            <button
              className="consent__button consent__button--accept"
              type="button"
              onClick={() => chooseConsent(true)}
            >
              Allow optional
            </button>
          </div>
        </section>
      ) : (
        <button
          className="consent__settings"
          type="button"
          onClick={() => setIsOpen(true)}
        >
          Privacy choices · {consent ? "allowed" : "rejected"}
        </button>
      )}
    </aside>
  );
}
