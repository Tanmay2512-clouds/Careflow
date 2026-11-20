"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type User = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "PATIENT" | "STAFF";
  clinicId: string | null;
};

type Doctor = {
  id: string;
  name: string;
  specialty: string;
  qualification?: string | null;
  bio?: string | null;
  avgConsultMinutes: number;
  isActive?: boolean;
  schedules?: Schedule[];
};

type Schedule = {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  isActive: boolean;
};

type Clinic = {
  id: string;
  name: string;
  description?: string | null;
  address: string;
  city: string;
  phone: string;
  email?: string | null;
  specialties: string[];
  openingTime: string;
  closingTime: string;
  isOpenNow?: boolean;
  waitingCount?: number;
  doctorCount?: number;
  doctors?: Doctor[];
  today?: { waiting: number; inConsultation: number; lastToken: number };
};

type Appointment = {
  id: string;
  dateTime: string;
  day: string;
  status: string;
  reason?: string | null;
  doctor: Pick<Doctor, "id" | "name" | "specialty">;
  clinic: Pick<Clinic, "id" | "name" | "address" | "city">;
  patient?: { id: string; name: string; phone: string | null };
  queueEntries?: { id: string; status: string; tokenCode: string }[];
};

type QueueEntry = {
  id: string;
  tokenNumber: number;
  tokenCode: string;
  status: string;
  type: "APPOINTMENT" | "WALK_IN";
  patientName: string;
  patientPhone: string | null;
  doctorId: string;
  doctorName: string;
  specialty: string;
  position: number;
  estimatedWaitMinutes: number;
  clinic?: Pick<Clinic, "id" | "name" | "address" | "city" | "phone"> | null;
};

type StaffOverview = {
  day: string;
  clinic: Clinic;
  doctors: number;
  appointments: Appointment[];
  queue: { entries: QueueEntry[]; nowServing: QueueEntry[]; waiting: QueueEntry[] };
  stats: Record<string, number | null>;
};

type AuthMode = "login" | "register";
type View = "discover" | "visits" | "staff";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? "Something went wrong. Please try again.");
  }
  return data as T;
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-${`${now.getDate()}`.padStart(2, "0")}`;
}

function formatDay(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatWait(minutes: number) {
  if (minutes <= 0) return "Up next";
  if (minutes < 60) return `About ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `About ${hours} hr ${rest} min` : `About ${hours} hr`;
}

function Icon({
  name,
  size = 20,
}: {
  name: "heart" | "search" | "pin" | "clock" | "arrow" | "close" | "calendar" | "user" | "check" | "plus" | "logout" | "menu" | "phone" | "spark";
  size?: number;
}) {
  const paths: Record<typeof name, React.ReactNode> = {
    heart: <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    phone: <><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 2.8a2 2 0 0 1-.6 1.9L7.7 9.7a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 1.9-.6l2.8.5a2 2 0 0 1 1.7 2.6Z" /></>,
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 14 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5Z" /></>,
  };
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "status-active",
    WAITING: "status-waiting",
    IN_CONSULTATION: "status-active",
    COMPLETED: "status-complete",
    BOOKED: "status-booked",
    CHECKED_IN: "status-active",
    CANCELLED: "status-muted",
    NO_SHOW: "status-muted",
  };
  const label = status === "ACTIVE" ? "Active" : status.toLowerCase().replaceAll("_", " ");
  return <span className={`status-pill ${styles[status] ?? "status-muted"}`}>{label}</span>;
}

