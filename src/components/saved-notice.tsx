import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bandeau de confirmation persistant (reste affiché après l'action, contrairement
 * au toast). Renforce le retour utilisateur après un enregistrement / un vote.
 */
export function SavedNotice({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "border-good/30 bg-good/10 text-good flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
        className,
      )}
    >
      <CheckCircle2 className="size-4 shrink-0" />
      {children}
    </div>
  );
}
