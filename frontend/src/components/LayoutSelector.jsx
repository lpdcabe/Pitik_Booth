import { useState } from "react";
import { Search, Heart, Shuffle, Check, ArrowRight } from "lucide-react";
import { layouts, layoutCategories } from "../utils/layouts";
import { useBooth } from "../context/PhotoboothContext";
import LayoutPreview from "./LayoutPreview";
export default function LayoutSelector({ onContinue }) {
  const { layout, setLayout, frame, photos, settings, preset, notify } =
    useBooth();
  const [category, setCategory] = useState("Featured"),
    [search, setSearch] = useState(""),
    [count, setCount] = useState("all"),
    [orientation, setOrientation] = useState("all");
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("photobooth_favorite_layouts") || "[]",
      );
    } catch {
      return [];
    }
  });
  function favorite(id) {
    const next = favorites.includes(id)
      ? favorites.filter((x) => x !== id)
      : [...favorites, id];
    setFavorites(next);
    try {
      localStorage.setItem("photobooth_favorite_layouts", JSON.stringify(next));
    } catch {
      notify("Favorites could not be saved in this browser.");
    }
  }
  const filtered = layouts.filter(
    (l) =>
      (category === "All" ||
        (category === "Featured" && l.featured) ||
        (category === "Favorites" && favorites.includes(l.id)) ||
        l.category === category) &&
      `${l.name} ${l.category} ${l.photoCount} photos`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (count === "all" || l.photoCount === Number(count)) &&
      (orientation === "all" || orientation === l.orientation),
  );
  return (
    <div className="layout-workspace">
      <div className="layout-browser">
        <div className="search-row">
          <label className="search-input">
            <Search size={18} />
            <input
              placeholder="Search layouts..."
              aria-label="Search layouts"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (e.target.value) setCategory("All");
              }}
            />
          </label>
          <button
            className="button secondary"
            onClick={() => {
              setLayout(layouts[Math.floor(Math.random() * layouts.length)]);
              notify("A little surprise, just for you.");
            }}
          >
            <Shuffle size={16} /> Surprise me
          </button>
        </div>
        <div className="category-chips">
          {layoutCategories.map((c) => (
            <button
              key={c}
              className={category === c ? "selected" : ""}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <span>{filtered.length} layouts to love</span>
          <select
            aria-label="Filter photo count"
            value={count}
            onChange={(e) => setCount(e.target.value)}
          >
            <option value="all">All photo counts</option>
            {[1, 2, 3, 4, 6, 8, 9].map((n) => (
              <option key={n} value={n}>
                {n} photos
              </option>
            ))}
          </select>
          <select
            aria-label="Filter orientation"
            value={orientation}
            onChange={(e) => setOrientation(e.target.value)}
          >
            <option value="all">All orientations</option>
            {["portrait", "landscape", "square"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="layout-grid">
          {filtered.map((l) => (
            <article
              key={l.id}
              className={`layout-card ${l.id === layout.id ? "chosen" : ""}`}
            >
              <button
                className="layout-select"
                onClick={() => setLayout(l)}
                aria-label={`Preview ${l.name}`}
              >
                <div className="layout-thumb">
                  <img src={l.thumbnail} alt="" />
                  {l.id === layout.id && (
                    <span className="selected-badge">
                      <Check size={15} />
                    </span>
                  )}
                </div>
                <h3>{l.name}</h3>
                <p>
                  {l.photoCount} photos · {l.orientation}
                </p>
              </button>
              <button
                className={`favorite icon-button ${favorites.includes(l.id) ? "hearted" : ""}`}
                aria-label={`${favorites.includes(l.id) ? "Unfavorite" : "Favorite"} ${l.name}`}
                onClick={() => favorite(l.id)}
              >
                <Heart
                  size={16}
                  fill={favorites.includes(l.id) ? "currentColor" : "none"}
                />
              </button>
            </article>
          ))}
        </div>
        {!filtered.length && (
          <div className="empty-state">
            <Search />
            <h3>No layouts found</h3>
            <p>Try another search or explore a different category.</p>
            <button
              className="button secondary"
              onClick={() => {
                setSearch("");
                setCategory("All");
                setCount("all");
                setOrientation("all");
              }}
            >
              Reset filters
            </button>
          </div>
        )}
      </div>
      <aside className="preview-sidebar">
        <span className="eyebrow">YOUR LITTLE MASTERPIECE</span>
        <div className="preview-stage">
          <LayoutPreview {...{ layout, frame, photos, settings, preset }} />
        </div>
        <h3>{layout.name}</h3>
        <p>
          {layout.photoCount} photos · {layout.orientation}
          <br />
          {layout.width} × {layout.height} px
        </p>
        <button className="button" onClick={onContinue}>
          Use this layout <ArrowRight size={17} />
        </button>
        <small>You can always change it later.</small>
      </aside>
    </div>
  );
}