function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={`modal-card${wide ? " modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default function CareFlowApp() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("discover");
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [loadingClinics, setLoadingClinics] = useState(true);
  const [clinicLoadError, setClinicLoadError] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);
  const [patientQueue, setPatientQueue] = useState<QueueEntry[]>([]);
  const [staffData, setStaffData] = useState<StaffOverview | null>(null);
  const [staffDoctors, setStaffDoctors] = useState<Doctor[]>([]);
  const [staffDay, setStaffDay] = useState(todayKey());
  const [staffTab, setStaffTab] = useState<"overview" | "queue" | "doctors" | "clinic">("overview");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [registerRole, setRegisterRole] = useState<"PATIENT" | "STAFF">("PATIENT");

  const refreshClinics = useCallback(async (term = search, town = city) => {
    setLoadingClinics(true);
    try {
      const params = new URLSearchParams();
      if (term.trim()) params.set("q", term.trim());
      if (town.trim()) params.set("city", town.trim());
      const result = await api<{ clinics: Clinic[] }>(`/api/clinics${params.size ? `?${params}` : ""}`);
      setClinics(result.clinics);
      setClinicLoadError("");
    } catch (reason) {
      setClinicLoadError(reason instanceof Error ? reason.message : "Could not load clinics.");
    } finally {
      setLoadingClinics(false);
    }
  }, [search, city]);

  const refreshPatient = useCallback(async () => {
    const [appointments, queue] = await Promise.all([
      api<{ appointments: Appointment[] }>("/api/appointments"),
      api<{ entries: QueueEntry[] }>("/api/me/queue"),
    ]);
    setPatientAppointments(appointments.appointments);
    setPatientQueue(queue.entries);
  }, []);

  const refreshStaff = useCallback(async (day = staffDay) => {
    const [overview, doctors] = await Promise.all([
      api<StaffOverview>(`/api/staff/overview?day=${day}`),
      api<{ doctors: Doctor[] }>("/api/staff/doctors"),
    ]);
    setStaffData(overview);
    setStaffDoctors(doctors.doctors);
  }, [staffDay]);

  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ user: User | null }>("/api/auth/me"),
      api<{ clinics: Clinic[] }>("/api/clinics"),
    ]).then(([session, result]) => {
      if (!active) return;
      setUser(session.user);
      setClinics(result.clinics);
      setClinicLoadError("");
      if (session.user?.role === "STAFF") setView("staff");
    }).catch((reason: unknown) => {
      if (active) setClinicLoadError(reason instanceof Error ? reason.message : "Could not connect to CareFlow.");
    }).finally(() => {
      if (active) setLoadingClinics(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user || user.role !== "PATIENT") return;
    let interval: number | undefined;
    const initial = window.setTimeout(() => {
      refreshPatient().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load your visits."));
      interval = window.setInterval(() => {
        refreshPatient().catch(() => undefined);
      }, 20000);
    }, 0);
    return () => {
      window.clearTimeout(initial);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [user, refreshPatient]);

  useEffect(() => {
    if (!user || user.role !== "STAFF") return;
    let interval: number | undefined;
    const initial = window.setTimeout(() => {
      refreshStaff(staffDay).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load the clinic dashboard."));
      interval = window.setInterval(() => {
        refreshStaff(staffDay).catch(() => undefined);
      }, 20000);
    }, 0);
    return () => {
      window.clearTimeout(initial);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [user, staffDay, refreshStaff]);

  const activeQueue = useMemo(
    () => patientQueue.filter((entry) => ["WAITING", "IN_CONSULTATION"].includes(entry.status)),
    [patientQueue],
  );

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const mode = authMode ?? "login";
    const payload: Record<string, string> = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    if (mode === "register") {
      payload.name = String(form.get("name") ?? "");
      payload.phone = String(form.get("phone") ?? "");
      payload.role = String(form.get("role") ?? "PATIENT");
      if (payload.role === "STAFF") {
        payload.clinicName = String(form.get("clinicName") ?? "");
        payload.clinicAddress = String(form.get("clinicAddress") ?? "");
        payload.clinicCity = String(form.get("clinicCity") ?? "");
        payload.clinicPhone = String(form.get("clinicPhone") ?? "");
      }
    }
    setWorking(true);
    setError("");
    try {
      const result = await api<{ user: User }>(`/api/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setUser(result.user);
      setView(result.user.role === "STAFF" ? "staff" : "visits");
      setAuthMode(null);
      setNotice(`Welcome${result.user.name ? `, ${result.user.name.split(" ")[0]}` : ""}!`);
      if (result.user.role === "PATIENT") await refreshPatient();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign in.");
    } finally {
      setWorking(false);
    }
  }

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
    setView("discover");
    setPatientAppointments([]);
    setPatientQueue([]);
    setNotice("You have been signed out.");
  }

  async function openClinic(id: string) {
    setSelectedClinic(null);
    setError("");
    try {
      const result = await api<{ clinic: Clinic }>(`/api/clinics/${id}`);
      setSelectedClinic(result.clinic);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load clinic details.");
    }
  }

  async function joinQueue(doctorId: string) {
    if (!user) {
      setSelectedClinic(null);
      setAuthMode("login");
      setNotice("Sign in to join a clinic queue.");
      return;
    }
    setWorking(true);
    setError("");
    try {
      const result = await api<{ entry: QueueEntry; position: number; estimatedWaitMinutes: number }>("/api/queue", {
        method: "POST",
        body: JSON.stringify({ doctorId }),
      });
      setSelectedClinic(null);
      await refreshPatient();
      setView("visits");
      setNotice(`You’re checked in. Your token is ${result.entry.tokenCode}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not join the queue.");
    } finally {
      setWorking(false);
    }
  }

  async function appointmentAction(id: string, action: "cancel" | "checkin") {
    setWorking(true);
    setError("");
    try {
      if (action === "checkin") {
        const result = await api<{ entry: QueueEntry }>("/api/appointments/" + id + "/checkin", { method: "POST" });
        setNotice(`Checked in. Your token is ${result.entry.tokenCode}.`);
      } else {
        await api(`/api/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ action }) });
        setNotice("Appointment cancelled.");
      }
      await refreshPatient();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update appointment.");
    } finally {
      setWorking(false);
    }
  }

  async function runQueueAction(id: string, action: "START" | "COMPLETE" | "CANCEL" | "NO_SHOW") {
    setWorking(true);
    setError("");
    try {
      await api(`/api/queue/${id}`, { method: "PATCH", body: JSON.stringify({ action }) });
      await refreshStaff();
      setNotice(action === "START" ? "Patient marked in consultation." : `Queue token ${action.toLowerCase()}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update the queue.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setView("discover"); }}>
          <span className="brand-mark"><Icon name="heart" size={19} /></span>
          <span>careflow<span className="brand-period">.</span></span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={view === "discover" ? "nav-link nav-link-active" : "nav-link"} onClick={() => setView("discover")}>Find care</button>
          {user?.role === "PATIENT" && <button className={view === "visits" ? "nav-link nav-link-active" : "nav-link"} onClick={() => setView("visits")}>My visits</button>}
          {user?.role === "STAFF" && <button className={view === "staff" ? "nav-link nav-link-active" : "nav-link"} onClick={() => setView("staff")}>Clinic dashboard</button>}
        </nav>
        <div className="header-account">
          {user ? (
            <>
              <span className="account-name"><span className="avatar">{user.name.charAt(0).toUpperCase()}</span><span className="account-name-text">{user.name}</span></span>
              <button className="button button-outline button-small" onClick={() => void signOut()}><Icon name="logout" size={16} /><span>Sign out</span></button>
            </>
          ) : (
            <>
              <button className="button button-text button-small" onClick={() => { setError(""); setAuthMode("login"); }}>Sign in</button>
              <button className="button button-primary button-small" onClick={() => { setError(""); setAuthMode("register"); }}>Get started</button>
            </>
          )}
        </div>
      </header>

      {error && <div className="feedback feedback-error" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError("")}><Icon name="close" size={16} /></button></div>}
      {notice && <div className="feedback feedback-success" role="status"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice("")}><Icon name="close" size={16} /></button></div>}

      {view === "discover" && (
        <>
          <section className="hero">
            <div className="hero-content">
              <div className="eyebrow"><span className="eyebrow-dot" /> HEALTHCARE, ON YOUR TIME</div>
              <h1>Good care.<br /><span>No guesswork.</span></h1>
              <p className="hero-copy">Find trusted clinics, book a time that works, or join the queue before you arrive.</p>
              <form className="search-panel" onSubmit={(event) => { event.preventDefault(); void refreshClinics(); }}>
                <label className="search-field">
                  <Icon name="search" size={19} />
                  <span className="sr-only">Clinic or specialty</span>
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Clinic, doctor or specialty" />
                </label>
                <span className="search-divider" />
                <label className="search-field search-location">
                  <Icon name="pin" size={19} />
                  <span className="sr-only">City</span>
                  <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City" />
                </label>
                <button className="button button-primary search-button" type="submit"><span>Search clinics</span><Icon name="arrow" size={17} /></button>
              </form>
              <div className="hero-proof"><span className="proof-check"><Icon name="check" size={13} /></span> Book appointments <span className="proof-separator">·</span> Join walk-in queues <span className="proof-separator">·</span> Track your turn</div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="art-glow" />
              <div className="art-card art-card-main">
                <div className="art-card-top"><span className="art-label">YOUR VISIT, IN FLOW</span><span className="art-live"><i /> LIVE</span></div>
                <div className="art-doctor"><div className="doctor-avatar">✳</div><div><strong>Care, made simple.</strong><span>From booking to check-in</span></div></div>
                <div className="art-steps">
                  <div className="art-step art-step-done"><span><Icon name="check" size={13} /></span><div><strong>Appointment booked</strong><small>Today · 10:30 AM</small></div></div>
                  <div className="art-step art-step-current"><span className="step-number">2</span><div><strong>Check in with your token</strong><small>Your place in line is saved</small></div></div>
                  <div className="art-step"><span className="step-number">3</span><div><strong>See your doctor</strong><small>We’ll keep you in the loop</small></div></div>
                </div>
              </div>
              <div className="floating-note"><span className="floating-icon"><Icon name="clock" size={17} /></span><span><strong>Less waiting,</strong><small>more peace of mind</small></span></div>
              <span className="art-star star-one">✳</span><span className="art-star star-two">✳</span>
            </div>
          </section>
          <section className="discovery-section" id="clinics">
            <div className="section-heading">
              <div><div className="eyebrow eyebrow-dark">CARE AROUND YOU</div><h2>Clinics ready to help</h2><p>Choose a clinic to see doctors, availability and today’s queue.</p></div>
              <span className="result-count">{loadingClinics ? "Finding clinics…" : `${clinics.length} ${clinics.length === 1 ? "clinic" : "clinics"}`}</span>
            </div>
            {loadingClinics ? <div className="empty-state"><span className="spinner" /> Finding nearby clinics…</div> : clinicLoadError ? (
              <div className="empty-state" role="alert"><span className="empty-icon"><Icon name="clock" size={22} /></span><h3>Clinics couldn’t load</h3><p>{clinicLoadError}</p><button className="button button-outline" onClick={() => void refreshClinics()}>Try again</button></div>
            ) : clinics.length ? (
              <div className="clinic-grid">
                {clinics.map((clinic, index) => (
                  <article className="clinic-card" key={clinic.id}>
                    <div className={`clinic-card-art clinic-art-${index % 3}`}>
                      <span className="clinic-monogram">{clinic.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                      <span className={`open-badge${clinic.isOpenNow ? "" : " closed-badge"}`}><i />{clinic.isOpenNow ? "Open now" : "Closed now"}</span>
                    </div>
                    <div className="clinic-card-body">
                      <div className="clinic-card-title"><h3>{clinic.name}</h3><span className="clinic-rating">✳ <small>CareFlow</small></span></div>
                      <p className="clinic-address"><Icon name="pin" size={15} />{clinic.address}, {clinic.city}</p>
                      <p className="clinic-description">{clinic.description || "A local clinic ready to help with your care."}</p>
                      <div className="specialty-list">{clinic.specialties.slice(0, 3).map((tag) => <span className="specialty-tag" key={tag}>{tag}</span>)}</div>
                      <div className="clinic-card-meta"><span><Icon name="user" size={15} />{clinic.doctorCount ?? clinic.doctors?.length ?? 0} doctors</span><span><Icon name="clock" size={15} />{clinic.waitingCount ?? 0} waiting today</span></div>
                      <button className="button button-outline clinic-action" onClick={() => void openClinic(clinic.id)}>View clinic & availability <Icon name="arrow" size={16} /></button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state"><span className="empty-icon"><Icon name="search" size={22} /></span><h3>No clinics found</h3><p>Try a different city or specialty, or clear your search.</p><button className="button button-outline" onClick={() => { setSearch(""); setCity(""); void refreshClinics("", ""); }}>Clear filters</button></div>
            )}
          </section>
          <section className="how-section">
            <div className="how-heading"><div className="eyebrow eyebrow-dark">A BETTER KIND OF WAIT</div><h2>Care that keeps moving.</h2><p>From finding a doctor to getting seen, everything stays in sync.</p></div>
            <div className="how-grid">
              <article><span className="how-icon"><Icon name="search" size={21} /></span><span className="how-number">01</span><h3>Find your fit</h3><p>Browse local clinics and see which doctors are available.</p></article>
              <article><span className="how-icon"><Icon name="calendar" size={21} /></span><span className="how-number">02</span><h3>Book or walk in</h3><p>Reserve an appointment or join today’s queue digitally.</p></article>
              <article><span className="how-icon"><Icon name="clock" size={21} /></span><span className="how-number">03</span><h3>Know your turn</h3><p>Track your token and estimated wait while life goes on.</p></article>
            </div>
          </section>
        </>
      )}

      {view === "visits" && user?.role === "PATIENT" && (
        <PatientDashboard
          user={user}
          appointments={patientAppointments}
          queue={patientQueue}
          activeQueue={activeQueue}
          onCancel={(id) => void appointmentAction(id, "cancel")}
          onCheckin={(id) => void appointmentAction(id, "checkin")}
          onDiscover={() => setView("discover")}
          busy={working}
        />
      )}
      {view === "staff" && user?.role === "STAFF" && (
        <StaffDashboard
          data={staffData}
          doctors={staffDoctors}
          day={staffDay}
          tab={staffTab}
          busy={working}
          onDay={setStaffDay}
          onTab={setStaffTab}
          onAction={(id, action) => void runQueueAction(id, action)}
          onRefresh={() => void refreshStaff()}
          onNotice={setNotice}
          onError={setError}
        />
      )}

      <footer className="site-footer"><a className="brand footer-brand" href="#" onClick={(event) => { event.preventDefault(); setView("discover"); }}><span className="brand-mark"><Icon name="heart" size={16} /></span><span>careflow<span className="brand-period">.</span></span></a><span>Care that moves with you.</span><a href="mailto:hello@careflow.health">Need help? Get in touch</a></footer>

      {authMode && (
        <Modal title={authMode === "login" ? "Welcome back" : "Join CareFlow"} onClose={() => setAuthMode(null)}>
          <p className="modal-intro">{authMode === "login" ? "Sign in to manage your visits and track your place in line." : "Create an account to book care and keep your visits together."}</p>
          <form className="form-stack" onSubmit={(event) => void submitAuth(event)}>
            {authMode === "register" && <label className="form-field"><span>Full name</span><input name="name" autoComplete="name" required minLength={2} placeholder="Your name" /></label>}
            <label className="form-field"><span>Email address</span><input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
            {authMode === "register" && <label className="form-field"><span>Phone number <small>(optional)</small></span><input name="phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" /></label>}
            <label className="form-field"><span>Password</span><input name="password" type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} required minLength={authMode === "register" ? 8 : 1} placeholder={authMode === "register" ? "At least 8 characters" : "Your password"} /></label>
            {authMode === "register" && (
              <>
                <label className="form-field"><span>I’m joining as</span><select name="role" value={registerRole} onChange={(event) => setRegisterRole(event.target.value as "PATIENT" | "STAFF")}><option value="PATIENT">A patient</option><option value="STAFF">Clinic staff</option></select></label>
                {registerRole === "STAFF" && <div className="clinic-signup-fields">
                  <label className="form-field"><span>Clinic name</span><input name="clinicName" required /></label>
                  <label className="form-field"><span>Street address</span><input name="clinicAddress" required /></label>
                  <div className="form-row">
                    <label className="form-field"><span>City</span><input name="clinicCity" required /></label>
                    <label className="form-field"><span>Clinic phone</span><input name="clinicPhone" type="tel" required /></label>
                  </div>
                </div>}
              </>
            )}
            {error && <p className="inline-error" role="alert">{error}</p>}
            <button className="button button-primary button-full" disabled={working}>{working ? "Please wait…" : authMode === "login" ? "Sign in" : "Create account"} <Icon name="arrow" size={17} /></button>
          </form>
          <p className="auth-switch">{authMode === "login" ? "New to CareFlow?" : "Already have an account?"} <button onClick={() => { setError(""); setRegisterRole("PATIENT"); setAuthMode(authMode === "login" ? "register" : "login"); }}>{authMode === "login" ? "Create an account" : "Sign in"}</button></p>
        </Modal>
      )}

      {selectedClinic && (
        <ClinicModal
          clinic={selectedClinic}
          user={user}
          busy={working}
          onClose={() => setSelectedClinic(null)}
          onQueue={(doctorId) => void joinQueue(doctorId)}
          onBook={async (doctorId, date, time, reason) => {
            if (!user) {
              setSelectedClinic(null);
              setAuthMode("login");
              setNotice("Sign in to book an appointment.");
              return;
            }
            setWorking(true);
            setError("");
            try {
              await api("/api/appointments", { method: "POST", body: JSON.stringify({ doctorId, date, time, reason }) });
              setSelectedClinic(null);
              await refreshPatient();
              setView("visits");
              setNotice("Your appointment is booked.");
            } catch (reasonError) {
              setError(reasonError instanceof Error ? reasonError.message : "Could not book this appointment.");
            } finally {
              setWorking(false);
            }
          }}
        />
      )}
    </main>
  );
}

function PatientDashboard({
  user,
  appointments,
  queue,
  activeQueue,
  onCancel,
  onCheckin,
  onDiscover,
  busy,
}: {
  user: User;
  appointments: Appointment[];
  queue: QueueEntry[];
  activeQueue: QueueEntry[];
  onCancel: (id: string) => void;
  onCheckin: (id: string) => void;
  onDiscover: () => void;
  busy: boolean;
}) {
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  const appointmentsToShow = appointments.filter((appointment) =>
    tab === "upcoming" ? ["BOOKED", "CHECKED_IN"].includes(appointment.status) : !["BOOKED", "CHECKED_IN"].includes(appointment.status),
  );
  const liveQueue = activeQueue.filter((entry) => entry.status === "WAITING" || entry.status === "IN_CONSULTATION");
  return (
    <section className="dashboard-page patient-page">
      <div className="dashboard-welcome"><div><div className="eyebrow eyebrow-dark">YOUR CARE SPACE</div><h1>Hi, {user.name.split(" ")[0]}<span className="welcome-dot">.</span></h1><p>Your appointments and queue, all in one place.</p></div><button className="button button-primary" onClick={onDiscover}><Icon name="plus" size={17} /> Find a clinic</button></div>
      {liveQueue.length > 0 && <div className="live-queue-list">
        {liveQueue.map((entry) => (
          <article className="live-token-card" key={entry.id}>
            <div className="token-decoration"><span>TOKEN</span><strong>{entry.tokenCode}</strong><small>{entry.type === "WALK_IN" ? "Walk-in" : "Appointment"}</small></div>
            <div className="token-info"><span className="eyebrow eyebrow-dark">YOU’RE IN THE QUEUE</span><h2>{entry.clinic?.name ?? entry.doctorName}</h2><p>{entry.doctorName} · {entry.specialty}</p><div className="queue-progress"><span className="queue-progress-dot" />{entry.status === "IN_CONSULTATION" ? "You’re with the doctor now" : `Position ${entry.position} · ${formatWait(entry.estimatedWaitMinutes)}`}</div></div>
            <div className="token-wait"><span>ESTIMATED WAIT</span><strong>{entry.status === "IN_CONSULTATION" ? "Now" : `${entry.estimatedWaitMinutes} min`}</strong><small>Updates automatically</small></div>
          </article>
        ))}
      </div>}
      <div className="dashboard-content-card">
        <div className="dashboard-card-heading"><div><h2>Your appointments</h2><p>Keep track of what’s coming up.</p></div><div className="segmented-control"><button className={tab === "upcoming" ? "segment-active" : ""} onClick={() => setTab("upcoming")}>Upcoming</button><button className={tab === "history" ? "segment-active" : ""} onClick={() => setTab("history")}>Past visits</button></div></div>
        {appointmentsToShow.length ? <div className="appointment-list">
          {appointmentsToShow.map((appointment) => {
            const queueEntry = appointment.queueEntries?.[0];
            const canCheckin = appointment.status === "BOOKED" && appointment.day === todayKey();
            return <article className="appointment-row" key={appointment.id}>
              <div className="appointment-date"><strong>{new Date(appointment.dateTime).toLocaleDateString(undefined, { day: "2-digit" })}</strong><span>{new Date(appointment.dateTime).toLocaleDateString(undefined, { month: "short" })}</span></div>
              <div className="appointment-main"><div className="appointment-title"><h3>{appointment.clinic.name}</h3><StatusPill status={appointment.status} /></div><p>{appointment.doctor.name} · {appointment.doctor.specialty}</p><p className="appointment-time"><Icon name="clock" size={14} />{formatDateTime(appointment.dateTime)}</p></div>
              <div className="appointment-actions">
                {queueEntry && <span className="appointment-token">Token {queueEntry.tokenCode}</span>}
                {canCheckin && <button className="button button-primary button-small" disabled={busy} onClick={() => onCheckin(appointment.id)}>Check in</button>}
                {["BOOKED", "CHECKED_IN"].includes(appointment.status) && <button className="button button-text button-small danger-text" disabled={busy} onClick={() => onCancel(appointment.id)}>Cancel</button>}
              </div>
            </article>;
          })}
        </div> : <div className="empty-state compact-empty"><span className="empty-icon"><Icon name={tab === "upcoming" ? "calendar" : "check"} size={22} /></span><h3>{tab === "upcoming" ? "Nothing booked yet" : "No past visits"}</h3><p>{tab === "upcoming" ? "Find a clinic and book a time that works for you." : "Completed or cancelled visits will show up here."}</p>{tab === "upcoming" && <button className="button button-outline" onClick={onDiscover}>Explore clinics <Icon name="arrow" size={16} /></button>}</div>}
      </div>
      {queue.filter((entry) => !["WAITING", "IN_CONSULTATION"].includes(entry.status)).length > 0 && <div className="dashboard-content-card completed-queue"><div className="dashboard-card-heading"><div><h2>Recent queue visits</h2><p>Your previous walk-in and check-in tokens.</p></div></div>{queue.filter((entry) => !["WAITING", "IN_CONSULTATION"].includes(entry.status)).slice(0, 5).map((entry) => <div className="simple-row" key={entry.id}><div><strong>{entry.clinic?.name ?? entry.doctorName}</strong><span>{entry.tokenCode} · {entry.doctorName}</span></div><StatusPill status={entry.status} /></div>)}</div>}
    </section>
  );
}

function StaffDashboard({
  data,
  doctors,
  day,
  tab,
  busy,
  onDay,
  onTab,
  onAction,
  onRefresh,
  onNotice,
  onError,
}: {
  data: StaffOverview | null;
  doctors: Doctor[];
  day: string;
  tab: "overview" | "queue" | "doctors" | "clinic";
  busy: boolean;
  onDay: (day: string) => void;
  onTab: (tab: "overview" | "queue" | "doctors" | "clinic") => void;
  onAction: (id: string, action: "START" | "COMPLETE" | "CANCEL" | "NO_SHOW") => void;
  onRefresh: () => void;
  onNotice: (notice: string) => void;
  onError: (error: string) => void;
}) {
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [doctorModal, setDoctorModal] = useState<Doctor | "new" | null>(null);
  const [clinicEditing, setClinicEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const stats = data?.stats;
  const queueEntries = data?.queue.entries ?? [];
  return (
    <section className="dashboard-page staff-page">
      <div className="dashboard-welcome staff-welcome"><div><div className="eyebrow eyebrow-dark">CLINIC OPERATIONS</div><h1>{data?.clinic.name ?? "Clinic dashboard"}<span className="welcome-dot">.</span></h1><p>Good care starts with a well-run day.</p></div><div className="staff-date-tools"><label className="date-picker"><Icon name="calendar" size={17} /><input type="date" value={day} onChange={(event) => onDay(event.target.value)} /></label><button className="button button-primary" onClick={() => setWalkInOpen(true)}><Icon name="plus" size={17} /> Add walk-in</button></div></div>
      <div className="staff-tabs">{(["overview", "queue", "doctors", "clinic"] as const).map((item) => <button key={item} className={tab === item ? "staff-tab staff-tab-active" : "staff-tab"} onClick={() => onTab(item)}>{item === "overview" ? "Overview" : item === "queue" ? "Patient queue" : item === "doctors" ? "Doctors & hours" : "Clinic details"}</button>)}</div>
      {!data ? <div className="empty-state"><span className="spinner" /> Loading clinic dashboard…</div> : <>
        {tab === "overview" && <>
          <div className="stats-grid">
            <StatCard label="Today’s appointments" value={stats?.appointments ?? 0} icon="calendar" hint={`${stats?.booked ?? 0} still booked`} />
            <StatCard label="Waiting now" value={stats?.waiting ?? 0} icon="clock" hint={`${stats?.inConsultation ?? 0} in consultation`} />
            <StatCard label="Walk-ins today" value={stats?.walkIns ?? 0} icon="user" hint={`${stats?.completed ?? 0} visits completed`} />
            <StatCard label="Avg. consultation" value={stats?.avgConsultMinutes ? `${stats.avgConsultMinutes}m` : "—"} icon="spark" hint="Based on completed visits" />
          </div>
          <div className="staff-columns">
            <div className="dashboard-content-card staff-panel"><div className="dashboard-card-heading"><div><h2>Live patient queue</h2><p>{formatDay(day)}</p></div><button className="button button-text button-small" onClick={() => onTab("queue")}>View all <Icon name="arrow" size={15} /></button></div><QueueList entries={queueEntries.filter((entry) => ["WAITING", "IN_CONSULTATION"].includes(entry.status)).slice(0, 5)} busy={busy} onAction={onAction} /></div>
            <div className="dashboard-content-card staff-panel"><div className="dashboard-card-heading"><div><h2>Appointments</h2><p>Booked and checked-in visits</p></div></div><AppointmentList appointments={data.appointments.slice(0, 5)} busy={busy} onCheckin={(id) => onActionForAppointment(id, data, onError, onNotice, onRefresh)} /></div>
          </div>
        </>}
        {tab === "queue" && <div className="dashboard-content-card"><div className="dashboard-card-heading"><div><h2>Patient queue</h2><p>{formatDay(day)} · {queueEntries.length} tokens issued</p></div><button className="button button-outline button-small" onClick={onRefresh}>Refresh</button></div><QueueList entries={queueEntries} busy={busy} onAction={onAction} /></div>}
        {tab === "doctors" && <div className="dashboard-content-card"><div className="dashboard-card-heading"><div><h2>Doctors & hours</h2><p>Manage your clinic’s doctors and weekly availability.</p></div><button className="button button-primary button-small" onClick={() => setDoctorModal("new")}><Icon name="plus" size={16} /> Add doctor</button></div>{doctors.length ? <div className="doctor-admin-list">{doctors.map((doctor) => <article className="doctor-admin-row" key={doctor.id}><div className="doctor-admin-avatar">{doctor.name.replace(/^Dr\.\s*/i, "").split(" ").map((word) => word[0]).slice(0, 2).join("")}</div><div className="doctor-admin-info"><div className="appointment-title"><h3>{doctor.name}</h3><StatusPill status={doctor.isActive === false ? "CANCELLED" : "ACTIVE"} /></div><p>{doctor.specialty} · {doctor.avgConsultMinutes} min appointments</p><p className="doctor-schedule-preview">{(doctor.schedules ?? []).filter((schedule) => schedule.isActive).length} availability blocks per week</p></div><button className="button button-outline button-small" onClick={() => setDoctorModal(doctor)}>Edit schedule</button></article>)}</div> : <div className="empty-state compact-empty"><h3>No doctors added</h3><p>Add a doctor to enable appointment booking and walk-in registration.</p></div>}</div>}
        {tab === "clinic" && <ClinicSettings clinic={data.clinic} onSaved={() => { onRefresh(); onNotice("Clinic details saved."); }} onError={onError} editing={clinicEditing} setEditing={setClinicEditing} saving={saving} setSaving={setSaving} />}
      </>}
      {walkInOpen && <WalkInModal doctors={doctors.filter((doctor) => doctor.isActive !== false)} onClose={() => setWalkInOpen(false)} onError={onError} onSaved={(token) => { setWalkInOpen(false); onRefresh(); onNotice(`Walk-in registered. Token ${token}.`); }} />}
      {doctorModal && <DoctorModal doctor={doctorModal === "new" ? null : doctorModal} onClose={() => setDoctorModal(null)} onError={onError} onSaved={() => { setDoctorModal(null); onRefresh(); onNotice(doctorModal === "new" ? "Doctor added." : "Doctor details updated."); }} />}
    </section>
  );
}

async function onActionForAppointment(id: string, data: StaffOverview, onError: (error: string) => void, onNotice: (notice: string) => void, onRefresh: () => void) {
  const appointment = data.appointments.find((item) => item.id === id);
  if (!appointment) return;
  try {
    const result = await api<{ entry: QueueEntry }>(`/api/appointments/${id}/checkin`, { method: "POST" });
    onNotice(`Patient checked in with token ${result.entry.tokenCode}.`);
    onRefresh();
  } catch (reason) {
    onError(reason instanceof Error ? reason.message : "Could not check in patient.");
  }
}

function StatCard({ label, value, icon, hint }: { label: string; value: number | string; icon: "calendar" | "clock" | "user" | "spark"; hint: string }) {
  return <article className="stat-card"><span className="stat-icon"><Icon name={icon} size={19} /></span><span className="stat-label">{label}</span><strong>{value}</strong><small>{hint}</small></article>;
}

function QueueList({ entries, busy, onAction }: { entries: QueueEntry[]; busy: boolean; onAction: (id: string, action: "START" | "COMPLETE" | "CANCEL" | "NO_SHOW") => void }) {
  if (!entries.length) return <div className="empty-queue"><span className="empty-icon"><Icon name="check" size={20} /></span><strong>All clear</strong><span>There are no patients in the queue.</span></div>;
  return <div className="queue-table">
    {entries.map((entry) => <article className="queue-row" key={entry.id}>
      <div className="queue-number">{entry.tokenNumber.toString().padStart(2, "0")}</div>
      <div className="queue-patient"><strong>{entry.patientName}</strong><span>{entry.doctorName} · {entry.type === "WALK_IN" ? "Walk-in" : "Appointment"}</span></div>
      <div className="queue-wait">{entry.status === "WAITING" ? `#${entry.position} · ${formatWait(entry.estimatedWaitMinutes)}` : entry.status === "IN_CONSULTATION" ? "In consultation" : "Queue closed"}</div>
      <StatusPill status={entry.status} />
      <div className="queue-actions">{entry.status === "WAITING" && <><button className="button button-primary button-small" disabled={busy} onClick={() => onAction(entry.id, "START")}>Call in</button><button className="button button-text button-small" disabled={busy} onClick={() => onAction(entry.id, "NO_SHOW")}>No-show</button></>}{entry.status === "IN_CONSULTATION" && <button className="button button-primary button-small" disabled={busy} onClick={() => onAction(entry.id, "COMPLETE")}>Complete</button>}</div>
    </article>)}
  </div>;
}

