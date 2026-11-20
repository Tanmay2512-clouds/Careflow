import { ApiError, errorResponse, isObjectId, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createQueueEntry } from "@/lib/queue";
import { dayKey } from "@/lib/time";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (!isObjectId(id)) throw new ApiError(404, "Appointment not found.");

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, name: true, phone: true } },
        doctor: { select: { id: true, clinicId: true } },
        queueEntries: {
          where: { status: { in: ["WAITING", "IN_CONSULTATION"] } },
          select: { id: true },
        },
      },
    });
    if (!appointment) throw new ApiError(404, "Appointment not found.");

    const isOwner = appointment.patientId === user.id;
    const isClinicStaff = user.role === "STAFF" && user.clinicId === appointment.doctor.clinicId;
    if (!isOwner && !isClinicStaff) {
      throw new ApiError(403, "You cannot check in this appointment.");
    }

    if (appointment.status === "CHECKED_IN" || appointment.queueEntries.length > 0) {
      throw new ApiError(409, "This appointment is already checked in.");
    }
    if (appointment.status !== "BOOKED") {
      throw new ApiError(400, "This appointment cannot be checked in.");
    }
    if (appointment.day !== dayKey()) {
      throw new ApiError(400, "Check-in opens on the day of the appointment.");
    }

    const { entry, position, estimatedWaitMinutes } = await createQueueEntry({
      clinicId: appointment.doctor.clinicId,
      doctorId: appointment.doctor.id,
      patientId: appointment.patient.id,
      patientName: appointment.patient.name,
      patientPhone: appointment.patient.phone,
      type: "APPOINTMENT",
      appointmentId: appointment.id,
    });

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "CHECKED_IN" },
    });

    return Response.json({ entry, position, estimatedWaitMinutes }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
