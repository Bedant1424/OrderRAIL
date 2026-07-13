import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Check, Pencil, Plus, Trash2, X, MoreVertical, Search } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { supabase, formatMoney, type Cafe, type MenuCategory, type MenuItem } from "@/lib/db";
import { cn } from "@/lib/utils";
import { generateUUID } from "@/lib/uuid";
import { useCafe } from "@/lib/cafe";
import { GlobalNotificationControls } from "@/components/owner/GlobalNotificationControls";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";


const SIGNED_YEARS = 60 * 60 * 24 * 365 * 10;

type FilterType = "all" | "available" | "unavailable" | "veg" | "non_veg" | "special" | "bestseller" | "chef_choice" | "new";

const FILTERS: { value: FilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "unavailable", label: "Unavailable" },
  { value: "veg", label: "Veg" },
  { value: "non_veg", label: "Non-Veg" },
  { value: "special", label: "Today's Special" },
  { value: "bestseller", label: "Best Seller" },
  { value: "chef_choice", label: "Chef's Choice" },
  { value: "new", label: "New" },
];

const TAG_FILTERS: Partial<Record<FilterType, string[]>> = {
  special: ["Today's Special"],
  bestseller: ["Best Seller", "Bestseller"],
  chef_choice: ["Chef's Choice"],
  new: ["New"],
};

