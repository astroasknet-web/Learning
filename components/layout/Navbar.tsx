import HomeNav from "@/components/home-options/HomeNav";

/**
 * The site navigation, on every page: the five mega-menus (Platform, Careers, Solutions, Employers, Resources) with the GrowQR apps,
 * the announcement bar, search palette (Ctrl or Cmd + K) and the mobile drawer. The `hideUseCases` prop of the earlier bar is no longer needed.
 */
export default function Navbar(_props: { hideUseCases?: boolean } = {}) {
  return <HomeNav />;
}
