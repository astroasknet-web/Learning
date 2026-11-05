import "server-only";
import type { Course } from "./courses";
import { hasThumb } from "./thumbs";
import type { CardCourse } from "./catalog-card";

export const toCard = (c: Course, here: boolean): CardCourse => ({
  slug: c.slug, title: c.title, brief: c.brief ?? "", cat_name: c.cat_name, c1: c.c1, c2: c.c2, icon: c.icon, level_label: c.level_label,
  badge: c.badge, hours: c.hours, modules: c.modules, price_minor: here ? c.price_minor : null, here, thumb: hasThumb(c.slug),
});

