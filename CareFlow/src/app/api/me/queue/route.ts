import { errorResponse, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { buildQueuePositions, type QueueRow } from "@/lib/queue";
import { dayKey } from "@/lib/time";

export async function GET() {
  try {
    const user = await requireUser();
    const day = dayKey();

    const entries = await prisma.queueEntry.findMany({
      where: { patientId: user.id, day },
      orderBy: { tokenNumber: "asc" },
      include: {
        doctor: { select: { id: true, name: true, specialty: true, avgConsultMinutes: true } },
        clinic: { select: { id: true, name: true, address: true, city: true, phone: true } },
      },
    });

    const rows: QueueRow[] = entries.map((entry) => ({
      id: entry.id,
      tokenNumber: entry.tokenNumber,
      tokenCode: entry.tokenCode,
      status: entry.status,
      type: entry.type,
      patientName: entry.patientName,
      patientPhone: entry.patientPhone,
      joinedAt: entry.joinedAt,
      startedAt: entry.startedAt,
      completedAt: entry.completedAt,
      doctorId: entry.doctor.id,
      doctorName: entry.doctor.name,
      specialty: entry.doctor.specialty,
      avgConsultMinutes: entry.doctor.avgConsultMinutes,
    }));

    const clinicMap = new Map(entries.map((entry) => [entry.id, entry.clinic]));
    const withPosition = buildQueuePositions(rows).map((row) => ({
      ...row,
      clinic: clinicMap.get(row.id) ?? null,
    }));

    return Response.json({
      day,
      entries: withPosition,
      active: withPosition.filter(
        (entry) => entry.status === "WAITING" || entry.status === "IN_CONSULTATION",
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
