import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { 
  QrCode, 
  ChefHat, 
  LayoutDashboard, 
  Receipt, 
  TrendingUp, 
  Users, 
  ArrowRight, 
  Check, 
  HelpCircle, 
  Mail, 
  Phone, 
  MapPin, 
  Coffee,
  CheckCircle,
  Menu,
  Smartphone,
  Monitor,
  Clock,
  CheckCircle2,
  CreditCard,
  ShoppingBag,
  Sparkles
} from "lucide-react";
import { 
  CustomerAppMockup, 
  KitchenDisplayMockup, 
  OwnerAnalyticsMockup, 
  CounterBillingMockup, 
  QrRestaurantSceneMockup 
} from "@/components/marketing/ProductShowcases";

export default function B2bLandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [demoRequested, setDemoRequested] = useState(false);
  const [activeTab, setActiveTab] = useState<"customer" | "staff" | "owner" | "billing">("customer");
  const shouldReduceMotion = useReducedMotion();

  const [formData, setFormData] = useState({
    restaurantName: "",
    contactName: "",
    email: "",
    phone: "",
    city: "",
    tableCount: "1-10",
    message: ""
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDemoRequested(true);
  };

  // Motion animation variants
  const fadeInVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } }
  };

  return (
    <div className="min-h-screen bg-gradient-warm text-foreground font-sans antialiased selection:bg-accent/30 selection:text-foreground">
      {/* ─── NAVIGATION ─── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-foreground shadow-soft">
              <span className="font-display text-sm font-bold">OR</span>
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">OrderRail</span>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            {["Product", "QR Scene", "Workflow", "Features", "Pricing", "FAQ"].map((item) => {
              const href = `#${item.toLowerCase().replace(/\s+/g, "-")}`;
              return (
                <a 
                  key={item} 
                  href={href} 
                  className="relative py-1 transition-colors hover:text-foreground after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-accent after:transition-all after:duration-200 hover:after:w-full"
                >
                  {item}
                </a>
              );
            })}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/staff/login"
              className="inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-2 text-sm font-medium ring-1 ring-border/80 hover:bg-secondary transition shadow-soft active:scale-95"
            >
              <LayoutDashboard className="h-4 w-4" /> Sign in
            </Link>
            <motion.a
              whileHover={shouldReduceMotion ? {} : { scale: 1.02 }}
              whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
              href="#contact"
              className="group inline-flex items-center gap-2 rounded-full btn-primary-action px-5 py-2 text-sm font-semibold shadow-soft"
            >
              Request demo <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </motion.a>
          </div>

          {/* Mobile menu trigger */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-muted-foreground hover:text-foreground transition"
            aria-label="Toggle Navigation"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        {/* Mobile menu panel */}
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden border-t border-border/60 bg-card px-6 py-4 space-y-4 shadow-float"
          >
            <nav className="flex flex-col gap-3 text-sm font-medium text-muted-foreground">
              <a href="#product" onClick={() => setMobileMenuOpen(false)} className="hover:text-foreground py-1">Product</a>
              <a href="#qr-experience" onClick={() => setMobileMenuOpen(false)} className="hover:text-foreground py-1">QR Scene</a>
              <a href="#workflow" onClick={() => setMobileMenuOpen(false)} className="hover:text-foreground py-1">Workflow</a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="hover:text-foreground py-1">Features</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="hover:text-foreground py-1">Pricing</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="hover:text-foreground py-1">FAQ</a>
              <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="hover:text-foreground py-1">Contact</a>
            </nav>
            <div className="border-t border-border/60 pt-4 flex flex-col gap-3">
              <Link
                to="/staff/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                Sign In
              </Link>
              <a
                href="#contact"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center rounded-full btn-primary-action py-2.5 text-sm font-semibold"
              >
                Request Demo
              </a>
            </div>
          </motion.div>
        )}
      </header>

      {/* ─── HERO SECTION ─── */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-16 md:pb-20">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div 
            initial={shouldReduceMotion ? false : "hidden"}
            animate="visible"
            transition={{ staggerChildren: 0.1 }}
            className="text-center max-w-3xl mx-auto"
          >
            <motion.div variants={fadeInVariants}>
              <span className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-border/80 shadow-soft">
                <Coffee className="h-3.5 w-3.5 text-accent" /> Digital café upgrade
              </span>
            </motion.div>

            <motion.h1 variants={fadeInVariants} className="mt-5 font-display text-3xl font-semibold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-balance break-words">
              Restaurant operations, <br />
              <span className="italic text-accent">beautifully simplified.</span>
            </motion.h1>

            <motion.p variants={fadeInVariants} className="mt-5 text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              OrderRail gives your café contactless QR ordering, a real-time kitchen display, and owner analytics — without changing how you run your floor.
            </motion.p>

            <motion.div variants={fadeInVariants} className="mt-7 flex flex-wrap justify-center gap-3">
              <motion.a
                whileHover={shouldReduceMotion ? {} : { scale: 1.03 }}
                whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                href="#contact"
                className="group inline-flex items-center gap-2 rounded-full btn-primary-action px-7 py-3 text-sm font-semibold shadow-soft"
              >
                Request a demo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </motion.a>
              <motion.div whileHover={shouldReduceMotion ? {} : { scale: 1.02 }}>
                <Link
                  to="/staff/login"
                  className="inline-flex items-center gap-2 rounded-full bg-card px-7 py-3 text-sm font-semibold ring-1 ring-border/80 transition hover:bg-secondary shadow-soft"
                >
                  <LayoutDashboard className="h-4 w-4" /> Sign in to console
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* HERO PRODUCT PREVIEW FRAME */}
          <motion.div 
            initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-10 md:mt-12 max-w-5xl mx-auto"
          >
            <div className="rounded-3xl bg-card p-3 md:p-5 shadow-float ring-1 ring-border/80 space-y-4">
              {/* Mockup Topbar & Tab Switcher */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 px-2 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-rose-400/80 inline-block" />
                    <span className="h-3 w-3 rounded-full bg-amber-400/80 inline-block" />
                    <span className="h-3 w-3 rounded-full bg-emerald-400/80 inline-block" />
                  </div>
                  <span className="ml-2 text-xs font-mono text-muted-foreground/70 hidden sm:inline-block">app.orderrail.com</span>
                </div>

                {/* Tab Controls */}
                <div className="flex flex-wrap items-center justify-center gap-1 rounded-full bg-secondary/70 p-1 ring-1 ring-border/50 text-xs font-medium">
                  <button
                    onClick={() => setActiveTab("customer")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition ${activeTab === "customer" ? "bg-card text-foreground shadow-soft font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Smartphone className="h-3.5 w-3.5 text-accent" /> Customer App
                  </button>
                  <button
                    onClick={() => setActiveTab("staff")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition ${activeTab === "staff" ? "bg-card text-foreground shadow-soft font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <ChefHat className="h-3.5 w-3.5 text-accent" /> Kitchen KDS
                  </button>
                  <button
                    onClick={() => setActiveTab("owner")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition ${activeTab === "owner" ? "bg-card text-foreground shadow-soft font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Monitor className="h-3.5 w-3.5 text-accent" /> Owner Analytics
                  </button>
                  <button
                    onClick={() => setActiveTab("billing")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition ${activeTab === "billing" ? "bg-card text-foreground shadow-soft font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Receipt className="h-3.5 w-3.5 text-accent" /> Counter POS
                  </button>
                </div>
              </div>

              {/* Mockup Display Render */}
              <div className="pt-1">
                {activeTab === "customer" && (
                  <motion.div initial={shouldReduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="py-3 flex justify-center bg-background/40 rounded-2xl border border-border/40 p-3">
                    <CustomerAppMockup />
                  </motion.div>
                )}

                {activeTab === "staff" && (
                  <motion.div initial={shouldReduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="bg-background/40 rounded-2xl border border-border/40 p-2 md:p-3">
                    <KitchenDisplayMockup />
                  </motion.div>
                )}

                {activeTab === "owner" && (
                  <motion.div initial={shouldReduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="bg-background/40 rounded-2xl border border-border/40 p-2 md:p-3">
                    <OwnerAnalyticsMockup />
                  </motion.div>
                )}

                {activeTab === "billing" && (
                  <motion.div initial={shouldReduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="bg-background/40 rounded-2xl border border-border/40 p-2 md:p-3">
                    <CounterBillingMockup />
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── PRODUCT SUITE SHOWCASE ─── */}
      <section id="product" className="border-t border-border/50 py-14 md:py-18">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div 
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45 }}
            className="text-center max-w-2xl mx-auto"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">The OrderRail Suite</span>
            <h2 className="mt-2.5 font-display text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl text-balance break-words">One unified system for your floor</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              Designed to connect diners, chefs, cashiers, and management in real time.
            </p>
          </motion.div>

          <div className="mt-12 space-y-14 lg:space-y-18">
            {/* Showcase 1: Customer App */}
            <motion.div 
              initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45 }}
              className="grid gap-8 lg:grid-cols-12 lg:items-center"
            >
              <div className="lg:col-span-5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                  <Smartphone className="h-3.5 w-3.5" /> Customer Ordering Experience
                </span>
                <h3 className="mt-3 font-display text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight text-balance break-words">
                  Contactless table ordering made effortless
                </h3>
                <p className="mt-3 text-muted-foreground leading-relaxed">
                  Every table receives a unique QR code. Guests scan to view full digital menus with live dish availability, add custom item notes, place orders, and summon waiters with one tap.
                </p>
                <ul className="mt-5 space-y-2.5 text-sm">
                  <li className="flex items-center gap-2.5 text-foreground font-medium">
                    <Check className="h-4 w-4 text-accent shrink-0" /> Zero app store downloads or registrations
                  </li>
                  <li className="flex items-center gap-2.5 text-foreground font-medium">
                    <Check className="h-4 w-4 text-accent shrink-0" /> Veg/Non-Veg toggles, search & popular tags
                  </li>
                  <li className="flex items-center gap-2.5 text-foreground font-medium">
                    <Check className="h-4 w-4 text-accent shrink-0" /> One-tap "Call Staff" & service requests
                  </li>
                </ul>
              </div>
              <div className="lg:col-span-7 flex justify-center">
                <CustomerAppMockup />
              </div>
            </motion.div>

            {/* Showcase 2: Staff Console */}
            <motion.div 
              initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45 }}
              className="grid gap-8 lg:grid-cols-12 lg:items-start"
            >
              <div className="lg:col-span-12">
                <div className="mb-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                    <ChefHat className="h-3.5 w-3.5" /> Kitchen & Service Display
                  </span>
                  <h3 className="mt-2.5 font-display text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight text-balance break-words">
                    Real-time kitchen tickets & Saturday peak rush KDS
                  </h3>
                  <p className="mt-2 text-muted-foreground leading-relaxed max-w-3xl">
                    Orders route instantly to kitchen display screens with audio chime alerts. Chefs manage prep timers, mark dishes ready, and acknowledge floor service requests in real time.
                  </p>
                </div>
                <KitchenDisplayMockup />
              </div>
            </motion.div>

            {/* Showcase 3: Owner Analytics Console */}
            <motion.div 
              initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45 }}
              className="grid gap-8 lg:grid-cols-12 lg:items-start"
            >
              <div className="lg:col-span-12">
                <div className="mb-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                    <TrendingUp className="h-3.5 w-3.5" /> Owner Analytics Dashboard
                  </span>
                  <h3 className="mt-2.5 font-display text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight text-balance break-words">
                    Instant visibility into revenue, peak hours & top items
                  </h3>
                  <p className="mt-2 text-muted-foreground leading-relaxed max-w-3xl">
                    Track daily sales progression, identify peak order hours for staffing, inspect top-selling dishes, and optimize table turnover from a single dashboard.
                  </p>
                </div>
                <OwnerAnalyticsMockup />
              </div>
            </motion.div>

            {/* Showcase 4: Counter Billing POS */}
            <motion.div 
              initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45 }}
              className="grid gap-8 lg:grid-cols-12 lg:items-start"
            >
              <div className="lg:col-span-12">
                <div className="mb-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                    <Receipt className="h-3.5 w-3.5" /> Counter Billing POS
                  </span>
                  <h3 className="mt-2.5 font-display text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight text-balance break-words">
                    Single-tap order settlement & quick thermal receipts
                  </h3>
                  <p className="mt-2 text-muted-foreground leading-relaxed max-w-3xl">
                    Cashiers can review itemized dining sessions, process split payments via UPI/Card/Cash, and instantly clear table sessions for the next guests.
                  </p>
                </div>
                <CounterBillingMockup />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── QR EXPERIENCE SCENE ─── */}
      <section id="qr-experience" className="border-t border-border/50 bg-secondary/20 py-14 md:py-18">
        <div className="mx-auto max-w-6xl px-6">
          <QrRestaurantSceneMockup />
        </div>
      </section>

      {/* ─── WORKFLOW SECTION (REDESIGNED CONNECTED TIMELINE RHYTHM) ─── */}
      <section id="workflow" className="border-t border-border/50 py-14 md:py-18">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div 
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="text-center max-w-2xl mx-auto"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">Floor Operations</span>
            <h2 className="mt-2.5 font-display text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl text-balance break-words">From scan to settlement</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              Customer → Kitchen → Staff → Cashier in five connected steps.
            </p>
          </motion.div>

          {/* Redesigned Balanced Grid Workflow */}
          <div className="mt-10 md:mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { step: "01", actor: "Customer", title: "Scan QR", desc: "Diner scans unique table QR with camera.", icon: QrCode },
              { step: "02", actor: "Customer", title: "Browse & Order", desc: "Guest selects menu items, notes & places order.", icon: Smartphone },
              { step: "03", actor: "Kitchen", title: "Kitchen Ticket", desc: "Order rings on KDS with prep timer & sound alert.", icon: ChefHat },
              { step: "04", actor: "Staff", title: "Dispatch", desc: "Chef marks ready; waiter delivers to table.", icon: CheckCircle2 },
              { step: "05", actor: "Cashier", title: "Bill Settlement", desc: "Counter settlement via UPI, Card, or Cash.", icon: Receipt },
            ].map((st, idx) => (
              <motion.div
                key={st.step}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.08 }}
                whileHover={shouldReduceMotion ? {} : { y: -3, boxShadow: "var(--shadow-float)" }}
                className="relative rounded-2xl border border-border/60 bg-card p-4 shadow-soft transition-all hover:border-accent/40 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/15 text-accent font-bold text-xs">
                      <st.icon className="h-4 w-4" />
                    </span>
                    <span className="font-display text-xs font-bold text-muted-foreground/80">{st.step}</span>
                  </div>
                  <span className="mt-3 inline-block text-[10px] font-bold uppercase tracking-wider text-accent">{st.actor}</span>
                  <h3 className="font-display text-sm font-semibold text-foreground mt-0.5">{st.title}</h3>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{st.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES GRID ─── */}
      <section id="features" className="border-t border-border/50 bg-secondary/20 py-14 md:py-18">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div 
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="text-center max-w-2xl mx-auto"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">Capabilities</span>
            <h2 className="mt-2.5 font-display text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl text-balance break-words">Engineered for busy service</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              Every feature is designed around how real restaurants operate during peak rush hours.
            </p>
          </motion.div>

          <div className="mt-10 md:mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Dine-in QR ordering",
                bullets: [
                  "Interactive digital menu browser",
                  "Cart custom notes & allergy alerts",
                  "Veg / Non-Veg toggles & categories",
                  "Direct staff summoning interface"
                ]
              },
              {
                title: "Counter billing",
                bullets: [
                  "Quick receipt generation",
                  "Integrated dining session resets",
                  "UPI, Card, and Cash ledger tags",
                  "Cross-device synchronisation"
                ]
              },
              {
                title: "Kitchen display",
                bullets: [
                  "Visual ticket priority colours",
                  "Prep timers & audio notifications",
                  "Individual item status tracking",
                  "Auto-refreshing status panels"
                ]
              },
              {
                title: "Reports & insights",
                bullets: [
                  "Daily, weekly, and monthly sales",
                  "Peak order hour heatmaps",
                  "Category analysis & food waste",
                  "Staff performance tracking"
                ]
              },
              {
                title: "Team roles & access",
                bullets: [
                  "Owner, manager, cashier, kitchen, waiter",
                  "Chef-only item availability controls",
                  "Secure cashier payment registers",
                  "Multi-branch control dashboard"
                ]
              },
              {
                title: "Table & QR management",
                bullets: [
                  "Custom table labels & seating counts",
                  "Bulk print QR card PDF exports",
                  "Live table status indicators",
                  "Dynamic table activation toggles"
                ]
              }
            ].map(({ title, bullets }, idx) => (
              <motion.div 
                key={title}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.06 }}
                whileHover={shouldReduceMotion ? {} : { y: -3, boxShadow: "var(--shadow-float)" }}
                className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 transition-all hover:border-accent/40"
              >
                <h3 className="font-display text-base font-semibold">{title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {bullets.map(b => (
                    <li key={b} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" className="border-t border-border/50 py-14 md:py-18">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div 
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="text-center max-w-2xl mx-auto"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">Pricing</span>
            <h2 className="mt-2.5 font-display text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl text-balance break-words">Simple, honest pricing</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              Start free, scale when you're ready. No setup fees, no hidden charges.
            </p>
          </motion.div>

          <div className="mt-10 md:mt-12 grid gap-6 md:max-w-4xl md:mx-auto md:grid-cols-2">
            {/* Starter Plan */}
            <motion.div 
              whileHover={shouldReduceMotion ? {} : { y: -3 }}
              className="rounded-3xl bg-card p-8 shadow-soft ring-1 ring-border/60 flex flex-col justify-between transition-all hover:shadow-float"
            >
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Starter</span>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-semibold tabular-nums tracking-tight">₹1,999</span>
                  <span className="text-sm font-medium text-muted-foreground">/month</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">For boutique cafés and food trucks getting started with QR ordering.</p>
                <ul className="mt-6 space-y-3 text-sm">
                  <li className="flex items-center gap-3"><Check className="h-4 w-4 text-accent shrink-0" /> Up to 15 dining tables</li>
                  <li className="flex items-center gap-3"><Check className="h-4 w-4 text-accent shrink-0" /> Dynamic digital menus</li>
                  <li className="flex items-center gap-3"><Check className="h-4 w-4 text-accent shrink-0" /> Staff order dashboard</li>
                  <li className="flex items-center gap-3"><Check className="h-4 w-4 text-accent shrink-0" /> Email support</li>
                </ul>
              </div>
              <a href="#contact" className="mt-8 block text-center rounded-full bg-card py-3 text-sm font-semibold ring-1 ring-border/80 hover:bg-secondary transition shadow-soft">Get started</a>
            </motion.div>

            {/* Pro Plan */}
            <motion.div 
              whileHover={shouldReduceMotion ? {} : { y: -3 }}
              className="relative rounded-3xl bg-card p-8 shadow-float ring-2 ring-accent/40 flex flex-col justify-between transition-all"
            >
              <span className="absolute top-0 right-8 -translate-y-1/2 rounded-full bg-gradient-accent px-3 py-1 text-xs font-semibold text-accent-foreground uppercase tracking-wider shadow-soft">Recommended</span>
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-accent">Professional</span>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-semibold tabular-nums tracking-tight">₹4,999</span>
                  <span className="text-sm font-medium text-muted-foreground">/month</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">For full-service restaurants and multi-room operations.</p>
                <ul className="mt-6 space-y-3 text-sm">
                  <li className="flex items-center gap-3"><Check className="h-4 w-4 text-accent shrink-0" /> Unlimited tables & QR codes</li>
                  <li className="flex items-center gap-3"><Check className="h-4 w-4 text-accent shrink-0" /> Full KDS & counter billing</li>
                  <li className="flex items-center gap-3"><Check className="h-4 w-4 text-accent shrink-0" /> Multiple staff roles & logs</li>
                  <li className="flex items-center gap-3"><Check className="h-4 w-4 text-accent shrink-0" /> Real-time sales analytics</li>
                  <li className="flex items-center gap-3"><Check className="h-4 w-4 text-accent shrink-0" /> 24/7 Phone & WhatsApp support</li>
                </ul>
              </div>
              <motion.a 
                whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
                href="#contact" 
                className="mt-8 block text-center rounded-full btn-primary-action py-3 text-sm font-semibold shadow-soft"
              >
                Start free trial
              </motion.a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="border-t border-border/50 bg-secondary/20 py-14 md:py-18">
        <div className="mx-auto max-w-3xl px-6">
          <motion.div 
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
            className="text-center"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">FAQ</span>
            <h2 className="mt-2.5 font-display text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl text-balance break-words">Common questions</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              Everything you need to know about setup, compatibility, and day-to-day use.
            </p>
          </motion.div>

          <div className="mt-8 md:mt-10 space-y-3.5">
            {[
              {
                q: "What hardware do I need?",
                a: "OrderRail is entirely web-based. Diners use their own phones. Your staff can access dashboards on any Android or iOS tablet, or a desktop computer with a modern browser."
              },
              {
                q: "What happens if the Wi-Fi drops?",
                a: "The customer app saves orders to a local queue. Once connection is restored, tickets automatically synchronise back to the staff console — nothing gets lost."
              },
              {
                q: "Can I manage multiple outlets?",
                a: "Yes. Our multi-tenant architecture supports chain outlets. Owners can view centralised analytics, adjust pricing per location, and manage staff permissions across branches."
              },
              {
                q: "Are there any setup fees?",
                a: "No setup fees at all. We provide QR card templates for bulk downloads immediately, along with support guides. Custom standee prints can be ordered through our partners."
              }
            ].map(({ q, a }, idx) => (
              <motion.div 
                key={idx}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: idx * 0.06 }}
                className="rounded-2xl bg-card p-5 shadow-soft ring-1 ring-border/60 space-y-2"
              >
                <h3 className="flex gap-3 font-display text-base font-semibold">
                  <HelpCircle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  <span>{q}</span>
                </h3>
                <p className="pl-8 text-sm text-muted-foreground leading-relaxed">{a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CONTACT / LEAD CAPTURE (BALANCED CONTAINER & INFO BLOCK) ─── */}
      <section id="contact" className="border-t border-border/50 py-14 md:py-18">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
            {/* Left Info Card - Balanced Density */}
            <motion.div 
              initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-5 rounded-3xl bg-card p-6 md:p-8 shadow-soft ring-1 ring-border/60 space-y-6"
            >
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                  <Sparkles className="h-3.5 w-3.5" /> Onboarding Support
                </span>
                <h2 className="mt-3 font-display text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl text-balance break-words">Ready to modernise your café?</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Schedule a walkthrough with our team. We'll show you how OrderRail fits into your existing workflow — no pressure, no obligations.
                </p>
              </div>

              <div className="space-y-4 text-xs border-t border-border/50 pt-4">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/15 text-accent shrink-0"><Mail className="h-4 w-4" /></span>
                  <div>
                    <div className="font-semibold text-foreground">Email Onboarding</div>
                    <div>onboarding@orderrail.com</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/15 text-accent shrink-0"><Phone className="h-4 w-4" /></span>
                  <div>
                    <div className="font-semibold text-foreground">Phone & WhatsApp</div>
                    <div>+91 98765 43210</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent/15 text-accent shrink-0"><MapPin className="h-4 w-4" /></span>
                  <div>
                    <div className="font-semibold text-foreground">Headquarters</div>
                    <div>Hitech City, Hyderabad, India</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-secondary/50 p-3.5 text-xs text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-accent shrink-0" />
                <span>Response commitment: Walkthrough scheduled within 2 hours.</span>
              </div>
            </motion.div>

            {/* Right Lead capture form panel */}
            <motion.div 
              initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-7 rounded-3xl bg-card p-6 md:p-8 shadow-soft ring-1 ring-border/60"
            >
              {demoRequested ? (
                <div className="text-center py-10 space-y-4">
                  <CheckCircle className="mx-auto h-14 w-14 text-accent" />
                  <h3 className="font-display text-2xl font-semibold">We'll be in touch!</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Thank you. An onboarding specialist will reach out within 24 hours to schedule your walkthrough.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleDemoSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Restaurant Name</label>
                      <input
                        required
                        type="text"
                        name="restaurantName"
                        value={formData.restaurantName}
                        onChange={handleInputChange}
                        placeholder="e.g. Café Sunrise"
                        className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition placeholder:text-muted-foreground/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Contact Name</label>
                      <input
                        required
                        type="text"
                        name="contactName"
                        value={formData.contactName}
                        onChange={handleInputChange}
                        placeholder="e.g. Rahul Sharma"
                        className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Business Email</label>
                      <input
                        required
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="rahul@sunrise.com"
                        className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition placeholder:text-muted-foreground/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Contact Number</label>
                      <input
                        required
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="+91 99999 88888"
                        className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">City</label>
                      <input
                        required
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        placeholder="Mumbai"
                        className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition placeholder:text-muted-foreground/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Number of Tables</label>
                      <select
                        name="tableCount"
                        value={formData.tableCount}
                        onChange={handleInputChange}
                        className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition text-foreground"
                      >
                        <option value="1-10">1 – 10 tables</option>
                        <option value="11-25">11 – 25 tables</option>
                        <option value="26-50">26 – 50 tables</option>
                        <option value="50+">More than 50 tables</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Additional Message</label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      placeholder="Tell us about your requirements..."
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition resize-none placeholder:text-muted-foreground/50"
                    />
                  </div>

                  <motion.button
                    whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
                    type="submit"
                    className="w-full rounded-full btn-primary-action py-3 text-sm font-semibold shadow-soft"
                  >
                    Submit request
                  </motion.button>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-border/50 py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-brand-foreground shadow-soft font-display text-xs font-bold">OR</span>
            <span className="font-display text-sm font-semibold">OrderRail</span>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 OrderRail Technologies Pvt Ltd. All rights reserved.</p>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <a href="#" className="hover:text-foreground transition">Privacy Policy</a>
            <a href="#" className="hover:text-foreground transition">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
