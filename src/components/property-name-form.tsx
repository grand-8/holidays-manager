"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, MapPin } from "lucide-react";
import {
  updatePropertyName,
  type PropertyNameState,
} from "@/lib/property/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initial: PropertyNameState = { status: "idle" };

export function PropertyNameForm({ nom }: { nom: string }) {
  const [value, setValue] = useState(nom);
  const [state, action, pending] = useActionState(updatePropertyName, initial);
  const seen = useRef<PropertyNameState>(initial);

  useEffect(() => {
    if (state === seen.current) return;
    seen.current = state;
    if (state.status === "saved")
      toast.success(state.message ?? "Nom du lieu enregistré.");
    else if (state.status === "error")
      toast.error(state.message ?? "Une erreur est survenue.");
  }, [state]);

  const dirty = value.trim() !== nom;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nom du lieu loué</CardTitle>
        <CardDescription>
          Ce nom identifie le bien dans l&apos;objet et le corps de tous les
          e-mails envoyés aux familles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-wrap items-end gap-3">
          <div className="grow space-y-2">
            <div className="relative">
              <MapPin className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                name="nom"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                maxLength={80}
                placeholder="Ex. La Bergerie, Chalet des Alpes…"
                className="pl-9"
              />
            </div>
          </div>
          <Button type="submit" variant="outline" disabled={pending || !dirty}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {dirty ? "Enregistrer" : "Enregistré ✓"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
