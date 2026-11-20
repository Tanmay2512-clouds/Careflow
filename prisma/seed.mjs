import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function dayKey(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function at(day, time) {
  return new Date(`${day}T${time}:00`);
}

function tokenCode(number) {
  return `T-${`${number}`.padStart(3, "0")}`;
}

const weekdaySchedules = (start = "09:00", end = "13:00", slotMinutes = 15) => [
  ...Array.from({ length: 6 }, (_, index) => ({
    dayOfWeek: index + 1,
    startTime: start,
    endTime: end,
    slotMinutes,
  })),
  ...Array.from({ length: 6 }, (_, index) => ({
    dayOfWeek: index + 1,
    startTime: "16:00",
    endTime: "19:00",
    slotMinutes,
  })),
];

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: "staff@careflow.health" },
  });

  if (existing) {
    console.log("Demo data already present — skipping seed.");
    return;
  }

  const staffPassword = await bcrypt.hash("staff12345", 10);
  const patientPassword = await bcrypt.hash("patient12345", 10);

  const [staff] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Anita Rao",
        email: "staff@careflow.health",
        phone: "+91 98450 11001",
        passwordHash: staffPassword,
        role: "STAFF",
      },
    }),
    prisma.user.create({
      data: {
        name: "Arjun Sharma",
        email: "patient@careflow.health",
        phone: "+91 98450 22002",
        passwordHash: patientPassword,
        role: "PATIENT",
      },
    }),
    prisma.user.create({
      data: {
        name: "Neha Patel",
        email: "neha@careflow.health",
        phone: "+91 98450 33003",
        passwordHash: patientPassword,
        role: "PATIENT",
      },
    }),
  ]);

  const patient = await prisma.user.findUnique({ where: { email: "patient@careflow.health" } });
  const neha = await prisma.user.findUnique({ where: { email: "neha@careflow.health" } });

  const familyClinic = await prisma.clinic.create({
    data: {
      name: "CareFlow Family Clinic",
      description:
        "A neighbourhood clinic offering general medicine, paediatrics and dermatology with same-day walk-in support.",
      address: "24, 100 Feet Road, Indiranagar",
      city: "Bengaluru",
      phone: "+91 80 4123 5566",
      email: "hello@careflowfamily.in",
      specialties: ["General Medicine", "Paediatrics", "Dermatology"],
      openingTime: "09:00",
      closingTime: "19:00",
      adminId: staff.id,
    },
  });

  await prisma.user.update({
    where: { id: staff.id },
    data: { clinicId: familyClinic.id },
  });

  const [kavita, sameer, ritu] = await Promise.all([
    prisma.doctor.create({
      data: {
        clinicId: familyClinic.id,
        name: "Dr. Kavita Menon",
        specialty: "General Medicine",
        qualification: "MBBS, MD (Internal Medicine)",
        bio: "Fifteen years of experience in primary care and preventive health.",
        avgConsultMinutes: 10,
        schedules: { create: weekdaySchedules() },
      },
    }),
    prisma.doctor.create({
      data: {
        clinicId: familyClinic.id,
        name: "Dr. Sameer Khan",
        specialty: "Paediatrics",
        qualification: "MBBS, DCH",
        bio: "Paediatrician focused on newborn care, vaccinations and child nutrition.",
        avgConsultMinutes: 12,
        schedules: { create: weekdaySchedules("10:00", "13:00", 15) },
      },
    }),
    prisma.doctor.create({
      data: {
        clinicId: familyClinic.id,
        name: "Dr. Ritu Shah",
        specialty: "Dermatology",
        qualification: "MBBS, MD (Dermatology)",
        bio: "Treats acne, eczema and hair-loss concerns with evidence-based care.",
        avgConsultMinutes: 15,
        schedules: { create: weekdaySchedules("11:00", "13:00", 15) },
      },
    }),
  ]);

  const secondaryClinics = [
    {
      staff: {
        name: "Rahul Verma",
        email: "sunrise@careflow.health",
        phone: "+91 98110 44556",
      },
      clinic: {
        name: "Sunrise Multispeciality Centre",
        description:
          "Multi-speciality centre with cardiology and general medicine, plus a dedicated morning walk-in counter.",
        address: "B-12, Lajpat Nagar II",
        city: "New Delhi",
        phone: "+91 11 4102 7788",
        email: "frontdesk@sunrisecare.in",
        specialties: ["Cardiology", "General Medicine"],
        openingTime: "08:30",
        closingTime: "20:00",
      },
      doctors: [
        {
          name: "Dr. Anil Gupta",
          specialty: "Cardiology",
          qualification: "MBBS, DM (Cardiology)",
          bio: "Interventional cardiologist running a preventive heart clinic.",
          avgConsultMinutes: 20,
        },
        {
          name: "Dr. Farah Ali",
          specialty: "General Medicine",
          qualification: "MBBS, MD",
          bio: "General physician with a focus on diabetes and hypertension.",
          avgConsultMinutes: 12,
        },
      ],
    },
    {
      staff: {
        name: "Priya Nair",
        email: "greenleaf@careflow.health",
        phone: "+91 98200 66778",
      },
      clinic: {
        name: "GreenLeaf Clinic",
        description:
          "Orthopaedics and ENT clinic with physiotherapy support and evening appointments.",
        address: "7, Hill Road, Bandra West",
        city: "Mumbai",
        phone: "+91 22 2640 1122",
        email: "care@greenleafclinic.in",
        specialties: ["Orthopaedics", "ENT"],
        openingTime: "09:30",
        closingTime: "18:30",
      },
      doctors: [
        {
          name: "Dr. Sanjay Iyer",
          specialty: "Orthopaedics",
          qualification: "MBBS, MS (Orthopaedics)",
          bio: "Joint pain, sports injuries and post-operative rehabilitation.",
          avgConsultMinutes: 15,
        },
        {
          name: "Dr. Meera Joshi",
          specialty: "ENT",
          qualification: "MBBS, MS (ENT)",
          bio: "Sinus, allergy and hearing care for adults and children.",
          avgConsultMinutes: 12,
        },
      ],
    },
  ];

  for (const entry of secondaryClinics) {
    const owner = await prisma.user.create({
      data: {
        name: entry.staff.name,
        email: entry.staff.email,
        phone: entry.staff.phone,
        passwordHash: staffPassword,
        role: "STAFF",
      },
    });

    const clinic = await prisma.clinic.create({
      data: {
        ...entry.clinic,
        adminId: owner.id,
      },
    });

    await prisma.user.update({
      where: { id: owner.id },
      data: { clinicId: clinic.id },
    });

    for (const doctor of entry.doctors) {
      await prisma.doctor.create({
        data: {
          clinicId: clinic.id,
          ...doctor,
          schedules: { create: weekdaySchedules() },
        },
      });
    }
  }

  const today = dayKey(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = dayKey(tomorrowDate);

  const [arjunAppointment] = await Promise.all([
    prisma.appointment.create({
      data: {
        clinicId: familyClinic.id,
        doctorId: kavita.id,
        patientId: patient.id,
        dateTime: at(today, "11:30"),
        day: today,
        status: "BOOKED",
        reason: "Recurring headache and fatigue",
      },
    }),
    prisma.appointment.create({
      data: {
        clinicId: familyClinic.id,
        doctorId: ritu.id,
        patientId: patient.id,
        dateTime: at(tomorrow, "11:15"),
        day: tomorrow,
        status: "BOOKED",
        reason: "Skin allergy follow-up",
      },
    }),
    prisma.appointment.create({
      data: {
        clinicId: familyClinic.id,
        doctorId: sameer.id,
        patientId: neha.id,
        dateTime: at(today, "10:15"),
        day: today,
        status: "CHECKED_IN",
        reason: "Child vaccination review",
      },
    }),
  ]);

  await prisma.tokenCounter.create({
    data: { clinicId: familyClinic.id, day: today, lastToken: 3 },
  });

  await prisma.queueEntry.createMany({
    data: [
      {
        clinicId: familyClinic.id,
        doctorId: kavita.id,
        patientId: patient.id,
        appointmentId: arjunAppointment.id,
        patientName: "Arjun Sharma",
        patientPhone: "+91 98450 22002",
        type: "APPOINTMENT",
        status: "WAITING",
        tokenNumber: 1,
        tokenCode: tokenCode(1),
        day: today,
        estimatedWaitMinutes: 12,
        joinedAt: new Date(Date.now() - 25 * 60 * 1000),
      },
      {
        clinicId: familyClinic.id,
        doctorId: sameer.id,
        patientId: neha.id,
        patientName: "Neha Patel",
        patientPhone: "+91 98450 33003",
        type: "APPOINTMENT",
        status: "IN_CONSULTATION",
        tokenNumber: 2,
        tokenCode: tokenCode(2),
        day: today,
        estimatedWaitMinutes: 0,
        joinedAt: new Date(Date.now() - 18 * 60 * 1000),
        startedAt: new Date(Date.now() - 6 * 60 * 1000),
      },
      {
        clinicId: familyClinic.id,
        doctorId: kavita.id,
        patientName: "Vikram Singh",
        patientPhone: "+91 90080 77112",
        type: "WALK_IN",
        status: "WAITING",
        tokenNumber: 3,
        tokenCode: tokenCode(3),
        day: today,
        estimatedWaitMinutes: 22,
        joinedAt: new Date(Date.now() - 9 * 60 * 1000),
      },
    ],
  });

  console.log("CareFlow demo data seeded.");
  console.log("Staff login   : staff@careflow.health / staff12345");
  console.log("Patient login : patient@careflow.health / patient12345");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
