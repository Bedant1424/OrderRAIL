import { useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import ImageCropperModal from "@/components/ImageCropperModal";
import { toast } from "@/components/ui/sonner";
import {
  Camera,
  Pencil,
  Store,
  Palette,
  Sliders,
  Receipt as ReceiptIcon,
  Percent,
  CreditCard,
  HeartHandshake,
  Wrench,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Save,
  Printer,
  FileText,
  CheckSquare,
  Square,
  Calculator,
  Info,
  Banknote,
  QrCode,
  Wallet,
  Building,
  Smartphone,
  Clock,
  ChefHat,
  UtensilsCrossed,
  AlertTriangle
} from "lucide-react";
import { useCafe } from "@/lib/cafe";
import { supabase } from "@/lib/db";
import { generateUUID } from "@/lib/uuid";
import { usePermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { GlobalNotificationControls } from "@/components/owner/GlobalNotificationControls";
import { resetDemoEnvironmentInDb } from "@/lib/demoReset";
import { getReceiptSettings, saveReceiptSettings, type ReceiptSettings } from "@/lib/billing/receiptSettings";
import { LiveReceiptPreview } from "@/components/billing/LiveReceiptPreview";
import { getTaxSettings, saveTaxSettings, type TaxSettings } from "@/lib/billing/taxSettings";
import { LiveTaxBillPreview } from "@/components/billing/LiveTaxBillPreview";
import {
  getPaymentSettings,
  savePaymentSettings,
  type PaymentSettings,
  type PaymentMethodKey,
} from "@/lib/billing/paymentSettings";
import { LivePaymentPreview } from "@/components/billing/LivePaymentPreview";
import {
  getOperationsSettings,
  saveOperationsSettings,
  type OperationsSettings,
  type OrderChannel,
  type RestaurantStatus,
  type KdsRefreshInterval,
  type SessionTimeoutOption,
  getTodayOpenStatus,
} from "@/lib/billing/operationsSettings";
import { LiveOperationsPreview } from "@/components/billing/LiveOperationsPreview";
import { DeveloperPrintingTest } from "@/components/printing/DeveloperPrintingTest";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "BRL", "MXN", "CHF"];
const SIGNED_YEARS = 60 * 60 * 24 * 365 * 10;

async function urlForPath(path: string) {
  const { data } = await supabase.storage.from("menu-images").createSignedUrl(path, SIGNED_YEARS);
  return data?.signedUrl ?? null;
}

type SettingsSectionId =
  | "business_profile"
  | "branding"
  | "operations"
  | "receipts_billing"
  | "taxes"
  | "payments"
  | "customer_experience"
  | "advanced";

interface SettingsSectionDef {
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: React.ElementType;
}

const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  {
    id: "business_profile",
    label: "Business Profile",
    description: "Manage core restaurant information, contact details, currency, and public identity.",
    icon: Store,
  },
  {
    id: "branding",
    label: "Branding",
    description: "Customize color schemes, dark mode themes, menu layouts, and brand typography.",
    icon: Palette,
  },
  {
    id: "operations",
    label: "Operations",
    description: "Configure KDS refresh rates, KOT printing behavior, and table ordering controls.",
    icon: Sliders,
  },
  {
    id: "receipts_billing",
    label: "Receipts & Billing",
    description: "Format thermal receipt layouts, header notes, tax breakdowns, and digital bill links.",
    icon: ReceiptIcon,
  },
  {
    id: "taxes",
    label: "Taxes",
    description: "Set up GST/VAT rates, service charge rules, and tax-inclusive pricing rules.",
    icon: Percent,
  },
  {
    id: "payments",
    label: "Payments",
    description: "Manage POS payment methods, UPI QR gateway integrations, and settlement alerts.",
    icon: CreditCard,
  },
  {
    id: "customer_experience",
    label: "Customer Experience",
    description: "Configure QR ordering feedback prompts, Google Review links, and customer details rules.",
    icon: HeartHandshake,
  },
  {
    id: "advanced",
    label: "Advanced",
    description: "API keys, Webhook integrations, database diagnostics, and local cache purging.",
    icon: Wrench,
  },
];

const METHOD_LIST: { key: PaymentMethodKey; label: string; icon: React.ElementType }[] = [
  { key: "cash", label: "Cash", icon: Banknote },
  { key: "upi", label: "UPI Instant QR", icon: QrCode },
  { key: "card", label: "Credit / Debit Card", icon: CreditCard },
  { key: "wallet", label: "Digital Wallet", icon: Wallet },
  { key: "bank_transfer", label: "Bank Transfer", icon: Building },
];

