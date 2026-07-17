"use client";

import { useActionState } from "react";
import {
  createUser,
  toggleUser,
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
              {createPending ? "Ajout…" : "Ajouter"}
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
            {users.map((u) => (
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
                <div className="flex gap-2">
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
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
