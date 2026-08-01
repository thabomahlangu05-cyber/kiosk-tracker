import { requireAction } from "@/lib/auth";
import { ComingSoon } from "@/components/coming-soon";

export default async function AdminPage() {
  await requireAction("admin:manage");
  return (
    <ComingSoon
      title="Admin"
      phase="Phase 5"
      description="Manage users, teams, kiosk models, workflow stages and the defect catalog."
    />
  );
}
