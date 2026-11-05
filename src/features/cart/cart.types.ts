export type CartLine = {
  productId: string;
  variantId: string;
  imageId: string | null;
  colorName?: string;
  quantity: number;
};

export function getCartLineKey(item: Pick<CartLine, "variantId" | "imageId">) {
  return `${item.variantId}:${item.imageId ?? ""}`;
}
