import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { supabase, formatMoney, type Cafe, type MenuCategory, type MenuItem } from "@/lib/db";
import { cn } from "@/lib/utils";
import { generateUUID } from "@/lib/uuid";

const SIGNED_YEARS = 60 * 60 * 24 * 365 * 10;

async function urlForPath(path: string) {
  const { data } = await supabase.storage.from("menu-images").createSignedUrl(path, SIGNED_YEARS);
  return data?.signedUrl ?? null;
}

import { useCafe } from "@/lib/cafe";
import { GlobalNotificationControls } from "@/components/owner/GlobalNotificationControls";

export default function OwnerMenuPage() {
  const qc = useQueryClient();
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [addingCat, setAddingCat] = useState(false);
  const [editingCat, setEditingCat] = useState<MenuCategory | null>(null);

  const { cafe, cafeId } = useCafe();

  const catsQ = useQuery({
    queryKey: ["owner-cats", cafeId],
    enabled: !!cafeId,
    queryFn: async () => {
      const { data } = await supabase.from("menu_categories").select("*").eq("cafe_id", cafeId!).order("sort_order");
      return (data ?? []) as MenuCategory[];
    },
  });

  const itemsQ = useQuery({
    queryKey: ["owner-items", cafeId],
    enabled: !!cafeId,
    queryFn: async () => {
      const { data } = await supabase.from("menu_items").select("*").eq("cafe_id", cafeId!).order("sort_order");
      return (data ?? []) as MenuItem[];
    },
  });

  const items = itemsQ.data ?? [];
  const cats = catsQ.data ?? [];

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const c of cats) map.set(c.id, []);
    for (const i of items) {
      if (!map.has(i.category_id)) map.set(i.category_id, []);
      map.get(i.category_id)!.push(i);
    }
    return map;
  }, [cats, items]);

  const toggleAvail = async (item: MenuItem) => {
    const { error } = await supabase.from("menu_items").update({ is_available: !item.is_available }).eq("id", item.id);
    if (error) toast.error(error.message);
    else void qc.invalidateQueries({ queryKey: ["owner-items", cafeId] });
  };

  const removeItem = async (item: MenuItem) => {
    if (!confirm(`Remove "${item.name}"?`)) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", item.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Item removed");
      void qc.invalidateQueries({ queryKey: ["owner-items", cafeId] });
    }
  };

  const removeCat = async (cat: MenuCategory) => {
    // Prevent deleting category if it still has menu items
    const { data: items, error: checkError } = await supabase
      .from("menu_items")
      .select("id")
      .eq("category_id", cat.id)
      .limit(1);

    if (checkError) {
      toast.error(checkError.message);
      return;
    }

    if (items && items.length > 0) {
      toast.error(`Cannot delete category "${cat.name}" because it still contains menu items. Please delete or move the items first.`);
      return;
    }

    if (!confirm(`Remove category "${cat.name}"?`)) return;
    const { error } = await supabase.from("menu_categories").delete().eq("id", cat.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Category removed");
      void qc.invalidateQueries({ queryKey: ["owner-cats", cafeId] });
      void qc.invalidateQueries({ queryKey: ["owner-items", cafeId] });
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center justify-between w-full lg:w-auto">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Menu manager</h1>
            <p className="mt-1 text-sm text-muted-foreground">Add categories, items, prices and photos.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <GlobalNotificationControls />
        <div className="flex gap-2">
          <button
            onClick={() => setAddingCat(true)}
            className="rounded-full bg-secondary px-4 py-2 text-xs font-medium"
          >
            <Plus className="mr-1 inline h-3.5 w-3.5" /> Category
          </button>
          <button
            onClick={() => setEditingItem({} as MenuItem)}
            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-soft"
          >
            <Plus className="mr-1 inline h-3.5 w-3.5" /> Item
          </button>
        </div>
        </div>
      </header>

      <div className="space-y-8">
        {(catsQ.isLoading || itemsQ.isLoading) ? (
          <div className="flex flex-col items-center justify-center p-12 gap-3 text-muted-foreground">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
            <span className="text-sm font-medium">Loading menu…</span>
          </div>
        ) : cats.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No categories added yet. Click "+ Category" to start.
          </div>
        ) : cats.map((cat) => (
          <section key={cat.id}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">{cat.name}</h2>
              <div className="flex gap-2 text-xs">
                <button
                  className="rounded-full bg-secondary px-3 py-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setEditingCat(cat)}
                >
                  <Pencil className="mr-1 inline h-3 w-3" /> Rename
                </button>
                <button
                  className="rounded-full bg-secondary px-3 py-1 text-muted-foreground hover:text-destructive"
                  onClick={() => void removeCat(cat)}
                >
                  <Trash2 className="mr-1 inline h-3 w-3" /> Delete
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence initial={false}>
                {(grouped.get(cat.id) ?? []).map((i) => (
                  <ItemCard
                    key={i.id}
                    item={i}
                    currency={cafe?.currency ?? "USD"}
                    onEdit={() => setEditingItem(i)}
                    onToggle={() => void toggleAvail(i)}
                    onDelete={() => void removeItem(i)}
                  />
                ))}
              </AnimatePresence>
              {(grouped.get(cat.id) ?? []).length === 0 && (
                <button
                  onClick={() => setEditingItem({ category_id: cat.id } as MenuItem)}
                  className="col-span-full rounded-2xl border border-dashed border-border bg-card/60 p-5 text-sm text-muted-foreground hover:bg-card"
                >
                  <Plus className="mr-1 inline h-4 w-4" /> Add first item to {cat.name}
                </button>
              )}
            </div>
          </section>
        ))}
        {cats.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center">
            <p className="text-muted-foreground">No categories yet.</p>
            <button
              onClick={() => setAddingCat(true)}
              className="mt-4 rounded-full btn-primary-action px-5 py-2.5 text-sm font-semibold"
            >
              Add your first category
            </button>
          </div>
        )}
      </div>

      {(addingCat || editingCat) && cafeId && (
        <CategoryDialog
          cafeId={cafeId}
          initial={editingCat}
          onClose={() => {
            setAddingCat(false);
            setEditingCat(null);
          }}
          onSaved={() => void qc.invalidateQueries({ queryKey: ["owner-cats", cafeId] })}
        />
      )}
      {editingItem && cafeId && cats.length > 0 && (
        <ItemDialog
          cafeId={cafeId}
          initial={editingItem}
          categories={cats}
          onClose={() => setEditingItem(null)}
          onSaved={() => void qc.invalidateQueries({ queryKey: ["owner-items", cafeId] })}
        />
      )}
    </div>
  );
}

