import { errorResponse, readJson, requireStaff } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { doctorInputSchema } from "@/lib/validation";

export async function GET() {
  try {
    const staff = await requireStaff();
    const doctors = await prisma.doctor.findMany({
      where: { clinicId: staff.clinicId },
      orderBy: { createdAt: "asc" },
      include: { schedules: { orderBy: { dayOfWeek: "asc" } } },
    });

    return Response.json({ doctors });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const staff = await requireStaff();
    const input = doctorInputSchema.parse(await readJson(request));

    const doctor = await prisma.doctor.create({
      data: {
        clinicId: staff.clinicId,
        name: input.name,
        specialty: input.specialty,
        qualification: input.qualification || null,
        bio: input.bio || null,
        avgConsultMinutes: input.avgConsultMinutes,
        isActive: input.isActive,
        schedules: input.schedules?.length
          ? {
              create: input.schedules.map((schedule) => ({
                dayOfWeek: schedule.dayOfWeek,
                startTime: schedule.startTime,
                endTime: schedule.endTime,
                slotMinutes: schedule.slotMinutes,
                isActive: schedule.isActive,
              })),
            }
          : undefined,
      },
      include: { schedules: { orderBy: { dayOfWeek: "asc" } } },
    });

    return Response.json({ doctor }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
