import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { getSession, type SessionUser } from "@/lib/auth";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    console.error("[careflow:database]", error.message);
    return Response.json(
      { error: "Database unavailable. Check DATABASE_URL and database network access." },
      { status: 503 },
    );
  }

  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const path = issue?.path?.join(".");
    const message = issue?.message ?? "Invalid input.";
    return Response.json(
      { error: path ? `${path}: ${message}` : message },
      { status: 400 },
    );
  }

  console.error("[careflow:api]", error);
  return Response.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new ApiError(401, "Please sign in to continue.");
  return user;
}

export async function requireStaff(): Promise<SessionUser & { clinicId: string }> {
  const user = await requireUser();
  if (user.role !== "STAFF") {
    throw new ApiError(403, "Only clinic staff can perform this action.");
  }
  if (!user.clinicId) {
    throw new ApiError(400, "Create or join a clinic before managing it.");
  }
  return user as SessionUser & { clinicId: string };
}

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

export function isObjectId(value: unknown): value is string {
  return typeof value === "string" && OBJECT_ID_PATTERN.test(value);
}

export function assertObjectId(value: unknown, label = "id") {
  if (!isObjectId(value)) throw new ApiError(400, `Invalid ${label}.`);
  return value;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.");
  }
}
