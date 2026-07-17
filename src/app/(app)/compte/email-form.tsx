"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import {
  requestEmailChange,
  confirmEmailChange,
  cancelEmailChange,
  type EmailChangeState,
} from "@/lib/account/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const idle: EmailChangeState = { status: "idle" };

export function EmailForm({
  currentEmail,
  pendingEmail,
}: {
  currentEmail: string;
  pendingEmail: string | null;
}) {
  const [phase, setPhase] = useState<"request" | "confirm">(
    pendingEmail ? "confirm" : "request",
  );

  const [reqState, reqAction, reqPending] = useActionState(
    requestEmailChange,
    idle,
  );
  const [confState, confAction, confPending] = useActionState(
    confirmEmailChange,
    idle,
  );
  const reqSeen = useRef<EmailChangeState>(idle);
  const confSeen = useRef<EmailChangeState>(idle);

  useEffect(() => {
    if (reqState === reqSeen.current) return;
    reqSeen.current = reqState;
    if (reqState.status === "sent") {
      // Réaction au résultat d'une Server Action (système externe).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("confirm");
      toast.success(reqState.message ?? "Code envoyé.");
    } else if (reqState.status === "error") {
      toast.error(reqState.message ?? "Une erreur est survenue.");
    }
  }, [reqState]);

  useEffect(() => {
    if (confState === confSeen.current) return;
    confSeen.current = confState;
    if (confState.status === "changed") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("request");
      toast.success(confState.message ?? "Adresse mise à jour.");
    } else if (confState.status === "error") {
      toast.error(confState.message ?? "Une erreur est survenue.");
    }
  }, [confState]);

  const targetEmail =
    reqState.status === "sent" ? (reqState.email ?? "") : (pendingEmail ?? "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Adresse e-mail</CardTitle>
        <CardDescription>
          Votre connexion se fait avec cette adresse. Un changement doit être
          confirmé par un code envoyé sur la nouvelle adresse.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Mail className="size-4" />
          Adresse actuelle : <span className="text-foreground font-medium">{currentEmail}</span>
        </div>

        {phase === "request" ? (
          <form action={reqAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="newEmail">Nouvelle adresse</Label>
              <Input
                id="newEmail"
                name="newEmail"
                type="email"
                required
                placeholder="nouvelle@adresse.tld"
              />
            </div>
            <Button type="submit" disabled={reqPending}>
              {reqPending && <Loader2 className="size-4 animate-spin" />}
              Envoyer un code
            </Button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              Un code a été envoyé à{" "}
              <span className="font-medium">{targetEmail}</span>. Saisissez-le
              pour confirmer.
            </p>
            <form action={confAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="code">Code à 6 chiffres</Label>
                <Input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  className="w-40 font-mono tracking-widest"
                  placeholder="000000"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={confPending}>
                  {confPending && <Loader2 className="size-4 animate-spin" />}
                  Confirmer
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setPhase("request");
                    cancelEmailChange();
                  }}
                >
                  Annuler
                </Button>
              </div>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
