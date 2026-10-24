const icon = {
  width: 28,
  height: 28,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  "aria-hidden": true,
} as const;

const benefits = [
  {
    title: "Several colours",
    text: "Pick your shade on every style",
    glyph: (
      <svg {...icon}>
        <circle cx="9" cy="12" r="6" />
        <circle cx="15" cy="12" r="6" />
      </svg>
    ),
  },
  {
    title: "Sizes for every fit",
    text: "Choose your size on each product",
    glyph: (
      <svg {...icon}>
        <path d="M3 15L15 3l6 6L9 21z" />
        <path d="M7 11l2 2M10 8l2 2M13 5l2 2" />
      </svg>
    ),
  },
  {
    title: "Cash on delivery",
    text: "Or arrange payment on WhatsApp",
    glyph: (
      <svg {...icon}>
        <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" />
        <circle cx="7" cy="17" r="1.6" />
        <circle cx="17" cy="17" r="1.6" />
      </svg>
    ),
  },
  {
    title: "Confirmed on WhatsApp",
    text: "We confirm your delivery with you",
    glyph: (
      <svg {...icon}>
        <path d="M4 5h16v11H9l-5 4z" />
      </svg>
    ),
  },
];

export function BenefitsStrip() {
  return (
    <section className="benefits" aria-label="Shopping with Manvelle">
      <ul className="benefits__list">
        {benefits.map((benefit) => (
          <li className="benefits__item" key={benefit.title}>
            {benefit.glyph}
            <div>
              <strong>{benefit.title}</strong>
              <span>{benefit.text}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
