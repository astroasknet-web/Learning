import data from "./data/exam-prep.json";

/**
 * Exam-prep hubs and the free course catalogue shown at /exam-prep (data/exam-prep.json).
 * Every entry with an `own` link opens a page on this site; entries without one are shown as "Coming soon".
 */
export type HubSection = { name: string; desc: string; count?: number; own?: string };
export type HubTest = { name: string; desc: string; own: string };
export type Hub = { slug: string; title: string; kind: string; intro: string; unit: string; sections: HubSection[]; tests: HubTest[]; learn?: string; mock?: string; studyMap?: Record<string, string> };
export type CatalogueCard = { title: string; group: string; own?: string; comingSoon?: boolean };

export const hubs = (): Hub[] => data.hubs as unknown as Hub[];
export const hub = (slug: string): Hub | null => hubs().find((h) => h.slug === slug) ?? null;
export const catalogue = (): CatalogueCard[] => data.catalogue as unknown as CatalogueCard[];
export const totalUnits = (h: Hub): number => h.sections.reduce((n, s) => n + (s.count ?? 0), 0);
