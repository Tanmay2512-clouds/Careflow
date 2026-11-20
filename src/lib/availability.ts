import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { generateSlots } from "@/lib/slots";
import { dayKey } from "@/lib/time";

export type AvailabilitySlot = { time: string; available: boolean };

export function timeLabel(date: Date) {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

export async function getDoctorAvailability(
  doctorId: string,
  day: string,
): Promise<AvailabilitySlot[]> {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    include: { schedules: true },
  });

  if (!doctor || !doctor.isActive) throw new ApiError(404, "Doctor not found.");

  const times = generateSlots(doctor.schedules, day);
  if (times.length === 0) return [];

  const booked = await prisma.appointment.findMany({
    where: {
      doctorId,
      day,
      status: { in: ["BOOKED", "CHECKED_IN", "COMPLETED"] },
    },
    select: { dateTime: true },
  });

  const taken = new Set(booked.map((appointment) => timeLabel(appointment.dateTime)));
  const today = dayKey();

  return times.map((time) => {
    const isPast = day < today;
    return { time, available: !taken.has(time) && !isPast };
  });
}
