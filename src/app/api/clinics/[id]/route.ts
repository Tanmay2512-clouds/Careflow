import { errorResponse, isObjectId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { dayKey } from "@/lib/time";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!isObjectId(id)) {
      return Response.json({ error: "Clinic not found." }, { status: 404 });
    }

    const today = dayKey();

    const clinic = await prisma.clinic.findUnique({
      where: { id },
      include: {
        doctors: {
          where: { isActive: true },
          orderBy: { name: "asc" },
          include: { schedules: { where: { isActive: true }, orderBy: { dayOfWeek: "asc" } } },
        },
        queueEntries: {
          where: { day: today, status: { in: ["WAITING", "IN_CONSULTATION"] } },
          select: { status: true, tokenNumber: true },
        },
      },
    });

    if (!clinic || !clinic.isActive) {
      return Response.json({ error: "Clinic not found." }, { status: 404 });
    }

    return Response.json({
      clinic: {
        id: clinic.id,
        name: clinic.name,
        description: clinic.description,
        address: clinic.address,
        city: clinic.city,
        phone: clinic.phone,
        email: clinic.email,
        specialties: clinic.specialties,
        openingTime: clinic.openingTime,
        closingTime: clinic.closingTime,
        doctors: clinic.doctors.map((doctor) => ({
          id: doctor.id,
          name: doctor.name,
          specialty: doctor.specialty,
          qualification: doctor.qualification,
          bio: doctor.bio,
          avgConsultMinutes: doctor.avgConsultMinutes,
          schedules: doctor.schedules.map((schedule) => ({
            id: schedule.id,
            dayOfWeek: schedule.dayOfWeek,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            slotMinutes: schedule.slotMinutes,
          })),
        })),
        today: {
          waiting: clinic.queueEntries.filter((entry) => entry.status === "WAITING").length,
          inConsultation: clinic.queueEntries.filter(
            (entry) => entry.status === "IN_CONSULTATION",
          ).length,
          lastToken: clinic.queueEntries.reduce(
            (max, entry) => Math.max(max, entry.tokenNumber),
            0,
          ),
        },
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
