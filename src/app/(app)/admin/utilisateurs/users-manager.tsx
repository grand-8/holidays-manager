"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  createUser,
  toggleUser,
  updateUser,
  type UserActionState,
} from "@/lib/users/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type UserRow = {
  id: string;
  email: string;
  nomAffiche: string;
  isAdmin: boolean;
  actif: boolean;
};

const initial: UserActionState = { status: "idle" };

export function UsersManager({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const [createState, createAction, createPending] = useActionState(
    createUser,
    initial,
  );
  const [toggleState, toggleAction, togglePending] = useActionState(
    toggleUser,
    initial,
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updateUser,
    initial,
  );

  // Ligne en cours d'édition (nom + e-mail). Une seule à la fois.
  const [editingId, setEditingId] = useState<string | null>(null);

  const createSeen = useRef<UserActionState>(initial);
  const toggleSeen = useRef<UserActionState>(initial);
  const updateSeen = useRef<UserActionState>(initial);
  useEffect(() => {
    if (createState === createSeen.current) return;
    createSeen.current = createState;
    if (createState.status === "saved")
      toast.success(createState.message ?? "Famille ajoutée.");
    else if (createState.status === "error")
      toast.error(createState.message ?? "Une erreur est survenue.");
  }, [createState]);
  useEffect(() => {
    if (toggleState === toggleSeen.current) return;
    toggleSeen.current = toggleState;
    if (toggleState.status === "saved")
      toast.success(toggleState.message ?? "Modifié.");
    else if (toggleState.status === "error")
      toast.error(toggleState.message ?? "Action impossible.");
  }, [toggleState]);
  useEffect(() => {
    if (updateState === updateSeen.current) return;
    updateSeen.current = updateState;
    if (updateState.status === "saved") {
      // Réaction au résultat d'une Server Action : on referme la ligne éditée.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditingId(null);
      toast.success(updateState.message ?? "Famille mise à jour.");
    } else if (updateState.status === "error") {
      toast.error(updateState.message ?? "Modification impossible.");
    }
  }, [updateState]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajouter une famille</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAction} className="flex flex-wrap items-end gap-3">
            <div className="grow space-y-2">
              <Label htmlFor="nomAffiche">Nom affiché</Label>
              <Input id="nomAffiche" name="nomAffiche" required placeholder="Famille Dupont" />
            </div>
            <div className="grow space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="dupont@exemple.fr"
              />
            </div>
            <Button type="submit" disabled={createPending}>
              {createPending && <Loader2 className="size-4 animate-spin" />}
              Ajouter
            </Button>
          </form>
          {createState.status !== "idle" && createState.message && (
            <p
              className={`mt-3 text-sm ${createState.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
            >
              {createState.message}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comptes</CardTitle>
        </CardHeader>
        <CardContent>
          {toggleState.status === "error" && (
            <p className="text-destructive mb-3 text-sm">{toggleState.message}</p>
          )}
          <ul className="divide-y">
            {users.map((u) =>
              editingId === u.id ? (
                <li key={u.id} className="py-3">
                  <form action={updateAction} className="space-y-3">
                    <input type="hidden" name="userId" value={u.id} />
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="flex-1 space-y-1.5">
                        <Label htmlFor={`nom-${u.id}`}>Nom affiché</Label>
                        <Input
                          id={`nom-${u.id}`}
                          name="nomAffiche"
                          required
                          defaultValue={u.nomAffiche}
                        />
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <Label htmlFor={`email-${u.id}`}>Adresse e-mail</Label>
                        <Input
                          id={`email-${u.id}`}
                          name="email"
                          type="email"
                          required
                          defaultValue={u.email}
                        />
                      </div>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      La modification est appliquée immédiatement, sans code de
                      confirmation, et journalisée.
                    </p>
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={updatePending}>
                        {updatePending && (
                          <Loader2 className="size-4 animate-spin" />
                        )}
                        Enregistrer
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        Annuler
                      </Button>
                    </div>
                  </form>
                </li>
              ) : (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {u.nomAffiche}
                      {u.isAdmin && (
                        <span className="text-muted-foreground"> · admin</span>
                      )}
                      {!u.actif && (
                        <span className="text-destructive"> · inactif</span>
                      )}
                      {u.id === currentUserId && (
                        <span className="text-muted-foreground"> · vous</span>
                      )}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {u.email}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingId(u.id)}
                    >
                      Modifier
                    </Button>
                    <form>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="champ" value="admin" />
                      <Button
                        type="submit"
                        formAction={toggleAction}
                        variant="outline"
                        size="sm"
                        disabled={togglePending}
                      >
                        {u.isAdmin ? "Retirer admin" : "Rendre admin"}
                      </Button>
                    </form>
                    <form>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="champ" value="actif" />
                      <Button
                        type="submit"
                        formAction={toggleAction}
                        variant="ghost"
                        size="sm"
                        disabled={togglePending}
                      >
                        {u.actif ? "Désactiver" : "Réactiver"}
                      </Button>
                    </form>
                  </div>
                </li>
              ),
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
