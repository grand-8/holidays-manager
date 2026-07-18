import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * État vide générique et élégant (icône + titre + une ligne + CTA centré). Les
 * messages sont volontairement contextualisés par l'appelant (selon l'étape du
 * cycle) pour toujours orienter l'utilisateur vers la bonne action.
 */
export function EmptyState({
  icon,
  title,
  description,
  cta,
  secondary,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  cta?: { href: string; label: string } | null;
  secondary?: { href: string; label: string } | null;
}) {
  return (
    <div className="rounded-xl border border-dashed py-16 text-center">
      <div className="text-muted-foreground mx-auto mb-4 grid size-12 place-items-center rounded-xl border">
        {icon}
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      {description && (
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-sm">
          {description}
        </p>
      )}
      {(cta || secondary) && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {cta && (
            <Button asChild>
              <Link href={cta.href}>{cta.label}</Link>
            </Button>
          )}
          {secondary && (
            <Button asChild variant="outline">
              <Link href={secondary.href}>{secondary.label}</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
