import { errorResponse } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { dayKey } from "@/lib/time";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const city = url.searchParams.get("city")?.trim() ?? "";

    const clinics = await prisma.clinic.findMany({
      where: {
        isActive: true,
        ...(city ? { city } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { address: { contains: q } },
                { city: { contains: q } },
                { specialties: { has: q } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      include: {
        doctors: {
          where: { isActive: true },
          select: { id: true, name: true, specialty: true },
        },
      },
    });

    const waiting = await prisma.queueEntry.groupBy({
      by: ["clinicId"],
      where: { day: dayKey(), status: "WAITING" },
      _count: { _all: true },
    });

    const waitingMap = new Map(waiting.map((row) => [row.clinicId, row._count._all]));
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    return Response.json({
      clinics: clinics.map((clinic) => {
        const [openHour, openMinute] = clinic.openingTime.split(":").map(Number);
        const [closeHour, closeMinute] = clinic.closingTime.split(":").map(Number);
        const open = nowMinutes >= openHour * 60 + openMinute;
        const close = nowMinutes <= closeHour * 60 + closeMinute;

        return {
          id: clinic.id,
          name: clinic.name,
          description: clinic.description,
          address: clinic.address,
          city: clinic.city,
          phone: clinic.phone,
          specialties: clinic.specialties,
          openingTime: clinic.openingTime,
          closingTime: clinic.closingTime,
          isOpenNow: open && close,
          waitingCount: waitingMap.get(clinic.id) ?? 0,
          doctorCount: clinic.doctors.length,
          doctors: clinic.doctors,
        };
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
