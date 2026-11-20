import bcrypt from "bcryptjs";
import { ApiError, errorResponse, readJson } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const input = registerSchema.parse(await readJson(request));

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      return Response.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    if (input.role === "STAFF") {
      if (!input.clinicName || !input.clinicAddress || !input.clinicCity || !input.clinicPhone) {
        throw new ApiError(
          400,
          "Clinic name, address, city and phone are required for staff accounts.",
        );
      }
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        passwordHash,
        role: input.role,
      },
    });

    let clinicId: string | null = null;

    if (input.role === "STAFF") {
      const clinic = await prisma.clinic.create({
        data: {
          name: input.clinicName!,
          address: input.clinicAddress!,
          city: input.clinicCity!,
          phone: input.clinicPhone!,
          adminId: user.id,
          specialties: [],
        },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { clinicId: clinic.id },
      });

      clinicId = clinic.id;
    }

    await createSession(user.id);

    return Response.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          clinicId,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
