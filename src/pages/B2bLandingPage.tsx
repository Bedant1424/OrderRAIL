import { useState } from "react";
import { Link } from "react-router-dom";
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
  Menu
} from "lucide-react";

export default function B2bLandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [demoRequested, setDemoRequested] = useState(false);
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
    // In a real B2B production app, this would submit to Supabase demo_requests.
    // For Sprint 1, we simulate a premium B2B success state.
    setDemoRequested(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-brand selection:text-white">
      {/* ─── NAVIGATION ─── */}
      <header className="sticky top-0 z-50 border-b border-slate-900 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-brand to-rose-500 text-white shadow-lg shadow-brand/20">
              <span className="font-display text-base font-black">OR</span>
            </span>
            <span className="font-display text-xl font-bold tracking-tight text-white">OrderRail<span className="text-brand">.</span></span>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#overview" className="hover:text-white transition">Overview</a>
            <a href="#workflow" className="hover:text-white transition">Workflow</a>
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
            <a href="#contact" className="hover:text-white transition">Contact</a>
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              to="/staff/login"
              className="text-sm font-semibold text-slate-300 hover:text-white transition"
            >
              Sign In
            </Link>
            <a
              href="#contact"
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 hover:bg-brand-hover transition"
            >
              Request Demo
            </a>
          </div>

          {/* Mobile menu trigger */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-slate-400 hover:text-white transition"
            aria-label="Toggle Navigation"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        {/* Mobile menu panel */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-900 bg-slate-950 px-6 py-4 space-y-4">
            <nav className="flex flex-col gap-3 text-sm font-medium text-slate-400">
              <a href="#overview" onClick={() => setMobileMenuOpen(false)} className="hover:text-white py-1">Overview</a>
              <a href="#workflow" onClick={() => setMobileMenuOpen(false)} className="hover:text-white py-1">Workflow</a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="hover:text-white py-1">Features</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="hover:text-white py-1">Pricing</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="hover:text-white py-1">FAQ</a>
              <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="hover:text-white py-1">Contact</a>
            </nav>
            <div className="border-t border-slate-900 pt-4 flex flex-col gap-3">
              <Link
                to="/staff/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center py-2 text-sm font-semibold text-slate-300 hover:text-white"
              >
                Sign In
              </Link>
              <a
                href="#contact"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center rounded-full bg-brand py-2 text-sm font-semibold text-white"
              >
                Request Demo
              </a>
            </div>
          </div>
        )}
      </header>

      {/* ─── HERO SECTION ─── */}
      <section className="relative overflow-hidden pt-20 pb-24 md:pt-32">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-brand/10 blur-[120px]" />
        <div className="absolute top-10 right-10 -z-10 h-72 w-72 rounded-full bg-rose-500/5 blur-[100px]" />

        <div className="mx-auto max-w-7xl px-6 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/60 px-4 py-1.5 text-xs font-semibold tracking-wider text-brand uppercase">
            <Coffee className="h-3.5 w-3.5" /> Next-Gen Restaurant Suite
          </span>
          <h1 className="mt-6 font-display text-4xl font-extrabold leading-none tracking-tight text-white sm:text-6xl lg:text-7xl">
            The QR ordering system <br/>
            <span className="bg-gradient-to-r from-brand to-rose-400 bg-clip-text text-transparent">your café deserves.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400 leading-relaxed md:text-xl">
            OrderRail modernizes dine-in services with contactless guest ordering, chef-friendly kitchen dashboards, and high-speed counter billing. Streamline workflows and boost table turnover today.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              to="/staff/login"
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 border border-slate-800 hover:border-slate-700 px-8 py-4 text-base font-semibold text-white transition shadow-lg hover:bg-slate-900/80"
            >
              Sign In to Console
            </Link>
            <a
              href="#contact"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-8 py-4 text-base font-semibold text-white shadow-xl shadow-brand/20 hover:bg-brand-hover transition"
            >
              Request Live Demo <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ─── PRODUCT OVERVIEW ─── */}
      <section id="overview" className="border-t border-slate-900 bg-slate-950 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Unified Operations, Elevated Experience</h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              Stop juggling disjointed apps. Manage tables, menus, tickets, and revenue from one robust, real-time operating system.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: QrCode,
                title: "Smart QR Ordering",
                desc: "Enable guests to scan dynamic table codes, browse menus with live item statuses, customize orders, and checkout instantly."
              },
              {
                icon: ChefHat,
                title: "Kitchen Display (KDS)",
                desc: "An interactive, visual ticket screen for your chefs. Real-time updates, preparation timers, and ready-to-serve alerts."
              },
              {
                icon: Receipt,
                title: "Counter Billing & POS",
                desc: "Quick, single-tap order settlement, receipt printing, offline queue syncing, and split-payment management for cashiers."
              },
              {
                icon: Users,
                title: "Staff Roles & Access",
                desc: "Delegate tasks with granular security roles: Owner, Manager, Cashier, Kitchen, and Waiter. Keep operations organized."
              },
              {
                icon: TrendingUp,
                title: "Real-time Analytics",
                desc: "Track average order value, peak operating hours, top menu categories, table occupancy, and staff response times."
              },
              {
                icon: LayoutDashboard,
                title: "Dynamic Menu Board",
                desc: "Update prices, mark items unavailable, edit dish details, and configure category order instantly from any device."
              }
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="group rounded-3xl border border-slate-900 bg-slate-900/20 p-8 hover:border-slate-800 transition">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 border border-slate-800 text-brand group-hover:text-rose-400 transition">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-6 font-display text-lg font-bold text-white">{title}</h3>
                <p className="mt-3 text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── RESTAURANT WORKFLOW ─── */}
      <section id="workflow" className="border-t border-slate-900 bg-slate-900/10 py-24 relative overflow-hidden">
        <div className="absolute top-1/2 left-0 -z-10 h-72 w-72 rounded-full bg-brand/5 blur-[100px]" />

        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">From Scan to Settlement</h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              Watch how OrderRail coordinates diners, kitchen, and service staff to slash order delays.
            </p>
          </div>

          {/* Workflow Steps layout */}
          <div className="mt-16 relative">
            {/* Connection Line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-brand/80 to-rose-500/20 -translate-x-1/2 hidden lg:block" />

            <div className="space-y-12 lg:space-y-20">
              {[
                {
                  step: "01",
                  title: "QR Table Scan",
                  actor: "Customer",
                  desc: "Diner scans the unique table QR code with their phone camera. No signups, app store downloads, or setups required.",
                  side: "left"
                },
                {
                  step: "02",
                  title: "Browse & Order",
                  actor: "Customer",
                  desc: "Guest browses the responsive digital menu, selects custom add-ons, adds notes, and places the order directly.",
                  side: "right"
                },
                {
                  step: "03",
                  title: "Ticket Generation",
                  actor: "Kitchen & Staff",
                  desc: "Orders immediately route to the KDS console, ringing audio alerts for chefs. Staff get notified of new table orders.",
                  side: "left"
                },
                {
                  step: "04",
                  title: "Preparation & Dispatch",
                  actor: "Kitchen",
                  desc: "The chef starts the prep timer. When ready, the cook marks the ticket completed, alerting floor waiters via service display.",
                  side: "right"
                },
                {
                  step: "05",
                  title: "Counter Settlement",
                  actor: "Cashier",
                  desc: "Diners can request calls, check order histories, or walk up to settle the unified table bill via credit card, UPI, or cash.",
                  side: "left"
                }
              ].map(({ step, title, actor, desc, side }) => (
                <div key={step} className="flex flex-col lg:flex-row items-center gap-8 lg:gap-0">
                  <div className={`flex-1 w-full text-center lg:text-left ${side === "right" ? "lg:order-last lg:pl-16" : "lg:text-right lg:pr-16"}`}>
                    <span className="text-xs font-bold uppercase tracking-wider text-brand">{actor}</span>
                    <h3 className="mt-2 font-display text-xl font-bold text-white">{title}</h3>
                    <p className="mt-3 text-sm text-slate-400 leading-relaxed max-w-md mx-auto lg:mx-0 lg:ml-auto lg:mr-0">{desc}</p>
                  </div>
                  {/* Step bubble */}
                  <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 border border-slate-800 text-xs font-bold text-white shadow-lg shadow-black">
                    {step}
                  </div>
                  <div className="flex-1 hidden lg:block" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURES GRID ─── */}
      <section id="features" className="border-t border-slate-900 bg-slate-950 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Engineered for Fast-Paced Dining</h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              Deep-dive into the features that keep OrderRail running smoothly during peak rush hours.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Dine-In QR Ordering",
                bullets: [
                  "Interactive digital menu browser",
                  "Cart custom notes & allergy alerts",
                  "Veg / Non-Veg toggles & categories",
                  "Direct staff summoning interface"
                ]
              },
              {
                title: "Counter Billing Hub",
                bullets: [
                  "Quick-receipt generation",
                  "Integrated dining session resets",
                  "UPI, Card, and Cash ledger tags",
                  "Cross-device ledger synchronization"
                ]
              },
              {
                title: "Kitchen Display (KDS)",
                bullets: [
                  "Visual ticket priority colors",
                  "Prep-timers & audio notifications",
                  "Individual item status rollups",
                  "Auto-refreshing status panels"
                ]
              },
              {
                title: "Detailed Reports",
                bullets: [
                  "Daily, weekly, and monthly sales logs",
                  "Peak order hour heatmaps",
                  "Food waste & category analysis",
                  "Staff resolution performance sheets"
                ]
              },
              {
                title: "Granular Team Roles",
                bullets: [
                  "Restricted manager settings access",
                  "Chef-only item availability controls",
                  "Secure cashier payment registers",
                  "Owner multi-branch control dashboard"
                ]
              },
              {
                title: "Table Layout & QR Engine",
                bullets: [
                  "Custom table labels & seating counts",
                  "Bulk print QR card PDF exports",
                  "Live table status color codes",
                  "Dynamic table activation toggles"
                ]
              }
            ].map(({ title, bullets }) => (
              <div key={title} className="rounded-3xl border border-slate-900 bg-slate-900/10 p-8 hover:border-slate-800 transition">
                <h3 className="font-display text-lg font-bold text-white">{title}</h3>
                <ul className="mt-6 space-y-3.5">
                  {bullets.map(b => (
                    <li key={b} className="flex items-start gap-2.5 text-sm text-slate-400">
                      <Check className="h-4.5 w-4.5 text-brand shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="pricing" className="border-t border-slate-900 bg-slate-900/10 py-24 relative overflow-hidden">
        <div className="absolute bottom-0 right-0 -z-10 h-72 w-72 rounded-full bg-rose-500/5 blur-[100px]" />
        
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Transparent, Growth-Focused Pricing</h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              Start free, scale seamlessly. Choose a package tailored to your restaurant's volume.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:max-w-4xl md:mx-auto md:grid-cols-2">
            {/* Starter Plan */}
            <div className="rounded-3xl border border-slate-900 bg-slate-900/10 p-8 hover:border-slate-850 transition flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Starter</span>
                <div className="mt-4 flex items-baseline gap-1 text-white">
                  <span className="text-4xl font-extrabold tracking-tight">₹1,999</span>
                  <span className="text-sm font-medium text-slate-400">/month</span>
                </div>
                <p className="mt-4 text-sm text-slate-400">For boutique cafes and food trucks looking to introduce QR table ordering.</p>
                <ul className="mt-8 space-y-4 text-sm text-slate-300">
                  <li className="flex items-center gap-3"><Check className="h-4.5 w-4.5 text-brand shrink-0" /> Up to 15 dining tables</li>
                  <li className="flex items-center gap-3"><Check className="h-4.5 w-4.5 text-brand shrink-0" /> Dynamic digital menus</li>
                  <li className="flex items-center gap-3"><Check className="h-4.5 w-4.5 text-brand shrink-0" /> Staff order dashboard</li>
                  <li className="flex items-center gap-3"><Check className="h-4.5 w-4.5 text-brand shrink-0" /> Email-only support</li>
                </ul>
              </div>
              <a href="#contact" className="mt-8 block text-center rounded-full bg-slate-900 border border-slate-800 hover:border-slate-700 py-3 text-sm font-semibold text-white transition">Get Started</a>
            </div>

            {/* Pro Plan */}
            <div className="relative rounded-3xl border border-brand bg-slate-900/30 p-8 shadow-2xl shadow-brand/5 flex flex-col justify-between">
              <span className="absolute top-0 right-8 -translate-y-1/2 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white uppercase tracking-wider">Recommended</span>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-brand">Professional</span>
                <div className="mt-4 flex items-baseline gap-1 text-white">
                  <span className="text-4xl font-extrabold tracking-tight">₹4,999</span>
                  <span className="text-sm font-medium text-slate-400">/month</span>
                </div>
                <p className="mt-4 text-sm text-slate-400">For active B2B operations, full-service bistros, and multi-room restaurants.</p>
                <ul className="mt-8 space-y-4 text-sm text-slate-300">
                  <li className="flex items-center gap-3"><Check className="h-4.5 w-4.5 text-brand shrink-0" /> Unlimited tables & QRs</li>
                  <li className="flex items-center gap-3"><Check className="h-4.5 w-4.5 text-brand shrink-0" /> Full KDS & counter billing</li>
                  <li className="flex items-center gap-3"><Check className="h-4.5 w-4.5 text-brand shrink-0" /> Multiple staff roles & logs</li>
                  <li className="flex items-center gap-3"><Check className="h-4.5 w-4.5 text-brand shrink-0" /> Real-time sales analytics</li>
                  <li className="flex items-center gap-3"><Check className="h-4.5 w-4.5 text-brand shrink-0" /> 24/7 Phone & WhatsApp support</li>
                </ul>
              </div>
              <a href="#contact" className="mt-8 block text-center rounded-full bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-hover shadow-lg shadow-brand/20 transition">Start Free Trial</a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="border-t border-slate-900 bg-slate-950 py-24">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Frequently Asked Questions</h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              Clear up your queries regarding setup, compatibility, and offline operations.
            </p>
          </div>

          <div className="mt-16 space-y-6">
            {[
              {
                q: "What hardware is required to run OrderRail?",
                a: "OrderRail is a web-based responsive suite. Diners need only their personal mobile phones. Your staff can access dashboards on any standard Android/iOS tablet or desktop computer running modern web browsers."
              },
              {
                q: "How does the offline syncing system work?",
                a: "If your restaurant's Wi-Fi network temporarily drops out, the customer app saves order logs to local device queue storage. Once connection is restored, tickets automatically synchronize back to the staff console."
              },
              {
                q: "Can I manage multiple outlets under a single account?",
                a: "Yes. Our multi-tenant architecture supports chain outlets. Owners can inspect centralized analytics, modify pricing per location, and partition staff permissions across branches easily."
              },
              {
                q: "Do you charge extra configuration or setup fees?",
                a: "No setup fees. We provide QR card layout templates for bulk downloads immediately. Support guides are available, and custom standee prints can be ordered through partners."
              }
            ].map(({ q, a }, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-900 bg-slate-900/5 p-6 hover:border-slate-800 transition">
                <h3 className="flex gap-3 font-display text-base font-bold text-white">
                  <HelpCircle className="h-5 w-5 text-brand shrink-0 mt-0.5" />
                  <span>{q}</span>
                </h3>
                <p className="mt-3.5 pl-8 text-sm text-slate-400 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CONTACT / LEAD CAPTURE ─── */}
      <section id="contact" className="border-t border-slate-900 bg-slate-900/10 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand">Connect with us</span>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Ready to upgrade your restaurant?</h2>
              <p className="mt-4 text-slate-400 leading-relaxed">
                Schedule a personalized product walkthrough with our hospitality experts. Discover how OrderRail can save staff hours and increase diners' satisfaction.
              </p>

              <div className="mt-8 space-y-6 text-sm text-slate-300">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-brand" />
                  <span>onboarding@orderrail.com</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-brand" />
                  <span>+91 98765 43210</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-brand" />
                  <span>Hitech City, Hyderabad, India</span>
                </div>
              </div>
            </div>

            {/* Lead capture form panel */}
            <div className="rounded-3xl border border-slate-900 bg-slate-900/20 p-8">
              {demoRequested ? (
                <div className="text-center py-10 space-y-4">
                  <CheckCircle className="mx-auto h-16 w-16 text-brand" />
                  <h3 className="font-display text-2xl font-bold text-white">Demo Request Received!</h3>
                  <p className="text-sm text-slate-400 max-w-md mx-auto">
                    Thank you! An onboarding specialist will reach out to you within 24 hours to schedule your live walkthrough.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleDemoSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-400">Restaurant Name</label>
                      <input
                        required
                        type="text"
                        name="restaurantName"
                        value={formData.restaurantName}
                        onChange={handleInputChange}
                        placeholder="e.g. Café Sunrise"
                        className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-white outline-none focus:border-brand transition"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-400">Contact Name</label>
                      <input
                        required
                        type="text"
                        name="contactName"
                        value={formData.contactName}
                        onChange={handleInputChange}
                        placeholder="e.g. Rahul Sharma"
                        className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-white outline-none focus:border-brand transition"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-400">Business Email</label>
                      <input
                        required
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="rahul@sunrise.com"
                        className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-white outline-none focus:border-brand transition"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-400">Contact Number</label>
                      <input
                        required
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="+91 99999 88888"
                        className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-white outline-none focus:border-brand transition"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-400">City</label>
                      <input
                        required
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        placeholder="Mumbai"
                        className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-white outline-none focus:border-brand transition"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-400">Number of Tables</label>
                      <select
                        name="tableCount"
                        value={formData.tableCount}
                        onChange={handleInputChange}
                        className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300 outline-none focus:border-brand transition"
                      >
                        <option value="1-10">1 - 10 tables</option>
                        <option value="11-25">11 - 25 tables</option>
                        <option value="26-50">26 - 50 tables</option>
                        <option value="50+">More than 50 tables</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400">Additional Message</label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      placeholder="Tell us about your requirements..."
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-white outline-none focus:border-brand transition resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-full bg-brand py-3 text-sm font-semibold text-white shadow-lg shadow-brand/20 hover:bg-brand-hover transition"
                  >
                    Submit Request
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-slate-900 bg-slate-950 py-12">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-tr from-brand to-rose-500 text-white font-display text-sm font-black">OR</span>
            <span className="font-display text-base font-bold text-white">OrderRail</span>
          </div>
          <p className="text-xs text-slate-500">© 2026 OrderRail Technologies Pvt Ltd. All rights reserved.</p>
          <div className="flex items-center gap-6 text-xs text-slate-400">
            <a href="#" className="hover:text-white transition">Privacy Policy</a>
            <a href="#" className="hover:text-white transition">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
