type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  category: string | null;
  active: boolean;
  featured: boolean;
  created_at: string;
  updated_at: string;
};

type ProductVariantRow = {
  id: string;
  product_id: string;
  size: string;
  sort_order: number;
  sku: string | null;
  stock_quantity: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type ProductImageRow = {
  id: string;
  product_id: string;
  storage_path: string;
  alt_text: string;
  sort_order: number;
  active: boolean;
  created_at: string;
};

type DeliveryZoneRow = {
  id: string;
  code: string;
  name: string;
  delivery_fee: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      products: Table<
        ProductRow,
        Omit<ProductRow, "id" | "created_at" | "updated_at"> &
          Partial<Pick<ProductRow, "id" | "created_at" | "updated_at">>,
        Partial<ProductRow>
      >;
      product_variants: Table<
        ProductVariantRow,
        Omit<ProductVariantRow, "id" | "created_at" | "updated_at"> &
          Partial<
            Pick<ProductVariantRow, "id" | "created_at" | "updated_at">
          >,
        Partial<ProductVariantRow>
      >;
      product_images: Table<
        ProductImageRow,
        Omit<ProductImageRow, "id" | "created_at"> &
          Partial<Pick<ProductImageRow, "id" | "created_at">>,
        Partial<ProductImageRow>
      >;
      delivery_zones: Table<
        DeliveryZoneRow,
        Omit<DeliveryZoneRow, "id" | "created_at" | "updated_at"> &
          Partial<Pick<DeliveryZoneRow, "id" | "created_at" | "updated_at">>,
        Partial<DeliveryZoneRow>
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      create_guest_order: {
        Args: {
          p_idempotency_key: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_delivery_zone_id: string;
          p_delivery_address: string;
          p_items: Json;
        };
        Returns: Json;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
