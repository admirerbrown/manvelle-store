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
  key_features: string;
  price: number;
  category: string | null;
  availability: "in-stock" | "out-of-stock";
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
  stock_quantity: number | null;
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

type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  notes: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  order_status: "pending" | "confirmed" | "out_for_delivery" | "delivered" | "completed" | "cancelled" | "failed_delivery";
  created_at: string;
  updated_at: string;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name_snapshot: string;
  size_snapshot: string;
  unit_price: number;
  quantity: number;
  line_subtotal: number;
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
      orders: Table<
        OrderRow,
        Omit<OrderRow, "id" | "created_at" | "updated_at"> &
          Partial<Pick<OrderRow, "id" | "created_at" | "updated_at">>,
        Partial<OrderRow>
      >;
      order_items: Table<
        OrderItemRow,
        Omit<OrderItemRow, "id"> & Partial<Pick<OrderItemRow, "id">>,
        Partial<OrderItemRow>
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      track_storefront_event: {
        Args: {
          p_event_name: string;
          p_session_id: string;
          p_product_id?: string | null;
          p_variant_id?: string | null;
          p_quantity?: number | null;
          p_order_number?: string | null;
          p_page?: string | null;
        };
        Returns: undefined;
      };
      create_guest_order: {
        Args: {
          p_idempotency_key: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_delivery_area: string;
          p_delivery_address: string;
          p_is_accra: boolean;
          p_accepts_advance_payment: boolean;
          p_items: Json;
        };
        Returns: Json;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
