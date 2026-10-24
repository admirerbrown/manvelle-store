import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { HeroSlide } from "./categories";

const slideDurationMs = 6000;

type HeroCarouselProps = {
  slides: HeroSlide[];
};

/**
 * Hero banner. With several slides (home page) it rotates through them, the text and
 * the photo changing together. With one slide (a category page) it is a plain banner.
 * Rotation pauses while the pointer or keyboard focus is on the hero, and is off for
 * visitors who prefer reduced motion.
 */
export function HeroCarousel({ slides }: HeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const [interacting, setInteracting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const count = slides.length;
  const slideKey = slides.map((slide) => slide.id).join("|");
  const activeIndex = count === 0 ? 0 : index % count;
  const playing = count > 1 && !interacting && !reducedMotion;

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) {
      return;
    }
    setReducedMotion(query.matches);
    const onChange = () => setReducedMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    setIndex(0);
  }, [slideKey]);

  useEffect(() => {
    if (!playing) {
      return;
    }
    const intervalId = window.setInterval(
      () => setIndex((current) => (current + 1) % count),
      slideDurationMs,
    );
    return () => window.clearInterval(intervalId);
  }, [playing, count, activeIndex]);

  if (count === 0) {
    return null;
  }

  return (
    <section
      className="home-hero"
      aria-roledescription={count > 1 ? "carousel" : undefined}
      aria-label={count > 1 ? "Featured categories" : undefined}
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocus={() => setInteracting(true)}
      onBlur={() => setInteracting(false)}
    >
      <div
        className="home-hero__viewport"
        aria-live={playing ? "off" : "polite"}
      >
        {slides.map((slide, slideIndex) => {
          const isActive = slideIndex === activeIndex;
          return (
            <div
              key={slide.id}
              className={`home-hero__slide${isActive ? " is-active" : ""}`}
              role={count > 1 ? "group" : undefined}
              aria-roledescription={count > 1 ? "slide" : undefined}
              aria-label={count > 1 ? `${slideIndex + 1} of ${count}` : undefined}
              aria-hidden={isActive ? undefined : true}
              inert={!isActive}
            >
              <div className="home-hero__copy">
                <p className="home-hero__eyebrow">{slide.eyebrow}</p>
                <h1>{slide.headline}</h1>
                {slide.text && <p className="home-hero__text">{slide.text}</p>}
                <Link className="home-hero__cta" to={slide.ctaTo}>
                  {slide.ctaLabel}
                </Link>
              </div>
              <div
                className={`home-hero__media${
                  slide.images.length > 1 ? " home-hero__media--duo" : ""
                }`}
              >
                {slide.images.map((image) => (
                  <img key={image.src} src={image.src} alt={image.alt} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {count > 1 && (
        <div className="home-hero__controls">
          <div className="home-hero__dots">
            {slides.map((slide, slideIndex) => (
              <button
                key={slide.id}
                type="button"
                className={`home-hero__dot${
                  slideIndex === activeIndex ? " is-active" : ""
                }`}
                aria-label={`Show ${slide.eyebrow}`}
                aria-current={slideIndex === activeIndex ? "true" : undefined}
                onClick={() => setIndex(slideIndex)}
              >
                <span />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
