import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Flame, 
  MapPin, 
  Phone, 
  Instagram, 
  Clock, 
  ArrowRight, 
  Utensils, 
  X,
  Maximize2,
  QrCode,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Award,
  Heart,
  ShieldCheck,
  Zap,
  CheckCircle2,
  ChevronDown,
  Pizza,
  ChefHat,
  CookingPot,
  GlassWater,
  CupSoda,
  IceCream,
  UtensilsCrossed,
  Sandwich,
  ConciergeBell
} from "lucide-react";
import { CHEESE_CORNER_CONFIG } from "./config";
import { useCafe } from "@/lib/cafe";
import { useMenu, type ProductionMenuItem } from "@/hooks/useMenu";
import { useImageUrl } from "@/lib/useImageUrl";
import { formatMoney } from "@/lib/db";

// ─── PREMIUM LUCIDE ICON RENDERER ───
function CategoryLucideIcon({ icon, className = "h-6 w-6" }: { icon: string; className?: string }) {
  switch (icon) {
    case "pizza": return <Pizza className={className} />;
    case "burger": return <ChefHat className={className} />;
    case "fries": return <Flame className={className} />;
    case "maggi": return <CookingPot className={className} />;
    case "pasta": return <UtensilsCrossed className={className} />;
    case "sandwich": return <Sandwich className={className} />;
    case "wrap": return <ConciergeBell className={className} />;
    case "mojito": return <GlassWater className={className} />;
    case "shake": return <CupSoda className={className} />;
    case "dessert": return <IceCream className={className} />;
    default: return <Utensils className={className} />;
  }
}

