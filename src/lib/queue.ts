import type { QueueStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dayKey } from "@/lib/time";

export const ACTIVE_QUEUE_STATUSES: QueueStatus[] = ["WAITING", "IN_CONSULTATION"];

export type QueueRow = {
  id: string;
  tokenNumber: number;
  tokenCode: string;
  status: QueueStatus;
  type: "APPOINTMENT" | "WALK_IN";
  patientName: string;
  patientPhone: string | null;
  joinedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  doctorId: string;
  doctorName: string;
  specialty: string;
  avgConsultMinutes: number;
};

export function orderQueue<T extends { tokenNumber: number }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => a.tokenNumber - b.tokenNumber);
}

export function buildQueuePositions(entries: QueueRow[]) {
  const ordered = orderQueue(entries);
  const waiting = ordered.filter((entry) => entry.status === "WAITING");
  const consulting = ordered.find((entry) => entry.status === "IN_CONSULTATION");

  return ordered.map((entry) => {
    if (entry.status !== "WAITING") {
      return { ...entry, position: 0, estimatedWaitMinutes: 0 };
    }

    const ahead = waiting.filter((other) => other.tokenNumber < entry.tokenNumber);
    const idleCredit = consulting ? Math.round(consulting.avgConsultMinutes / 2) : 0;
    const minutes = ahead.reduce((total, other) => total + other.avgConsultMinutes, idleCredit);

    return {
      ...entry,
      position: ahead.length + 1,
      estimatedWaitMinutes: minutes,
    };
  });
}

export async function fetchQueueRows(clinicId: string, day: string): Promise<QueueRow[]> {
  const entries = await prisma.queueEntry.findMany({
    where: { clinicId, day },
    orderBy: { tokenNumber: "asc" },
    include: {
      doctor: { select: { id: true, name: true, specialty: true, avgConsultMinutes: true } },
    },
  });

  return entries.map((entry) => ({
    id: entry.id,
    tokenNumber: entry.tokenNumber,
    tokenCode: entry.tokenCode,
    status: entry.status,
    type: entry.type,
    patientName: entry.patientName,
    patientPhone: entry.patientPhone,
    joinedAt: entry.joinedAt,
    startedAt: entry.startedAt,
    completedAt: entry.completedAt,
    doctorId: entry.doctor.id,
    doctorName: entry.doctor.name,
    specialty: entry.doctor.specialty,
    avgConsultMinutes: entry.doctor.avgConsultMinutes,
  }));
}

export async function issueToken(clinicId: string, day: string) {
  const counter = await prisma.tokenCounter.upsert({
    where: { clinicId_day: { clinicId, day } },
    create: { clinicId, day, lastToken: 1 },
    update: { lastToken: { increment: 1 } },
  });

  return {
    tokenNumber: counter.lastToken,
    tokenCode: `T-${`${counter.lastToken}`.padStart(3, "0")}`,
  };
}

export async function createQueueEntry(params: {
  clinicId: string;
  doctorId: string;
  patientId?: string | null;
  patientName: string;
  patientPhone?: string | null;
  type: "APPOINTMENT" | "WALK_IN";
  appointmentId?: string | null;
}) {
  const day = dayKey();
  const { tokenNumber, tokenCode } = await issueToken(params.clinicId, day);

  const doctor = await prisma.doctor.findUnique({
    where: { id: params.doctorId },
    select: { avgConsultMinutes: true },
  });
  const avgMinutes = doctor?.avgConsultMinutes ?? 10;

  const ahead = await prisma.queueEntry.count({
    where: { clinicId: params.clinicId, day, status: "WAITING" },
  });

  const entry = await prisma.queueEntry.create({
    data: {
      clinicId: params.clinicId,
      doctorId: params.doctorId,
      patientId: params.patientId ?? null,
      appointmentId: params.appointmentId ?? null,
      patientName: params.patientName,
      patientPhone: params.patientPhone ?? null,
      type: params.type,
      tokenNumber,
      tokenCode,
      day,
      estimatedWaitMinutes: ahead * avgMinutes,
    },
    include: {
      doctor: { select: { id: true, name: true, specialty: true, avgConsultMinutes: true } },
    },
  });

  return { entry, position: ahead + 1, estimatedWaitMinutes: ahead * avgMinutes };
}
