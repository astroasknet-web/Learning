export type FooterLink = { href: string; label: string; external?: boolean; tag?: string };
export type FooterColumn = { title: string; links: FooterLink[] };
export type FooterApp = { key: string; name: string; href: string; icon: string; external?: boolean };
export type FooterOffice = { city: string; addr: string; hq?: boolean; href?: string };

/**
 * Everything that differs between Yugty web applications. The layout, offices, share card, legal bar and behaviour are the same everywhere
 * (see StandardFooter.tsx), so every app looks and works like the others. Change copy, links and the app list here, never the layout.
 */
export type FooterConfig = {
  brand: { name: string; logoSrc: string; logoAlt: string; tagline: string };
  /** Public URL of this app, used by the share buttons. */
  siteUrl: string;
  cta: {
    eyebrow: string;
    title: string;
    text: string;
    primary: { label: string; href: string };
    secondary: { label: string; href: string };
    tertiary?: { label: string; href: string };
  };
  /** The family of apps ("N apps. One account."). The panel only shows when at least two apps have a URL. */
  appsTitle: string;
  apps: FooterApp[];
  newsletter: { label: string; button: string; endpoint: string; source: string };
  /** Exactly four columns look best. */
  columns: FooterColumn[];
  social: Array<{ label: string; href: string; icon: "linkedin" | "x" | "instagram" | "youtube" | "facebook" }>;
  supportEmail: string;
  share: { title: string; text: string; subject: string };
  offices?: FooterOffice[];
  /** Hide a legal link whose page does not exist yet. */
  legal?: Array<{ href: string; label: string }>;
};
