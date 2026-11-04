import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import Shell from "@/components/Shell";
import Settings from "@/components/Settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <Shell username={user.username}>
      <Settings />
    </Shell>
  );
}
