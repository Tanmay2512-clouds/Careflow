import { errorResponse, isObjectId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { buildQueuePositions, fetchQueueRows } from "@/lib/queue";
import { dayKey, isValidDayKey } from "@/lib/time";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const dayParam = url.searchParams.get("day");
    const day = dayParam && isValidDayKey(dayParam) ? dayParam : dayKey();

    if (!isObjectId(id)) {
      return Response.json({ error: "Clinic not found." }, { status: 404 });
    }

    const clinic = await prisma.clinic.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!clinic) {
      return Response.json({ error: "Clinic not found." }, { status: 404 });
    }

    const rows = await fetchQueueRows(id, day);
    const entries = buildQueuePositions(rows);

    return Response.json({
      clinic,
      day,
      entries,
      nowServing: entries.filter((entry) => entry.status === "IN_CONSULTATION"),
      stats: {
        waiting: entries.filter((entry) => entry.status === "WAITING").length,
        inConsultation: entries.filter((entry) => entry.status === "IN_CONSULTATION").length,
        completed: entries.filter((entry) => entry.status === "COMPLETED").length,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