async function urlForPath(path: string) {
  const { data } = await supabase.storage.from("menu-images").createSignedUrl(path, SIGNED_YEARS);
  return data?.signedUrl ?? null;
}

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

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const filteredCatsAndItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredCategories: MenuCategory[] = [];
    const filteredItemsMap = new Map<string, MenuItem[]>();

    for (const cat of cats) {
      const dbItems = grouped.get(cat.id) ?? [];

      let filteredByChip = dbItems;
      if (activeFilter === "available") {
        filteredByChip = dbItems.filter((i) => i.is_available);
      } else if (activeFilter === "unavailable") {
        filteredByChip = dbItems.filter((i) => !i.is_available);
      } else if (activeFilter === "veg") {
        filteredByChip = dbItems.filter((i) => i.veg_type === "veg");
      } else if (activeFilter === "non_veg") {
        filteredByChip = dbItems.filter((i) => i.veg_type === "non_veg");
      } else if (TAG_FILTERS[activeFilter]) {
        const allowedTags = TAG_FILTERS[activeFilter]!;
        filteredByChip = dbItems.filter((i) =>
          (i.tags || []).some((tag) => allowedTags.includes(tag))
        );
      }

      if (!normalizedQuery) {
        if (dbItems.length === 0) {
          if (activeFilter === "all") {
            filteredCategories.push(cat);
            filteredItemsMap.set(cat.id, []);
          }
          continue;
        }

        if (filteredByChip.length > 0) {
          filteredCategories.push(cat);
          filteredItemsMap.set(cat.id, filteredByChip);
        }
      } else {
        const catMatches = cat.name.toLowerCase().includes(normalizedQuery);
        if (catMatches) {
          if (filteredByChip.length > 0) {
            filteredCategories.push(cat);
            filteredItemsMap.set(cat.id, filteredByChip);
          }
        } else {
          const matchingItems = filteredByChip.filter((i) => i.name.toLowerCase().includes(normalizedQuery));
          if (matchingItems.length > 0) {
            filteredCategories.push(cat);
            filteredItemsMap.set(cat.id, matchingItems);
          }
        }
      }
    }

    return {
      categories: filteredCategories,
      itemsMap: filteredItemsMap
    };
  }, [cats, grouped, searchQuery, activeFilter]);

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
    const catItems = grouped.get(cat.id) ?? [];
    
    if (catItems.length > 0) {
      const message = `Warning: The category "${cat.name}" contains ${catItems.length} menu items.\n\n` +
                      `Deleting this category will also permanently delete all of these menu items.\n\n` +
                      `Are you sure you want to delete Category "${cat.name}" and all its items?`;
      if (!confirm(message)) return;
    } else {
      if (!confirm(`Are you sure you want to remove the category "${cat.name}"?`)) return;
    }

    try {
      if (catItems.length > 0) {
        const { error: itemsError } = await supabase
          .from("menu_items")
          .delete()
          .eq("category_id", cat.id);
        if (itemsError) throw itemsError;
      }
      
      const { error: catError } = await supabase
        .from("menu_categories")
        .delete()
        .eq("id", cat.id);
      if (catError) throw catError;

      toast.success("Category and its items removed");
      void qc.invalidateQueries({ queryKey: ["owner-cats", cafeId] });
      void qc.invalidateQueries({ queryKey: ["owner-items", cafeId] });
    } catch (error: any) {
      toast.error(error.message);
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
            className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground shadow-soft"
          >
            <Plus className="mr-1 inline h-3.5 w-3.5" /> Item
          </button>
        </div>
        </div>
      </header>

      <div className="space-y-8">
        {!catsQ.isLoading && !itemsQ.isLoading && cats.length > 0 && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items or categories..."
                className="w-full rounded-2xl border border-border bg-card py-2.5 pl-11 pr-4 text-sm outline-none ring-ring/60 transition focus:ring-2"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter Chips */}
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setActiveFilter(f.value)}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition active:scale-95",
                    activeFilter === f.value
                      ? "bg-brand text-brand-foreground font-semibold"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {(catsQ.isLoading || itemsQ.isLoading) ? (
          <div className="flex flex-col items-center justify-center p-12 gap-3 text-muted-foreground">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
            <span className="text-sm font-medium">Loading menu…</span>
          </div>
        ) : cats.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No categories added yet. Click "+ Category" to start.
          </div>
        ) : filteredCatsAndItems.categories.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No menu items found.
          </div>
        ) : filteredCatsAndItems.categories.map((cat) => (
          <section key={cat.id}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">{cat.name}</h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="h-11 w-11 flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition active:scale-95 shrink-0"
                    aria-label="Category options"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditingCat(cat)} className="cursor-pointer">
                    <Pencil className="mr-2 h-4 w-4" /> Rename Category
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void removeCat(cat)} className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Category
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence initial={false}>
                {(filteredCatsAndItems.itemsMap.get(cat.id) ?? []).map((i) => (
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

const getTagColorClass = (tag: string): string => {
  switch (tag) {
    case "Best Seller":
    case "Bestseller":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    case "New":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
    case "Popular":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300";
    case "Chef's Choice":
      return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300";
    case "Today's Special":
      return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
    case "Spicy":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    case "Veg":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    case "Non-Veg":
      return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
    default:
      return "bg-secondary text-secondary-foreground";
  }
};

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

  const tagsToRender = (item.tags || []).filter((t) => t !== "Veg" && t !== "Non-Veg");
  if (item.veg_type === "veg") {
    tagsToRender.unshift("Veg");
  } else if (item.veg_type === "non_veg") {
    tagsToRender.unshift("Non-Veg");
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className={cn(
        "w-full min-w-0 flex flex-col rounded-2xl bg-card p-3 shadow-soft ring-1 ring-border/60",
        !item.is_available && "opacity-60",
      )}
    >
      <div className="flex gap-3">
        {imgUrl ? (
          <img src={imgUrl} alt="" className="h-20 w-20 flex-shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="h-20 w-20 flex-shrink-0 rounded-xl bg-gradient-warm" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          {tagsToRender.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {tagsToRender.map((tag) => (
                <span
                  key={tag}
                  className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getTagColorClass(tag)}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{formatMoney(item.price_cents, currency)}</p>
            </div>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0",
                item.is_available ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
              )}
            >
              {item.is_available ? "Available" : "Unavailable"}
            </span>
          </div>
          {item.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>}
        </div>
      </div>

      {/* Actions row */}
      <div className="mt-3 flex items-center justify-between text-xs border-t border-border/40 pt-2.5">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-xs select-none h-11">
            <Switch
              checked={item.is_available}
              onCheckedChange={onToggle}
            />
            <span className="font-semibold text-muted-foreground">Available</span>
          </label>
          <button
            onClick={onEdit}
            className="h-11 w-11 flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 text-foreground transition active:scale-95 shrink-0"
            title="Edit item"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={onDelete}
          className="h-11 w-11 flex items-center justify-center rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive transition active:scale-95 shrink-0"
          title="Delete item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
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
    <Dialog
      title={initial ? "Edit category" : "New category"}
      onClose={onClose}
      footer={
        <button
          onClick={() => void save()}
          disabled={busy || !name.trim()}
          className="w-full rounded-full btn-primary-action px-5 py-2.5 text-sm font-semibold"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      }
    >
      <div>
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
      </div>
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
    <Dialog
      title={isEdit ? "Edit item" : "New item"}
      onClose={onClose}
      footer={
        <button
          onClick={() => void save()}
          disabled={busy || !name.trim()}
          className="w-full rounded-full btn-primary-action px-5 py-2.5 text-sm font-semibold"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      }
    >
      <div className="space-y-4 pb-2">
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
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Description</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            className="mt-1 w-full resize-none rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60"
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => setAvailable(e.target.checked)}
            className="rounded border-border text-primary focus:ring-ring"
          />
          <span>Available on menu</span>
        </label>
        <div>
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
        <div>
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
      </div>
    </Dialog>
  );
}

function Dialog({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex justify-center items-end sm:items-center p-4 pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
      <div className="flex flex-col w-full max-w-md bg-card rounded-3xl p-5 shadow-float ring-1 ring-border max-h-[85vh] sm:max-h-[80vh] overflow-hidden">
        {/* Fixed Header */}
        <div className="mb-4 flex items-center justify-between shrink-0">
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-full bg-secondary p-1.5 active:scale-95 transition" aria-label="Close dialog">
            <X className="h-4 w-4" />
          </button>
        </div>
        
        {/* Scrollable Body */}
        <div className="overflow-y-auto overflow-x-hidden flex-1 pr-1 min-h-0 space-y-4">
          {children}
        </div>
        
        {/* Fixed Footer */}
        {footer && (
          <div className="mt-4 shrink-0 pt-3 border-t border-border/40 pb-[env(safe-area-inset-bottom)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
