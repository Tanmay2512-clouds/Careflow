import { ApiError, errorResponse, isObjectId, readJson, requireStaff } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { doctorInputSchema } from "@/lib/validation";

async function requireOwnedDoctor(doctorId: string, clinicId: string) {
  if (!isObjectId(doctorId)) throw new ApiError(404, "Doctor not found.");
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor || doctor.clinicId !== clinicId) {
    throw new ApiError(404, "Doctor not found.");
  }
  return doctor;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const staff = await requireStaff();
    const { id } = await params;
    await requireOwnedDoctor(id, staff.clinicId);

    const input = doctorInputSchema.parse(await readJson(request));

    await prisma.doctorSchedule.deleteMany({ where: { doctorId: id } });

    const doctor = await prisma.doctor.update({
      where: { id },
      data: {
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

    return Response.json({ doctor });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const staff = await requireStaff();
    const { id } = await params;
    await requireOwnedDoctor(id, staff.clinicId);

    await prisma.doctor.update({ where: { id }, data: { isActive: false } });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
