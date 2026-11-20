import { ApiError, errorResponse, requireStaff } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { buildQueuePositions, fetchQueueRows } from "@/lib/queue";
import { dayKey, isValidDayKey } from "@/lib/time";

export async function GET(request: Request) {
  try {
    const staff = await requireStaff();
    const url = new URL(request.url);
    const dayParam = url.searchParams.get("day");
    const day = dayParam && isValidDayKey(dayParam) ? dayParam : dayKey();

    const clinic = await prisma.clinic.findUnique({
      where: { id: staff.clinicId },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        phone: true,
        openingTime: true,
        closingTime: true,
      },
    });
    if (!clinic) throw new ApiError(404, "Clinic not found.");

    const [appointments, doctors, rows] = await Promise.all([
      prisma.appointment.findMany({
        where: { clinicId: staff.clinicId, day },
        orderBy: { dateTime: "asc" },
        include: {
          patient: { select: { id: true, name: true, phone: true } },
          doctor: { select: { id: true, name: true, specialty: true } },
          queueEntries: {
            orderBy: { joinedAt: "desc" },
            take: 1,
            select: { id: true, status: true, tokenCode: true },
          },
        },
      }),
      prisma.doctor.count({ where: { clinicId: staff.clinicId, isActive: true } }),
      fetchQueueRows(staff.clinicId, day),
    ]);

    const entries = buildQueuePositions(rows);
    const completedEntries = entries.filter((entry) => entry.status === "COMPLETED");

    const avgConsult =
      completedEntries.length > 0
        ? Math.round(
            completedEntries.reduce(
              (total, entry) =>
                total +
                Math.max(
                  0,
                  ((entry.completedAt?.getTime() ?? 0) - (entry.startedAt?.getTime() ?? 0)) /
                    60000,
                ),
              0,
            ) / completedEntries.length,
          )
        : null;

    return Response.json({
      day,
      clinic,
      doctors,
      appointments,
      queue: {
        entries,
        nowServing: entries.filter((entry) => entry.status === "IN_CONSULTATION"),
        waiting: entries.filter((entry) => entry.status === "WAITING"),
      },
      stats: {
        appointments: appointments.length,
        booked: appointments.filter((appointment) => appointment.status === "BOOKED").length,
        checkedIn: appointments.filter((appointment) => appointment.status === "CHECKED_IN").length,
        completedAppointments: appointments.filter(
          (appointment) => appointment.status === "COMPLETED",
        ).length,
        cancelledAppointments: appointments.filter(
          (appointment) => appointment.status === "CANCELLED",
        ).length,
        walkIns: entries.filter((entry) => entry.type === "WALK_IN").length,
        waiting: entries.filter((entry) => entry.status === "WAITING").length,
        inConsultation: entries.filter((entry) => entry.status === "IN_CONSULTATION").length,
        completed: completedEntries.length,
        noShows: entries.filter((entry) => entry.status === "NO_SHOW").length,
        avgConsultMinutes: avgConsult,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