function AppointmentList({ appointments, busy, onCheckin }: { appointments: Appointment[]; busy: boolean; onCheckin: (id: string) => void }) {
  if (!appointments.length) return <div className="empty-queue"><span className="empty-icon"><Icon name="calendar" size={20} /></span><strong>No appointments yet</strong><span>Visits booked for this day appear here.</span></div>;
  return <div className="staff-appointment-list">{appointments.map((appointment) => <article className="staff-appointment-row" key={appointment.id}><div className="mini-time">{formatTime(appointment.dateTime)}</div><div className="staff-appointment-main"><strong>{appointment.patient?.name ?? "Patient"}</strong><span>{appointment.doctor.name}</span></div>{appointment.status === "BOOKED" && appointment.day === todayKey() ? <button className="button button-outline button-small" disabled={busy} onClick={() => onCheckin(appointment.id)}>Check in</button> : <StatusPill status={appointment.status} />}</article>)}</div>;
}

function WalkInModal({ doctors, onClose, onError, onSaved }: { doctors: Doctor[]; onClose: () => void; onError: (error: string) => void; onSaved: (token: string) => void }) {
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const result = await api<{ entry: QueueEntry }>("/api/queue", { method: "POST", body: JSON.stringify({ doctorId: form.get("doctorId"), patientName: form.get("patientName"), patientPhone: form.get("patientPhone") }) });
      onSaved(result.entry.tokenCode);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Could not register the walk-in.");
    } finally {
      setSaving(false);
    }
  }
  return <Modal title="Register a walk-in" onClose={onClose}><p className="modal-intro">Add a patient to today’s queue and issue a digital token.</p>{doctors.length ? <form className="form-stack" onSubmit={(event) => void submit(event)}><label className="form-field"><span>Patient name</span><input name="patientName" required minLength={2} /></label><label className="form-field"><span>Patient phone <small>(optional)</small></span><input name="patientPhone" type="tel" /></label><label className="form-field"><span>Doctor</span><select name="doctorId" required defaultValue=""><option value="" disabled>Choose a doctor</option>{doctors.map((doctor) => <option value={doctor.id} key={doctor.id}>{doctor.name} · {doctor.specialty}</option>)}</select></label><button className="button button-primary button-full" disabled={saving}>{saving ? "Registering…" : "Issue token"} <Icon name="arrow" size={17} /></button></form> : <div className="empty-state compact-empty"><p>Add an active doctor before registering walk-ins.</p></div>}</Modal>;
}

