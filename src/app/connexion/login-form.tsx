"use client";

import { useActionState } from "react";
import {
  requestOtp,
  verifyOtp,
  type RequestOtpState,
  type VerifyOtpState,
} from "@/lib/auth/actions";
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

const requestInitial: RequestOtpState = { status: "idle" };
const verifyInitial: VerifyOtpState = { status: "idle" };

export function LoginForm() {
  const [requestState, requestAction, requestPending] = useActionState(
    requestOtp,
    requestInitial,
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyOtp,
    verifyInitial,
  );

  const codeStep = requestState.status === "sent";

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Connexion</CardTitle>
        <CardDescription>
          {codeStep
            ? "Saisissez le code à 6 chiffres reçu par email."
            : "Saisissez votre adresse email pour recevoir un code de connexion."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!codeStep ? (
          <form action={requestAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Adresse email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                placeholder="vous@exemple.fr"
              />
            </div>
            {requestState.status === "error" && (
              <p className="text-destructive text-sm">{requestState.message}</p>
            )}
            <Button type="submit" className="w-full" disabled={requestPending}>
              {requestPending ? "Envoi…" : "Recevoir un code"}
            </Button>
          </form>
        ) : (
          <form action={verifyAction} className="space-y-4">
            <input type="hidden" name="email" value={requestState.email ?? ""} />
            <div className="space-y-2">
              <Label htmlFor="code">Code de connexion</Label>
              <Input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
                placeholder="123456"
                className="text-center text-lg tracking-[0.4em]"
              />
              <p className="text-muted-foreground text-xs">
                Code envoyé à {requestState.email}.
              </p>
            </div>
            {verifyState.status === "error" && (
              <p className="text-destructive text-sm">{verifyState.message}</p>
            )}
            <Button type="submit" className="w-full" disabled={verifyPending}>
              {verifyPending ? "Vérification…" : "Se connecter"}
            </Button>
            {/* Réémission : même formulaire, l'action requestOtp ne lit que l'email. */}
            <Button
              type="submit"
              formAction={requestAction}
              variant="link"
              className="text-muted-foreground w-full"
              disabled={requestPending}
            >
              Renvoyer un code
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
