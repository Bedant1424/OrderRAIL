import { useState, useMemo } from "react";
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
  Sparkles,
  Info
} from "lucide-react";
import { CHEESE_CORNER_CONFIG } from "./config";
import { useCafe } from "@/lib/cafe";
import { useMenu, type ProductionMenuItem } from "@/hooks/useMenu";
import { useImageUrl } from "@/lib/useImageUrl";
import { formatMoney } from "@/lib/db";

function MenuPreviewItemCard({ item, currency }: { item: ProductionMenuItem; currency: string }) {
  const imageUrl = useImageUrl(item.image_url);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-amber-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-amber-400 hover:shadow-md"
    >
      <div>
        <div className="relative mb-3 h-40 w-full overflow-hidden rounded-2xl bg-amber-100/50">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={item.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-100 to-amber-200 text-amber-700 font-medium text-sm">
              <Utensils className="h-8 w-8 text-amber-400 opacity-60" />
            </div>
          )}
          
          {/* Veg / Non-Veg Indicator */}
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 shadow-sm backdrop-blur-md text-[11px] font-bold">
            <span className={`h-2.5 w-2.5 rounded-full ${item.veg_type === "veg" ? "bg-emerald-500" : "bg-rose-500"}`} />
            <span className={item.veg_type === "veg" ? "text-emerald-700" : "text-rose-700"}>
              {item.veg_type === "veg" ? "VEG" : "NON-VEG"}
            </span>
          </div>

          {/* Tags / Badges */}
          {item.tags && item.tags.length > 0 && (
            <div className="absolute top-2.5 right-2.5 flex flex-wrap gap-1">
              {item.tags.slice(0, 1).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-start justify-between gap-2">
          <h4 className="font-display text-base font-bold text-amber-950 group-hover:text-amber-600 transition-colors line-clamp-1">
            {item.name}
          </h4>
          <span className="shrink-0 font-display text-base font-extrabold text-amber-600">
            {formatMoney(item.price_cents, currency)}
          </span>
        </div>

        {item.description && (
          <p className="mt-1.5 line-clamp-2 text-xs text-amber-800/80 leading-relaxed font-medium">
            {item.description}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-amber-100 pt-3 text-xs">
        <span className="text-[11px] font-semibold text-amber-600/90">
          {item.categoryName || "Specialty"}
        </span>
        <span className="inline-flex items-center gap-1 font-bold text-amber-700">
          In-House Specialty
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
  const [heroImageError, setHeroImageError] = useState(false);
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
    <div className="min-h-screen bg-[#FFFBEB] text-[#451A03] font-sans antialiased selection:bg-amber-400/40">
      
      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50 border-b border-amber-200/60 bg-[#FFFBEB]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <img
              src={CHEESE_CORNER_CONFIG.logoUrl}
              alt="Cheese Corner Logo"
              className="h-11 w-11 object-contain drop-shadow-sm"
            />
            <div>
              <span className="font-display text-xl font-black tracking-tight text-amber-950 block leading-none">
                {CHEESE_CORNER_CONFIG.name}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
                Gourmet Café & Bites
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-bold text-amber-900/80">
            <a href="#about" className="hover:text-amber-600 transition-colors">About</a>
            <a href="#categories" className="hover:text-amber-600 transition-colors">Categories</a>
            <a href="#menu-preview" className="hover:text-amber-600 transition-colors">Menu</a>
            <a href="#gallery" className="hover:text-amber-600 transition-colors">Gallery</a>
            <a href="#contact" className="hover:text-amber-600 transition-colors">Location</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOrderNowModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-xs font-extrabold text-white shadow-md transition hover:from-amber-600 hover:to-orange-600 active:scale-95"
            >
              <QrCode className="h-4 w-4" /> Order Now
            </button>
          </div>
        </div>
      </header>

      {/* ─── HERO SECTION ─── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-amber-100/80 via-[#FFFBEB] to-[#FFFBEB] pt-10 pb-16 md:pt-16 md:pb-24">
        {/* Decorative Cheese Circles */}
        <div className="pointer-events-none absolute top-10 left-[-5%] h-72 w-72 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="pointer-events-none absolute top-40 right-[-5%] h-96 w-96 rounded-full bg-orange-400/20 blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-7"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-100/90 px-4 py-1.5 text-xs font-extrabold text-amber-900 shadow-sm">
                <Flame className="h-4 w-4 text-orange-500 animate-pulse" />
                <span>Cheesy, Sizzling & Fresh Daily</span>
              </div>

              <h1 className="mt-5 font-display text-4xl font-black tracking-tight text-amber-950 sm:text-5xl md:text-6xl lg:text-7xl leading-[1.08]">
                Where Every Slice <br />
                <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent italic">
                  Is Packed With Cheese!
                </span>
              </h1>

              <p className="mt-5 text-base sm:text-lg text-amber-900/80 max-w-xl leading-relaxed font-medium">
                {CHEESE_CORNER_CONFIG.subtitle}
              </p>

              <div className="mt-8 flex flex-wrap gap-4 items-center">
                <button
                  onClick={() => setIsOrderNowModalOpen(true)}
                  className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-7 py-3.5 text-sm font-extrabold text-white shadow-lg transition hover:shadow-xl hover:from-amber-600 hover:to-orange-600 active:scale-95"
                >
                  <QrCode className="h-4 w-4" />
                  <span>How To Order</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <a
                  href="#menu-preview"
                  className="inline-flex items-center gap-2 rounded-full border-2 border-amber-300 bg-white/90 px-7 py-3.5 text-sm font-extrabold text-amber-900 shadow-sm transition hover:bg-amber-50 active:scale-95"
                >
                  <Utensils className="h-4 w-4 text-amber-600" />
                  <span>Explore Menu</span>
                </a>
              </div>

              {/* Quick Feature Badges */}
              <div className="mt-10 grid grid-cols-3 gap-3 border-t border-amber-200/80 pt-6">
                <div>
                  <div className="font-display text-2xl font-black text-amber-950">100%</div>
                  <div className="text-xs font-bold text-amber-800/80">Fresh Ingredients</div>
                </div>
                <div>
                  <div className="font-display text-2xl font-black text-amber-950">92+</div>
                  <div className="text-xs font-bold text-amber-800/80">Delicious Items</div>
                </div>
                <div>
                  <div className="font-display text-2xl font-black text-amber-950">⚡ Fast</div>
                  <div className="text-xs font-bold text-amber-800/80">Dine-in Experience</div>
                </div>
              </div>
            </motion.div>

            {/* Right Hero Poster Showcase */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="lg:col-span-5 relative"
            >
              <div className="relative mx-auto max-w-md overflow-hidden rounded-3xl border-4 border-white bg-amber-200 p-2 shadow-2xl">
                {!heroImageError ? (
                  <img
                    src={CHEESE_CORNER_CONFIG.posters[0].image}
                    alt="Cheese Corner Gourmet Burger Poster"
                    onError={() => setHeroImageError(true)}
                    className="h-[440px] w-full rounded-2xl object-cover shadow-sm transition-transform duration-500 hover:scale-105"
                  />
                ) : (
                  <div className="flex h-[440px] w-full flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 p-6 text-center text-white shadow-inner">
                    <img
                      src={CHEESE_CORNER_CONFIG.logoUrl}
                      alt="Cheese Corner Logo"
                      className="h-20 w-20 object-contain drop-shadow-md mb-4"
                    />
                    <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-wider backdrop-blur-md">
                      {CHEESE_CORNER_CONFIG.posters[0].tag}
                    </span>
                    <h3 className="mt-3 font-display text-2xl font-black">
                      {CHEESE_CORNER_CONFIG.name}
                    </h3>
                    <p className="mt-1 text-xs text-amber-100 max-w-xs font-medium">
                      {CHEESE_CORNER_CONFIG.posters[0].title}
                    </p>
                  </div>
                )}
                
                {/* Floating Tag Overlay */}
                <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/40 bg-black/60 p-4 backdrop-blur-md text-white">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-black">
                      {CHEESE_CORNER_CONFIG.posters[0].tag}
                    </span>
                    <span className="text-xs font-bold text-amber-300">Freshly Grilled</span>
                  </div>
                  <h3 className="mt-1 font-display text-lg font-bold">
                    {CHEESE_CORNER_CONFIG.posters[0].title}
                  </h3>
                  <p className="text-xs text-amber-100/80 line-clamp-1">
                    {CHEESE_CORNER_CONFIG.posters[0].subtitle}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── ABOUT SECTION ─── */}
      <section id="about" className="border-t border-amber-200/60 bg-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto">
            <span className="text-xs font-extrabold uppercase tracking-widest text-orange-600">
              Welcome to Cheese Corner
            </span>
            <h2 className="mt-2 font-display text-3xl font-black text-amber-950 sm:text-4xl">
              {CHEESE_CORNER_CONFIG.about.title}
            </h2>
            <p className="mt-4 text-base text-amber-900/80 leading-relaxed font-medium">
              {CHEESE_CORNER_CONFIG.about.description}
            </p>
          </div>

          {/* Highlights Grid */}
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {CHEESE_CORNER_CONFIG.about.highlights.map((h, i) => (
              <motion.div
                key={h.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                whileHover={{ y: -4 }}
                className="rounded-3xl border border-amber-200/80 bg-[#FFFBEB] p-5 text-center shadow-sm transition-all hover:border-amber-400 hover:shadow-md"
              >
                <div className="text-4xl mb-2">{h.icon}</div>
                <h3 className="font-display text-lg font-bold text-amber-950">{h.name}</h3>
                <span className="inline-block my-1 rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-900">
                  {h.count}
                </span>
                <p className="mt-2 text-xs text-amber-900/70 leading-relaxed font-medium">
                  {h.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURED CATEGORIES SECTION ─── */}
      <section id="categories" className="border-t border-amber-200/60 bg-[#FFFBEB] py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-extrabold uppercase tracking-widest text-orange-600">
              Explore Our Menu Categories
            </span>
            <h2 className="mt-2 font-display text-3xl font-black text-amber-950 sm:text-4xl">
              10 Signature Food Categories
            </h2>
            <p className="mt-2 text-sm text-amber-900/80 font-medium">
              From cheesy pizzas to icy mojitos, find your favorite comfort craving.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {CHEESE_CORNER_CONFIG.categories.map((cat, i) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
                whileHover={{ scale: 1.02, y: -3 }}
                onClick={() => {
                  setActiveCategory(cat.id);
                  const el = document.getElementById("menu-preview");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                className="cursor-pointer group relative overflow-hidden rounded-3xl border border-amber-200 bg-white p-5 shadow-sm transition-all hover:border-orange-400 hover:shadow-md"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl transition-transform group-hover:scale-110">{cat.icon}</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black tracking-wider text-amber-900 uppercase">
                    {cat.badge}
                  </span>
                </div>
                <h3 className="font-display text-lg font-bold text-amber-950 group-hover:text-orange-600 transition-colors">
                  {cat.name}
                </h3>
                <span className="text-xs font-extrabold text-amber-600 block mt-0.5">
                  {cat.count}
                </span>
                <p className="mt-2 text-xs text-amber-900/70 line-clamp-2 leading-relaxed font-medium">
                  {cat.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── MENU PREVIEW SECTION ─── */}
      <section id="menu-preview" className="border-t border-amber-200/60 bg-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-orange-600">
                Taste The Best
              </span>
              <h2 className="mt-1 font-display text-3xl font-black text-amber-950 sm:text-4xl">
                Cheese Corner Menu Preview
              </h2>
              <p className="mt-1 text-sm text-amber-900/80 font-medium">
                Live prices and customer items from our active kitchen menu.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2">
              {[
                { id: "all", label: "All Items" },
                { id: "pizza", label: "Pizzas" },
                { id: "burger", label: "Burgers" },
                { id: "fries", label: "Fries" },
                { id: "shake", label: "Shakes" },
                { id: "mojito", label: "Mojitos" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-extrabold transition active:scale-95 ${
                    activeCategory === tab.id
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm"
                      : "bg-amber-100/70 text-amber-900 hover:bg-amber-200/80"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-amber-700 gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-amber-300 border-t-amber-600" />
              <span className="text-sm font-bold">Loading Cheese Corner menu...</span>
            </div>
          ) : filteredPreviewItems.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-amber-300 bg-amber-50/50 p-12 text-center text-amber-900 font-bold">
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

      {/* ─── GALLERY SECTION (POSTERS) ─── */}
      <section id="gallery" className="border-t border-amber-200/60 bg-[#FFFBEB] py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-extrabold uppercase tracking-widest text-orange-600">
              Visual Showcase
            </span>
            <h2 className="mt-2 font-display text-3xl font-black text-amber-950 sm:text-4xl">
              Café Poster Gallery
            </h2>
            <p className="mt-2 text-sm text-amber-900/80 font-medium">
              High-resolution promotional poster artwork from Cheese Corner.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {CHEESE_CORNER_CONFIG.posters.map((poster, i) => (
              <motion.div
                key={poster.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="group relative overflow-hidden rounded-3xl border-2 border-white bg-amber-200 shadow-md transition-all hover:shadow-xl"
              >
                <img
                  src={poster.image}
                  alt={poster.title}
                  className="h-[380px] w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-6 flex flex-col justify-end text-white">
                  <span className="inline-self-start rounded-full bg-amber-500 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-black w-max mb-2">
                    {poster.tag}
                  </span>
                  <h3 className="font-display text-xl font-bold">{poster.title}</h3>
                  <p className="text-xs text-amber-100/90 mt-1 line-clamp-2">{poster.subtitle}</p>
                  
                  <button
                    onClick={() => setSelectedPoster(poster.image)}
                    className="mt-4 flex items-center gap-1.5 text-xs font-extrabold text-amber-300 hover:text-white transition-colors"
                  >
                    <Maximize2 className="h-3.5 w-3.5" /> View Full Poster
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── LOCATION & CONTACT SECTION ─── */}
      <section id="contact" className="border-t border-amber-200/60 bg-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-8 md:grid-cols-2">
            
            {/* Location & Contact Details */}
            <div className="rounded-3xl border border-amber-200 bg-[#FFFBEB] p-8 shadow-sm space-y-6">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-widest text-orange-600">
                  Visit Cheese Corner
                </span>
                <h2 className="mt-2 font-display text-3xl font-black text-amber-950">
                  Location & Contact
                </h2>
                <p className="mt-2 text-sm text-amber-900/80 font-medium">
                  We'd love to serve you fresh melted comfort food at our café.
                </p>
              </div>

              <div className="space-y-5 text-sm">
                <div className="flex items-start gap-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-200/80 text-amber-900">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-extrabold text-amber-950">Café Address</div>
                    <div className="text-amber-900/80 mt-0.5">{CHEESE_CORNER_CONFIG.contact.address}</div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-200/80 text-amber-900">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-extrabold text-amber-950">Phone & Inquiries</div>
                    <div className="text-amber-900/80 mt-0.5">{CHEESE_CORNER_CONFIG.contact.phone}</div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-200/80 text-amber-900">
                    <Instagram className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-extrabold text-amber-950">Instagram</div>
                    <div className="text-amber-900/80 mt-0.5">{CHEESE_CORNER_CONFIG.contact.instagram}</div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-200/80 text-amber-900">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-extrabold text-amber-950">Opening Hours</div>
                    <div className="text-amber-900/80 mt-0.5">{CHEESE_CORNER_CONFIG.contact.hours}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* In-House Dine-In QR Ordering Information Card */}
            <div className="flex flex-col justify-between rounded-3xl border-2 border-amber-200 bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 p-8 text-white shadow-lg">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3.5 py-1 text-xs font-black uppercase tracking-wider backdrop-blur-md">
                  <QrCode className="h-4 w-4" /> Dine-In Ordering
                </div>
                
                <h3 className="mt-4 font-display text-3xl font-black leading-tight">
                  How To Order At Cheese Corner
                </h3>
                
                <p className="mt-3 text-sm text-amber-100 leading-relaxed font-medium">
                  To place a dine-in order, simply scan the QR code available at your table inside Cheese Corner using your smartphone camera.
                </p>

                <div className="my-6 flex items-center justify-center rounded-2xl bg-white/10 p-4 backdrop-blur-md border border-white/20">
                  <img
                    src={CHEESE_CORNER_CONFIG.qrStandUrl}
                    alt="Cheese Corner QR Stand"
                    className="h-40 w-auto object-contain drop-shadow-lg"
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-black/30 p-4 backdrop-blur-md border border-white/10 text-center">
                <p className="text-xs font-bold text-amber-200">
                  Visit us in person to experience contactless table ordering!
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-amber-200/80 bg-amber-950 text-amber-100 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src={CHEESE_CORNER_CONFIG.logoUrl} alt="Logo" className="h-8 w-8 object-contain" />
            <span className="font-display text-lg font-black text-white">Cheese Corner</span>
          </div>

          <p className="text-xs text-amber-200/70 text-center font-medium">
            © {new Date().getFullYear()} Cheese Corner Café. All rights reserved.
          </p>

          <div className="text-xs font-bold text-amber-300">
            Official Gourmet Café Website
          </div>
        </div>
      </footer>

      {/* ─── ORDER NOW INFORMATION MODAL ─── */}
      {isOrderNowModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          onClick={() => setIsOrderNowModalOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-md w-full overflow-hidden rounded-3xl border-2 border-white bg-white p-6 shadow-2xl text-[#451A03]"
          >
            <button
              onClick={() => setIsOrderNowModalOpen(false)}
              className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-full bg-amber-100 text-amber-900 hover:bg-amber-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md">
                <QrCode className="h-7 w-7" />
              </div>

              <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-amber-900">
                Dine-In Table Ordering
              </span>

              <h3 className="mt-3 font-display text-2xl font-black text-amber-950">
                Scan Your Table QR Code
              </h3>

              <p className="mt-3 text-sm text-amber-900/80 leading-relaxed font-medium">
                To place a dine-in order, simply scan the QR code available at your table inside Cheese Corner.
              </p>

              <div className="my-5 flex items-center justify-center rounded-2xl bg-[#FFFBEB] p-4 border border-amber-200">
                <img
                  src={CHEESE_CORNER_CONFIG.qrStandUrl}
                  alt="Cheese Corner QR Stand"
                  className="h-36 w-auto object-contain drop-shadow-md"
                />
              </div>

              <p className="text-xs font-bold text-amber-700/90 mb-5">
                Visit us to experience instant QR dining!
              </p>

              <button
                onClick={() => setIsOrderNowModalOpen(false)}
                className="w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-extrabold text-white shadow-md transition hover:from-amber-600 hover:to-orange-600 active:scale-95"
              >
                Got It
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── LIGHTBOX MODAL FOR POSTERS ─── */}
      {selectedPoster && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setSelectedPoster(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] overflow-hidden rounded-3xl border-4 border-white">
            <img src={selectedPoster} alt="Poster Lightbox" className="max-h-[85vh] w-auto object-contain" />
            <button
              onClick={() => setSelectedPoster(null)}
              className="absolute top-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-black/70 text-white hover:bg-black"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
