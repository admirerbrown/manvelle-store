// Single rule for "which catalog folder belongs to which product".
//
// Used by BOTH the storefront (src/features/catalogue/catalog-images.ts) and the
// importer (scripts/sync-catalog.mjs), so the images a customer sees on the site
// and the images uploaded to Supabase Storage always come from the same directory:
//
//   catalog/<category>/<subcategory>/<product-folder>/<colour>.jpeg
//
// A product folder is the product's slug, or a shorter folder name made of the
// same words, e.g. product "Beltless-Material Trousers" (slug
// beltless-material-trousers) -> folder "beltless-trouser".

/** Explicit overrides (slug -> folder). Optional; the word-matching rule below
 *  already covers these, they are kept so the mapping is visible in one place. */
export const FOLDER_ALIASES = {
  "khakie-trousers": "khakie",
  "beltless-material-trousers": "beltless-trouser",
};

function words(name) {
  return new Set(
    name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      // trouser == trousers, pant == pants, short == shorts
      .map((word) => (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word)),
  );
}

/**
 * Pick the folder (from `folderNames`, the directories that exist inside the
 * product's category folder) that belongs to the product with this `slug`.
 * Returns null when nothing matches or when the match would be ambiguous, so an
 * image can never be attached to the wrong product.
 *
 * Order: exact slug -> explicit alias -> the single folder whose words are all
 * contained in the slug (most words wins; a tie returns null).
 */
export function matchProductFolder(slug, folderNames) {
  if (folderNames.includes(slug)) {
    return slug;
  }
  const alias = FOLDER_ALIASES[slug];
  if (alias && folderNames.includes(alias)) {
    return alias;
  }

  const slugWords = words(slug);
  let best = null;
  let bestSize = 0;
  let tied = false;
  for (const folder of folderNames) {
    const folderWords = words(folder);
    if (folderWords.size === 0 || ![...folderWords].every((word) => slugWords.has(word))) {
      continue;
    }
    if (folderWords.size > bestSize) {
      best = folder;
      bestSize = folderWords.size;
      tied = false;
    } else if (folderWords.size === bestSize) {
      tied = true;
    }
  }
  return tied ? null : best;
}

/** "light-brown" / "light_brown.jpeg" -> "Light Brown" */
export function colourNameFromFile(fileName) {
  const last = fileName.split("/").at(-1) ?? fileName;
  return last
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}
