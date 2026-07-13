import { useEffect, useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Cropper from "react-easy-crop";
import { toast } from "@/components/ui/sonner";
import { Camera, Pencil } from "lucide-react";
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

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (err) => reject(err));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });
}

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number }
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2d context");
  }

  canvas.width = 512;
  canvas.height = 512;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    512,
    512
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((file) => {
      if (file) {
        resolve(file);
      } else {
        reject(new Error("Canvas toBlob failed"));
      }
    }, "image/png");
  });
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

  // Cropper states
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (cafe) {
      setName(cafe.name);
      setTagline(cafe.tagline ?? "");
      setCurrency(cafe.currency || "USD");
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

  // Esc key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isCropOpen) {
        setIsCropOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCropOpen]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (imageSrc && imageSrc.startsWith("blob:")) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [imageSrc]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedPixels(croppedAreaPixels);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      if (!imageSrc) return;
      try {
        const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
        const url = URL.createObjectURL(croppedImage);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch (e) {
        console.error(e);
      }
    }, 150);
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
    setImageSrc(objectUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setIsCropOpen(true);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSaveLogo = async () => {
    if (!cafe || !croppedPixels || !imageSrc) return;
    setUploading(true);
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedPixels);
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
          <div className="relative w-32 h-32">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full h-full overflow-hidden rounded-2xl border border-border bg-secondary flex items-center justify-center hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
              title="Edit Logo"
              disabled={uploading}
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
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-primary shadow-soft hover:bg-muted active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
              title="Edit Logo"
              aria-label="Edit Logo"
              disabled={uploading}
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
              onClick={() => void handleRemoveLogo()}
              disabled={uploading}
              className="text-xs font-semibold text-destructive hover:underline mt-1 disabled:opacity-50"
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

      {isCropOpen && imageSrc && (
        <div className="fixed inset-0 z-50 bg-background md:bg-background/80 md:backdrop-blur-sm flex justify-center items-center p-0 md:p-4 print:hidden">
          <div className="flex flex-col md:flex-row w-full h-full md:h-auto md:max-h-[90vh] md:max-w-3xl bg-card md:rounded-3xl overflow-hidden shadow-float ring-1 ring-border">
            
            {/* Left panel: Cropper */}
            <div className="relative flex-1 bg-neutral-950 min-h-[50vh] md:min-h-[400px]">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Right panel: Controls & Preview */}
            <div className="w-full md:w-80 p-5 md:p-6 flex flex-col justify-between bg-card border-t md:border-t-0 md:border-l border-border overflow-y-auto pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:pb-6">
              <div className="space-y-4 md:space-y-6">
                <div>
                  <h3 className="font-display text-lg font-semibold">Edit Logo</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pinch to zoom. Drag to position.
                  </p>
                </div>

                {/* Advanced Controls Toggle */}
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center justify-between w-full"
                  >
                    <span>{showAdvanced ? "Hide manual zoom slider" : "Show manual zoom slider"}</span>
                    <span className="text-xs">{showAdvanced ? "▲" : "▼"}</span>
                  </button>

                  {showAdvanced && (
                    <div className="space-y-2 p-3 bg-secondary/50 rounded-2xl border border-border">
                      <label className="text-[10px] font-semibold text-muted-foreground flex justify-between">
                        <span>Manual Zoom</span>
                        <span>{Math.round(zoom * 100)}%</span>
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.1}
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="w-full accent-primary cursor-pointer"
                      />
                    </div>
                  )}
                </div>

                {/* Live Preview section */}
                <div className="space-y-2 flex flex-col items-center">
                  <span className="text-xs font-semibold text-muted-foreground self-start">Preview</span>
                  <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-2xl overflow-hidden border border-border shadow-inner bg-secondary flex items-center justify-center">
                    {previewUrl ? (
                      <img src={previewUrl} alt="Cropped preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Generating...</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-3 mt-4 md:mt-6">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full py-2 rounded-full border border-border text-xs font-semibold hover:bg-secondary transition active:scale-95 text-center"
                >
                  Choose another photo
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsCropOpen(false)}
                    className="flex-1 py-2.5 rounded-full border border-border text-xs font-semibold hover:bg-secondary transition active:scale-95 text-center"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleSaveLogo()}
                    disabled={uploading || !previewUrl}
                    className="flex-1 py-2.5 rounded-full btn-primary-action text-xs font-semibold transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5"
                  >
                    {uploading ? "Saving…" : "Save Logo"}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
