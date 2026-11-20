import { z } from "zod";

const phone = z
  .string()
  .trim()
  .min(6, "Enter a valid phone number.")
  .max(20, "Enter a valid phone number.");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
  phone: phone.optional().or(z.literal("")),
  role: z.enum(["PATIENT", "STAFF"]).default("PATIENT"),
  clinicName: z.string().trim().min(2).max(120).optional(),
  clinicAddress: z.string().trim().min(3).max(200).optional(),
  clinicCity: z.string().trim().min(2).max(80).optional(),
  clinicPhone: phone.optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

const dayString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.");

const timeString = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Pick a valid time.");

export const bookingSchema = z.object({
  doctorId: z.string().min(1),
  date: dayString,
  time: timeString,
  reason: z.string().trim().max(300).optional(),
});

export const queueJoinSchema = z.object({
  doctorId: z.string().min(1),
});

export const walkInSchema = z.object({
  doctorId: z.string().min(1),
  patientName: z.string().trim().min(2, "Enter the patient name.").max(80),
  patientPhone: phone.optional().or(z.literal("")),
});

export const queueActionSchema = z.object({
  action: z.enum(["START", "COMPLETE", "CANCEL", "NO_SHOW"]),
});

export const appointmentActionSchema = z.object({
  action: z.literal("cancel"),
});

export const scheduleInputSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: timeString,
    endTime: timeString,
    slotMinutes: z.number().int().min(5).max(120).default(15),
    isActive: z.boolean().default(true),
  })
  .refine((value) => value.startTime < value.endTime, {
    message: "End time must be after start time.",
    path: ["endTime"],
  });

export const doctorInputSchema = z.object({
  name: z.string().trim().min(2, "Enter the doctor's name.").max(80),
  specialty: z.string().trim().min(2, "Enter a specialty.").max(80),
  qualification: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(500).optional(),
  avgConsultMinutes: z.number().int().min(5).max(120).default(10),
  isActive: z.boolean().default(true),
  schedules: z.array(scheduleInputSchema).max(21).optional(),
});

export const clinicInputSchema = z.object({
  name: z.string().trim().min(2, "Enter the clinic name.").max(120),
  description: z.string().trim().max(600).optional(),
  address: z.string().trim().min(3, "Enter the clinic address.").max(200),
  city: z.string().trim().min(2, "Enter the city.").max(80),
  phone: phone,
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  openingTime: z.string().regex(/^\d{2}:\d{2}$/),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/),
  specialties: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type DoctorInput = z.infer<typeof doctorInputSchema>;
export type ClinicInput = z.infer<typeof clinicInputSchema>;
