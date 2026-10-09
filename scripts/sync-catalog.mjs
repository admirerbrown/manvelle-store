import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(projectRoot, "catalog", "products.csv");
const imageRoot = path.join(projectRoot, "catalog");
const bucketName = "product-images";
const imageDirectoryAliases = new Map([
  ["khakie-trousers", "khakie"],
  ["beltless-material-trousers", "beltless-trouser"],
]);

function fail(message) {
  throw new Error(message);
}

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.trim())) {
        rows.push(row);
      }
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) {
    fail("The product spreadsheet contains an unterminated quoted field.");
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    if (row.some((value) => value.trim())) {
      rows.push(row);
    }
  }
  return rows;
}

function slugify(name) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseProducts(csv) {
  const rows = parseCsv(csv);
  const headers = rows.shift();
  const expectedHeaders = [
    "name",
    "description",
    "key_features",
    "available_sizes",
    "availability",
    "price",
  ];

  if (
    !headers ||
    headers.length !== expectedHeaders.length ||
    headers.some((header, index) => header.trim() !== expectedHeaders[index])
  ) {
    fail(`Spreadsheet columns must be: ${expectedHeaders.join(", ")}.`);
  }

  const slugs = new Set();
  return rows.map((values, index) => {
    const line = index + 2;
    if (values.length !== expectedHeaders.length) {
      fail(`Spreadsheet row ${line} has ${values.length} columns; expected 6.`);
    }

    const [name, description, keyFeatures, sizesValue, availability, priceValue] =
      values.map((value) => value.trim());
    const slug = slugify(name);
    const sizes = sizesValue
      .split("|")
      .map((size) => size.trim())
      .filter(Boolean);
    const price = Number(priceValue);

    if (!name || !description || !slug || !keyFeatures) {
      fail(`Spreadsheet row ${line} must include a name, description, and key features.`);
    }
    if (slugs.has(slug)) {
      fail(`Spreadsheet row ${line} repeats product name "${name}".`);
    }
    slugs.add(slug);
    if (sizes.length < 4 || new Set(sizes).size !== sizes.length) {
      fail(`Spreadsheet row ${line} must have at least four unique sizes separated by "|".`);
    }
    if (!["in-stock", "out-of-stock"].includes(availability)) {
      fail(`Spreadsheet row ${line} availability must be "in-stock" or "out-of-stock".`);
    }
    if (!Number.isFinite(price) || price < 0) {
      fail(`Spreadsheet row ${line} must have a non-negative numeric price in GHS.`);
    }

    return {
      name,
      slug,
      description,
      keyFeatures,
      sizes,
      availability,
      price,
    };
  });
}

async function findImageDirectory(slug) {
  const expectedName = imageDirectoryAliases.get(slug) ?? slug;
  const directories = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const entryPath = path.join(directory, entry.name);
        directories.push(entryPath);
        await visit(entryPath);
      }
    }
  }

  await visit(imageRoot);
  const matches = directories.filter(
    (directory) => path.basename(directory) === expectedName,
  );
  if (matches.length !== 1) {
    fail(
      `Expected one image folder named "${expectedName}" for ${slug}; found ${matches.length}.`,
    );
  }

  return matches[0];
}

async function getImageInfo(filePath, folder) {
  const bytes = await readFile(filePath);
  let extension;
  let contentType;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    extension = ".jpeg";
    contentType = "image/jpeg";
  } else if (
    bytes[0] === 0x89 &&
    bytes.subarray(1, 4).toString("ascii") === "PNG"
  ) {
    extension = ".png";
    contentType = "image/png";
  } else if (bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP") {
    extension = ".webp";
    contentType = "image/webp";
  } else {
    fail(`Unsupported or invalid product image: ${path.relative(projectRoot, filePath)}.`);
  }

  const relativeName = path
    .relative(folder, filePath)
    .split(path.sep)
    .join("/");
  const parsedName = path.parse(relativeName);
  const fileName =
    parsedName.ext.length > 0 ? relativeName : `${relativeName}${extension}`;

  return { bytes, contentType, fileName };
}

async function listImages(folder) {
  const images = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (entry.isFile()) {
        images.push(await getImageInfo(entryPath, folder));
      }
    }
  }

  await visit(folder);
  images.sort((first, second) =>
    first.fileName.localeCompare(second.fileName, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
  if (images.length === 0) {
    fail(`No images found in ${path.relative(projectRoot, folder)}.`);
  }
  return images;
}

function loadCatalogEnvironment() {
  const envPath = path.join(projectRoot, ".env.catalog.local");
  return readFile(envPath, "utf8")
    .catch((error) => {
      if (error.code === "ENOENT") {
        return "";
      }
      throw error;
    })
    .then((contents) => {
      for (const line of contents.split(/\r?\n/)) {
        const match = line.match(/^\s*(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)\s*=\s*(.*?)\s*$/);
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
        }
      }
    });
}

