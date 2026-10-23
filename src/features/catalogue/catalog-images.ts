import { colourNameFromFile, matchProductFolder } from "../../lib/catalog-folder";

// Every product photo shipped in the repo, keyed by its real path:
//   /catalog/<category>/<subcategory>/<product-folder>/<colour>.jpeg
const catalogAssets = import.meta.glob<string>(
  "/catalog/**/*.{jpeg,jpg,png,webp,JPEG,JPG,PNG,WEBP}",
  { eager: true, query: "?url", import: "default" },
);

export type LocalCatalogImage = {
  /** Stable id: "<category>/<folder>/<file>" so it can never collide across products. */
  id: string;
  fileName: string;
  colorName: string;
  url: string;
};

type CatalogFile = { dir: string; fileName: string; url: string };

const catalogFiles: CatalogFile[] = Object.entries(catalogAssets).map(
  ([assetPath, url]) => {
    const parts = assetPath.replace(/^\/catalog\//, "").split("/");
    const fileName = parts.pop() ?? "";
    return { dir: parts.join("/"), fileName, url };
  },
);

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

/** Directories directly inside `<category>/` that contain images. */
function folderNamesIn(category: string): string[] {
  const prefix = `${category}/`;
  const names = new Set<string>();
  for (const file of catalogFiles) {
    if (file.dir.startsWith(prefix)) {
      const folder = file.dir.slice(prefix.length).split("/")[0];
      if (folder) {
        names.add(folder);
      }
    }
  }
  return [...names];
}

/**
 * The directory that holds this product's images, e.g.
 * "pants/office/beltless-trouser" for slug "beltless-material-trousers".
 * Returns null when the product has no folder (or the match is ambiguous).
 */
export function findProductCatalogDir(
  slug: string,
  category: string | null,
): string | null {
  if (category) {
    const folder = matchProductFolder(slug, folderNamesIn(category));
    return folder ? `${category}/${folder}` : null;
  }

  // No category on the product row: accept only an unambiguous exact match.
  const dirs = new Set(
    catalogFiles
      .map((file) => file.dir)
      .filter((dir) => dir.split("/").includes(slug)),
  );
  const matches = [...dirs].map((dir) => {
    const parts = dir.split("/");
    return parts.slice(0, parts.indexOf(slug) + 1).join("/");
  });
  const unique = [...new Set(matches)];
  return unique.length === 1 ? (unique[0] ?? null) : null;
}

/**
 * Every image in the product's own folder, one per colour, in a stable order.
 * Images from other products' folders are never returned.
 */
export function getLocalCatalogImages(
  slug: string,
  category: string | null,
): LocalCatalogImage[] {
  const dir = findProductCatalogDir(slug, category);
  if (!dir) {
    return [];
  }
  return catalogFiles
    .filter((file) => file.dir === dir || file.dir.startsWith(`${dir}/`))
    .map((file) => {
      const relative = `${file.dir.slice(dir.length + 1)}${
        file.dir.length > dir.length ? "/" : ""
      }${file.fileName}`;
      return {
        id: `${dir}/${relative}`,
        fileName: relative,
        colorName: colourNameFromFile(relative),
        url: file.url,
      };
    })
    .sort((first, second) => collator.compare(first.fileName, second.fileName));
}

/** First image of a product's folder (used for card/hero fallbacks). */
export function getLocalProductImageUrl(
  slug: string,
  category: string | null = null,
): string | null {
  return getLocalCatalogImages(slug, category)[0]?.url ?? null;
}