const CHANNEL_LIST: { key: OrderChannel; label: string }[] = [
  { key: "dine_in", label: "Accept Dine-In Orders" },
  { key: "counter", label: "Accept Counter Orders" },
  { key: "takeaway", label: "Accept Takeaway Orders" },
  { key: "swiggy", label: "Accept Swiggy Orders" },
  { key: "zomato", label: "Accept Zomato Orders" },
];

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function OwnerSettingsPage() {
  const qc = useQueryClient();
  const permissions = usePermissions();
  const isDemo = permissions.isDemo;
  const { cafe, refreshCafe } = useCafe();

  const [activeSection, setActiveSection] = useState<SettingsSectionId>("business_profile");

  // Form Fields for Business Profile
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [logoUrl, setLogoUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [googleMapsReviewUrl, setGoogleMapsReviewUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [operatingHours, setOperatingHours] = useState("");

  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Cropper states
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  // Form Fields for Receipts & Billing
  const [receiptForm, setReceiptForm] = useState<ReceiptSettings>(() => getReceiptSettings(cafe?.id));

  // Form Fields for Taxes & Pricing
  const [taxForm, setTaxForm] = useState<TaxSettings>(() => getTaxSettings(cafe?.id, cafe));

  // Form Fields for Payments
  const [paymentForm, setPaymentForm] = useState<PaymentSettings>(() => getPaymentSettings(cafe?.id));

  // Form Fields for Operations
  const [opsForm, setOpsForm] = useState<OperationsSettings>(() => getOperationsSettings(cafe?.id));

  useEffect(() => {
    if (cafe) {
      setName(cafe.name || "");
      setTagline(cafe.tagline ?? "");
      setCurrency(cafe.currency || "INR");
      setLogoUrl(cafe.logo_url ?? "");
      setPhone(cafe.phone ?? "");
      setWhatsapp(cafe.whatsapp ?? "");
      setEmail((cafe as any).email ?? "");
      setAddress(cafe.address ?? "");
      setGoogleMapsReviewUrl(cafe.google_maps_review_url ?? "");
      setWebsite(cafe.website ?? "");
      setInstagram(cafe.instagram ?? "");
      setOperatingHours(cafe.operating_hours ?? "");

      // Load settings for cafe
      setReceiptForm(getReceiptSettings(cafe.id, cafe));
      setTaxForm(getTaxSettings(cafe.id, cafe));
      setPaymentForm(getPaymentSettings(cafe.id));
      setOpsForm(getOperationsSettings(cafe.id));
    }
  }, [cafe]);

  useEffect(() => {
    let stop = false;
    if (logoUrl?.startsWith("menu-images/")) {
      void urlForPath(logoUrl.slice("menu-images/".length)).then((u) => !stop && setPreview(u));
    } else {
      setPreview(logoUrl || null);
    }
    return () => {
      stop = true;
    };
  }, [logoUrl]);

  useEffect(() => {
    return () => {
      if (imageSrc && imageSrc.startsWith("blob:")) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [imageSrc]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(f.type)) {
      toast.error("Unsupported file format. Please upload PNG, JPG, or WEBP.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    if (f.size > 5 * 1024 * 1024) {
      toast.error("The selected image exceeds the 5 MB limit.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    const objectUrl = URL.createObjectURL(f);
    setImageSrc((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return objectUrl;
    });
    setIsCropOpen(true);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSaveLogo = async (croppedBlob: Blob) => {
    if (!cafe) return;
    setUploading(true);
    try {
      const file = new File([croppedBlob], "logo.png", { type: "image/png" });
      const ext = "png";
      const path = `${cafe.id}/logo_${generateUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("menu-images").upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (uploadError) throw uploadError;

      const fullPath = `menu-images/${path}`;
      const { error: updateError } = await supabase
        .from("cafes")
        .update({ logo_url: fullPath })
        .eq("id", cafe.id);
      if (updateError) throw updateError;

      setLogoUrl(fullPath);
      toast.success("Logo updated successfully!");
      setIsCropOpen(false);
      void refreshCafe();
    } catch (e: any) {
      console.error("[handleSaveLogo] Upload error:", e);
      toast.error(
        e?.message ||
        e?.error_description ||
        "Unable to save logo."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!confirm("Remove your cafe logo?")) return;
    setUploading(true);
    try {
      const { error } = await supabase
        .from("cafes")
        .update({ logo_url: null })
        .eq("id", cafe?.id);
      if (error) throw error;
      setLogoUrl("");
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Logo removed");
      void refreshCafe();
    } catch (e: any) {
      console.error(e);
      toast.error("Unable to remove logo.");
    } finally {
      setUploading(false);
    }
  };

  // Save handler for Business Profile
  const saveBusinessProfile = async () => {
    if (!cafe) return;

    if (googleMapsReviewUrl.trim()) {
      const url = googleMapsReviewUrl.trim();
      try {
        const parsed = new URL(url);
        const validHosts = ["google.com", "g.page", "goo.gl", "maps.google.com", "search.google.com"];
        const isGoogle = validHosts.some((host) => parsed.hostname.endsWith(host));
        if (!isGoogle) {
          return toast.error("Invalid review URL. Must be a valid Google Maps or Google Reviews link.");
        }
      } catch (e) {
        return toast.error("Please enter a valid Google Maps Review URL starting with http:// or https://");
      }
    }

    setBusy(true);
    const { error } = await supabase
      .from("cafes")
      .update({
        name: name.trim(),
        tagline: tagline.trim() || null,
        currency,
        logo_url: logoUrl.trim() || null,
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        google_maps_review_url: googleMapsReviewUrl.trim() || null,
        website: website.trim() || null,
        instagram: instagram.trim() || null,
        operating_hours: operatingHours.trim() || null,
      })
      .eq("id", cafe.id);

    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Business Profile saved successfully!");
    void refreshCafe();
  };

  // Save handler for Receipts & Billing
  const saveReceiptsBilling = async () => {
    if (receiptForm.receiptHeader.length > 100) {
      return toast.error("Receipt header must be 100 characters or less.");
    }
    if (receiptForm.footerInfo.length > 250) {
      return toast.error("Footer information must be 250 characters or less.");
    }
    if (receiptForm.invoicePrefix.length > 10) {
      return toast.error("Invoice prefix must be 10 characters or less.");
    }

    saveReceiptSettings(receiptForm, cafe?.id);

    if (cafe?.id) {
      setBusy(true);
      try {
        const { error } = await supabase
          .from("cafes")
          .update({ receipt_settings: receiptForm as any })
          .eq("id", cafe.id);
        if (error) throw error;
        toast.success("Receipts & Billing settings saved successfully!");
        void refreshCafe();
      } catch (e: any) {
        console.error(e);
        toast.error(e.message || "Failed to persist receipt settings to database.");
      } finally {
        setBusy(false);
      }
    } else {
      toast.success("Receipts & Billing settings saved successfully!");
    }
  };

  // Save handler for Taxes & Pricing
  const saveTaxesPricing = () => {
    if (taxForm.gstPercentage < 0 || taxForm.gstPercentage > 100) {
      return toast.error("GST percentage must be between 0% and 100%.");
    }
    if (taxForm.serviceChargePercentage < 0 || taxForm.serviceChargePercentage > 100) {
      return toast.error("Service charge percentage must be between 0% and 100%.");
    }
    if (taxForm.gstNumber.length > 15) {
      return toast.error("GST Number must be 15 characters or less.");
    }

    saveTaxSettings(taxForm, cafe?.id);
    toast.success("Taxes & Pricing settings saved successfully!");
  };

  // Save handler for Payments
  const savePayment = () => {
    const enabledCount = Object.values(paymentForm.enabledMethods).filter(Boolean).length;
    if (enabledCount === 0) {
      return toast.error("At least one payment method must remain enabled.");
    }

    savePaymentSettings(paymentForm, cafe?.id);
    toast.success("Payment settings saved successfully!");
  };

  // Method toggle handler with validation for Payments
  const togglePaymentMethod = (key: PaymentMethodKey) => {
    const isCurrentlyEnabled = paymentForm.enabledMethods[key];
    const enabledCount = Object.values(paymentForm.enabledMethods).filter(Boolean).length;

    if (isCurrentlyEnabled && enabledCount <= 1) {
      return toast.error("At least one payment method must remain enabled.");
    }

    const nextEnabled = {
      ...paymentForm.enabledMethods,
      [key]: !isCurrentlyEnabled,
    };

    let nextDefault = paymentForm.defaultMethod;
    if (!nextEnabled[nextDefault]) {
      const firstAvailable = (Object.keys(nextEnabled) as PaymentMethodKey[]).find((k) => nextEnabled[k]);
      if (firstAvailable) nextDefault = firstAvailable;
    }

    setPaymentForm((prev) => ({
      ...prev,
      enabledMethods: nextEnabled,
      defaultMethod: nextDefault,
    }));
  };

  // Save handler for Operations
  const saveOperations = () => {
    const activeChannelsCount = Object.values(opsForm.enabledChannels).filter(Boolean).length;
    if (activeChannelsCount === 0) {
      return toast.error("At least one ordering channel must remain enabled.");
    }

    saveOperationsSettings(opsForm, cafe?.id);
    if (opsForm.status === "closed" || opsForm.status === "maintenance") {
      toast.warning(`Operations saved. Note: Restaurant is set to ${opsForm.status === "closed" ? "Temporarily Closed" : "Under Maintenance"}.`);
    } else {
      toast.success("Operations settings saved successfully!");
    }
  };

  // Channel toggle handler with validation for Operations
  const toggleOrderChannel = (key: OrderChannel) => {
    const isCurrentlyEnabled = opsForm.enabledChannels[key];
    const enabledCount = Object.values(opsForm.enabledChannels).filter(Boolean).length;

    if (isCurrentlyEnabled && enabledCount <= 1) {
      return toast.error("At least one ordering channel must remain enabled.");
    }

    setOpsForm((prev) => ({
      ...prev,
      enabledChannels: {
        ...prev.enabledChannels,
        [key]: !isCurrentlyEnabled,
      },
    }));
  };

  const activeDef = SETTINGS_SECTIONS.find((s) => s.id === activeSection)!;
  const todayStatus = getTodayOpenStatus(opsForm);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <header className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Settings Workspace
              </h1>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary border border-primary/20">
                Configuration Center
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Manage your restaurant information, branding, operational preferences, and system settings.
            </p>
          </div>

          <GlobalNotificationControls />
        </div>
      </header>

      {/* Mobile Navigation Dropdown / Scrolling Chip Bar */}
      <div className="block md:hidden overflow-x-auto pb-2 scrollbar-none">
        <div className="flex items-center gap-2 min-w-max">
          {SETTINGS_SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition cursor-pointer border shadow-xs",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary font-bold shadow-soft"
                    : "bg-card text-muted-foreground border-border/60 hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Settings Two-Column Workspace */}
      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        {/* Left Navigation Sidebar */}
        <aside
          role="tablist"
          aria-label="Settings sections"
          className="hidden md:flex flex-col gap-1.5 rounded-3xl bg-card p-3 shadow-soft ring-1 ring-border/60 h-fit"
        >
          {SETTINGS_SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                id={`tab-${sec.id}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${sec.id}`}
                onClick={() => setActiveSection(sec.id)}
                className={cn(
                  "flex items-center justify-between rounded-2xl px-3.5 py-2.5 text-xs font-medium transition duration-150 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-soft"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{sec.label}</span>
                </div>
                {isActive && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-80" />}
              </button>
            );
          })}
        </aside>

        {/* Right Content Panel */}
        <main
          id={`panel-${activeSection}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeSection}`}
          className="space-y-6"
        >
          {/* Active Section Header Card */}
          <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                <activeDef.icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">{activeDef.label}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{activeDef.description}</p>
              </div>
            </div>
          </div>

          {/* SECTION 1: BUSINESS PROFILE */}
          {activeSection === "business_profile" && (
            <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
              {/* Logo Card */}
              <section className="flex flex-col items-center gap-3 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60 h-fit">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cafe Logo</label>
                <div className="relative w-32 h-32">
                  <button
                    type="button"
                    onClick={isDemo ? undefined : () => {
                      if (preview) {
                        setImageSrc(preview);
                        setIsCropOpen(true);
                      } else {
                        fileRef.current?.click();
                      }
                    }}
                    className={cn(
                      "w-full h-full overflow-hidden rounded-2xl border border-border bg-secondary flex items-center justify-center hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50",
                      isDemo && "cursor-not-allowed hover:opacity-100"
                    )}
                    title={isDemo ? "This action is disabled in the public demo." : "Edit Logo"}
                    disabled={uploading || isDemo}
                  >
                    {preview ? (
                      <img src={preview} alt="Logo" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                        <Camera className="h-6 w-6" />
                        <span>{uploading ? "Uploading…" : "Upload logo"}</span>
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={isDemo ? undefined : () => {
                      if (preview) {
                        setImageSrc(preview);
                        setIsCropOpen(true);
                      } else {
                        fileRef.current?.click();
                      }
                    }}
                    className={cn(
                      "absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-primary shadow-soft hover:bg-muted active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50",
                      isDemo && "cursor-not-allowed opacity-50"
                    )}
                    title={isDemo ? "This action is disabled in the public demo." : "Edit Logo"}
                    aria-label="Edit Logo"
                    disabled={uploading || isDemo}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {logoUrl && (
                  <button
                    onClick={isDemo ? undefined : () => void handleRemoveLogo()}
                    disabled={uploading || isDemo}
                    className="text-xs font-semibold text-destructive hover:underline mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Remove logo
                  </button>
                )}
                <p className="text-[10px] text-center text-muted-foreground">PNG or JPG. Square image recommended.</p>
              </section>

              {/* Form Input Fields Card */}
              <section className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground">Cafe Name</label>
                    <input
                      value={name}
                      disabled={isDemo}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground">Currency</label>
                    <select
                      value={currency}
                      disabled={isDemo}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35 disabled:cursor-not-allowed"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground">Tagline</label>
                  <input
                    value={tagline}
                    disabled={isDemo}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="e.g. Artisanal Coffee & Warm Pastries"
                    className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground">Phone</label>
                    <input
                      value={phone}
                      disabled={isDemo}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground">WhatsApp</label>
                    <input
                      value={whatsapp}
                      disabled={isDemo}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground">Email</label>
                    <input
                      value={email}
                      disabled={isDemo}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. contact@mycafe.com"
                      className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground">Website</label>
                    <input
                      value={website}
                      disabled={isDemo}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="e.g. https://mycafe.com"
                      className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground">Address</label>
                  <input
                    value={address}
                    disabled={isDemo}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 123 Espresso Blvd, Seattle, WA"
                    className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground">Instagram</label>
                    <input
                      value={instagram}
                      disabled={isDemo}
                      onChange={(e) => setInstagram(e.target.value)}
                      placeholder="e.g. https://instagram.com/mycafe"
                      className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground">Operating Hours</label>
                    <input
                      value={operatingHours}
                      disabled={isDemo}
                      onChange={(e) => setOperatingHours(e.target.value)}
                      placeholder="Mon-Fri: 7 AM - 6 PM, Sat-Sun: 8 AM - 8 PM"
                      className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground">Google Maps Review URL</label>
                  <input
                    value={googleMapsReviewUrl}
                    disabled={isDemo}
                    onChange={(e) => setGoogleMapsReviewUrl(e.target.value)}
                    placeholder="e.g. https://g.page/r/unique-id/review"
                    className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Section-Specific Save Button */}
                <div className="pt-2">
                  <button
                    onClick={isDemo ? undefined : () => void saveBusinessProfile()}
                    disabled={busy || isDemo}
                    className={cn(
                      "w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-xs font-semibold transition cursor-pointer shadow-soft active:scale-95",
                      isDemo
                        ? "bg-muted text-muted-foreground border border-border cursor-not-allowed"
                        : "bg-primary text-primary-foreground hover:opacity-90"
                    )}
                  >
                    <Save className="h-4 w-4" />
                    {isDemo ? "🔒 Disabled in Public Demo" : busy ? "Saving Changes…" : "Save Business Profile"}
                  </button>
                </div>

                {/* Demo Reset Utility */}
                <div className="pt-4 border-t border-border/60">
                  <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <h4 className="font-display text-sm font-semibold text-foreground">One-Click Demo Environment Reset</h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Frees all occupied tables, clears active orders, closes dining sessions, and resets service requests for the demo environment.
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const res = await resetDemoEnvironmentInDb(cafe?.id);
                          if (res.success) {
                            toast.success(res.message);
                            void refreshCafe();
                            void qc.invalidateQueries();
                          } else {
                            toast.error(res.message);
                          }
                        } catch (e: any) {
                          toast.error(e?.message || "Demo reset failed.");
                        } finally {
                          setBusy(false);
                        }
                      }}
                      disabled={busy}
                      className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 px-4 py-2 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <RotateCcw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
                      {busy ? "Resetting Demo Environment..." : "Reset Demo Environment"}
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* SECTION 3: OPERATIONS */}
          {activeSection === "operations" && (
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              {/* Settings Configuration Column */}
              <div className="space-y-6">
                {/* Restaurant Status Card */}
                <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 space-y-4">
                  <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Store className="h-4 w-4 text-primary" /> Restaurant Operating Status
                  </h3>

                  <div className="grid gap-3 sm:grid-cols-4">
                    {[
                      { id: "open", label: "Open", color: "border-emerald-500/40 text-emerald-600" },
                      { id: "busy", label: "Busy", color: "border-amber-500/40 text-amber-600" },
                      { id: "closed", label: "Temporarily Closed", color: "border-rose-500/40 text-rose-600" },
                      { id: "maintenance", label: "Maintenance", color: "border-purple-500/40 text-purple-600" },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setOpsForm((prev) => ({ ...prev, status: st.id as RestaurantStatus }))}
                        className={cn(
                          "rounded-2xl p-3 border text-center font-bold text-xs transition cursor-pointer select-none",
                          opsForm.status === st.id
                            ? "bg-primary text-primary-foreground border-primary shadow-soft"
                            : "bg-secondary/40 text-muted-foreground border-border/60 hover:bg-secondary"
                        )}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  {(opsForm.status === "closed" || opsForm.status === "maintenance") && (
                    <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-3 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                      <span>
                        Restaurant is marked as <strong>{opsForm.status === "closed" ? "Temporarily Closed" : "Under Maintenance"}</strong>. Ordering workflows will be paused for customers.
                      </span>
                    </div>
                  )}
                </div>

                {/* Per-Day Operating Hours Card */}
                <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" /> Per-Day Operating Hours
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <span className={cn("h-2 w-2 rounded-full", todayStatus.isOpen ? "bg-emerald-500" : "bg-rose-500")} />
                      <span className={todayStatus.isOpen ? "text-emerald-600" : "text-rose-600"}>{todayStatus.text}</span>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    {DAY_NAMES.map((dayName, index) => {
                      const sched = opsForm.weeklySchedule[index] || { isOpen: true, openTime: "08:00", closeTime: "22:00" };
                      return (
                        <div
                          key={dayName}
                          className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border border-border/50 bg-secondary/20"
                        >
                          <div className="flex items-center gap-3 min-w-[130px]">
                            <button
                              type="button"
                              onClick={() =>
                                setOpsForm((prev) => ({
                                  ...prev,
                                  weeklySchedule: {
                                    ...prev.weeklySchedule,
                                    [index]: { ...sched, isOpen: !sched.isOpen },
                                  },
                                }))
                              }
                              className={cn(
                                "flex items-center gap-2 text-xs font-bold transition cursor-pointer select-none",
                                sched.isOpen ? "text-foreground" : "text-muted-foreground line-through"
                              )}
                            >
                              {sched.isOpen ? (
                                <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                              ) : (
                                <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                              <span>{dayName}</span>
                            </button>
                          </div>

                          {sched.isOpen ? (
                            <div className="flex items-center gap-2 text-xs font-mono">
                              <input
                                type="time"
                                value={sched.openTime}
                                onChange={(e) =>
                                  setOpsForm((prev) => ({
                                    ...prev,
                                    weeklySchedule: {
                                      ...prev.weeklySchedule,
                                      [index]: { ...sched, openTime: e.target.value },
                                    },
                                  }))
                                }
                                className="rounded-xl border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                              />
                              <span className="text-muted-foreground">to</span>
                              <input
                                type="time"
                                value={sched.closeTime}
                                onChange={(e) =>
                                  setOpsForm((prev) => ({
                                    ...prev,
                                    weeklySchedule: {
                                      ...prev.weeklySchedule,
                                      [index]: { ...sched, closeTime: e.target.value },
                                    },
                                  }))
                                }
                                className="rounded-xl border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                              />
                            </div>
                          ) : (
                            <span className="text-xs font-bold text-rose-500 uppercase tracking-wider">Closed</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Order Acceptance Channels Card */}
                <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 space-y-4">
                  <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                    <UtensilsCrossed className="h-4 w-4 text-primary" /> Ordering Channels Acceptance
                  </h3>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {CHANNEL_LIST.map((ch) => {
                      const isEnabled = opsForm.enabledChannels[ch.key];
                      return (
                        <button
                          key={ch.key}
                          type="button"
                          onClick={() => toggleOrderChannel(ch.key)}
                          className={cn(
                            "flex items-center justify-between rounded-2xl p-3.5 border text-xs font-semibold transition cursor-pointer text-left select-none",
                            isEnabled
                              ? "bg-primary/5 border-primary/40 text-foreground"
                              : "bg-secondary/40 border-border/60 text-muted-foreground hover:bg-secondary"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {isEnabled ? (
                              <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <span>{ch.label}</span>
                          </div>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">
                            {isEnabled ? "Active" : "Disabled"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Kitchen & KDS Behavior Card */}
                <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 space-y-4">
                  <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                    <ChefHat className="h-4 w-4 text-primary" /> Kitchen Display System (KDS) & Sound
                  </h3>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                        KDS Refresh Interval
                      </label>
                      <div className="flex gap-1.5">
                        {(["2s", "5s", "10s", "30s"] as const).map((int) => (
                          <button
                            key={int}
                            type="button"
                            onClick={() => setOpsForm((prev) => ({ ...prev, kdsRefreshInterval: int }))}
                            className={cn(
                              "flex-1 rounded-2xl py-2 text-xs font-bold font-mono transition cursor-pointer border text-center",
                              opsForm.kdsRefreshInterval === int
                                ? "bg-primary text-primary-foreground border-primary shadow-soft"
                                : "bg-secondary/40 text-muted-foreground border-border/60 hover:bg-secondary"
                            )}
                          >
                            {int}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {[
                        { key: "kdsAutoScroll", label: "Auto-scroll KDS" },
                        { key: "kdsSoundEnabled", label: "Enable Kitchen Sound Alerts" },
                        { key: "kdsHighlightDelayed", label: "Highlight Delayed Orders" },
                      ].map((item) => {
                        const isChecked = (opsForm as any)[item.key];
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() =>
                              setOpsForm((prev) => ({ ...prev, [item.key]: !isChecked }))
                            }
                            className={cn(
                              "w-full flex items-center gap-3 rounded-2xl p-2.5 border text-xs font-semibold transition cursor-pointer text-left select-none",
                              isChecked
                                ? "bg-primary/5 border-primary/40 text-foreground"
                                : "bg-secondary/40 border-border/60 text-muted-foreground hover:bg-secondary"
                            )}
                          >
                            {isChecked ? (
                              <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Table Behavior Card */}
                <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 space-y-4">
                  <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-primary" /> Table Behavior & Session Timeouts
                  </h3>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                        Dining Session Timeout
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "30m", label: "30 mins" },
                          { id: "60m", label: "60 mins" },
                          { id: "90m", label: "90 mins" },
                          { id: "never", label: "Never" },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setOpsForm((prev) => ({ ...prev, sessionTimeout: opt.id as SessionTimeoutOption }))}
                            className={cn(
                              "rounded-2xl py-2 px-3 text-xs font-bold transition cursor-pointer border text-center",
                              opsForm.sessionTimeout === opt.id
                                ? "bg-primary text-primary-foreground border-primary shadow-soft"
                                : "bg-secondary/40 text-muted-foreground border-border/60 hover:bg-secondary"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                        Table Auto-Release Rules
                      </label>
                      <button
                        type="button"
                        onClick={() => setOpsForm((prev) => ({ ...prev, autoReleaseTable: !prev.autoReleaseTable }))}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-2xl p-3 border text-xs font-semibold transition cursor-pointer text-left select-none",
                          opsForm.autoReleaseTable
                            ? "bg-primary/5 border-primary/40 text-foreground"
                            : "bg-secondary/40 border-border/60 text-muted-foreground hover:bg-secondary"
                        )}
                      >
                        {opsForm.autoReleaseTable ? (
                          <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span>Auto Release Table After Payment Settlement</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* KOT Printing Behavior Card */}
                <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 space-y-4">
                  <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Printer className="h-4 w-4 text-primary" /> Kitchen Order Ticket (KOT) Printing
                  </h3>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { key: "autoPrintKot", label: "Auto Print KOT on Order Received" },
                      { key: "reprintOnEdit", label: "Reprint KOT on Order Edit / Addition" },
                      { key: "printCustomerCopy", label: "Print Customer Receipt Copy" },
                      { key: "printKitchenCopy", label: "Print Kitchen Copy" },
                    ].map((item) => {
                      const isChecked = (opsForm as any)[item.key];
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setOpsForm((prev) => ({ ...prev, [item.key]: !isChecked }))}
                          className={cn(
                            "flex items-center gap-3 rounded-2xl p-3 border text-xs font-semibold transition cursor-pointer text-left select-none",
                            isChecked
                              ? "bg-primary/5 border-primary/40 text-foreground"
                              : "bg-secondary/40 border-border/60 text-muted-foreground hover:bg-secondary"
                          )}
                        >
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section-Specific Save Button */}
                <div className="pt-2">
                  <button
                    onClick={saveOperations}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-xs font-semibold transition cursor-pointer shadow-soft active:scale-95 bg-primary text-primary-foreground hover:opacity-90"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save Operations Settings</span>
                  </button>
                </div>
              </div>

              {/* Live Operations Preview Panel */}
              <div className="space-y-4">
                <div className="sticky top-6">
                  <LiveOperationsPreview settings={opsForm} />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: RECEIPTS & BILLING */}
          {activeSection === "receipts_billing" && (
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              {/* Settings Configuration Column */}
              <div className="space-y-6">
                {/* Branding Toggles Card */}
                <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 space-y-4">
                  <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" /> Receipt Branding & Fields
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { key: "showLogo", label: "Show Cafe Logo" },
                      { key: "showAddress", label: "Show Cafe Address" },
                      { key: "showPhone", label: "Show Phone Number" },
                      { key: "showGst", label: "Show GST Number" },
                      { key: "showInvoiceNum", label: "Show Invoice Number" },
                    ].map((toggle) => {
                      const isChecked = (receiptForm as any)[toggle.key];
                      return (
                        <button
                          key={toggle.key}
                          type="button"
                          onClick={() =>
                            setReceiptForm((prev) => ({
                              ...prev,
                              [toggle.key]: !isChecked,
                            }))
                          }
                          className={cn(
                            "flex items-center gap-3 rounded-2xl p-3 border text-xs font-semibold transition cursor-pointer text-left select-none",
                            isChecked
                              ? "bg-primary/5 border-primary/40 text-foreground"
                              : "bg-secondary/40 border-border/60 text-muted-foreground hover:bg-secondary"
                          )}
                        >
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span>{toggle.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Receipt Header & Custom Notes Card */}
                <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 space-y-4">
                  <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Pencil className="h-4 w-4 text-primary" /> Header, Thank You & Footer Notes
                  </h3>

                  <div>
                    <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground mb-1">
                      <label>Receipt Header Note</label>
                      <span className="text-[10px] font-mono">{receiptForm.receiptHeader.length}/100</span>
                    </div>
                    <input
                      type="text"
                      maxLength={100}
                      value={receiptForm.receiptHeader}
                      onChange={(e) =>
                        setReceiptForm((prev) => ({ ...prev, receiptHeader: e.target.value }))
                      }
                      placeholder="e.g. Welcome to OrderRail Cafe"
                      className="w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">
                      Thank You Message
                    </label>
                    <textarea
                      rows={2}
                      value={receiptForm.thankYouMessage}
                      onChange={(e) =>
                        setReceiptForm((prev) => ({ ...prev, thankYouMessage: e.target.value }))
                      }
                      placeholder="e.g. Thank you for visiting! We hope to see you again soon."
                      className="w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground mb-1">
                      <label>Footer Information (Optional)</label>
                      <span className="text-[10px] font-mono">{receiptForm.footerInfo.length}/250</span>
                    </div>
                    <textarea
                      rows={2}
                      maxLength={250}
                      value={receiptForm.footerInfo}
                      onChange={(e) =>
                        setReceiptForm((prev) => ({ ...prev, footerInfo: e.target.value }))
                      }
                      placeholder="e.g. FSSAI LIC NO: 10020022000123 / Return policy / Social media"
                      className="w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
                    />
                  </div>
                </div>

                {/* Invoice Prefix & Thermal Printing Card */}
                <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 space-y-4">
                  <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Printer className="h-4 w-4 text-primary" /> Invoice Prefix & Thermal Printing
                  </h3>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">
                        Invoice Prefix
                      </label>
                      <input
                        type="text"
                        maxLength={10}
                        value={receiptForm.invoicePrefix}
                        onChange={(e) =>
                          setReceiptForm((prev) => ({ ...prev, invoicePrefix: e.target.value.toUpperCase() }))
                        }
                        placeholder="e.g. INV-"
                        className="w-full rounded-2xl border border-border bg-background p-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-ring/60"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Preview: <span className="font-mono font-bold text-foreground">{receiptForm.invoicePrefix || "INV-"}000001</span>
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">
                        Number of Copies
                      </label>
                      <select
                        value={receiptForm.printCopies}
                        onChange={(e) =>
                          setReceiptForm((prev) => ({ ...prev, printCopies: Number(e.target.value) }))
                        }
                        className="w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
                      >
                        <option value={1}>1 Copy</option>
                        <option value={2}>2 Copies</option>
                        <option value={3}>3 Copies</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-border/40">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                        Receipt Width
                      </label>
                      <div className="flex gap-2">
                        {(["58mm", "80mm"] as const).map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => setReceiptForm((prev) => ({ ...prev, receiptWidth: w }))}
                            className={cn(
                              "flex-1 rounded-2xl py-2 text-xs font-bold transition cursor-pointer border text-center",
                              receiptForm.receiptWidth === w
                                ? "bg-primary text-primary-foreground border-primary shadow-soft"
                                : "bg-secondary/40 text-muted-foreground border-border/60 hover:bg-secondary"
                            )}
                          >
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                        Auto-Print After Payment
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setReceiptForm((prev) => ({ ...prev, autoPrint: !prev.autoPrint }))
                        }
                        className={cn(
                          "w-full flex items-center justify-center gap-2 rounded-2xl py-2 px-3 text-xs font-bold transition cursor-pointer border",
                          receiptForm.autoPrint
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                            : "bg-secondary/40 text-muted-foreground border-border/60 hover:bg-secondary"
                        )}
                      >
                        {receiptForm.autoPrint ? (
                          <CheckSquare className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span>{receiptForm.autoPrint ? "Auto-Print Enabled" : "Auto-Print Disabled"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Identifiers & Optional Business Fields Card */}
                <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 space-y-4">
                  <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Store className="h-4 w-4 text-primary" /> Business Identifiers & Support Info
                  </h3>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">
                        GST Number
                      </label>
                      <input
                        type="text"
                        value={receiptForm.gstNumber}
                        onChange={(e) =>
                          setReceiptForm((prev) => ({ ...prev, gstNumber: e.target.value.toUpperCase() }))
                        }
                        placeholder="e.g. 27AAAAA0000A1Z5"
                        className="w-full rounded-2xl border border-border bg-background p-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-ring/60"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">
                        FSSAI License
                      </label>
                      <input
                        type="text"
                        value={receiptForm.fssaiNumber}
                        onChange={(e) =>
                          setReceiptForm((prev) => ({ ...prev, fssaiNumber: e.target.value }))
                        }
                        placeholder="e.g. 10020022000123"
                        className="w-full rounded-2xl border border-border bg-background p-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-ring/60"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">
                        Business Registration No.
                      </label>
                      <input
                        type="text"
                        value={receiptForm.businessRegNumber}
                        onChange={(e) =>
                          setReceiptForm((prev) => ({ ...prev, businessRegNumber: e.target.value }))
                        }
                        placeholder="e.g. CIN-12345678"
                        className="w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">
                        Support Email
                      </label>
                      <input
                        type="email"
                        value={receiptForm.supportEmail}
                        onChange={(e) =>
                          setReceiptForm((prev) => ({ ...prev, supportEmail: e.target.value }))
                        }
                        placeholder="e.g. billing@orderrail.com"
                        className="w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">
                      Website URL
                    </label>
                    <input
                      type="text"
                      value={receiptForm.website}
                      onChange={(e) =>
                        setReceiptForm((prev) => ({ ...prev, website: e.target.value }))
                      }
                      placeholder="e.g. www.orderrail.com"
                      className="w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
                    />
                  </div>
                </div>

                {/* Section-Specific Save Button */}
                <div className="pt-2">
                  <button
                    onClick={saveReceiptsBilling}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-xs font-semibold transition cursor-pointer shadow-soft active:scale-95 bg-primary text-primary-foreground hover:opacity-90"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save Receipts & Billing Settings</span>
                  </button>
                </div>
              </div>

              {/* Live Thermal Receipt Preview Panel */}
              <div className="space-y-4">
                <div className="sticky top-6">
                  <LiveReceiptPreview
                    settings={receiptForm}
                    cafeName={name || cafe?.name}
                    cafeAddress={address || cafe?.address}
                    cafePhone={phone || cafe?.phone}
                    cafeLogoUrl={preview}
                    currency={currency}
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: TAXES & PRICING */}
          {activeSection === "taxes" && (
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              {/* Settings Configuration Column */}
              <div className="space-y-6">
                {/* Tax Profile Card */}
                <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 space-y-4">
                  <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Percent className="h-4 w-4 text-primary" /> Tax Profile & Service Charge
                  </h3>

                  {/* GST Toggles & Fields */}
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setTaxForm((prev) => ({ ...prev, gstEnabled: !prev.gstEnabled }))}
                      className={cn(
                        "w-full flex items-center justify-between rounded-2xl p-3 border text-xs font-semibold transition cursor-pointer select-none",
                        taxForm.gstEnabled
                          ? "bg-primary/5 border-primary/40 text-foreground"
                          : "bg-secondary/40 border-border/60 text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {taxForm.gstEnabled ? (
                          <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span>GST Taxation Active</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">
                        {taxForm.gstEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </button>

                    {taxForm.gstEnabled && (
                      <div className="grid gap-4 sm:grid-cols-2 pt-1 pl-1">
                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1">
                            GST Registration No. (GSTIN)
                          </label>
                          <input
                            type="text"
                            maxLength={15}
                            value={taxForm.gstNumber}
                            onChange={(e) =>
                              setTaxForm((prev) => ({ ...prev, gstNumber: e.target.value.toUpperCase() }))
                            }
                            placeholder="e.g. 27AAAAA0000A1Z5"
                            className="w-full rounded-2xl border border-border bg-background p-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-ring/60"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1">
                            Default GST Rate (%)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              value={taxForm.gstPercentage}
                              onChange={(e) =>
                                setTaxForm((prev) => ({ ...prev, gstPercentage: Number(e.target.value) }))
                              }
                              className="w-full rounded-2xl border border-border bg-background p-2.5 pr-8 text-sm outline-none focus:ring-2 focus:ring-ring/60 font-mono"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">%</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Service Charge Toggles & Fields */}
                  <div className="space-y-3 pt-3 border-t border-border/40">
                    <button
                      type="button"
                      onClick={() =>
                        setTaxForm((prev) => ({ ...prev, serviceChargeEnabled: !prev.serviceChargeEnabled }))
                      }
                      className={cn(
                        "w-full flex items-center justify-between rounded-2xl p-3 border text-xs font-semibold transition cursor-pointer select-none",
                        taxForm.serviceChargeEnabled
                          ? "bg-primary/5 border-primary/40 text-foreground"
                          : "bg-secondary/40 border-border/60 text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {taxForm.serviceChargeEnabled ? (
                          <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span>Service Charge Active</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">
                        {taxForm.serviceChargeEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </button>

                    {taxForm.serviceChargeEnabled && (
                      <div className="pt-1 pl-1 max-w-xs">
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">
                          Default Service Charge Rate (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={taxForm.serviceChargePercentage}
                            onChange={(e) =>
                              setTaxForm((prev) => ({ ...prev, serviceChargePercentage: Number(e.target.value) }))
                            }
                            className="w-full rounded-2xl border border-border bg-background p-2.5 pr-8 text-sm outline-none focus:ring-2 focus:ring-ring/60 font-mono"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">%</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pricing Behavior Card */}
                <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 space-y-4">
                  <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-primary" /> Menu Pricing Behavior
                  </h3>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setTaxForm((prev) => ({ ...prev, pricingMode: "exclusive" }))}
                      className={cn(
                        "rounded-2xl p-4 border text-left space-y-2 transition cursor-pointer",
                        taxForm.pricingMode === "exclusive"
                          ? "bg-primary/5 border-primary text-foreground shadow-soft"
                          : "bg-secondary/40 border-border/60 text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-foreground">Tax Exclusive Pricing</span>
                        {taxForm.pricingMode === "exclusive" && <CheckSquare className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Taxes and service charges are calculated and added on top of menu item subtotal at checkout.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTaxForm((prev) => ({ ...prev, pricingMode: "inclusive" }))}
                      className={cn(
                        "rounded-2xl p-4 border text-left space-y-2 transition cursor-pointer",
                        taxForm.pricingMode === "inclusive"
                          ? "bg-primary/5 border-primary text-foreground shadow-soft"
                          : "bg-secondary/40 border-border/60 text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-foreground">Tax Inclusive Pricing</span>
                        {taxForm.pricingMode === "inclusive" && <CheckSquare className="h-4 w-4 text-primary" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Menu prices include all taxes. Tax amounts are calculated backwards for receipt breakdown.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Rounding Options Card */}
                <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 space-y-4">
                  <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-primary" /> Final Bill Rounding
                  </h3>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { id: "none", label: "No Rounding", desc: "Exact cents" },
                      { id: "nearest_1", label: "Nearest ₹1", desc: "Round to whole ₹1" },
                      { id: "nearest_0_5", label: "Nearest ₹0.50", desc: "Round to 50 paise" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setTaxForm((prev) => ({ ...prev, roundingMode: opt.id as any }))}
                        className={cn(
                          "rounded-2xl p-3 border text-left space-y-1 transition cursor-pointer",
                          taxForm.roundingMode === opt.id
                            ? "bg-primary/5 border-primary text-foreground font-bold shadow-soft"
                            : "bg-secondary/40 border-border/60 text-muted-foreground hover:bg-secondary"
                        )}
                      >
                        <div className="font-bold text-xs text-foreground">{opt.label}</div>
                        <div className="text-[10px] text-muted-foreground">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tax Display Preferences Card */}
                <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 space-y-4">
                  <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" /> Tax Display Preferences
                  </h3>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { key: "showTaxBreakdown", label: "Show Tax Breakdown" },
                      { key: "showServiceCharge", label: "Show Service Charge" },
                      { key: "mergeTaxesInTotal", label: "Merge Taxes in Total" },
                    ].map((toggle) => {
                      const isChecked = (taxForm as any)[toggle.key];
                      return (
                        <button
                          key={toggle.key}
                          type="button"
                          onClick={() =>
                            setTaxForm((prev) => ({
                              ...prev,
                              [toggle.key]: !isChecked,
                            }))
                          }
                          className={cn(
                            "flex items-center gap-3 rounded-2xl p-3 border text-xs font-semibold transition cursor-pointer text-left select-none",
                            isChecked
                              ? "bg-primary/5 border-primary/40 text-foreground"
                              : "bg-secondary/40 border-border/60 text-muted-foreground hover:bg-secondary"
                          )}
                        >
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span>{toggle.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section-Specific Save Button */}
                <div className="pt-2">
                  <button
                    onClick={saveTaxesPricing}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-xs font-semibold transition cursor-pointer shadow-soft active:scale-95 bg-primary text-primary-foreground hover:opacity-90"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save Taxes & Pricing Settings</span>
                  </button>
                </div>
              </div>

              {/* Live Tax Bill Calculation Preview Panel */}
              <div className="space-y-4">
                <div className="sticky top-6">
                  <LiveTaxBillPreview settings={taxForm} currency={currency} />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 6: PAYMENTS */}
          {activeSection === "payments" && (
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              {/* Settings Configuration Column */}
              <div className="space-y-6">
                {/* Accepted Payment Methods Card */}
                <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 space-y-4">
                  <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" /> Accepted Payment Methods
                  </h3>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {METHOD_LIST.map((method) => {
                      const isEnabled = paymentForm.enabledMethods[method.key];
                      const Icon = method.icon;

                      return (
                        <button
                          key={method.key}
                          type="button"
                          onClick={() => togglePaymentMethod(method.key)}
                          className={cn(
                            "flex items-center justify-between rounded-2xl p-3.5 border text-xs font-semibold transition cursor-pointer text-left select-none",
                            isEnabled
                              ? "bg-primary/5 border-primary/40 text-foreground"
                              : "bg-secondary/40 border-border/60 text-muted-foreground hover:bg-secondary"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {isEnabled ? (
                              <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span>{method.label}</span>
                            </div>
                          </div>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">
                            {isEnabled ? "Enabled" : "Disabled"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Default Preselected Payment Method Card */}
                <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 space-y-4">
                  <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-primary" /> Default Preselected Method
                  </h3>

                  <div className="max-w-xs">
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">
                      Preselected Payment Method at Checkout
                    </label>
                    <select
                      value={paymentForm.defaultMethod}
                      onChange={(e) =>
                        setPaymentForm((prev) => ({ ...prev, defaultMethod: e.target.value as PaymentMethodKey }))
                      }
                      className="w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
                    >
                      {METHOD_LIST.filter((m) => paymentForm.enabledMethods[m.key]).map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Payment Behavior & Settlement Rules Card */}
                <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 space-y-4">
                  <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-primary" /> Settlement & Order Closing Rules
                  </h3>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Require Payment Before Closing */}
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentForm((prev) => ({
                          ...prev,
                          requirePaymentBeforeClosing: !prev.requirePaymentBeforeClosing,
                        }))
                      }
                      className={cn(
                        "flex items-center gap-3 rounded-2xl p-3 border text-xs font-semibold transition cursor-pointer text-left select-none",
                        paymentForm.requirePaymentBeforeClosing
                          ? "bg-primary/5 border-primary/40 text-foreground"
                          : "bg-secondary/40 border-border/60 text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      {paymentForm.requirePaymentBeforeClosing ? (
                        <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span>Require Payment Before Closing Order</span>
                    </button>

                    {/* Auto Close Order After Payment */}
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentForm((prev) => ({
                          ...prev,
                          autoCloseOrder: !prev.autoCloseOrder,
                        }))
                      }
                      className={cn(
                        "flex items-center gap-3 rounded-2xl p-3 border text-xs font-semibold transition cursor-pointer text-left select-none",
                        paymentForm.autoCloseOrder
                          ? "bg-primary/5 border-primary/40 text-foreground"
                          : "bg-secondary/40 border-border/60 text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      {paymentForm.autoCloseOrder ? (
                        <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span>Auto Close Order After Payment</span>
                    </button>

                    {/* Partial Payments Placeholder */}
                    <div className="flex items-center justify-between rounded-2xl p-3 border border-border/60 bg-muted/30 text-xs font-semibold text-muted-foreground opacity-75">
                      <div className="flex items-center gap-3">
                        <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>Allow Partial Payments</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">
                        <Sparkles className="h-3 w-3" /> Coming Soon
                      </span>
                    </div>

                    {/* Split Bills Placeholder */}
                    <div className="flex items-center justify-between rounded-2xl p-3 border border-border/60 bg-muted/30 text-xs font-semibold text-muted-foreground opacity-75">
                      <div className="flex items-center gap-3">
                        <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>Allow Split Bills</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">
                        <Sparkles className="h-3 w-3" /> Coming Soon
                      </span>
                    </div>
                  </div>
                </div>

                {/* Digital & Thermal Receipt Behavior Card */}
                <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 space-y-4">
                  <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Printer className="h-4 w-4 text-primary" /> Receipt Dispatch & Printing Rules
                  </h3>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { key: "offerDigitalReceipt", label: "Offer Digital Receipt" },
                      { key: "offerPrintedReceipt", label: "Offer Thermal Printed Receipt" },
                      { key: "printAutomatically", label: "Print Automatically After Payment" },
                      { key: "printCustomerCopy", label: "Print Customer Copy" },
                      { key: "printKitchenCopy", label: "Print Kitchen Copy" },
                    ].map((item) => {
                      const isChecked = (paymentForm as any)[item.key];
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() =>
                            setPaymentForm((prev) => ({
                              ...prev,
                              [item.key]: !isChecked,
                            }))
                          }
                          className={cn(
                            "flex items-center gap-3 rounded-2xl p-3 border text-xs font-semibold transition cursor-pointer text-left select-none",
                            isChecked
                              ? "bg-primary/5 border-primary/40 text-foreground"
                              : "bg-secondary/40 border-border/60 text-muted-foreground hover:bg-secondary"
                          )}
                        >
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section-Specific Save Button */}
                <div className="pt-2">
                  <button
                    onClick={savePayment}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-xs font-semibold transition cursor-pointer shadow-soft active:scale-95 bg-primary text-primary-foreground hover:opacity-90"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save Payment Settings</span>
                  </button>
                </div>
              </div>

              {/* Live Payment Preview Panel */}
              <div className="space-y-4">
                <div className="sticky top-6">
                  <LivePaymentPreview settings={paymentForm} />
                </div>
              </div>
            </div>
          )}

          {/* ADVANCED / DEVELOPER TOOLS SECTION */}
          {activeSection === "advanced" && (
            <div className="space-y-6">
              <DeveloperPrintingTest />
            </div>
          )}

          {/* PLACEHOLDER SECTIONS FOR OTHER CONFIGURATIONS */}
          {activeSection !== "business_profile" &&
            activeSection !== "receipts_billing" &&
            activeSection !== "taxes" &&
            activeSection !== "payments" &&
            activeSection !== "operations" &&
            activeSection !== "advanced" && (
              <div className="rounded-3xl bg-card p-12 shadow-soft ring-1 ring-border/60 text-center space-y-4">
                <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                  <activeDef.icon className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-display text-lg font-bold text-foreground">{activeDef.label} Configuration</h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">{activeDef.description}</p>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent border border-accent/20">
                  <Sparkles className="h-3.5 w-3.5" /> Coming Soon
                </div>

                <div className="pt-6 border-t border-border/40 max-w-md mx-auto">
                  <button
                    disabled
                    className="w-full rounded-full bg-muted py-2.5 text-xs font-semibold text-muted-foreground border border-border cursor-not-allowed"
                  >
                    Save {activeDef.label} Settings
                  </button>
                </div>
              </div>
            )}
        </main>
      </div>

      <ImageCropperModal
        isOpen={isCropOpen}
        imageSrc={imageSrc}
        onClose={() => setIsCropOpen(false)}
        onSave={handleSaveLogo}
        onChooseAnother={() => fileRef.current?.click()}
        saveLabel="Save Logo"
        title="Edit Logo"
        isSaving={uploading}
      />
    </div>
  );
}
