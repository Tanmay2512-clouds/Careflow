import { ApiError, errorResponse, isObjectId, readJson, requireUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createQueueEntry } from "@/lib/queue";
import { dayKey } from "@/lib/time";
import { queueJoinSchema, walkInSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const payload = await readJson(request);

    const isStaff = user.role === "STAFF";
    let doctorId: string;
    let patientName = user.name;
    let patientPhone = user.phone;

    if (isStaff) {
      const input = walkInSchema.parse(payload);
      doctorId = input.doctorId;
      patientName = input.patientName;
      patientPhone = input.patientPhone || null;
    } else {
      const input = queueJoinSchema.parse(payload);
      doctorId = input.doctorId;
    }

    if (!isObjectId(doctorId)) throw new ApiError(404, "Doctor not found.");

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        clinic: { select: { id: true, name: true, isActive: true } },
      },
    });

    if (!doctor || !doctor.isActive || !doctor.clinic.isActive) {
      throw new ApiError(404, "Doctor not found.");
    }

    if (isStaff) {
      if (!user.clinicId) throw new ApiError(400, "Your account is not linked to a clinic.");
      if (doctor.clinicId !== user.clinicId) {
        throw new ApiError(403, "You can only register patients for your own clinic.");
      }
    }

    const active = await prisma.queueEntry.findFirst({
      where: {
        patientId: user.id,
        day: dayKey(),
        status: { in: ["WAITING", "IN_CONSULTATION"] },
      },
      select: { id: true, tokenCode: true },
    });
    if (!isStaff && active) {
      throw new ApiError(
        409,
        `You already hold token ${active.tokenCode}. Complete or cancel it before joining again.`,
      );
    }

    const result = await createQueueEntry({
      clinicId: doctor.clinicId,
      doctorId: doctor.id,
      patientId: isStaff ? null : user.id,
      patientName,
      patientPhone,
      type: "WALK_IN",
    });

    return Response.json(
      {
        entry: result.entry,
        position: result.position,
        estimatedWaitMinutes: result.estimatedWaitMinutes,
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
