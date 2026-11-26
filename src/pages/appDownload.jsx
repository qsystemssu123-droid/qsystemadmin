
import { useState } from "react";
import {
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  ArrowDownToLine,
  LoaderCircle,
  CalendarDays,
  Clock3,
  Bell,
  ListChecks,
  ChevronRight,
  PackageCheck,
  MonitorDown,
  ArrowRight,
  Info,
  Users,
  UserRound,
  Building2,
  ClipboardCheck,
  Ticket,
  MessageSquare,
  GraduationCap,
  CalendarCheck,
  CircleHelp,
  Check,
  Hourglass,
  SmartphoneNfc,
} from "lucide-react";

import APP_LOGO from "../assets/QueueMatrix.png";
const APK_DOWNLOAD_URL = "/QueueMatrix.apk";

const APP_NAME = "QueueMatrix";
const APP_VERSION = "1.0.0";

export default function AppDownload() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);

  const handleSmoothScroll = (e, sectionId) => {
    e.preventDefault();

    const target = document.getElementById(sectionId);

    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const handleDownload = async () => {
    if (isDownloading) return;

    if (!APK_DOWNLOAD_URL) {
      alert("The APK download link has not been configured yet.");
      return;
    }

    setIsDownloading(true);
    setDownloadStarted(false);

    try {
      // Give the loading animation time to appear.
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const link = document.createElement("a");

      link.href = APK_DOWNLOAD_URL;
      link.download = "QueueMatrix.apk";
      link.rel = "noopener noreferrer";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadStarted(true);

      // Keep the confirmation visible briefly.
      setTimeout(() => {
        setDownloadStarted(false);
      }, 6000);
    } catch (error) {
      console.error("APK download error:", error);

      window.open(
        APK_DOWNLOAD_URL,
        "_blank",
        "noopener,noreferrer"
      );

      setDownloadStarted(true);

      setTimeout(() => {
        setDownloadStarted(false);
      }, 6000);
    } finally {
      setIsDownloading(false);
    }
  };

  const features = [
    {
      icon: CalendarDays,
      title: "Easy Appointment Booking",
      description:
        "Browse available office services, choose the service you need, and book an appointment through your mobile device.",
      preview: "Book an appointment",
      detail: "Choose a service and available schedule.",
    },
    {
      icon: Clock3,
      title: "Appointment Status",
      description:
        "Check the progress of your appointments and see whether they are pending, approved, or have already been processed.",
      preview: "Track your appointment",
      detail: "Know the current status of your booking.",
    },
    {
      icon: Ticket,
      title: "Queue Number and Monitoring",
      description:
        "Once your appointment is processed and assigned a queue number, use the app to check your queue information.",
      preview: "Your queue information",
      detail: "Keep your queue details accessible.",
    },
    {
      icon: Bell,
      title: "Announcements and Updates",
      description:
        "Stay informed about office announcements, service updates, and other important information shared through QueueMatrix.",
      preview: "Office announcements",
      detail: "Keep up with important service information.",
    },
    {
      icon: ListChecks,
      title: "Organized Appointments",
      description:
        "Keep your appointment information organized in one place instead of relying on separate manual records.",
      preview: "Appointment history",
      detail: "Review your appointment information.",
    },
    {
      icon: Users,
      title: "Staff-Assisted Processing",
      description:
        "Some appointments require staff confirmation. QueueMatrix supports a staff-assisted process for services that need approval.",
      preview: "Staff confirmation",
      detail: "Appointments can be reviewed before processing.",
    },
    {
      icon: MessageSquare,
      title: "Feedback and Ratings",
      description:
        "Share feedback about your experience and help improve the quality of office services.",
      preview: "Share your feedback",
      detail: "Help improve the service experience.",
    },
    {
      icon: ShieldCheck,
      title: "Account-Based Access",
      description:
        "Access your personal appointment information through your account, keeping your booking experience organized.",
      preview: "Your account",
      detail: "Your appointments in one account.",
    },
  ];

  const workflowSteps = [
    {
      icon: UserRound,
      number: "01",
      title: "Create an account or sign in",
      description:
        "Open QueueMatrix and access your student account to start using the appointment and queuing services.",
    },
    {
      icon: Building2,
      number: "02",
      title: "Choose an office service",
      description:
        "Browse the available services and select the office service you need.",
    },
    {
      icon: CalendarCheck,
      number: "03",
      title: "Select your appointment schedule",
      description:
        "Choose an available appointment time and submit your booking through the application.",
    },
    {
      icon: ClipboardCheck,
      number: "04",
      title: "Wait for appointment processing",
      description:
        "Your appointment is processed according to the selected service's requirements. Some services require staff confirmation.",
    },
    {
      icon: Ticket,
      number: "05",
      title: "Check your queue information",
      description:
        "When your appointment is approved and assigned a queue number, check your appointment and queue details in the app.",
    },
  ];

  const installationSteps = [
    {
      title: "Download the APK",
      description:
        "Tap the Download APK button and wait for the installer to finish downloading.",
    },
    {
      title: "Open the downloaded file",
      description:
        "Locate QueueMatrix.apk in your device's Downloads folder and tap the file.",
    },
    {
      title: "Allow installation if prompted",
      description:
        "Android may ask you to allow installation from your browser or file manager. Review the prompt before proceeding.",
    },
    {
      title: "Install and launch",
      description:
        "Complete the installation and open QueueMatrix from your device.",
    },
  ];

  const serviceHandling = [
    {
      icon: Hourglass,
      title: "Services requiring staff confirmation",
      description:
        "Guidance & Counseling Services and Guidance and Counseling Services are handled through a pending appointment process so the booking can be reviewed and confirmed.",
      color: "amber",
      status: "Pending confirmation",
    },
    {
      icon: CheckCircle2,
      title: "Other eligible services",
      description:
        "Other services can follow the automatic approval and queuing process when the appointment schedule and service requirements allow it.",
      color: "green",
      status: "Automatic processing",
    },
    {
      icon: Clock3,
      title: "Future appointments",
      description:
        "Appointments scheduled for a later time are handled according to their appointment schedule. A future booking should not be confused with an appointment that is ready for immediate queuing.",
      color: "blue",
      status: "Schedule-based processing",
    },
  ];

  const cardThemes = [
    "from-[#102b61] via-[#17458f] to-[#2563c7] text-white",
    "from-[#17458f] via-[#1d56b3] to-[#2b6fe0] text-white",
    "from-[#133678] via-[#1a4da1] to-[#2563c7] text-white",
    "from-[#0f295c] via-[#16428a] to-[#225ec2] text-white",
  ];

  const downloadButtonContent = (
    <>
      {isDownloading ? (
        <>
          <LoaderCircle
            size={19}
            className="animate-spin"
          />
          Preparing Download...
        </>
      ) : (
        <>
          <ArrowDownToLine size={19} />
          Download APK
        </>
      )}
    </>
  );

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#f8faff] text-slate-800">
      {/* Futuristic Background Effects */}
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-blue-400/10 blur-[100px]" />
        <div className="absolute -right-40 top-[500px] h-96 w-96 rounded-full bg-indigo-400/10 blur-[100px]" />
      </div>

      {/* Top Navigation Header */}
      <header className="sticky top-0 z-30 w-full border-b border-blue-100/80 bg-white/85 shadow-sm shadow-blue-900/[0.02] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex items-center gap-6 sm:gap-8">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={APP_LOGO}
                alt="QueueMatrix Logo"
                className="h-9 w-9 shrink-0 rounded-xl object-contain shadow-sm sm:h-10 sm:w-10"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />

              <div className="min-w-0">
                <p className="truncate text-lg font-extrabold tracking-tight text-slate-900">
                  {APP_NAME}
                </p>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-blue-600">
                  Smart Student Services
                </p>
              </div>
            </div>

            <nav className="hidden items-center gap-6 text-sm font-semibold sm:flex">
              <a
                href="#overview"
                onClick={(e) => handleSmoothScroll(e, "overview")}
                className="relative py-3 text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[3px] after:rounded-t-full after:bg-blue-600"
              >
                Overview
              </a>

              <a
                href="#features"
                onClick={(e) => handleSmoothScroll(e, "features")}
                className="py-3 text-slate-500 transition hover:text-blue-600"
              >
                Features
              </a>

              <a
                href="#how-it-works"
                onClick={(e) => handleSmoothScroll(e, "how-it-works")}
                className="py-3 text-slate-500 transition hover:text-blue-600"
              >
                How It Works
              </a>

              <a
                href="#install-guide"
                onClick={(e) => handleSmoothScroll(e, "install-guide")}
                className="py-3 text-slate-500 transition hover:text-blue-600"
              >
                Installation Guide
              </a>
            </nav>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/80 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
            </span>
            Official Download
          </span>
        </div>
      </header>

      <main
        id="overview"
        className="relative z-10 mx-auto w-full max-w-[1280px] scroll-mt-20 px-4 py-8 sm:px-6 sm:py-10 lg:px-10"
      >
        {/* Main App Header */}
        <section className="relative overflow-hidden rounded-3xl border border-blue-100/80 bg-white p-5 shadow-xl shadow-blue-900/[0.04] sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-blue-100/70 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-indigo-100/50 blur-3xl" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-3 shadow-lg shadow-blue-900/10 sm:h-28 sm:w-28 sm:rounded-3xl">
                <div className="absolute inset-0 rounded-2xl border border-white/80 sm:rounded-3xl" />
                <img
                  src={APP_LOGO}
                  alt="QueueMatrix Application Logo"
                  className="relative h-full w-full rounded-xl object-contain"
                />
              </div>

              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                  <ShieldCheck size={13} />
                  Official QueueMatrix Application
                </div>

                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
                  {APP_NAME}
                </h1>

                <p className="mt-1.5 text-sm font-bold text-blue-600 sm:text-base">
                  Your Queue. Your Time. Made Simple.
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Student Appointment and Queuing System
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
                    <GraduationCap size={13} />
                    Student Services
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
                    <CalendarDays size={13} />
                    Appointment Booking
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
                    <Ticket size={13} />
                    Queue Management
                  </span>
                </div>
              </div>
            </div>

            {/* Download Action Box */}
            <div className="relative w-full shrink-0 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-white via-blue-50/80 to-indigo-50/80 p-4 shadow-lg shadow-blue-900/[0.04] sm:w-[270px] sm:p-5">
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-200/30 blur-2xl" />

              <div className="relative flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">
                  Android APK
                </span>

                <span className="rounded-md border border-green-100 bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700">
                  v{APP_VERSION}
                </span>
              </div>

              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className={`relative mt-3.5 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-3.5 text-sm font-bold text-white shadow-lg transition-all duration-300 ${
                  isDownloading
                    ? "cursor-wait bg-blue-800 shadow-blue-300/50"
                    : "bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 shadow-blue-300/60 hover:-translate-y-1 hover:from-blue-700 hover:via-blue-700 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-300/70 active:translate-y-0"
                } disabled:opacity-90`}
              >
                {isDownloading && (
                  <span className="absolute inset-0 animate-pulse bg-white/10" />
                )}

                <span className="relative flex items-center justify-center gap-2">
                  {downloadButtonContent}
                </span>
              </button>

              {/* Loading Progress Indicator */}
              {isDownloading && (
                <div className="mt-3 animate-in fade-in duration-300">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                      Preparing your file
                    </span>
                    <span className="text-[10px] font-semibold text-blue-600">
                      Please wait
                    </span>
                  </div>

                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
                    <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600" />
                  </div>
                </div>
              )}

              <p className="relative mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                <ShieldCheck size={14} className="text-green-600" />
                Official Download Page
              </p>

              {downloadStarted && (
                <div className="mt-3 flex animate-in fade-in slide-in-from-top-2 items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3">
                  <CheckCircle2
                    size={16}
                    className="mt-0.5 shrink-0 text-green-600"
                  />

                  <p className="text-[11px] leading-4 text-green-700">
                    Download request started. Check your browser's downloads.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* App Metadata */}
          <div className="relative mt-7 flex flex-wrap items-center gap-y-4 border-t border-slate-100 pt-6">
            <div className="pr-6 sm:pr-8">
              <div className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
                <Smartphone size={15} className="text-blue-600" />
                <span>Android</span>
              </div>

              <p className="mt-0.5 text-xs text-slate-500">Platform</p>
            </div>

            <div className="h-8 w-px bg-slate-200" />

            <div className="px-6 sm:px-8">
              <div className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
                <PackageCheck size={15} className="text-blue-600" />
                <span>APK</span>
              </div>

              <p className="mt-0.5 text-xs text-slate-500">File format</p>
            </div>

            <div className="h-8 w-px bg-slate-200" />

            <div className="px-6 sm:px-8">
              <div className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
                <CheckCircle2 size={15} className="text-green-600" />
                <span>{APP_VERSION}</span>
              </div>

              <p className="mt-0.5 text-xs text-slate-500">Version</p>
            </div>

            <div className="h-8 w-px bg-slate-200" />

            <div className="pl-6 sm:pl-8">
              <div className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
                <ShieldCheck size={15} className="text-blue-600" />
                <span>Official</span>
              </div>

              <p className="mt-0.5 text-xs text-slate-500">Download source</p>
            </div>
          </div>
        </section>

        {/* QueueMatrix Introduction */}
        <section className="mt-8 overflow-hidden rounded-3xl border border-blue-100/80 bg-white shadow-lg shadow-blue-900/[0.03]">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">
                A better way to access student services
              </p>

              <h2 className="mt-2 max-w-2xl text-2xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-3xl">
                Less waiting confusion.
                <span className="block text-blue-600">
                  More organized appointments.
                </span>
              </h2>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
                QueueMatrix is a student appointment and queuing application
                designed to make accessing office services more organized and
                convenient. Students can browse available services, schedule
                appointments, monitor booking status, and check their queue
                information through one mobile application.
              </p>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                With QueueMatrix, students can keep their appointment details
                accessible, stay informed through office announcements, and
                provide feedback about their service experience.
              </p>

              <button
                type="button"
                onClick={(e) => handleSmoothScroll(e, "how-it-works")}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-200 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                See how QueueMatrix works
                <ArrowRight size={15} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/70 p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <CalendarCheck size={20} />
                </div>

                <p className="mt-4 text-xl font-extrabold text-slate-900">
                  Booking
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Schedule office appointments.
                </p>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/70 p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  <Ticket size={20} />
                </div>

                <p className="mt-4 text-xl font-extrabold text-slate-900">
                  Queuing
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Check assigned queue information.
                </p>
              </div>

              <div className="rounded-2xl border border-green-100 bg-gradient-to-br from-white to-green-50/70 p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-600">
                  <ClipboardCheck size={20} />
                </div>

                <p className="mt-4 text-xl font-extrabold text-slate-900">
                  Processing
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Follow your appointment status.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-white to-amber-50/70 p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <Bell size={20} />
                </div>

                <p className="mt-4 text-xl font-extrabold text-slate-900">
                  Updates
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Access office announcements.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="mt-10 scroll-mt-20">
          <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">
                What you can do
              </p>

              <h2 className="mt-0.5 text-xl font-extrabold text-slate-900 sm:text-2xl">
                Everything in one place.
              </h2>

              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Explore the tools and features that make up the QueueMatrix
                student mobile application.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <div
                  key={index}
                  className={`group relative flex min-h-[245px] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br ${
                    cardThemes[index % cardThemes.length]
                  } p-5 shadow-md transition duration-300 hover:-translate-y-1 hover:shadow-xl`}
                >
                  <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 transition duration-500 group-hover:scale-150" />
                  <div className="pointer-events-none absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-white/5 blur-xl" />

                  <div className="relative">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/15 text-white shadow-inner backdrop-blur-sm">
                      <Icon size={21} />
                    </div>

                    <p className="text-sm font-extrabold leading-snug text-white">
                      {feature.title}
                    </p>

                    <p className="mt-2 text-xs leading-5 text-blue-100">
                      {feature.description}
                    </p>
                  </div>

                  {/* Mini App Preview */}
                  <div className="relative mt-5 rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm">
                        <Icon size={18} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] font-bold text-white">
                          {feature.preview}
                        </p>

                        <p className="mt-1 truncate text-[9px] text-blue-100">
                          {feature.detail}
                        </p>
                      </div>

                      <ChevronRight
                        size={15}
                        className="shrink-0 text-white/70"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* How QueueMatrix Works */}
        <section id="how-it-works" className="mt-12 scroll-mt-20">
          <div className="mb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">
              The student experience
            </p>

            <h2 className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">
              How QueueMatrix works
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              From selecting a service to checking your queue information,
              QueueMatrix organizes the appointment process into clear steps.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {workflowSteps.map((step, index) => {
              const Icon = step.icon;

              return (
                <div
                  key={index}
                  className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-600">
                      <Icon size={21} />
                    </div>

                    <span className="text-xs font-extrabold tracking-wider text-slate-300">
                      {step.number}
                    </span>
                  </div>

                  <h3 className="mt-5 text-sm font-extrabold leading-snug text-slate-900">
                    {step.title}
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {step.description}
                  </p>

                  {index !== workflowSteps.length - 1 && (
                    <div className="absolute -right-3 top-9 z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 lg:flex">
                      <ChevronRight size={14} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Appointment Processing Explanation */}
        <section className="mt-12">
          <div className="mb-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">
              Appointment processing
            </p>

            <h2 className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">
              Not every appointment follows the same process.
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              QueueMatrix handles appointments based on the selected service
              and its processing requirements. This helps distinguish
              appointments that need staff confirmation from those eligible
              for automatic processing.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {serviceHandling.map((item, index) => {
              const Icon = item.icon;

              const colorClasses = {
                amber: {
                  icon: "bg-amber-50 text-amber-600",
                  badge: "bg-amber-50 text-amber-700",
                  border: "border-amber-100",
                },
                green: {
                  icon: "bg-green-50 text-green-600",
                  badge: "bg-green-50 text-green-700",
                  border: "border-green-100",
                },
                blue: {
                  icon: "bg-blue-50 text-blue-600",
                  badge: "bg-blue-50 text-blue-700",
                  border: "border-blue-100",
                },
              };

              const theme = colorClasses[item.color];

              return (
                <div
                  key={index}
                  className={`rounded-2xl border ${theme.border} bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${theme.icon}`}
                    >
                      <Icon size={21} />
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${theme.badge}`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <h3 className="mt-4 text-sm font-extrabold text-slate-900">
                    {item.title}
                  </h3>

                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
            <Info
              size={19}
              className="mt-0.5 shrink-0 text-blue-600"
            />

            <p className="text-xs leading-6 text-blue-900/80">
              <strong>Important:</strong> A booking submission does not
              automatically mean that every appointment is immediately
              approved or assigned a queue number. Processing depends on the
              selected service, appointment schedule, and applicable staff
              confirmation requirements.
            </p>
          </div>
        </section>

        {/* About This App & Quick Specification */}
        <section className="mt-12 grid gap-6 border-t border-slate-100 pt-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-900">
                About this app
              </h2>

              <ArrowRight size={18} className="text-slate-500" />
            </div>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              QueueMatrix is a student appointment and queuing application
              developed to make accessing office services more convenient
              and organized. Through the mobile application, students can
              browse available services, schedule appointments, view
              appointment information, and check their queue details once
              they have been processed and assigned a queue number.
            </p>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              The application supports staff-assisted appointment
              confirmation for services that require it and automatic
              processing for other eligible services. Students can also
              access office announcements and share feedback about their
              service experience.
            </p>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              QueueMatrix brings appointment booking, queue information,
              appointment tracking, office announcements, and service
              feedback together in one mobile application.
            </p>

            {/* App Feature Pills */}
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                "Appointment Booking",
                "Queue Monitoring",
                "Appointment Tracking",
                "Staff Confirmation",
                "Office Announcements",
                "Feedback and Ratings",
                "Student Services",
                "Android Application",
              ].map((item, index) => (
                <span
                  key={index}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
                    index === 7
                      ? "border-blue-100 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Package Details */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-3.5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                Package Details
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              <div className="flex items-center justify-between px-5 py-3 text-xs">
                <span className="flex items-center gap-2.5 font-medium text-slate-600">
                  <Smartphone size={16} className="text-blue-600" />
                  Platform
                </span>

                <span className="font-bold text-slate-900">Android</span>
              </div>

              <div className="flex items-center justify-between px-5 py-3 text-xs">
                <span className="flex items-center gap-2.5 font-medium text-slate-600">
                  <PackageCheck size={16} className="text-blue-600" />
                  Installer Format
                </span>

                <span className="font-bold text-slate-900">
                  QueueMatrix.apk
                </span>
              </div>

              <div className="flex items-center justify-between px-5 py-3 text-xs">
                <span className="flex items-center gap-2.5 font-medium text-slate-600">
                  <CheckCircle2 size={16} className="text-green-600" />
                  Release Version
                </span>

                <span className="font-bold text-slate-900">
                  v{APP_VERSION}
                </span>
              </div>

              <div className="flex items-center justify-between px-5 py-3 text-xs">
                <span className="flex items-center gap-2.5 font-medium text-slate-600">
                  <ShieldCheck size={16} className="text-blue-600" />
                  Distribution
                </span>

                <span className="rounded-md bg-green-50 px-2 py-0.5 font-bold text-green-700">
                  Official Source
                </span>
              </div>

              <div className="flex items-center justify-between px-5 py-3 text-xs">
                <span className="flex items-center gap-2.5 font-medium text-slate-600">
                  <CalendarDays size={16} className="text-blue-600" />
                  Application Type
                </span>

                <span className="font-bold text-slate-900">
                  Student Services
                </span>
              </div>

              <a
                href="#install-guide"
                onClick={(e) => handleSmoothScroll(e, "install-guide")}
                className="flex items-center justify-between px-5 py-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <span className="flex items-center gap-2.5">
                  <Info size={16} className="text-slate-400" />
                  How to install APK
                </span>

                <ChevronRight size={15} className="text-slate-400" />
              </a>
            </div>
          </div>
        </section>

        {/* Installation Guide */}
        <section
          id="install-guide"
          className="mt-12 scroll-mt-20 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 to-white shadow-sm"
        >
          <div className="border-b border-blue-100 bg-white/80 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <MonitorDown size={21} />
              </div>

              <div>
                <h2 className="text-base font-extrabold text-slate-900 sm:text-lg">
                  Installation Guide
                </h2>

                <p className="text-xs text-slate-500">
                  Get started in just a few steps.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:p-6">
            {installationSteps.map((step, index) => (
              <div
                key={index}
                className="flex items-start gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-xs font-extrabold text-blue-700">
                  {index + 1}
                </div>

                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900">
                    {step.title}
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Android Installation Help */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <SmartphoneNfc size={21} />
            </div>

            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Installing an APK on Android
              </h3>

              <p className="mt-1 text-xs leading-6 text-slate-500">
                QueueMatrix is distributed as an Android APK. Depending on
                your device and browser, Android may ask you to permit
                installation from the application used to download the file.
                Open your device settings only if prompted, review the
                installation permission, and proceed only if you trust the
                downloaded file.
              </p>
            </div>
          </div>
        </section>

        {/* Security Notice */}
        <section className="mt-6 flex w-full items-start gap-3 rounded-2xl border border-green-100 bg-green-50/80 p-4 sm:gap-4 sm:p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-green-600 shadow-sm">
            <ShieldCheck size={22} />
          </div>

          <div className="min-w-0">
            <h3 className="text-sm font-bold text-green-900">
              Download Safely
            </h3>

            <p className="mt-1 text-xs leading-6 text-green-800/80 sm:text-sm">
              Make sure you download QueueMatrix from its official download
              page. Android may display a security warning when installing
              an APK outside the Play Store. Only proceed if you trust the
              source and the application.
            </p>
          </div>
        </section>

        {/* Frequently Asked Questions */}
        <section className="mt-12">
          <div className="mb-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">
              Need to know?
            </p>

            <h2 className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">
              Frequently asked questions
            </h2>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
              <div className="flex items-start gap-3">
                <CircleHelp
                  size={19}
                  className="mt-0.5 shrink-0 text-blue-600"
                />

                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    What is QueueMatrix?
                  </h3>

                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    QueueMatrix is a student appointment and queuing
                    application that helps students access available office
                    services, book appointments, and check appointment and
                    queue information.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
              <div className="flex items-start gap-3">
                <CircleHelp
                  size={19}
                  className="mt-0.5 shrink-0 text-blue-600"
                />

                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Does every appointment get approved automatically?
                  </h3>

                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    No. Guidance & Counseling Services and Guidance and
                    Counseling Services require staff confirmation. Other
                    eligible services can follow the automatic processing
                    workflow when their schedule and requirements allow it.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
              <div className="flex items-start gap-3">
                <CircleHelp
                  size={19}
                  className="mt-0.5 shrink-0 text-blue-600"
                />

                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    When will I receive a queue number?
                  </h3>

                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    A queue number is assigned when the appointment has
                    reached the appropriate processing stage. Appointments
                    requiring staff confirmation must first be reviewed
                    according to the service workflow.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
              <div className="flex items-start gap-3">
                <CircleHelp
                  size={19}
                  className="mt-0.5 shrink-0 text-blue-600"
                />

                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Can I book an appointment for a later time?
                  </h3>

                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    Yes. You can select an available appointment schedule.
                    Future appointments are handled according to their
                    scheduled time and the selected service's processing
                    requirements.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
              <div className="flex items-start gap-3">
                <CircleHelp
                  size={19}
                  className="mt-0.5 shrink-0 text-blue-600"
                />

                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Can I check my appointment status?
                  </h3>

                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    Yes. QueueMatrix lets you view your appointment
                    information and check its current processing status
                    through the mobile application.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
              <div className="flex items-start gap-3">
                <CircleHelp
                  size={19}
                  className="mt-0.5 shrink-0 text-blue-600"
                />

                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    What should I do if the APK does not install?
                  </h3>

                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    Check that the APK finished downloading, that your
                    device allows installation from the download source,
                    and that your Android device is compatible with the
                    application.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final Download CTA */}
        <section className="relative mt-12 overflow-hidden rounded-3xl border border-blue-400/20 bg-gradient-to-br from-[#0b1f49] via-[#123b82] to-[#2563c7] p-6 text-white shadow-2xl shadow-blue-900/20 sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full border border-white/10 bg-blue-400/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-blue-100 backdrop-blur-sm">
                <Check size={13} />
                Get started with QueueMatrix
              </div>

              <h2 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
                Your Queue. Your Time. Made Simple.
              </h2>

              <p className="mt-2 text-sm leading-6 text-blue-100">
                Download the QueueMatrix Android application and access
                appointment booking, queue information, and office service
                updates from your mobile device.
              </p>
            </div>

            <div className="relative w-full shrink-0 sm:w-[230px]">
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className={`relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-3.5 text-sm font-extrabold transition-all duration-300 ${
                  isDownloading
                    ? "cursor-wait bg-blue-100 text-blue-800 shadow-lg"
                    : "bg-white text-blue-700 shadow-xl shadow-blue-950/20 hover:-translate-y-1 hover:bg-blue-50 hover:shadow-2xl active:translate-y-0"
                } disabled:opacity-90`}
              >
                {isDownloading && (
                  <span className="absolute inset-0 animate-pulse bg-blue-200/30" />
                )}

                <span className="relative flex items-center justify-center gap-2">
                  {isDownloading ? (
                    <>
                      <LoaderCircle size={19} className="animate-spin" />
                      Preparing Download...
                    </>
                  ) : (
                    <>
                      <ArrowDownToLine size={19} />
                      Download QueueMatrix
                    </>
                  )}
                </span>
              </button>

              {isDownloading && (
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-white" />
                </div>
              )}

              <p className="mt-2 text-center text-[11px] text-blue-100">
                Android APK · Version {APP_VERSION}
              </p>

              {downloadStarted && (
                <p className="mt-2 text-center text-[11px] font-semibold text-green-200">
                  <CheckCircle2
                    size={13}
                    className="mr-1 inline"
                  />
                  Download request started!
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-12 w-full border-t border-slate-200 py-7">
          <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <div className="flex items-center gap-3">
              <img
                src={APP_LOGO}
                alt="QueueMatrix Logo"
                className="h-9 w-9 rounded-lg object-contain"
              />

              <div>
                <p className="text-sm font-extrabold text-slate-800">
                  QueueMatrix
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Your Queue. Your Time. Made Simple.
                </p>
              </div>
            </div>

            <div className="text-center sm:text-right">
              <p className="text-xs text-slate-400">
                Student Appointment and Queuing System
              </p>

              <p className="mt-1 text-xs text-slate-400">
                © {new Date().getFullYear()} QueueMatrix. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
