import * as L from "lucide-react";
import type { LucideProps } from "lucide-react";

export default function Icon({ name, ...p }: { name: string } & LucideProps) {
  const C = (L as unknown as Record<string, React.ComponentType<LucideProps>>)[name] ?? L.Sparkles;
  return <C aria-hidden strokeWidth={1.7} {...p} />;
}
