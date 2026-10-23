# How product images are found

The `catalog/` folder is the source of truth for product photos:

```
catalog/<category>/<subcategory>/<product-folder>/<colour>.jpeg

catalog/pants/office/beltless-trouser/
    beige.jpeg  black.jpeg  brown.jpeg  coffee.jpeg  grey.jpeg  light-brown.jpeg  wine.jpeg
```

* The product row in `catalog/products.csv` gives the **category** (`pants/office`).
* The **product folder** is the product's slug (`beltless-material-trousers`) or a folder
  made of the same words (`beltless-trouser`, `khakie`). Matching lives in one place,
  `src/lib/catalog-folder.js`, and is used by both the storefront and the importer.
  If a folder name matches two products equally, it matches neither (an image can never
  land under the wrong product).
* **Every file in that folder becomes one colour option** for that product. The file name is
  the colour name (`light-brown.jpeg` -> "Light Brown").
* The storefront builds a product's images from its folder only. Database `product_images`
  rows are not used for products that have a folder, so stale, partial or mis-mapped rows
  can no longer break an image or hide a colour. Rows are only a fallback for products with
  no folder (for example the `local-fixtures/` seed data).

## Adding or changing images

1. Drop `<colour>.jpeg` files into the product's folder.
2. `npm run catalog:validate` lists each product, its folder and its colours, and warns about
   folders no product points at.
3. (Optional, for Supabase Storage) `npm run catalog:sync` uploads to
   `products/<category>/<product-folder>/<file>` — the same path as the local directory —
   and deactivates image rows for files that no longer exist. Set `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` in `.env.catalog.local` first (never commit it).