async function validateCatalog(products) {
  for (const product of products) {
    const folder = await findImageDirectory(product.slug);
    const images = await listImages(folder);
    console.log(
      `${product.name}: ${product.sizes.length} sizes, ${product.availability}, ` +
        `${images.length} images (${path.relative(projectRoot, folder)})`,
    );
  }
}

async function syncCatalog(products) {
  await loadCatalogEnvironment();
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    fail("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.catalog.local or the environment.");
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: buckets, error: bucketsError } = await client.storage.listBuckets();
  if (bucketsError) {
    throw new Error("Could not check Supabase Storage buckets.", { cause: bucketsError });
  }
  let imageBucket = buckets.find((bucket) => bucket.name === bucketName);
  if (!imageBucket) {
    const { data, error } = await client.storage.createBucket(bucketName, {
      public: true,
    });
    if (error) {
      throw new Error(`Could not create the public ${bucketName} bucket.`, {
        cause: error,
      });
    }
    imageBucket = data;
  }
  if (!imageBucket.public) {
    const { data, error } = await client.storage.updateBucket(bucketName, {
      public: true,
    });
    if (error) {
      throw new Error(`Could not make the ${bucketName} bucket public.`, {
        cause: error,
      });
    }
    imageBucket = data;
  }

  for (const product of products) {
    const folder = await findImageDirectory(product.slug);
    const images = await listImages(folder);
    const { data: savedProduct, error: productError } = await client
      .from("products")
      .upsert(
        {
          name: product.name,
          slug: product.slug,
          description: product.description,
          key_features: product.keyFeatures,
          price: product.price,
          category: null,
          availability: product.availability,
          active: true,
          featured: false,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (productError) {
      throw new Error(`Could not save ${product.name}.`, { cause: productError });
    }

    const { error: deactivateVariantsError } = await client
      .from("product_variants")
      .update({ active: false })
      .eq("product_id", savedProduct.id);
    if (deactivateVariantsError) {
      throw new Error(`Could not reconcile sizes for ${product.name}.`, {
        cause: deactivateVariantsError,
      });
    }

    const variants = product.sizes.map((size, index) => ({
      product_id: savedProduct.id,
      size,
      sort_order: (index + 1) * 10,
      sku: null,
      stock_quantity: null,
      active: true,
    }));
    const { error: variantsError } = await client
      .from("product_variants")
      .upsert(variants, { onConflict: "product_id,size" });
    if (variantsError) {
      throw new Error(`Could not save sizes for ${product.name}.`, {
        cause: variantsError,
      });
    }

    const imageRows = [];
    for (const [index, image] of images.entries()) {
      const storagePath = `products/${product.slug}/${image.fileName}`;
      const { error: uploadError } = await client.storage
        .from(bucketName)
        .upload(storagePath, image.bytes, {
          contentType: image.contentType,
          cacheControl: "3600",
          upsert: true,
        });
      if (uploadError) {
        throw new Error(`Could not upload ${storagePath}.`, {
          cause: uploadError,
        });
      }
      imageRows.push({
        product_id: savedProduct.id,
        storage_path: storagePath,
        alt_text: `${product.name} - ${path.parse(image.fileName).name.replace(/[-_]/g, " ")}`,
        sort_order: index * 10,
        active: true,
      });
    }

    const { error: deactivateImagesError } = await client
      .from("product_images")
      .update({ active: false })
      .eq("product_id", savedProduct.id);
    if (deactivateImagesError) {
      throw new Error(`Could not reconcile images for ${product.name}.`, {
        cause: deactivateImagesError,
      });
    }
    const { error: imagesError } = await client
      .from("product_images")
      .upsert(imageRows, { onConflict: "product_id,storage_path" });
    if (imagesError) {
      throw new Error(`Could not save image mappings for ${product.name}.`, {
        cause: imagesError,
      });
    }

    console.log(`Synced ${product.name}: ${variants.length} sizes, ${images.length} images.`);
  }
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  if (!checkOnly && !process.argv.includes("--sync")) {
    fail("Choose --check to validate the spreadsheet or --sync to import it.");
  }

  const products = parseProducts(await readFile(catalogPath, "utf8"));
  if (products.length === 0) {
    fail("The product spreadsheet has no product rows.");
  }

  if (checkOnly) {
    await validateCatalog(products);
    console.log(`Validated ${products.length} products. No database changes made.`);
  } else {
    await syncCatalog(products);
  }
}

main().catch((error) => {
  console.error(error.message);
  if (error.cause) {
    console.error(error.cause);
  }
  process.exitCode = 1;
});
