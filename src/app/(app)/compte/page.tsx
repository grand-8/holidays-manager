import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { EmailForm } from "./email-form";

export default async function ComptePage() {
  const user = await requireUser();
  const pending = await prisma.pendingEmailChange.findUnique({
    where: { userId: user.id },
    select: { newEmail: true },
  });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
      <div className="mb-6">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Mon compte
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
          {user.nomAffiche}
        </h1>
      </div>
      <EmailForm currentEmail={user.email} pendingEmail={pending?.newEmail ?? null} />
    </main>
  );
}