function ClinicSettings({ clinic, onSaved, onError, editing, setEditing, saving, setSaving }: { clinic: Clinic; onSaved: () => void; onError: (error: string) => void; editing: boolean; setEditing: (value: boolean) => void; saving: boolean; setSaving: (value: boolean) => void }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      name: form.get("name"),
      description: form.get("description"),
      address: form.get("address"),
      city: form.get("city"),
      phone: form.get("phone"),
      email: form.get("email"),
      openingTime: form.get("openingTime"),
      closingTime: form.get("closingTime"),
      specialties: String(form.get("specialties") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    };
    setSaving(true);
    try {
      await api("/api/staff/clinic", { method: "PATCH", body: JSON.stringify(input) });
      setEditing(false);
      onSaved();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Could not save clinic details.");
    } finally {
      setSaving(false);
    }
  }
  return <div className="dashboard-content-card"><div className="dashboard-card-heading"><div><h2>Clinic details</h2><p>Update how patients find and contact your clinic.</p></div><button className="button button-outline button-small" onClick={() => setEditing(!editing)}>{editing ? "Cancel" : "Edit details"}</button></div>{editing ? <form className="form-stack clinic-settings-form" onSubmit={(event) => void submit(event)}><div className="form-row"><label className="form-field"><span>Clinic name</span><input name="name" defaultValue={clinic.name} required /></label><label className="form-field"><span>City</span><input name="city" defaultValue={clinic.city} required /></label></div><label className="form-field"><span>Street address</span><input name="address" defaultValue={clinic.address} required /></label><label className="form-field"><span>Description</span><textarea name="description" rows={3} defaultValue={clinic.description ?? ""} /></label><div className="form-row"><label className="form-field"><span>Phone</span><input name="phone" type="tel" defaultValue={clinic.phone} required /></label><label className="form-field"><span>Email</span><input name="email" type="email" defaultValue={clinic.email ?? ""} /></label></div><div className="form-row"><label className="form-field"><span>Opens</span><input name="openingTime" type="time" defaultValue={clinic.openingTime} required /></label><label className="form-field"><span>Closes</span><input name="closingTime" type="time" defaultValue={clinic.closingTime} required /></label></div><label className="form-field"><span>Specialties <small>Separate with commas</small></span><input name="specialties" defaultValue={clinic.specialties.join(", ")} /></label><button className="button button-primary form-submit" disabled={saving}>{saving ? "Saving…" : "Save clinic details"}</button></form> : <div className="clinic-details-grid"><div><span>Address</span><strong>{clinic.address}, {clinic.city}</strong></div><div><span>Phone</span><strong>{clinic.phone}</strong></div><div><span>Email</span><strong>{clinic.email || "Not set"}</strong></div><div><span>Opening hours</span><strong>{clinic.openingTime} – {clinic.closingTime}</strong></div><div className="clinic-specialty-detail"><span>Specialties</span><div className="specialty-list">{clinic.specialties.map((specialty) => <span className="specialty-tag" key={specialty}>{specialty}</span>)}</div></div></div>}</div>;
}

