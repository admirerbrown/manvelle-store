import { Link } from "react-router-dom";
import { paths } from "../../app/routes";
import type { LiveCategory } from "./categories";

type CategoryTilesProps = {
  categories: LiveCategory[];
};

/** Full-width "Shop by Category" band. Tiles are staggered by CSS (see .category-mosaic). */
export function CategoryTiles({ categories }: CategoryTilesProps) {
  return (
    <section
      className="category-section"
      id="categories"
      aria-labelledby="category-heading"
    >
      <h2 className="category-section__title" id="category-heading">
        Shop by Category
      </h2>
      <div className="category-mosaic">
        {categories.map((category) => (
          <article className="category-tile" key={category.id}>
            {/* The title link below is the accessible one; the photo link is a mouse/touch shortcut. */}
            <Link
              className="category-tile__media"
              to={paths.collection(category.id)}
              tabIndex={-1}
              aria-hidden="true"
            >
              {category.coverUrl && <img src={category.coverUrl} alt="" />}
            </Link>
            <div className="category-tile__caption">
              <div>
                <span className="category-tile__label">Category</span>
                <h3>
                  <Link to={paths.collection(category.id)}>{category.name}</Link>
                </h3>
              </div>
            </div>
            {category.subcategories.length > 0 && (
              <div className="category-tile__chips">
                {category.subcategories.map((subcategory) => (
                  <Link
                    className="category-tile__chip"
                    key={subcategory.path}
                    to={paths.collection(subcategory.path)}
                  >
                    {subcategory.name}
                  </Link>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
