import { ApiError, errorResponse, isObjectId, readJson, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { appointmentActionSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (!isObjectId(id)) throw new ApiError(404, "Appointment not found.");

    appointmentActionSchema.parse(await readJson(request));

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { queueEntries: { where: { status: { in: ["WAITING", "IN_CONSULTATION"] } } } },
    });
    if (!appointment) throw new ApiError(404, "Appointment not found.");

    const isOwner = appointment.patientId === user.id;
    const isClinicStaff = user.role === "STAFF" && user.clinicId === appointment.clinicId;
    if (!isOwner && !isClinicStaff) {
      throw new ApiError(403, "You cannot modify this appointment.");
    }

    if (!["BOOKED", "CHECKED_IN"].includes(appointment.status)) {
      throw new ApiError(400, "This appointment can no longer be cancelled.");
    }

    await prisma.queueEntry.updateMany({
      where: { appointmentId: appointment.id, status: { in: ["WAITING", "IN_CONSULTATION"] } },
      data: { status: "CANCELLED", completedAt: new Date() },
    });

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "CANCELLED" },
      include: {
        doctor: { select: { id: true, name: true, specialty: true } },
        clinic: { select: { id: true, name: true, address: true, city: true } },
      },
    });

    return Response.json({ appointment: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
