"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

/**
 * Bouton de soumission (dans un `<form action={serverAction}>`) qui demande une
 * confirmation native avant d'envoyer. Si l'utilisateur annule, la soumission
 * est bloquée. Utilisé pour les actions destructives (suppression de cycle,
 * suppression d'année d'historique).
 */
export function ConfirmButton({
  message,
  children,
  ...props
}: { message: string } & ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      type="submit"
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
