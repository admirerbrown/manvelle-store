export const consentChangeEvent = "manvelle:analytics-consent-change";

const consentStorageKey = "manvelle.analytics.consent";
let inMemoryConsent: boolean | null = null;

declare global {
  interface Window {
    dataLayer?: unknown[] & { push(...items: unknown[]): number };
  }
}

export function getAnalyticsConsent(): boolean | null {
  try {
    const storedConsent = window.localStorage.getItem(consentStorageKey);
    if (storedConsent === "granted") return true;
    if (storedConsent === "denied") return false;
  } catch (cause) {
    console.error("Could not read the analytics consent preference.", cause);
  }
  return inMemoryConsent;
}

export function setAnalyticsConsent(consent: boolean): void {
  inMemoryConsent = consent;
  try {
    window.localStorage.setItem(
      consentStorageKey,
      consent ? "granted" : "denied",
    );
  } catch (cause) {
    console.error("Could not save the analytics consent preference.", cause);
  }

  syncGtmConsent(consent);
  window.dispatchEvent(new Event(consentChangeEvent));
}

export function initializeGoogleTagManager(): void {
  if (document.getElementById("manvelle-gtm-script")) return;
  const dataLayer = window.dataLayer ?? [];
  window.dataLayer = dataLayer;

  const containerId = import.meta.env.VITE_GTM_ID ?? "GTM-WHSN3754";
  if (!/^GTM-[A-Z0-9]+$/.test(containerId)) {
    throw new Error("The Google Tag Manager container ID is invalid.");
  }

  dataLayer.push([
    "consent",
    "default",
    getGtmConsentState(getAnalyticsConsent() ?? false),
  ]);
  dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });

  const script = document.createElement("script");
  script.id = "manvelle-gtm-script";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`;
  document.head.append(script);
}

function syncGtmConsent(consent: boolean): void {
  initializeGoogleTagManager();
  window.dataLayer?.push([
    "consent",
    "update",
    getGtmConsentState(consent),
  ]);
}

export function captureCheckoutAttribution(): {
  fbp: string | null;
  fbc: string | null;
  pageUrl: string;
  userAgent: string;
  metaConsent: boolean;
} {
  const metaConsent = getAnalyticsConsent() === true;
  return {
    fbp: metaConsent ? readCookie("_fbp") : null,
    fbc: metaConsent ? readCookie("_fbc") : null,
    pageUrl: `${window.location.origin}${window.location.pathname}`.slice(
      0,
      2048,
    ),
    userAgent: navigator.userAgent.slice(0, 1024),
    metaConsent,
  };
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const value = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix))
    ?.slice(prefix.length);

  if (!value) return null;
  try {
    return decodeURIComponent(value).slice(0, 250);
  } catch (cause) {
    console.error(`Could not decode the ${name} attribution cookie.`, cause);
    return null;
  }
}

function getGtmConsentState(consent: boolean) {
  return {
    ad_storage: consent ? "granted" : "denied",
    ad_user_data: consent ? "granted" : "denied",
    ad_personalization: consent ? "granted" : "denied",
    analytics_storage: consent ? "granted" : "denied",
  };
}
