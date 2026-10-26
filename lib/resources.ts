import data from "./generated/resources.json";

export interface Resource {
  name: string;
  url: string;
  description: string;
  category: string;
}

const ALL: Resource[] = data.categories.flatMap(
  (c: { name: string; resources: { name: string; url: string; description: string }[] }) =>
    c.resources.map((r) => ({ ...r, category: c.name }))
);

export function searchResources(q: string, limit = 100): Resource[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return ALL.slice(0, limit);
  return ALL.filter(
    (r) =>
      r.name.toLowerCase().includes(needle) ||
      r.description.toLowerCase().includes(needle) ||
      r.category.toLowerCase().includes(needle)
  ).slice(0, limit);
}

export function resourceStats(): { total: number; categories: number } {
  return { total: data.total, categories: data.categories.length };
}

export function allCategories(): { name: string; count: number }[] {
  return data.categories.map((c: { name: string; resources: unknown[] }) => ({
    name: c.name,
    count: c.resources.length,
  }));
}
