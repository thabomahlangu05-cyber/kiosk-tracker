import { requireAction } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/enums";
import { IntakeForm } from "@/components/intake-form";
import { Card, CardBody } from "@/components/ui/card";

export default async function IntakePage() {
  await requireAction("intake:create");

  const [models, teams, techs] = await Promise.all([
    prisma.kioskModel.findMany({ orderBy: { name: "asc" } }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: ROLES.REPAIR_TECHNICIAN, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, teamId: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Intake</h1>
        <p className="text-sm text-gray-400">
          Register a kiosk for build or repair
        </p>
      </div>
      <Card>
        <CardBody>
          <IntakeForm
            models={models.map((m) => ({ id: m.id, name: m.name }))}
            teams={teams.map((t) => ({ id: t.id, name: t.name }))}
            techs={techs}
          />
        </CardBody>
      </Card>
    </div>
  );
}
