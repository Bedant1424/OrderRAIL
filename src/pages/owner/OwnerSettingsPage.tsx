import { useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import ImageCropperModal from "@/components/ImageCropperModal";
import { toast } from "@/components/ui/sonner";
import { Camera, Pencil } from "lucide-react";
import { useCafe } from "@/lib/cafe";
import { supabase } from "@/lib/db";
import { generateUUID } from "@/lib/uuid";
import { usePermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { GlobalNotificationControls } from "@/components/owner/GlobalNotificationControls";
import { resetDemoEnvironmentInDb } from "@/lib/demoReset";
import { RefreshCw, RotateCcw } from "lucide-react";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "BRL", "MXN", "CHF"];
const SIGNED_YEARS = 60 * 60 * 24 * 365 * 10;

async function urlForPath(path: string) {
  const { data } = await supabase.storage.from("menu-images").createSignedUrl(path, SIGNED_YEARS);
  return data?.signedUrl ?? null;
}

export default function OwnerSettingsPage() {
  const qc = useQueryClient();
  const permissions = usePermissions();
  const isDemo = permissions.isDemo;
  const { cafe, refreshCafe } = useCafe();

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [logoUrl, setLogoUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
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

  useEffect(() => {
    if (cafe) {
      setName(cafe.name || "");
      setTagline(cafe.tagline ?? "");
      setCurrency(cafe.currency || "INR");
      setLogoUrl(cafe.logo_url ?? "");
      setPhone(cafe.phone ?? "");
      setWhatsapp(cafe.whatsapp ?? "");
      setAddress(cafe.address ?? "");
      setGoogleMapsReviewUrl(cafe.google_maps_review_url ?? "");
      setWebsite(cafe.website ?? "");
      setInstagram(cafe.instagram ?? "");
      setOperatingHours(cafe.operating_hours ?? "");
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
      console.error(e);
      toast.error("Unable to save logo.");
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

  const save = async () => {
    if (!cafe) return;

    if (googleMapsReviewUrl.trim()) {
      const url = googleMapsReviewUrl.trim();
      try {
        const parsed = new URL(url);
        const validHosts = ["google.com", "g.page", "goo.gl", "maps.google.com", "search.google.com"];
        const isGoogle = validHosts.some((host) => parsed.hostname.endsWith(host));
        if (!isGoogle) {
          return toast.error("Invalid review URL. Must be a valid Google Maps or Google Reviews link (e.g. google.com, g.page, goo.gl).");
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
        address: address.trim() || null,
        google_maps_review_url: googleMapsReviewUrl.trim() || null,
        website: website.trim() || null,
        instagram: instagram.trim() || null,
        operating_hours: operatingHours.trim() || null,
      })
      .eq("id", cafe.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    void refreshCafe();
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cafe details customers see.</p>
        </div>
        <GlobalNotificationControls />
      </header>

      <div className="grid gap-8 md:grid-cols-[200px_1fr]">
        {/* Logo upload left panel */}
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

        {/* Inputs panel right */}
        <section className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground">Cafe name</label>
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
                placeholder="e.g. 987..."
                className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground">WhatsApp</label>
              <input
                value={whatsapp}
                disabled={isDemo}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="e.g. 987..."
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
              <label className="block text-xs font-semibold text-muted-foreground">Website</label>
              <input
                value={website}
                disabled={isDemo}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="e.g. https://mycafe.com"
                className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35 disabled:cursor-not-allowed"
              />
            </div>
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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


          <button
            onClick={isDemo ? undefined : () => void save()}
            disabled={busy || isDemo}
            className={cn(
              "w-full rounded-full py-3 text-sm font-semibold transition",
              isDemo
                ? "bg-muted text-muted-foreground border border-border cursor-not-allowed"
                : "btn-primary-action"
            )}
          >
            {isDemo ? "🔒 Disabled in Public Demo" : busy ? "Saving…" : "Save changes"}
          </button>
          {isDemo && (
            <p className="text-[11px] text-amber-600 bg-amber-500/8 border border-amber-500/20 p-2.5 rounded-xl text-center font-medium">
              This action is disabled in the public demo.
            </p>
          )}

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
                className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 px-4 py-2 text-xs font-bold transition-all disabled:opacity-50"
              >
                <RotateCcw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
                {busy ? "Resetting Demo Environment..." : "Reset Demo Environment"}
              </button>
            </div>
          </div>
        </section>
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
