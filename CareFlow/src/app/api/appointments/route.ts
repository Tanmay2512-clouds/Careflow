import { ApiError, errorResponse, isObjectId, readJson, requireUser } from "@/lib/api";
import { timeLabel } from "@/lib/availability";
import { prisma } from "@/lib/prisma";
import { generateSlots } from "@/lib/slots";
import { dateAtTime, dayKey, isValidDayKey } from "@/lib/time";
import { bookingSchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);

    if (user.role === "PATIENT") {
      const appointments = await prisma.appointment.findMany({
        where: { patientId: user.id },
        orderBy: { dateTime: "asc" },
        include: {
          doctor: { select: { id: true, name: true, specialty: true } },
          clinic: { select: { id: true, name: true, address: true, city: true } },
          queueEntries: {
            orderBy: { joinedAt: "desc" },
            take: 1,
            select: { id: true, status: true, tokenCode: true, day: true },
          },
        },
      });

      return Response.json({ appointments });
    }

    if (!user.clinicId) {
      throw new ApiError(400, "Your account is not linked to a clinic yet.");
    }

    const dayParam = url.searchParams.get("day");
    const day = dayParam && isValidDayKey(dayParam) ? dayParam : dayKey();

    const appointments = await prisma.appointment.findMany({
      where: { clinicId: user.clinicId, day },
      orderBy: { dateTime: "asc" },
      include: {
        doctor: { select: { id: true, name: true, specialty: true } },
        patient: { select: { id: true, name: true, phone: true } },
        queueEntries: {
          orderBy: { joinedAt: "desc" },
          take: 1,
          select: { id: true, status: true, tokenCode: true },
        },
      },
    });

    return Response.json({ day, appointments });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "PATIENT") {
      throw new ApiError(403, "Staff accounts cannot book appointments.");
    }

    const input = bookingSchema.parse(await readJson(request));
    if (!isObjectId(input.doctorId)) throw new ApiError(404, "Doctor not found.");
    if (!isValidDayKey(input.date)) throw new ApiError(400, "Pick a valid date.");

    const doctor = await prisma.doctor.findUnique({
      where: { id: input.doctorId },
      include: {
        schedules: true,
        clinic: { select: { id: true, name: true, isActive: true } },
      },
    });

    if (!doctor || !doctor.isActive || !doctor.clinic.isActive) {
      throw new ApiError(404, "Doctor not found.");
    }

    const slots = generateSlots(doctor.schedules, input.date);
    if (!slots.includes(input.time)) {
      throw new ApiError(400, "That time is outside the doctor's schedule.");
    }

    const dateTime = dateAtTime(input.date, input.time);
    if (dateTime.getTime() < Date.now()) {
      throw new ApiError(400, "Pick a time in the future.");
    }

    const clash = await prisma.appointment.findFirst({
      where: {
        doctorId: doctor.id,
        dateTime,
        status: { in: ["BOOKED", "CHECKED_IN"] },
      },
      select: { id: true },
    });
    if (clash) throw new ApiError(409, "That slot was just booked. Pick another time.");

    const patientClash = await prisma.appointment.findFirst({
      where: {
        patientId: user.id,
        dateTime,
        status: { in: ["BOOKED", "CHECKED_IN"] },
      },
      select: { id: true },
    });
    if (patientClash) {
      throw new ApiError(409, "You already have an appointment at that time.");
    }

    const appointment = await prisma.appointment.create({
      data: {
        clinicId: doctor.clinicId,
        doctorId: doctor.id,
        patientId: user.id,
        dateTime,
        day: input.date,
        reason: input.reason || null,
      },
      include: {
        doctor: { select: { id: true, name: true, specialty: true } },
        clinic: { select: { id: true, name: true, address: true, city: true } },
      },
    });

    return Response.json(
      {
        appointment,
        slot: { time: timeLabel(appointment.dateTime) },
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
