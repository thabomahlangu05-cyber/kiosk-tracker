import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ComingSoon({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        <Badge tone="blue">{phase}</Badge>
      </div>
      <Card>
        <CardBody className="text-sm text-gray-400">{description}</CardBody>
      </Card>
    </div>
  );
}