function ItemCard({
  item,
  currency,
  onEdit,
  onToggle,
  onDelete,
}: {
  item: MenuItem;
  currency: string;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  useEffect(() => {
    let stop = false;
    if (item.image_url?.startsWith("menu-images/")) {
      void urlForPath(item.image_url.slice("menu-images/".length)).then((u) => !stop && setImgUrl(u));
    } else {
      setImgUrl(item.image_url ?? null);
    }
    return () => {
      stop = true;
    };
  }, [item.image_url]);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className={cn(
        "flex gap-3 rounded-2xl bg-card p-3 shadow-soft ring-1 ring-border/60",
        !item.is_available && "opacity-60",
      )}
    >
      {imgUrl ? (
        <img src={imgUrl} alt="" className="h-20 w-20 flex-shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="h-20 w-20 flex-shrink-0 rounded-xl bg-gradient-warm" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{formatMoney(item.price_cents, currency)}</p>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              item.is_available ? "bg-success/15 text-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {item.is_available ? "Live" : "Off"}
          </span>
        </div>
        {item.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>}
        <div className="mt-2 flex gap-1 text-xs">
          <button onClick={onEdit} className="rounded-full bg-secondary px-2.5 py-1 hover:bg-secondary/80">
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={onToggle}
            className="rounded-full bg-secondary px-2.5 py-1 hover:bg-secondary/80"
            title={item.is_available ? "Take off menu" : "Put back on menu"}
          >
            {item.is_available ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
          </button>
          <button
            onClick={onDelete}
            className="rounded-full bg-secondary px-2.5 py-1 hover:bg-destructive/15 hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </motion.article>
  );
}

function CategoryDialog({
  cafeId,
  initial,
  onClose,
  onSaved,
}: {
  cafeId: string;
  initial: MenuCategory | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sort, setSort] = useState(initial?.sort_order ?? 100);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const payload = { cafe_id: cafeId, name: name.trim(), sort_order: sort };
    const q = initial
      ? supabase.from("menu_categories").update(payload).eq("id", initial.id)
      : supabase.from("menu_categories").insert(payload);
    const { error } = await q;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Category saved");
    onSaved();
    onClose();
  };

  return (
    <Dialog title={initial ? "Edit category" : "New category"} onClose={onClose}>
      <label className="block text-xs font-medium text-muted-foreground">Name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
      />
      <label className="mt-3 block text-xs font-medium text-muted-foreground">Sort order</label>
      <input
        type="number"
        value={sort}
        onChange={(e) => setSort(Number(e.target.value))}
        className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
      />
      <button
        onClick={() => void save()}
        disabled={busy || !name.trim()}
        className="mt-4 w-full rounded-full btn-primary-action px-5 py-2.5 text-sm font-semibold"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </Dialog>
  );
}

function ItemDialog({
  cafeId,
  initial,
  categories,
  onClose,
  onSaved,
}: {
  cafeId: string;
  initial: MenuItem;
  categories: MenuCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial.id;
  const [name, setName] = useState(initial.name ?? "");
  const [desc, setDesc] = useState(initial.description ?? "");
  const [price, setPrice] = useState(((initial.price_cents ?? 0) / 100).toFixed(2));
  const [category, setCategory] = useState(initial.category_id ?? categories[0].id);
  const [available, setAvailable] = useState(initial.is_available ?? true);
  const [vegType, setVegType] = useState(initial.veg_type ?? "unspecified");
  const [tags, setTags] = useState<string[]>(initial.tags ?? []);
  const [imagePath, setImagePath] = useState<string | null>(initial.image_url ?? null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let stop = false;
    if (imagePath?.startsWith("menu-images/")) {
      void urlForPath(imagePath.slice("menu-images/".length)).then((u) => !stop && setPreview(u));
    } else {
      setPreview(imagePath);
    }
    return () => {
      stop = true;
    };
  }, [imagePath]);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${cafeId}/${generateUUID()}.${ext}`;
      const { error } = await supabase.storage.from("menu-images").upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      setImagePath(`menu-images/${path}`);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setBusy(true);
    const cents = Math.max(0, Math.round(parseFloat(price || "0") * 100));
    const payload = {
      cafe_id: cafeId,
      category_id: category,
      name: name.trim(),
      description: desc.trim() || null,
      price_cents: cents,
      is_available: available,
      veg_type: vegType,
      image_url: imagePath,
      tags: tags,
    };
    const q = isEdit
      ? supabase.from("menu_items").update(payload).eq("id", initial.id)
      : supabase.from("menu_items").insert(payload);
    const { error } = await q;
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Item saved");
    onSaved();
    onClose();
  };

  return (
    <Dialog title={isEdit ? "Edit item" : "New item"} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
        <button
          onClick={() => fileRef.current?.click()}
          className="grid aspect-square w-full place-items-center overflow-hidden rounded-2xl bg-secondary text-muted-foreground"
        >
          {preview ? (
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-xs">
              <Camera className="h-5 w-5" /> {uploading ? "Uploading…" : "Photo"}
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
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Price</label>
              <input
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
      <label className="mt-3 block text-xs font-medium text-muted-foreground">Description</label>
      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        rows={3}
        className="mt-1 w-full resize-none rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
      />
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} />
        Available on menu
      </label>
      <div className="mt-3">
        <label className="text-xs font-medium text-muted-foreground">Veg / Non-Veg</label>
        <select
          value={vegType}
          onChange={(e) => setVegType(e.target.value as typeof vegType)}
          className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
        >
          <option value="unspecified">Not specified</option>
          <option value="veg">Veg</option>
          <option value="non_veg">Non-Veg</option>
        </select>
      </div>
      <div className="mt-3">
        <label className="text-xs font-medium text-muted-foreground">Labels</label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {["Best Seller", "Chef's Choice", "Today's Special", "New"].map((lbl) => {
            const active = tags.includes(lbl);
            return (
              <button
                key={lbl}
                type="button"
                onClick={() => {
                  setTags((prev) =>
                    prev.includes(lbl) ? prev.filter((t) => t !== lbl) : [...prev, lbl]
                  );
                }}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium border transition-all active:scale-95",
                  active
                    ? "bg-primary border-primary text-primary-foreground font-semibold"
                    : "bg-background border-border text-muted-foreground hover:bg-secondary"
                )}
              >
                {lbl}
              </button>
            );
          })}
        </div>
      </div>
      <button
        onClick={() => void save()}
        disabled={busy || !name.trim()}
        className="mt-4 w-full rounded-full btn-primary-action px-5 py-2.5 text-sm font-semibold"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </Dialog>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/70 p-4 backdrop-blur-sm flex justify-center items-start sm:items-center">
      <div className="my-auto flex max-h-[90vh] sm:max-h-[85vh] w-full max-w-md flex-col rounded-3xl bg-card p-5 shadow-float ring-1 ring-border">
        <div className="mb-4 flex items-center justify-between shrink-0">
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-full bg-secondary p-1.5" aria-label="Close dialog">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 pr-1 -mr-1 min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}
