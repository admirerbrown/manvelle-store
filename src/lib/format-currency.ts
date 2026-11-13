const ghanaCediFormatter = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
});

export function formatGhs(amount: number): string {
  return ghanaCediFormatter.format(amount);
}
