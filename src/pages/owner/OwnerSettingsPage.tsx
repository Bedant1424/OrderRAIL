import { useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { Camera } from "lucide-react";
import { useCafe } from "@/lib/cafe";
import { supabase } from "@/lib/db";
import { generateUUID } from "@/lib/uuid";
import { GlobalNotificationControls } from "@/components/owner/GlobalNotificationControls";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "BRL", "MXN", "CHF"];
const SIGNED_YEARS = 60 * 60 * 24 * 365 * 10;

async function urlForPath(path: string) {
  const { data } = await supabase.storage.from("menu-images").createSignedUrl(path, SIGNED_YEARS);
  return data?.signedUrl ?? null;
}

export default function OwnerSettingsPage() {
  const qc = useQueryClient();
  const { cafe, refreshCafe } = useCafe();

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [logoUrl, setLogoUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [googleMapsReviewUrl, setGoogleMapsReviewUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [operatingHours, setOperatingHours] = useState("");
  const [staffCanManageSpecials, setStaffCanManageSpecials] = useState(false);

  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cafe) {
      setName(cafe.name);
      setTagline(cafe.tagline ?? "");
      setCurrency(cafe.currency);
      setLogoUrl(cafe.logo_url ?? "");
      setPhone(cafe.phone ?? "");
      setWhatsapp(cafe.whatsapp ?? "");
      setAddress(cafe.address ?? "");
      setGoogleMapsReviewUrl(cafe.google_maps_review_url ?? "");
      setWebsite(cafe.website ?? "");
      setInstagram(cafe.instagram ?? "");
      setOperatingHours(cafe.operating_hours ?? "");
      setStaffCanManageSpecials(cafe.staff_can_manage_specials ?? false);
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

  const upload = async (file: File) => {
    if (!cafe) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${cafe.id}/logo_${generateUUID()}.${ext}`;
      const { error } = await supabase.storage.from("menu-images").upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      setLogoUrl(`menu-images/${path}`);
      toast.success("Logo uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
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
        staff_can_manage_specials: staffCanManageSpecials,
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
          <button
            onClick={() => fileRef.current?.click()}
            className="grid aspect-square w-32 place-items-center overflow-hidden rounded-2xl bg-secondary text-muted-foreground border border-dashed border-border hover:bg-secondary/75 transition-all shadow-inner relative"
          >
            {preview ? (
              <img src={preview} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-xs">
                <Camera className="h-6 w-6" /> {uploading ? "Uploading…" : "Upload"}
              </div>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
          {logoUrl && (
            <button
              onClick={() => {
                setLogoUrl("");
                setPreview(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="text-xs font-semibold text-destructive hover:underline mt-1"
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
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
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
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g. Artisanal Coffee & Warm Pastries"
              className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +1 555-0199"
                className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground">WhatsApp</label>
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="e.g. +1 555-0199"
                className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground">Address</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 123 Espresso Blvd, Seattle, WA"
              className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground">Website</label>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="e.g. https://mycafe.com"
                className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground">Instagram</label>
              <input
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="e.g. https://instagram.com/mycafe"
                className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground">Google Maps Review URL</label>
              <input
                value={googleMapsReviewUrl}
                onChange={(e) => setGoogleMapsReviewUrl(e.target.value)}
                placeholder="e.g. https://g.page/r/unique-id/review"
                className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground">Operating Hours</label>
              <input
                value={operatingHours}
                onChange={(e) => setOperatingHours(e.target.value)}
                placeholder="e.g. Mon-Fri: 7 AM - 6 PM, Sat-Sun: 8 AM - 8 PM"
                className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
              />
            </div>
          </div>

          {/* Staff permission toggle */}
          <div className="pt-2 border-t border-border/50">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={staffCanManageSpecials}
                onChange={(e) => setStaffCanManageSpecials(e.target.checked)}
                className="rounded text-primary border-border focus:ring-ring"
              />
              <span className="text-xs font-semibold text-muted-foreground">Allow staff to manage "Today's Specials"</span>
            </label>
          </div>

          <button
            onClick={() => void save()}
            disabled={busy}
            className="w-full rounded-full btn-primary-action py-3 text-sm font-semibold"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </section>
      </div>
    </div>
  );
}
