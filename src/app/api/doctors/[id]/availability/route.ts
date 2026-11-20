import { errorResponse, isObjectId } from "@/lib/api";
import { getDoctorAvailability } from "@/lib/availability";
import { prisma } from "@/lib/prisma";
import { dayKey, isValidDayKey } from "@/lib/time";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!isObjectId(id)) {
      return Response.json({ error: "Doctor not found." }, { status: 404 });
    }

    const url = new URL(request.url);
    const dayParam = url.searchParams.get("day");
    const day = dayParam && isValidDayKey(dayParam) ? dayParam : dayKey();

    const doctor = await prisma.doctor.findUnique({
      where: { id },
      include: { clinic: { select: { id: true, name: true, address: true, city: true } } },
    });
    if (!doctor || !doctor.isActive) {
      return Response.json({ error: "Doctor not found." }, { status: 404 });
    }

    const slots = await getDoctorAvailability(id, day);

    return Response.json({
      day,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        specialty: doctor.specialty,
        avgConsultMinutes: doctor.avgConsultMinutes,
        clinic: doctor.clinic,
      },
      slots,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