function DoctorModal({ doctor, onClose, onError, onSaved }: { doctor: Doctor | null; onClose: () => void; onError: (error: string) => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>(doctor?.schedules?.map(({ dayOfWeek, startTime, endTime, slotMinutes, isActive }) => ({ dayOfWeek, startTime, endTime, slotMinutes, isActive })) ?? [
    { dayOfWeek: 1, startTime: "09:00", endTime: "17:00", slotMinutes: 15, isActive: true },
    { dayOfWeek: 2, startTime: "09:00", endTime: "17:00", slotMinutes: 15, isActive: true },
    { dayOfWeek: 3, startTime: "09:00", endTime: "17:00", slotMinutes: 15, isActive: true },
    { dayOfWeek: 4, startTime: "09:00", endTime: "17:00", slotMinutes: 15, isActive: true },
    { dayOfWeek: 5, startTime: "09:00", endTime: "17:00", slotMinutes: 15, isActive: true },
  ]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      name: form.get("name"),
      specialty: form.get("specialty"),
      qualification: form.get("qualification"),
      bio: form.get("bio"),
      avgConsultMinutes: Number(form.get("avgConsultMinutes")),
      isActive: form.get("isActive") === "on",
      schedules: schedules.map((schedule) => ({
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        slotMinutes: schedule.slotMinutes,
        isActive: schedule.isActive,
      })),
    };
    setSaving(true);
    try {
      await api(doctor ? `/api/staff/doctors/${doctor.id}` : "/api/staff/doctors", { method: doctor ? "PATCH" : "POST", body: JSON.stringify(input) });
      onSaved();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Could not save doctor.");
    } finally {
      setSaving(false);
    }
  }
  const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return <Modal title={doctor ? "Edit doctor & schedule" : "Add a doctor"} onClose={onClose} wide><form className="form-stack doctor-form" onSubmit={(event) => void submit(event)}><div className="form-row"><label className="form-field"><span>Doctor’s name</span><input name="name" defaultValue={doctor?.name} required minLength={2} placeholder="Dr. Asha Mehta" /></label><label className="form-field"><span>Specialty</span><input name="specialty" defaultValue={doctor?.specialty} required minLength={2} placeholder="General medicine" /></label></div><div className="form-row"><label className="form-field"><span>Qualifications <small>(optional)</small></span><input name="qualification" defaultValue={doctor?.qualification ?? ""} /></label><label className="form-field"><span>Average consultation (minutes)</span><input name="avgConsultMinutes" type="number" min={5} max={120} defaultValue={doctor?.avgConsultMinutes ?? 10} required /></label></div><label className="form-field"><span>About <small>(optional)</small></span><textarea name="bio" rows={2} defaultValue={doctor?.bio ?? ""} /></label><div className="schedule-editor"><div className="schedule-heading"><div><strong>Weekly availability</strong><span>Add one or more time blocks for each day.</span></div><button type="button" className="button button-outline button-small" onClick={() => setSchedules([...schedules, { dayOfWeek: 1, startTime: "09:00", endTime: "17:00", slotMinutes: 15, isActive: true }])}><Icon name="plus" size={15} /> Add hours</button></div>{schedules.length ? schedules.map((schedule, index) => <div className="schedule-row" key={`${schedule.dayOfWeek}-${index}`}><select aria-label="Schedule day" value={schedule.dayOfWeek} onChange={(event) => setSchedules(schedules.map((item, current) => current === index ? { ...item, dayOfWeek: Number(event.target.value) } : item))}>{dayLabels.map((label, dayIndex) => <option key={label} value={dayIndex}>{label}</option>)}</select><input aria-label="Start time" type="time" value={schedule.startTime} onChange={(event) => setSchedules(schedules.map((item, current) => current === index ? { ...item, startTime: event.target.value } : item))} /><span>to</span><input aria-label="End time" type="time" value={schedule.endTime} onChange={(event) => setSchedules(schedules.map((item, current) => current === index ? { ...item, endTime: event.target.value } : item))} /><select aria-label="Appointment duration" value={schedule.slotMinutes} onChange={(event) => setSchedules(schedules.map((item, current) => current === index ? { ...item, slotMinutes: Number(event.target.value) } : item))}><option value={10}>10 min</option><option value={15}>15 min</option><option value={20}>20 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option></select><button type="button" className="icon-button remove-schedule" aria-label={`Remove ${dayLabels[schedule.dayOfWeek]} schedule`} onClick={() => setSchedules(schedules.filter((_, current) => current !== index))}><Icon name="close" size={17} /></button></div>) : <p className="no-schedules">No availability yet. Add hours when this doctor is ready to see patients.</p>}</div>{doctor && <label className="active-toggle"><input type="checkbox" name="isActive" defaultChecked={doctor.isActive !== false} /><span>Doctor is accepting appointments</span></label>}{!doctor && <input type="hidden" name="isActive" value="on" />}<button className="button button-primary form-submit" disabled={saving}>{saving ? "Saving…" : doctor ? "Save doctor & hours" : "Add doctor"} <Icon name="arrow" size={16} /></button></form></Modal>;
}

