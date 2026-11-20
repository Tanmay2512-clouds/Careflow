import { ApiError, errorResponse, readJson, requireStaff } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { clinicInputSchema } from "@/lib/validation";

async function loadClinic(clinicId: string) {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    include: {
      _count: { select: { doctors: true, staff: true } },
    },
  });
  if (!clinic) throw new ApiError(404, "Clinic not found.");
  return clinic;
}

export async function GET() {
  try {
    const staff = await requireStaff();
    const clinic = await loadClinic(staff.clinicId);

    return Response.json({
      clinic: {
        ...clinic,
        doctorCount: clinic._count.doctors,
        staffCount: clinic._count.staff,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const staff = await requireStaff();
    const input = clinicInputSchema.parse(await readJson(request));

    const clinic = await prisma.clinic.update({
      where: { id: staff.clinicId },
      data: {
        name: input.name,
        description: input.description || null,
        address: input.address,
        city: input.city,
        phone: input.phone,
        email: input.email || null,
        openingTime: input.openingTime,
        closingTime: input.closingTime,
        specialties: input.specialties,
      },
    });

    return Response.json({ clinic });
  } catch (error) {
    return errorResponse(error);
  }
}
