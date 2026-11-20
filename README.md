# CareFlow

**Clinic access and patient-flow management.**

CareFlow brings clinic discovery, scheduled appointments, and walk-in queues into one patient flow. Patients can find a clinic, book a doctor's available time, join a walk-in queue, and follow their token. Clinic staff can coordinate appointments and walk-ins through a shared daily queue.

## Features

### Patient

- Register and sign in with a patient account.
- Find clinics by name, location, or specialty.
- Browse clinic doctors, schedules, and available appointment slots.
- Book and cancel appointments.
- Check in for an appointment on its scheduled day.
- Join a clinic's walk-in queue and receive a digital token.
- Follow active queue position and estimated wait from the patient dashboard.

### Clinic staff

- Create a clinic staff account and clinic profile.
- Review the daily appointment list and clinic queue.
- Register a walk-in patient and issue a token.
- Call the next patient, mark no-shows, and complete consultations.
- Add and edit doctors, consultation duration, and weekly availability.
- Update clinic details, contact information, hours, and specialties.
- Review daily appointment and queue statistics.

The patient and staff interfaces refresh active visit and queue data automatically. This MVP does not include medical records, diagnosis, prescriptions, payments, pharmacy workflows, or hospital ERP.

## Technology

- Next.js 16 App Router and React 19
- TypeScript
- Next.js Route Handlers (REST API)
- Prisma ORM and MongoDB Atlas
- bcrypt password hashing and signed, HTTP-only session cookies
- CSS with Tailwind CSS 4 tooling

The repository is a single Next.js application; it does not currently have a separate Express server or Supabase integration. MongoDB is the configured database.

## Requirements

- Node.js 20+
- npm
- MongoDB Atlas database and a database user with read/write access

## Local setup

1. Install the project dependencies:

   ```powershell
   npm install
   ```

2. Create a local environment file from the template:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Edit `.env` and set:

   - `DATABASE_URL` to your MongoDB Atlas connection string. URL-encode special characters in the database username or password.
   - `AUTH_SECRET` to a new, private random value. Generate one with:

     ```powershell
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```

   Never commit `.env` or send its contents to a repository. The `.env.example` file contains placeholders only.

4. Create the collections and indexes, then load the demo clinics:

   ```powershell
   npm run db:push
   npm run db:seed
   ```

5. Start the development server:

   ```powershell
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

Ensure MongoDB Atlas network access allows the machine running the application to connect. For deployment, configure `DATABASE_URL` and `AUTH_SECRET` as server-side environment variables in the hosting platform.

## Demo accounts

The seed script creates demonstration clinics, doctors, schedules, appointments, and queue entries.

| Account | Email | Password |
| --- | --- | --- |
| Clinic staff | `staff@careflow.health` | `staff12345` |
| Patient | `patient@careflow.health` | `patient12345` |

These are **demo credentials**. The seed script skips seeding if the primary staff account already exists. Never use the demo passwords for a public or production deployment.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Generate Prisma Client and build the production application |
| `npm run start` | Serve the production build |
| `npm run typecheck` | Run the TypeScript compiler without emitting files |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Synchronize the Prisma schema with MongoDB |
| `npm run db:seed` | Seed the demonstration dataset |

## API overview

| Route | Purpose |
| --- | --- |
| `/api/auth/register` | Register a patient or clinic staff account |
| `/api/auth/login` | Start an authenticated session |
| `/api/auth/logout` | End the current session |
| `/api/auth/me` | Return the current session user |
| `/api/clinics` | Search active clinics |
| `/api/clinics/:id` | Clinic details, doctors, and today's queue summary |
| `/api/clinics/:id/queue` | Public clinic queue status |
| `/api/doctors/:id/availability` | Doctor appointment availability for a day |
| `/api/appointments` | List or book appointments |
| `/api/appointments/:id` | Cancel an authorized appointment |
| `/api/appointments/:id/checkin` | Check in an appointment for today's queue |
| `/api/queue` | Join a queue or register a staff-entered walk-in |
| `/api/queue/:id` | Staff queue actions |
| `/api/me/queue` | Current patient's queue entries |
| `/api/staff/overview` | Staff clinic dashboard and daily statistics |
| `/api/staff/clinic` | Read or update the staff member's clinic |
| `/api/staff/doctors` | List or add clinic doctors |
| `/api/staff/doctors/:id` | Edit or deactivate a clinic doctor |

Write operations require authentication. Staff operations are scoped to the staff member's clinic; patient appointment and queue views are scoped to the signed-in patient.

## Deployment

Deploy the Next.js application to a Next.js-compatible host such as Vercel. Set `DATABASE_URL` and a strong `AUTH_SECRET` in the deployment environment, and configure MongoDB Atlas network access for the deployed application. Do not expose server environment variables in client-side code.

This repository does not include a separate Render/Express service or automated deployment pipeline.

## Security and production notes

- `.env` and other environment files are excluded by `.gitignore`; `.env.example` is safe to commit and must contain placeholders only.
- Change demo account passwords or remove demo data before a public launch.
- Use a unique `AUTH_SECRET` in each environment and use HTTPS in production.
- Configure MongoDB least-privilege access and network restrictions for production.
- Confirm backup, monitoring, privacy, and regulatory requirements before using real patient information. This MVP is a workflow demo, not a medical-record system.
