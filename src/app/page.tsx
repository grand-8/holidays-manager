import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Vacances familiales
          </h1>
          <p className="text-muted-foreground text-sm">
            Planification partagée des semaines de vacances entre les familles
            du bien.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/connexion">Se connecter</Link>
        </Button>
        <p className="text-muted-foreground text-xs">
          Accès réservé aux familles enregistrées. Aucun mot de passe : vous
          recevez un code à usage unique par email.
        </p>
      </div>
    </main>
  );
}
