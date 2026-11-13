import { useEffect, useRef } from "react";
import type { CatalogueProduct } from "../catalogue/catalogue.service";
import { trackStorefrontEvent } from "./analytics.service";

export function useTrackProductView(product: CatalogueProduct | undefined) {
  const sentProductId = useRef<string | null>(null);

  useEffect(() => {
    if (!product || sentProductId.current === product.id) {
      return;
    }

    sentProductId.current = product.id;
    trackStorefrontEvent({
      name: "product_view",
      productId: product.id,
      productName: product.name,
      price: product.price,
    });
  }, [product?.id]);
}
