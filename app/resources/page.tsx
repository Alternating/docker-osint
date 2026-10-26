import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import Shell from "@/components/Shell";
import ResourceExplorer from "@/components/ResourceExplorer";

export const dynamic = "force-dynamic";

export default async function ResourcesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <Shell username={user.username}>
      <ResourceExplorer />
    </Shell>
  );
}
