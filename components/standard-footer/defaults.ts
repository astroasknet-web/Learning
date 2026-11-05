import type { FooterOffice } from "./types";

/** The company offices, shown in the footer of every Yugty app. */
export const STANDARD_OFFICES: FooterOffice[] = [
  { city: "New Jersey, USA", addr: "103 Carnegie Center Drive, Princeton, NJ 08540", hq: true },
  { city: "Noida, India", addr: "4th Floor, Wesource Building, Sector 125, Noida, UP 201313", href: "https://share.google/OeH9CLBjeBa3VssRT" },
  { city: "Oslo, Norway", addr: "Odalsgata 42, 2003 Lillestrom" },
  { city: "St Julian's, Malta", addr: "Dragonara Business Centre, 5th Floor, Dragonara Road, St Julian's" },
];

/**
 * The legal links. Privacy and Refund are ungated on purpose: the privacy policy covers global processing and must be reachable from the
 * newsletter field, and the refund policy must be visible to paying customers in every market. Do not hide them behind a country check.
 */
export const STANDARD_LEGAL = [
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/refund-policy", label: "Refund Policy" },
  { href: "/data-deletion", label: "Data Deletion" },
  { href: "/editorial-policy", label: "Editorial Policy" },
];
