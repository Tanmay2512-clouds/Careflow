import bcrypt from "bcryptjs";
import { errorResponse, readJson } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await readJson(request));

    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      return Response.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      return Response.json({ error: "Invalid email or password." }, { status: 401 });
    }

    await createSession(user.id);

    return Response.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