// ─── HERO POSTER & FOOD SHOWCASE CAROUSEL ───
function HeroPosterCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const posters = CHEESE_CORNER_CONFIG.posters;

  useEffect(() => {
    if (isHovered) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % posters.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [isHovered, posters.length]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % posters.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + posters.length) % posters.length);
  };

  const currentItem = posters[currentIndex];

  return (
    <div
      className="group relative mx-auto w-full max-w-xl lg:max-w-2xl overflow-hidden rounded-[2.5rem] border-4 border-white/80 bg-black/10 p-2 shadow-2xl transition-all duration-500 hover:shadow-amber-500/10"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative h-[400px] sm:h-[480px] lg:h-[540px] w-full overflow-hidden rounded-[2rem] bg-amber-950">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentItem.id}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 h-full w-full"
          >
            <img
              src={currentItem.image}
              alt={currentItem.title}
              loading={currentIndex === 0 ? "eager" : "lazy"}
              className="h-full w-full object-cover rounded-[2rem] select-none"
            />

            {/* Premium Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent rounded-[2rem]" />
          </motion.div>
        </AnimatePresence>

        {/* Floating Tag Badge */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-amber-950 shadow-lg backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5" />
            {currentItem.tag}
          </span>
        </div>

        {/* Content Info Overlay */}
        <div className="absolute bottom-14 inset-x-0 p-6 sm:p-8 z-10 text-white pointer-events-none">
          <motion.h3
            key={`title-${currentItem.id}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="font-display text-2xl sm:text-3xl font-black text-white drop-shadow-md"
          >
            {currentItem.title}
          </motion.h3>
          <motion.p
            key={`sub-${currentItem.id}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-1.5 text-xs sm:text-sm text-amber-100/90 font-medium line-clamp-2 max-w-lg leading-relaxed"
          >
            {currentItem.subtitle}
          </motion.p>
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={handlePrev}
          aria-label="Previous slide"
          className="absolute left-4 top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-amber-500 hover:text-amber-950 active:scale-95 z-20"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button
          onClick={handleNext}
          aria-label="Next slide"
          className="absolute right-4 top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-amber-500 hover:text-amber-950 active:scale-95 z-20"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* Indicators */}
        <div className="absolute bottom-5 inset-x-0 flex items-center justify-center gap-2 z-20">
          {posters.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-2 rounded-full transition-all duration-500 ${
                idx === currentIndex
                  ? "w-8 bg-amber-400 shadow-md"
                  : "w-2 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PREMIUM RESTAURANT MENU PREVIEW CARD ───
function MenuPreviewItemCard({ item, currency }: { item: ProductionMenuItem; currency: string }) {
  const imageUrl = useImageUrl(item.image_url);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -6 }}
      className="group relative flex flex-col justify-between overflow-hidden rounded-[2rem] bg-white p-4 shadow-sm transition-all duration-500 hover:shadow-xl hover:shadow-amber-500/10 border border-amber-100/90"
    >
      <div>
        {/* Large Food Image Container */}
        <div className="relative mb-3.5 h-48 sm:h-52 w-full overflow-hidden rounded-2xl bg-amber-100/30">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={item.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-100 to-amber-200 text-amber-700 font-medium text-sm">
              <Utensils className="h-10 w-10 text-amber-400/60" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60 transition-opacity group-hover:opacity-40" />

          {/* Veg / Non-Veg Indicator Pill */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 shadow-md backdrop-blur-md text-[11px] font-extrabold tracking-wide">
            <span className={`h-2.5 w-2.5 rounded-full ${item.veg_type === "veg" ? "bg-emerald-500 shadow-sm" : "bg-rose-500 shadow-sm"}`} />
            <span className={item.veg_type === "veg" ? "text-emerald-800" : "text-rose-800"}>
              {item.veg_type === "veg" ? "VEG" : "NON-VEG"}
            </span>
          </div>

          {/* Special Badges */}
          {item.tags && item.tags.length > 0 && (
            <div className="absolute top-3 right-3 flex flex-wrap gap-1">
              {item.tags.slice(0, 1).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-md"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Price Badge Overlay */}
          <div className="absolute bottom-3 right-3 rounded-full bg-amber-950/90 px-3.5 py-1 text-xs font-black text-amber-300 shadow-lg backdrop-blur-md border border-amber-500/30">
            {formatMoney(item.price_cents, currency)}
          </div>
        </div>

        {/* Item Content */}
        <div className="px-1">
          <h4 className="font-display text-lg font-extrabold text-amber-950 group-hover:text-orange-600 transition-colors line-clamp-1">
            {item.name}
          </h4>

          {item.description ? (
            <p className="mt-1.5 line-clamp-2 text-xs text-amber-900/75 leading-relaxed font-medium">
              {item.description}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-amber-900/50 italic font-medium">
              Freshly prepared with artisanal ingredients & signature house cheese.
            </p>
          )}
        </div>
      </div>

      {/* Footer Details */}
      <div className="mt-4 flex items-center justify-between border-t border-amber-100/80 pt-3 px-1 text-xs">
        <span className="text-[11px] font-extrabold text-amber-700/90 tracking-wide uppercase">
          {item.categoryName || "Specialty"}
        </span>
        <span className="inline-flex items-center gap-1 font-extrabold text-orange-600 group-hover:translate-x-1 transition-transform">
          Crafted Fresh <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </motion.div>
  );
}

export default function CheeseCornerLandingPage() {
  const { cafe, cafeId } = useCafe();
  const { items, categories, isLoading } = useMenu(cafeId);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedPoster, setSelectedPoster] = useState<string | null>(null);
  const [isOrderNowModalOpen, setIsOrderNowModalOpen] = useState(false);

  // Filter menu preview items based on active tab
  const filteredPreviewItems = useMemo(() => {
    if (activeCategory === "all") {
      return items.slice(0, 12);
    }
    return items.filter((item) => {
      const cat = categories.find((c) => c.id === item.category_id);
      return (
        cat?.name.toLowerCase().includes(activeCategory.toLowerCase()) ||
        item.categoryName?.toLowerCase().includes(activeCategory.toLowerCase())
      );
    });
  }, [items, categories, activeCategory]);

  return (
    <div className="min-h-screen bg-[#FFFBEB] text-[#321300] font-sans antialiased selection:bg-amber-400/40">
      
      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50 border-b border-amber-200/60 bg-[#FFFBEB]/90 backdrop-blur-xl transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3.5">
            <img
              src={CHEESE_CORNER_CONFIG.logoUrl}
              alt="Cheese Corner Logo"
              className="h-12 w-12 object-contain drop-shadow-md transition-transform hover:scale-105"
            />
            <div>
              <span className="font-display text-2xl font-black tracking-tight text-amber-950 block leading-none">
                {CHEESE_CORNER_CONFIG.name}
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-orange-600 block mt-0.5">
                Gourmet Comfort Café
              </span>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-8 text-sm font-extrabold text-amber-950/80">
            <a href="#why-choose" className="hover:text-orange-600 transition-colors">Why Choose Us</a>
            <a href="#specials" className="hover:text-orange-600 transition-colors">Chef's Specials</a>
            <a href="#menu" className="hover:text-orange-600 transition-colors">Menu</a>
            <a href="#qr-ordering" className="hover:text-orange-600 transition-colors">Dine-In QR</a>
            <a href="#gallery" className="hover:text-orange-600 transition-colors">Gallery</a>
            <a href="#contact" className="hover:text-orange-600 transition-colors">Location</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOrderNowModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 px-6 py-2.5 text-xs font-black tracking-wide text-white shadow-lg shadow-amber-500/20 transition hover:shadow-xl hover:from-amber-600 hover:to-orange-700 active:scale-95"
            >
              <QrCode className="h-4 w-4" /> Dine-In QR Ordering
            </button>
          </div>
        </div>
      </header>

      {/* ─── HERO SECTION (PHASE 1: REFINED HERO) ─── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-amber-200/50 via-[#FFFBEB] to-[#FFFBEB] pt-12 pb-20 md:pt-20 md:pb-32">
        <div className="pointer-events-none absolute top-10 left-[-10%] h-[420px] w-[420px] rounded-full bg-amber-400/25 blur-3xl" />
        <div className="pointer-events-none absolute top-32 right-[-10%] h-[500px] w-[500px] rounded-full bg-orange-400/20 blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            
            {/* Left Hero Content */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6"
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-300/60 px-4 py-1.5 text-xs font-black text-amber-950 shadow-sm">
                <Flame className="h-4 w-4 text-orange-600 animate-pulse" />
                <span>Handcrafted Gourmet Comfort Food</span>
              </div>

              <h1 className="mt-6 font-display text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-amber-950 leading-[1.05]">
                Where Every Bite <br />
                <span className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 bg-clip-text text-transparent italic">
                  Is Packed With Cheese!
                </span>
              </h1>

              <p className="mt-6 text-base sm:text-lg lg:text-xl text-amber-900/85 max-w-xl font-medium leading-relaxed">
                Savor artisanal hand-tossed pizzas, double-patty cheese burgers, loaded piri-piri fries & refreshing fruit mojitos prepared fresh daily.
              </p>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-wrap gap-4 items-center">
                <button
                  onClick={() => setIsOrderNowModalOpen(true)}
                  className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 px-8 py-4 text-sm font-black text-white shadow-xl shadow-amber-500/25 transition-all hover:shadow-2xl hover:scale-[1.02] active:scale-95"
                >
                  <QrCode className="h-5 w-5" />
                  <span>Dine-In QR Order</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <a
                  href="#menu-preview"
                  className="inline-flex items-center gap-2.5 rounded-full border-2 border-amber-300/80 bg-white/90 px-8 py-4 text-sm font-black text-amber-950 shadow-sm backdrop-blur-md transition-all hover:bg-amber-50 hover:border-amber-400 active:scale-95"
                >
                  <Utensils className="h-4 w-4 text-orange-600" />
                  <span>Explore Menu</span>
                </a>
              </div>

              {/* Quality & Credibility Pillars */}
              <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-amber-200/80 pt-8">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-200/60 text-amber-950">
                    <ShieldCheck className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="font-display text-sm font-black text-amber-950">100% Real</div>
                    <div className="text-[11px] font-bold text-amber-800/80">Mozzarella & Cheddar</div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-200/60 text-amber-950">
                    <Award className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="font-display text-sm font-black text-amber-950">92+ Dishes</div>
                    <div className="text-[11px] font-bold text-amber-800/80">Fresh Crafted</div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-200/60 text-amber-950">
                    <Zap className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="font-display text-sm font-black text-amber-950">Instant QR</div>
                    <div className="text-[11px] font-bold text-amber-800/80">Table Service</div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-200/60 text-amber-950">
                    <Heart className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="font-display text-sm font-black text-amber-950">Cozy Ambience</div>
                    <div className="text-[11px] font-bold text-amber-800/80">Family Friendly</div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Hero Food Carousel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="lg:col-span-6"
            >
              <HeroPosterCarousel />
            </motion.div>

          </div>
        </div>
      </section>

      {/* ─── WHY CHOOSE CHEESE CORNER ─── */}
      <section id="why-choose" className="bg-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-black uppercase tracking-widest text-orange-600">
              Handcrafted Quality
            </span>
            <h2 className="mt-1 font-display text-3xl sm:text-4xl font-black text-amber-950">
              Why Choose Us
            </h2>
            <p className="mt-2 text-sm text-amber-900/80 font-medium">
              Real ingredients, signature house sauces & melted cheese in every bite.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {CHEESE_CORNER_CONFIG.about.highlights.map((h, i) => (
              <motion.div
                key={h.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                whileHover={{ y: -6 }}
                className="group rounded-[2rem] bg-[#FFFBEB] p-6 text-center transition-all duration-300 hover:shadow-lg border border-amber-200/50"
              >
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-100/80 text-orange-600 mb-4 mx-auto group-hover:scale-110 group-hover:bg-orange-600 group-hover:text-white transition-all duration-300 shadow-sm">
                  <CategoryLucideIcon icon={h.icon} className="h-7 w-7" />
                </div>
                <h3 className="font-display text-lg font-extrabold text-amber-950">{h.name}</h3>
                <span className="inline-block my-1.5 rounded-full bg-amber-200/80 px-3 py-0.5 text-[11px] font-black text-amber-950">
                  {h.count}
                </span>
                <p className="mt-2 text-xs text-amber-900/75 leading-relaxed font-medium">
                  {h.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CHEF'S SPECIALS ─── */}
      <section id="specials" className="bg-gradient-to-b from-[#FFFBEB] to-amber-100/50 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-black uppercase tracking-widest text-orange-600">
              Kitchen Selection
            </span>
            <h2 className="mt-1 font-display text-3xl sm:text-4xl font-black text-amber-950">
              Chef's Specials
            </h2>
            <p className="mt-2 text-sm text-amber-900/80 font-medium">
              Hand-picked customer favorites prepared fresh to order.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Dish 1: Quattro Formaggi */}
            <div className="group rounded-[2.5rem] bg-white p-6 shadow-sm border border-amber-100 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/10 flex flex-col justify-between">
              <div>
                <div className="relative mb-4 h-48 w-full overflow-hidden rounded-2xl bg-amber-100">
                  <img
                    src="/branding/cheesecorner/showcase/quattro-formaggi.jpg"
                    alt="Quattro Formaggi Pizza"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute top-3 left-3 rounded-full bg-amber-400 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-950 shadow-md">
                    Chef's Favorite
                  </span>
                  <span className="absolute bottom-3 right-3 rounded-full bg-amber-950/90 px-3 py-1 text-xs font-black text-amber-300 shadow-md">
                    ₹349
                  </span>
                </div>
                <h3 className="font-display text-xl font-extrabold text-amber-950 group-hover:text-orange-600 transition-colors">
                  Quattro Formaggi Pizza
                </h3>
                <p className="mt-2 text-xs text-amber-900/75 leading-relaxed font-medium">
                  Artisanal sourdough crust layered with mozzarella, cheddar, gouda & parmesan.
                </p>
              </div>
              <button
                onClick={() => setIsOrderNowModalOpen(true)}
                className="mt-5 w-full rounded-full bg-amber-100/80 py-2.5 text-xs font-black text-amber-950 transition hover:bg-orange-600 hover:text-white flex items-center justify-center gap-1.5"
              >
                <Utensils className="h-3.5 w-3.5" /> Order Dish
              </button>
            </div>

            {/* Dish 2: Double Cheese Burst Burger */}
            <div className="group rounded-[2.5rem] bg-white p-6 shadow-sm border border-amber-100 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/10 flex flex-col justify-between">
              <div>
                <div className="relative mb-4 h-48 w-full overflow-hidden rounded-2xl bg-amber-100">
                  <img
                    src="/branding/cheesecorner/showcase/paneer-delight-burger.jpg"
                    alt="Double Cheese Burst Burger"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute top-3 left-3 rounded-full bg-orange-500 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-md">
                    Best Seller
                  </span>
                  <span className="absolute bottom-3 right-3 rounded-full bg-amber-950/90 px-3 py-1 text-xs font-black text-amber-300 shadow-md">
                    ₹249
                  </span>
                </div>
                <h3 className="font-display text-xl font-extrabold text-amber-950 group-hover:text-orange-600 transition-colors">
                  Double Cheese Burger
                </h3>
                <p className="mt-2 text-xs text-amber-900/75 leading-relaxed font-medium">
                  Juicy double patty topped with caramelized onions & melted cheddar in brioche.
                </p>
              </div>
              <button
                onClick={() => setIsOrderNowModalOpen(true)}
                className="mt-5 w-full rounded-full bg-amber-100/80 py-2.5 text-xs font-black text-amber-950 transition hover:bg-orange-600 hover:text-white flex items-center justify-center gap-1.5"
              >
                <Utensils className="h-3.5 w-3.5" /> Order Dish
              </button>
            </div>

            {/* Dish 3: Loaded Salsa Cheese Fries */}
            <div className="group rounded-[2.5rem] bg-white p-6 shadow-sm border border-amber-100 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/10 flex flex-col justify-between">
              <div>
                <div className="relative mb-4 h-48 w-full overflow-hidden rounded-2xl bg-amber-100">
                  <img
                    src="/branding/cheesecorner/showcase/salsa-cheese-fries.jpg"
                    alt="Loaded Salsa Cheese Fries"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute top-3 left-3 rounded-full bg-amber-400 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-950 shadow-md">
                    Loaded Side
                  </span>
                  <span className="absolute bottom-3 right-3 rounded-full bg-amber-950/90 px-3 py-1 text-xs font-black text-amber-300 shadow-md">
                    ₹189
                  </span>
                </div>
                <h3 className="font-display text-xl font-extrabold text-amber-950 group-hover:text-orange-600 transition-colors">
                  Loaded Salsa Cheese Fries
                </h3>
                <p className="mt-2 text-xs text-amber-900/75 leading-relaxed font-medium">
                  Golden crinkle fries doused in warm melted cheese sauce & tangy salsa.
                </p>
              </div>
              <button
                onClick={() => setIsOrderNowModalOpen(true)}
                className="mt-5 w-full rounded-full bg-amber-100/80 py-2.5 text-xs font-black text-amber-950 transition hover:bg-orange-600 hover:text-white flex items-center justify-center gap-1.5"
              >
                <Utensils className="h-3.5 w-3.5" /> Order Dish
              </button>
            </div>

            {/* Dish 4: Hot Sizzling Brownie */}
            <div className="group rounded-[2.5rem] bg-white p-6 shadow-sm border border-amber-100 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/10 flex flex-col justify-between">
              <div>
                <div className="relative mb-4 h-48 w-full overflow-hidden rounded-2xl bg-amber-100">
                  <img
                    src="/branding/cheesecorner/showcase/sizzling-brownie.jpg"
                    alt="Hot Sizzling Chocolate Brownie"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute top-3 left-3 rounded-full bg-orange-500 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-md">
                    Dessert Special
                  </span>
                  <span className="absolute bottom-3 right-3 rounded-full bg-amber-950/90 px-3 py-1 text-xs font-black text-amber-300 shadow-md">
                    ₹199
                  </span>
                </div>
                <h3 className="font-display text-xl font-extrabold text-amber-950 group-hover:text-orange-600 transition-colors">
                  Sizzling Brownie Sundae
                </h3>
                <p className="mt-2 text-xs text-amber-900/75 leading-relaxed font-medium">
                  Dark fudgy brownie on a sizzling skillet topped with vanilla bean ice cream.
                </p>
              </div>
              <button
                onClick={() => setIsOrderNowModalOpen(true)}
                className="mt-5 w-full rounded-full bg-amber-100/80 py-2.5 text-xs font-black text-amber-950 transition hover:bg-orange-600 hover:text-white flex items-center justify-center gap-1.5"
              >
                <Utensils className="h-3.5 w-3.5" /> Order Dish
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── MENU ─── */}
      <section id="menu" className="bg-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-orange-600">
                Live Kitchen
              </span>
              <h2 className="mt-1 font-display text-3xl sm:text-4xl font-black text-amber-950">
                Menu
              </h2>
              <p className="mt-1.5 text-sm text-amber-900/80 font-medium max-w-lg">
                Explore real prices and dishes from our live digital kitchen menu.
              </p>
            </div>

            {/* Filter Chips */}
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2">
              {[
                { id: "all", label: "All Dishes" },
                { id: "pizza", label: "Pizzas" },
                { id: "burger", label: "Burgers" },
                { id: "fries", label: "Fries" },
                { id: "shake", label: "Shakes" },
                { id: "mojito", label: "Mojitos" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`shrink-0 rounded-full px-5 py-2 text-xs font-black transition-all active:scale-95 ${
                    activeCategory === tab.id
                      ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20"
                      : "bg-amber-100/70 text-amber-950 hover:bg-amber-200/80"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-16 text-amber-800 gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-300 border-t-amber-600" />
              <span className="text-sm font-extrabold">Fetching live Cheese Corner menu...</span>
            </div>
          ) : filteredPreviewItems.length === 0 ? (
            <div className="rounded-[2.5rem] border-2 border-dashed border-amber-300 bg-amber-50/50 p-16 text-center text-amber-950 font-extrabold">
              No menu items found for this filter.
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <AnimatePresence mode="popLayout">
                {filteredPreviewItems.map((item) => (
                  <MenuPreviewItemCard key={item.id} item={item} currency={cafe?.currency ?? "INR"} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </section>

      {/* ─── DINE-IN QR ORDERING EXPERIENCE ─── */}
      <section id="qr-ordering" className="bg-gradient-to-b from-[#FFFBEB] to-amber-100/50 py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            {/* Left: Branded QR Stand Artwork */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative group overflow-hidden rounded-[2.5rem] border-4 border-white bg-white p-6 shadow-xl transition-all duration-500 hover:shadow-amber-500/10">
                <img
                  src={CHEESE_CORNER_CONFIG.qrStandUrl}
                  alt="Cheese Corner Table QR Stand"
                  className="h-80 sm:h-96 w-auto object-contain transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            </div>

            {/* Right: 4-Step Process */}
            <div className="lg:col-span-7">
              <span className="text-xs font-black uppercase tracking-widest text-orange-600">
                Dine-In QR Service
              </span>
              <h2 className="mt-1 font-display text-3xl sm:text-4xl font-black text-amber-950">
                Order in 4 Easy Steps
              </h2>
              <p className="mt-2 text-sm text-amber-900/80 font-medium max-w-lg">
                No waiting for paper menus. Scan the QR stand on your table to browse prices and order directly to your seat.
              </p>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl bg-white p-5 shadow-sm border border-amber-100/80">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-orange-600 text-white font-black text-xs">1</span>
                    <h3 className="font-display font-extrabold text-amber-950 text-base">Visit Café</h3>
                  </div>
                  <p className="text-xs text-amber-900/75 font-medium leading-relaxed">
                    Drop by Cheese Corner on University Road & find your table.
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm border border-amber-100/80">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-orange-600 text-white font-black text-xs">2</span>
                    <h3 className="font-display font-extrabold text-amber-950 text-base">Take A Seat</h3>
                  </div>
                  <p className="text-xs text-amber-900/75 font-medium leading-relaxed">
                    Settle into your dining table with friends & family.
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm border border-amber-100/80">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-orange-600 text-white font-black text-xs">3</span>
                    <h3 className="font-display font-extrabold text-amber-950 text-base">Scan QR Stand</h3>
                  </div>
                  <p className="text-xs text-amber-900/75 font-medium leading-relaxed">
                    Point your camera at the acrylic QR card on your table.
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm border border-amber-100/80">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-orange-600 text-white font-black text-xs">4</span>
                    <h3 className="font-display font-extrabold text-amber-950 text-base">Order Live</h3>
                  </div>
                  <p className="text-xs text-amber-900/75 font-medium leading-relaxed">
                    Browse menu, customize options & send orders straight to kitchen.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOrderNowModalOpen(true)}
                className="mt-8 inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 px-7 py-3.5 text-xs font-black text-white shadow-lg shadow-amber-500/20 transition hover:shadow-xl active:scale-95"
              >
                <QrCode className="h-4 w-4" /> Scan & Order Live
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── GALLERY ─── */}
      <section id="gallery" className="bg-[#FFFBEB] py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-black uppercase tracking-widest text-orange-600">
              Food Photography
            </span>
            <h2 className="mt-1 font-display text-3xl sm:text-4xl font-black text-amber-950">
              Gallery
            </h2>
            <p className="mt-2 text-sm text-amber-900/80 font-medium">
              A glimpse of gourmet pizzas, burgers & refreshing drinks prepared daily.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CHEESE_CORNER_CONFIG.signatureGallery.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                onClick={() => setSelectedPoster(item.image)}
                className={`group relative cursor-pointer overflow-hidden rounded-[2.5rem] bg-amber-950 shadow-md transition-all duration-500 hover:shadow-2xl hover:shadow-amber-500/10 ${
                  i % 3 === 0 ? "h-[420px]" : i % 3 === 1 ? "h-[360px]" : "h-[460px]"
                }`}
              >
                <img
                  src={item.image}
                  alt={item.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />

                {/* Dark Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent p-8 flex flex-col justify-end text-white">
                  <span className="inline-self-start rounded-full bg-amber-400 px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-950 w-max mb-2.5 shadow-md">
                    {item.tag}
                  </span>
                  <h3 className="font-display text-2xl font-extrabold text-white group-hover:text-amber-300 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-amber-100/90 mt-1.5 line-clamp-2 font-medium leading-relaxed">{item.subtitle}</p>
                  
                  <div className="mt-5 flex items-center gap-1.5 text-xs font-black text-amber-300 group-hover:translate-x-1 transition-transform">
                    <Utensils className="h-4 w-4 text-orange-400" /> Savor Signature Dish
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── LOCATION & HOURS ─── */}
      <section id="contact" className="bg-white py-16 md:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[3rem] bg-[#FFFBEB] p-8 sm:p-12 md:p-16 shadow-sm border border-amber-200/60 space-y-10">
            <div className="text-center max-w-xl mx-auto">
              <span className="text-xs font-black uppercase tracking-widest text-orange-600">
                Find Us
              </span>
              <h2 className="mt-1 font-display text-3xl sm:text-4xl font-black text-amber-950">
                Location & Hours
              </h2>
              <p className="mt-2 text-sm text-amber-900/80 font-medium">
                Visit our café on University Road.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 text-sm">
              <div className="flex items-start gap-4 rounded-3xl bg-white p-6 shadow-sm border border-amber-100">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-100 text-orange-600">
                  <MapPin className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-extrabold text-amber-950 text-base">Café Address</div>
                  <div className="text-amber-900/80 mt-1 font-medium leading-relaxed">{CHEESE_CORNER_CONFIG.contact.address}</div>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-3xl bg-white p-6 shadow-sm border border-amber-100">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-100 text-orange-600">
                  <Phone className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-extrabold text-amber-950 text-base">Phone & Inquiries</div>
                  <div className="text-amber-900/80 mt-1 font-medium">{CHEESE_CORNER_CONFIG.contact.phone}</div>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-3xl bg-white p-6 shadow-sm border border-amber-100">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-100 text-orange-600">
                  <Instagram className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-extrabold text-amber-950 text-base">Instagram</div>
                  <div className="text-amber-900/80 mt-1 font-medium">{CHEESE_CORNER_CONFIG.contact.instagram}</div>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-3xl bg-white p-6 shadow-sm border border-amber-100">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-100 text-orange-600">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-extrabold text-amber-950 text-base">Opening Hours</div>
                  <div className="text-amber-900/80 mt-1 font-medium">{CHEESE_CORNER_CONFIG.contact.hours}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-amber-900/50 bg-amber-950 text-amber-100 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3.5">
            <img src={CHEESE_CORNER_CONFIG.logoUrl} alt="Logo" className="h-9 w-9 object-contain" />
            <div>
              <span className="font-display text-xl font-black text-white block leading-none">Cheese Corner</span>
              <span className="text-[10px] font-bold text-amber-400">Gourmet Comfort Food</span>
            </div>
          </div>

          <p className="text-xs text-amber-200/70 text-center font-medium">
            © {new Date().getFullYear()} Cheese Corner Café. All rights reserved.
          </p>

          <div className="text-xs font-black text-amber-400">
            Official Gourmet Café Website
          </div>
        </div>
      </footer>

      {/* ─── ORDER NOW INFORMATION MODAL ─── */}
      {isOrderNowModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => setIsOrderNowModalOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-md w-full overflow-hidden rounded-[2.5rem] border-2 border-white bg-white p-7 shadow-2xl text-[#321300]"
          >
            <button
              onClick={() => setIsOrderNowModalOpen(false)}
              className="absolute top-5 right-5 grid h-9 w-9 place-items-center rounded-full bg-amber-100 text-amber-950 hover:bg-amber-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center">
              <div className="mx-auto mb-3 flex items-center justify-center gap-2">
                <span className="rounded-full bg-amber-100 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                  <QrCode className="h-4 w-4 text-orange-600" /> Table QR Ordering
                </span>
              </div>

              <h3 className="font-display text-2xl font-black text-amber-950">
                Dine-In At Cheese Corner
              </h3>

              <div className="my-5 flex justify-center">
                <div className="rounded-3xl border-2 border-amber-200 bg-[#FFFBEB] p-4 shadow-md">
                  <img
                    src={CHEESE_CORNER_CONFIG.qrStandUrl}
                    alt="Cheese Corner QR Stand"
                    className="h-56 w-auto object-contain drop-shadow-xl hover:scale-105 transition-transform duration-300"
                  />
                </div>
              </div>

              <div className="my-4 grid grid-cols-2 gap-2.5 text-left text-xs font-medium text-amber-950">
                <div className="rounded-2xl bg-amber-50 p-3 border border-amber-200/60">
                  <div className="font-extrabold text-amber-950">1. Visit Café</div>
                  <div className="text-amber-900/80 text-[11px] mt-0.5">Drop by Cheese Corner.</div>
                </div>
                <div className="rounded-2xl bg-amber-50 p-3 border border-amber-200/60">
                  <div className="font-extrabold text-amber-950">2. Take A Seat</div>
                  <div className="text-amber-900/80 text-[11px] mt-0.5">Find any dining table.</div>
                </div>
                <div className="rounded-2xl bg-amber-50 p-3 border border-amber-200/60">
                  <div className="font-extrabold text-amber-950">3. Scan QR</div>
                  <div className="text-amber-800/80 text-[11px] mt-0.5">Scan card on table.</div>
                </div>
                <div className="rounded-2xl bg-amber-50 p-3 border border-amber-200/60">
                  <div className="font-extrabold text-amber-950">4. Order Live</div>
                  <div className="text-amber-800/80 text-[11px] mt-0.5">Browse menu & order!</div>
                </div>
              </div>

              <button
                onClick={() => setIsOrderNowModalOpen(false)}
                className="mt-3 w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 py-3.5 text-sm font-black text-white shadow-lg transition hover:from-amber-600 hover:to-orange-700 active:scale-95"
              >
                Got It
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── LIGHTBOX MODAL FOR SHOWCASE ─── */}
      {selectedPoster && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setSelectedPoster(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-[2.5rem] border-4 border-white shadow-2xl">
            <img src={selectedPoster} alt="Showcase Lightbox" className="max-h-[85vh] w-auto object-contain" />
            <button
              onClick={() => setSelectedPoster(null)}
              className="absolute top-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-black/70 text-white hover:bg-black transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
