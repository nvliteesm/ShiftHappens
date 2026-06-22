/**
 * Landing Page Component
 *
 * Public-facing marketing page for Smart Task Allocation.
 * Pricing section pulls from the centralized tier config —
 * same source of truth as the backend enforcement.
 *
 * Design: Dark navy hero, clean white content sections,
 * emerald CTAs. Subtle scroll-reveal animations.
 */
"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import {
  Brain,
  CalendarClock,
  ArrowLeftRight,
  ShieldCheck,
  Users,
  BarChart3,
  Check,
  X,
  ChevronRight,
  Zap,
  Clock,
  Target,
} from "lucide-react";
import { TIER_CONFIG, PRICING_FEATURES, type SubscriptionTier } from "@/lib/subscription-tiers";

// ─── Scroll Reveal ────────────────────────────────────────────────────────

function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, isVisible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-6"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────

function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 backdrop-blur-md shadow-sm border-b border-slate-200"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-6xl px-6 flex items-center justify-between h-16">
        <span
          className={`text-lg font-bold tracking-tight transition-colors ${
            scrolled ? "text-slate-900" : "text-white"
          }`}
        >
          SmartTask
        </span>
        <div className="hidden md:flex items-center gap-8">
          <a
            href="#features"
            className={`text-sm transition-colors ${
              scrolled
                ? "text-slate-600 hover:text-slate-900"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Features
          </a>
          <a
            href="#pricing"
            className={`text-sm transition-colors ${
              scrolled
                ? "text-slate-600 hover:text-slate-900"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Pricing
          </a>
          <a
            href="#how-it-works"
            className={`text-sm transition-colors ${
              scrolled
                ? "text-slate-600 hover:text-slate-900"
                : "text-slate-300 hover:text-white"
            }`}
          >
            How It Works
          </a>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className={`text-sm font-medium transition-colors ${
              scrolled
                ? "text-slate-700 hover:text-slate-900"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
          >
            Get Started Free
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-gradient-to-b from-slate-950 via-blue-950 to-slate-900">
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center pt-20">
        <Reveal>
          <p className="mb-4 inline-block rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-300">
            AI-powered workforce management
          </p>
        </Reveal>
        <Reveal delay={100}>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white leading-[1.1]">
            The right staff on the{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
              right shift
            </span>
          </h1>
        </Reveal>
        <Reveal delay={200}>
          <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Smart Task Allocation matches staff to shifts using AI that
            considers availability, certifications, work rules, and fairness
            — so your schedule builds itself.
          </p>
        </Reveal>
        <Reveal delay={300}>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="rounded-lg bg-emerald-600 px-6 py-3 text-base font-medium text-white hover:bg-emerald-500 transition-colors flex items-center gap-2"
            >
              Start free <ChevronRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="rounded-lg border border-slate-600 px-6 py-3 text-base font-medium text-slate-300 hover:border-slate-500 hover:text-white transition-colors"
            >
              See what it does
            </a>
          </div>
        </Reveal>

        {/* Metrics strip */}
        <Reveal delay={400}>
          <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto">
            {[
              { value: "4", label: "Eligibility checks per assignment" },
              { value: "10+", label: "AI-powered features" },
              { value: "<2s", label: "Schedule generation time" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Brain,
    title: "AI Staff Suggestions",
    description:
      "The engine ranks every eligible staff member by availability, certifications, hours worked, and historical performance — then recommends the best match.",
  },
  {
    icon: CalendarClock,
    title: "One-Click Auto-Schedule",
    description:
      "Generate a full week of assignments in seconds. The AI balances workload fairly, respects all constraints, and lets you review before confirming.",
  },
  {
    icon: ArrowLeftRight,
    title: "Smart-Swap Replacements",
    description:
      "When someone cancels, the system immediately finds qualified replacements and notifies you with the top recommendation.",
  },
  {
    icon: ShieldCheck,
    title: "Work Rules Engine",
    description:
      "Define break intervals, daily hour caps, and weekly limits — per department or per role. The eligibility engine enforces them automatically.",
  },
  {
    icon: Users,
    title: "Role-Based Access",
    description:
      "Admins see everything. Managers see their department. Staff see their own schedule. Custom roles add granular permissions on top.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Insights",
    description:
      "Coverage gaps, rejection trends, staffing ratios, and AI recommendations — all on a dashboard tailored to your role.",
  },
];

function Features() {
  return (
    <section id="features" className="py-24 bg-white">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-medium text-emerald-600 mb-2">
              Features
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Everything your scheduling needs
            </h2>
            <p className="mt-4 text-slate-500">
              Built for shift-based teams in hospitality, healthcare, retail,
              and beyond.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={i * 80}>
              <div className="group rounded-xl border border-slate-200 p-6 hover:border-slate-300 hover:shadow-lg transition-all duration-300">
                <div className="mb-4 inline-flex rounded-lg bg-blue-50 p-2.5 text-blue-600 group-hover:bg-blue-100 transition-colors">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────

const STEPS = [
  {
    icon: Target,
    title: "Set up your organization",
    description:
      "Create departments, define work rules, and configure operating hours. Choose an industry template or start from scratch.",
  },
  {
    icon: Users,
    title: "Invite your team",
    description:
      "Add staff with their availability, certifications, and employment type. The system knows who can work when.",
  },
  {
    icon: Zap,
    title: "Let AI schedule",
    description:
      "Click auto-schedule or assign manually with AI suggestions. Review the plan, adjust if needed, and confirm.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-slate-50">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-medium text-emerald-600 mb-2">
              How it works
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Up and running in minutes
            </h2>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 120}>
              <div className="relative text-center">
                <div className="mx-auto mb-5 inline-flex rounded-full bg-white p-4 shadow-sm border border-slate-200">
                  <step.icon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {step.description}
                </p>
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] border-t border-dashed border-slate-300" />
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────

const TIER_ORDER: SubscriptionTier[] = ["free", "pro", "enterprise"];

function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-white">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-sm font-medium text-emerald-600 mb-2">
              Pricing
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Start free, scale when ready
            </h2>
            <p className="mt-4 text-slate-500">
              Every plan includes all AI features. Upgrade when your team grows.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {TIER_ORDER.map((tierKey, i) => {
            const tier = TIER_CONFIG[tierKey];
            const isPro = tierKey === "pro";

            return (
              <Reveal key={tierKey} delay={i * 100}>
                <div
                  className={`relative rounded-xl p-6 flex flex-col h-full transition-all duration-300 hover:shadow-lg ${
                    isPro
                      ? "border-2 border-blue-600 shadow-md"
                      : "border border-slate-200"
                  }`}
                >
                  {isPro && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-medium text-white">
                      Most popular
                    </span>
                  )}

                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {tier.displayName}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {tier.tagline}
                    </p>
                    <div className="mt-4">
                      {tier.monthlyPrice !== null ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold text-slate-900">
                            ${tier.monthlyPrice}
                          </span>
                          {tier.monthlyPrice > 0 && (
                            <span className="text-slate-500 text-sm">
                              /month
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-4xl font-bold text-slate-900">
                          Custom
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Limits */}
                  <div className="space-y-2 mb-6 pb-6 border-b border-slate-100">
                    {Object.entries(tier.limits).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-600">
                          {key === "members"
                            ? "Team members"
                            : key === "active_tasks"
                              ? "Active tasks"
                              : key === "departments"
                                ? "Departments"
                                : key === "work_rules"
                                  ? "Work rules"
                                  : "Custom roles"}
                        </span>
                        <span className="font-medium text-slate-900">
                          {value === null ? "Unlimited" : value === 0 ? "—" : `Up to ${value}`}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Feature checklist */}
                  <div className="space-y-2 flex-1">
                    {PRICING_FEATURES.filter((f) => f.category === "tools").map(
                      (feature) => {
                        const val = feature[tierKey as keyof typeof feature];
                        const available = val === true;
                        return (
                          <div
                            key={feature.name}
                            className="flex items-center gap-2 text-sm"
                          >
                            {available ? (
                              <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                            ) : (
                              <X className="h-4 w-4 text-slate-300 shrink-0" />
                            )}
                            <span
                              className={
                                available
                                  ? "text-slate-700"
                                  : "text-slate-400"
                              }
                            >
                              {feature.name}
                            </span>
                          </div>
                        );
                      }
                    )}
                  </div>

                  <div className="mt-6">
                    <Link
                      href={tierKey === "enterprise" ? "#" : "/register"}
                      className={`block w-full rounded-lg py-2.5 text-center text-sm font-medium transition-colors ${
                        isPro
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : tierKey === "enterprise"
                            ? "bg-slate-900 text-white hover:bg-slate-800"
                            : "bg-slate-100 text-slate-900 hover:bg-slate-200"
                      }`}
                    >
                      {tierKey === "enterprise"
                        ? "Contact us"
                        : tierKey === "pro"
                          ? "Get started"
                          : "Start free"}
                    </Link>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={350}>
          <p className="text-center text-sm text-slate-400 mt-8">
            All plans include AI suggestions, auto-schedule, smart-swap,
            natural language tasks, dashboard insights, and coverage detection.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="py-24 bg-gradient-to-b from-slate-950 via-blue-950 to-slate-900 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Stop wrestling with spreadsheets
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Join teams that schedule smarter with AI — free to start,
            no credit card required.
          </p>
          <div className="mt-8">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-8 py-3 text-base font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              Get started free <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>

        <Reveal delay={200}>
          <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-8 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Set up in under 5 minutes</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Free for teams up to 10</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-800 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <span className="text-lg font-bold text-white tracking-tight">
              SmartTask
            </span>
            <p className="text-sm text-slate-500 mt-1">
              Intelligent workforce scheduling for modern teams.
            </p>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <a href="#features" className="hover:text-slate-300 transition-colors">
              Features
            </a>
            <a href="#pricing" className="hover:text-slate-300 transition-colors">
              Pricing
            </a>
            <Link href="/login" className="hover:text-slate-300 transition-colors">
              Log in
            </Link>
            <Link href="/register" className="hover:text-slate-300 transition-colors">
              Sign up
            </Link>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-slate-800 text-center text-xs text-slate-600">
          &copy; {new Date().getFullYear()} Smart Task Allocation. CSIT321
          Final Year Project — University of Wollongong (SIM Campus).
        </div>
      </div>
    </footer>
  );
}

// ─── Landing Page ─────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}
