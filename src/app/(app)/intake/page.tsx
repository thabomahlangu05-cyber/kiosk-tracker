import { requireAction } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/enums";
import { IntakeForm } from "@/components/intake-form";
import { Card, CardBody } from "@/components/ui/card";

export default async function IntakePage() {
  await requireAction("intake:create");

  const techs = await prisma.user.findMany({
    where: { role: ROLES.REPAIR_TECHNICIAN, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Log a kiosk</h1>
        <p className="text-sm text-gray-400">
          Register a kiosk at Receiving for build or repair
        </p>
      </div>
      <Card>
        <CardBody>
          <IntakeForm techs={techs} />
        </CardBody>
      </Card>
    </div>
  );
}
