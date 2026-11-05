import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import Shell from "@/components/Shell";
import Support from "@/components/Support";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <Shell username={user.username}>
      <Support />
    </Shell>
  );
}