function ClinicModal({ clinic, user, busy, onClose, onQueue, onBook }: { clinic: Clinic; user: User | null; busy: boolean; onClose: () => void; onQueue: (doctorId: string) => void; onBook: (doctorId: string, date: string, time: string, reason: string) => Promise<void> }) {
  const doctors = clinic.doctors ?? [];
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? "");
  const [date, setDate] = useState(todayKey());
  const [availability, setAvailability] = useState<{
    key: string;
    slots: { time: string; available: boolean }[];
    error?: string;
  } | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ key: string; time: string } | null>(null);
  const [reason, setReason] = useState("");
  const requestKey = `${doctorId}:${date}`;
  const loading = Boolean(doctorId) && user?.role !== "STAFF" && availability?.key !== requestKey;
  const slots = availability?.key === requestKey ? availability.slots : [];
  const localError = availability?.key === requestKey ? availability.error : undefined;
  const selectedTime = selectedSlot?.key === requestKey ? selectedSlot.time : "";

  useEffect(() => {
    if (!doctorId || user?.role === "STAFF") return;
    let active = true;
    api<{ slots: { time: string; available: boolean }[] }>(`/api/doctors/${doctorId}/availability?day=${date}`)
      .then((result) => { if (active) setAvailability({ key: `${doctorId}:${date}`, slots: result.slots }); })
      .catch((reason) => {
        if (active) {
          setAvailability({
            key: `${doctorId}:${date}`,
            slots: [],
            error: reason instanceof Error ? reason.message : "Could not load availability.",
          });
        }
      });
    return () => { active = false; };
  }, [doctorId, date, user?.role]);

  const selectedDoctor = doctors.find((doctor) => doctor.id === doctorId);
  return <Modal title={clinic.name} onClose={onClose} wide><div className="clinic-detail"><p className="clinic-detail-location"><Icon name="pin" size={15} />{clinic.address}, {clinic.city}<span>·</span><Icon name="clock" size={15} />{clinic.openingTime}–{clinic.closingTime}</p><p className="clinic-detail-description">{clinic.description}</p><div className="specialty-list">{clinic.specialties.map((specialty) => <span className="specialty-tag" key={specialty}>{specialty}</span>)}</div><div className="detail-queue-note"><span className="queue-progress-dot" />{clinic.today?.waiting ?? clinic.waitingCount ?? 0} patients waiting · {clinic.today?.inConsultation ?? 0} in consultation today</div></div><div className="doctor-booking-list">{doctors.length ? doctors.map((doctor) => <button className={`doctor-select-card${doctor.id === doctorId ? " doctor-selected" : ""}`} key={doctor.id} onClick={() => setDoctorId(doctor.id)}><span className="doctor-select-avatar">{doctor.name.replace(/^Dr\.\s*/i, "").split(" ").map((word) => word[0]).slice(0, 2).join("")}</span><span className="doctor-select-main"><strong>{doctor.name}</strong><span>{doctor.specialty}{doctor.qualification ? ` · ${doctor.qualification}` : ""}</span></span><span className="doctor-select-duration"><Icon name="clock" size={14} />{doctor.avgConsultMinutes} min</span><span className="radio-dot" /></button>) : <div className="empty-state compact-empty"><p>No doctors are listed at this clinic yet.</p></div>}</div>  {selectedDoctor && user?.role !== "STAFF" && <div className="booking-panel"><div className="booking-panel-heading"><div><h3>Book an appointment</h3><p>Choose a day and an available time.</p></div><label className="form-field booking-date"><span>Date</span><input type="date" value={date} min={todayKey()} onChange={(event) => setDate(event.target.value)} /></label></div>{localError && <p className="inline-error">{localError}</p>}{loading ? <div className="slots-loading"><span className="spinner" /> Checking times…</div> : slots.filter((slot) => slot.available).length ? <div className="time-slots">{slots.filter((slot) => slot.available).map((slot) => <button type="button" className={selectedTime === slot.time ? "time-slot time-slot-selected" : "time-slot"} key={slot.time} onClick={() => setSelectedSlot({ key: requestKey, time: slot.time })}>{new Date(`2000-01-01T${slot.time}:00`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</button>)}</div> : <p className="no-slots">{localError ? "Availability could not be loaded." : "No open times for this day. Try another date or join the walk-in queue."}</p>}<label className="form-field reason-field"><span>Reason for visit <small>(optional)</small></span><input value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} placeholder="What would you like help with?" /></label><button className="button button-primary button-full" disabled={!selectedTime || busy} onClick={() => void onBook(doctorId, date, selectedTime, reason)}>{busy ? "Booking…" : "Book this appointment"} <Icon name="arrow" size={16} /></button><div className="booking-or"><span />or<span /></div><button className="button button-outline button-full" disabled={busy || !user} onClick={() => onQueue(doctorId)}><Icon name="clock" size={17} /> Join today’s walk-in queue</button>{!user && <p className="login-prompt">Sign in is required to book or join the queue.</p>}</div>}</Modal>;
}
