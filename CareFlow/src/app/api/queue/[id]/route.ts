import { ApiError, errorResponse, isObjectId, readJson, requireStaff } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { queueActionSchema } from "@/lib/validation";

const TRANSITIONS: Record<string, string[]> = {
  START: ["WAITING"],
  COMPLETE: ["IN_CONSULTATION"],
  CANCEL: ["WAITING", "IN_CONSULTATION"],
  NO_SHOW: ["WAITING"],
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const staff = await requireStaff();
    const { id } = await params;
    if (!isObjectId(id)) throw new ApiError(404, "Queue entry not found.");

    const { action } = queueActionSchema.parse(await readJson(request));

    const entry = await prisma.queueEntry.findUnique({ where: { id } });
    if (!entry) throw new ApiError(404, "Queue entry not found.");
    if (entry.clinicId !== staff.clinicId) {
      throw new ApiError(403, "You can only manage your own clinic's queue.");
    }
    if (!TRANSITIONS[action].includes(entry.status)) {
      throw new ApiError(400, `Cannot ${action.toLowerCase()} a ${entry.status.toLowerCase()} token.`);
    }

    const now = new Date();
    const data =
      action === "START"
        ? { status: "IN_CONSULTATION" as const, startedAt: now }
        : action === "COMPLETE"
          ? { status: "COMPLETED" as const, completedAt: now }
          : action === "CANCEL"
            ? { status: "CANCELLED" as const, completedAt: now }
            : { status: "NO_SHOW" as const, completedAt: now };

    const updated = await prisma.queueEntry.update({
      where: { id },
      data,
      include: {
        doctor: { select: { id: true, name: true, specialty: true, avgConsultMinutes: true } },
      },
    });

    if (entry.appointmentId) {
      const appointmentStatus =
        action === "COMPLETE"
          ? "COMPLETED"
          : action === "CANCEL"
            ? "CANCELLED"
            : action === "NO_SHOW"
              ? "NO_SHOW"
              : null;

      if (appointmentStatus) {
        await prisma.appointment.update({
          where: { id: entry.appointmentId },
          data: { status: appointmentStatus },
        });
      }
    }

    return Response.json({ entry: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
