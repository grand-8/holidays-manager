import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { LoginForm } from "./login-form";

export default async function ConnexionPage() {
  // Déjà connecté → on va directement au tableau de bord.
  const user = await getCurrentUser();
  if (user) redirect("/tableau-de-bord");

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <LoginForm />
    </main>
  );
}
