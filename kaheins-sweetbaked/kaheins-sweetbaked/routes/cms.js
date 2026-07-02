import { crudRouter } from "../lib/crud.js";
import { slugify } from "../lib/helpers.js";

export const categoriesRouter = crudRouter({
  collection: "categories", sortBy: "sort_order", ascending: true,
  publicList: true, hasActive: true,
  allowed: ["name", "slug", "description", "sort_order", "active"], required: ["name"],
  beforeWrite: (body) => { if (body.name && !body.slug) body.slug = slugify(body.name); return body; },
});
export const bannersRouter = crudRouter({
  collection: "banners", sortBy: "sort_order", ascending: true,
  publicList: true, hasActive: true,
  allowed: ["title", "subtitle", "image_url", "link_url", "sort_order", "active"],
});
export const promosRouter = crudRouter({
  collection: "promos", publicList: true, hasActive: true,
  allowed: ["title", "description", "image_url", "badge", "active"], required: ["title"],
});
export const galleryRouter = crudRouter({
  collection: "gallery", sortBy: "sort_order", ascending: true, publicList: true,
  allowed: ["title", "image_url", "sort_order"], required: ["image_url"],
});
