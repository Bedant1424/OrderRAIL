import { useEffect, useMemo, useRef, useState, forwardRef, type ElementRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Check, Pencil, Plus, Trash2, X, MoreVertical, Search } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import ImageCropperModal from "@/components/ImageCropperModal";
import { supabase, formatMoney, type Cafe, type MenuCategory, type MenuItem } from "@/lib/db";
import { cn } from "@/lib/utils";
import { generateUUID } from "@/lib/uuid";
import { useCafe } from "@/lib/cafe";
import { GlobalNotificationControls } from "@/components/owner/GlobalNotificationControls";
import { usePermissions } from "@/lib/permissions";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
} from "@/components/ui/select";
import * as SelectPrimitive from "@radix-ui/react-select";


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
  const permissions = usePermissions();
  const isDemo = permissions.isDemo;
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

      const remainingCats = cats.filter(c => c.id !== cat.id);
      remainingCats.sort((a, b) => a.sort_order - b.sort_order);
      
      const updates = remainingCats.map((c, index) => {
        const nextOrder = index + 1;
        if (c.sort_order !== nextOrder) {
          return supabase
            .from("menu_categories")
            .update({ sort_order: nextOrder })
            .eq("id", c.id);
        }
        return null;
      }).filter(Boolean);

      if (updates.length > 0) {
        await Promise.all(updates);
      }

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
            onClick={isDemo ? undefined : () => setAddingCat(true)}
            disabled={isDemo}
            className={cn(
              "rounded-full px-4 py-2 text-xs font-medium transition",
              isDemo ? "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-70" : "bg-secondary hover:bg-secondary/80"
            )}
            title={isDemo ? "This action is disabled in the public demo." : "New category"}
          >
            <Plus className="mr-1 inline h-3.5 w-3.5" /> Category {isDemo && "🔒"}
          </button>
          <button
            onClick={isDemo ? undefined : () => setEditingItem({} as MenuItem)}
            disabled={isDemo}
            className={cn(
              "rounded-full px-4 py-2 text-xs font-semibold transition",
              isDemo ? "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-70" : "bg-brand text-brand-foreground shadow-soft hover:bg-brand/90"
            )}
            title={isDemo ? "This action is disabled in the public demo." : "New item"}
          >
            <Plus className="mr-1 inline h-3.5 w-3.5" /> Item {isDemo && "🔒"}
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
                  <DropdownMenuItem 
                    onClick={isDemo ? undefined : () => setEditingCat(cat)} 
                    disabled={isDemo}
                    className={cn("cursor-pointer", isDemo && "opacity-50 cursor-not-allowed")}
                  >
                    <Pencil className="mr-2 h-4 w-4" /> Rename Category {isDemo && "🔒"}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={isDemo ? undefined : () => void removeCat(cat)} 
                    disabled={isDemo}
                    className={cn(
                      "cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10",
                      isDemo && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Category {isDemo && "🔒"}
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
                    currency={cafe?.currency ?? "INR"}
                    onEdit={() => setEditingItem(i)}
                    onToggle={() => void toggleAvail(i)}
                    onDelete={() => void removeItem(i)}
                  />
                ))}
              </AnimatePresence>
              {(grouped.get(cat.id) ?? []).length === 0 && (
                <button
                  onClick={isDemo ? undefined : () => setEditingItem({ category_id: cat.id } as MenuItem)}
                  disabled={isDemo}
                  className={cn(
                    "col-span-full rounded-2xl border border-dashed border-border p-5 text-sm transition text-muted-foreground",
                    isDemo ? "bg-muted/30 cursor-not-allowed opacity-60" : "bg-card/60 hover:bg-card"
                  )}
                  title={isDemo ? "This action is disabled in the public demo." : "Add first item"}
                >
                  <Plus className="mr-1 inline h-4 w-4" /> Add first item to {cat.name} {isDemo && "🔒"}
                </button>
              )}
            </div>
          </section>
        ))}
        {cats.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center">
            <p className="text-muted-foreground">No categories yet.</p>
            <button
              onClick={isDemo ? undefined : () => setAddingCat(true)}
              disabled={isDemo}
              className={cn(
                "mt-4 rounded-full px-5 py-2.5 text-sm font-semibold transition",
                isDemo
                  ? "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-70"
                  : "btn-primary-action"
              )}
              title={isDemo ? "This action is disabled in the public demo." : "Add your first category"}
            >
              Add your first category {isDemo && "🔒"}
            </button>
          </div>
        )}
      </div>

      {(addingCat || editingCat) && cafeId && (
        <CategoryDialog
          cafeId={cafeId}
          initial={editingCat}
          categories={cats}
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
  const permissions = usePermissions();
  const isDemo = permissions.isDemo;
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
          <label className={cn("flex items-center gap-2 text-xs select-none h-11", isDemo ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
            <Switch
              checked={item.is_available}
              disabled={isDemo}
              onCheckedChange={isDemo ? undefined : onToggle}
            />
            <span className="font-semibold text-muted-foreground">Available</span>
          </label>
          <button
            onClick={onEdit}
            className="h-11 w-11 flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 text-foreground transition active:scale-95 shrink-0"
            title={isDemo ? "View item details" : "Edit item"}
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={isDemo ? undefined : onDelete}
          disabled={isDemo}
          className={cn(
            "h-11 w-11 flex items-center justify-center rounded-full transition shrink-0",
            isDemo
              ? "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60"
              : "bg-destructive/10 hover:bg-destructive/20 text-destructive active:scale-95"
          )}
          title={isDemo ? "This action is disabled in the public demo." : "Delete item"}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </motion.article>
  );
}

const RightSelectItem = forwardRef<
  ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center justify-between rounded-lg px-3 py-2.5 text-sm outline-none",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      "focus:bg-secondary focus:text-foreground",
      "data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary data-[state=checked]:font-semibold",
      "h-[42px] transition-colors cursor-pointer",
      className
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator>
      <Check className="h-4 w-4 shrink-0" />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
RightSelectItem.displayName = "RightSelectItem";

function CategoryDialog({
  cafeId,
  initial,
  categories,
  onClose,
  onSaved,
}: {
  cafeId: string;
  initial: MenuCategory | null;
  categories: MenuCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sort, setSort] = useState<string | number>(
    initial ? initial.sort_order : categories.length + 1
  );
  const [busy, setBusy] = useState(false);

  const permissions = usePermissions();
  const isDemo = permissions.isDemo;

  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    if (sort === "" || sort === null || sort === undefined) {
      toast.error("Sort order cannot be empty.");
      return;
    }

    const sortNum = Number(sort);
    const finalMax = categories.length + (initial ? 0 : 1);
    if (isNaN(sortNum) || sortNum < 1 || sortNum > finalMax) {
      toast.error(`Sort order must be between 1 and ${finalMax}.`);
      return;
    }

    setBusy(true);
    try {
      let listToNormalize: { id: string; name: string; sort_order: number; isTemp?: boolean }[] = [];

      if (!initial) {
        const tempId = "TEMP_INSERT_ID";
        listToNormalize = [
          ...categories.map(c => ({ id: c.id, name: c.name, sort_order: c.sort_order })),
          { id: tempId, name: trimmedName, sort_order: sortNum, isTemp: true }
        ];
        
        listToNormalize.sort((a, b) => {
          if (a.sort_order !== b.sort_order) {
            return a.sort_order - b.sort_order;
          }
          if (a.id === tempId) return -1;
          if (b.id === tempId) return 1;
          return 0;
        });
      } else {
        listToNormalize = categories.map(c => {
          if (c.id === initial.id) {
            return { id: c.id, name: trimmedName, sort_order: sortNum };
          }
          return { id: c.id, name: c.name, sort_order: c.sort_order };
        });

        listToNormalize.sort((a, b) => {
          if (a.sort_order !== b.sort_order) {
            return a.sort_order - b.sort_order;
          }
          if (a.id === initial.id) return -1;
          if (b.id === initial.id) return 1;
          return 0;
        });
      }

      const normalizedList = listToNormalize.map((item, index) => ({
        ...item,
        final_sort_order: index + 1
      }));

      if (!initial) {
        const newItem = normalizedList.find(item => item.isTemp)!;
        const { error: insertError } = await supabase
          .from("menu_categories")
          .insert({
            cafe_id: cafeId,
            name: trimmedName,
            sort_order: newItem.final_sort_order
          });
        if (insertError) throw insertError;

        const updates = normalizedList
          .filter(item => !item.isTemp)
          .map(item => {
            const orig = categories.find(c => c.id === item.id)!;
            if (orig.sort_order !== item.final_sort_order) {
              return supabase
                .from("menu_categories")
                .update({ sort_order: item.final_sort_order })
                .eq("id", item.id);
            }
            return null;
          })
          .filter(Boolean);

        if (updates.length > 0) {
          await Promise.all(updates);
        }
      } else {
        const updates = normalizedList.map(item => {
          const orig = categories.find(c => c.id === item.id)!;
          if (item.id === initial.id) {
            return supabase
              .from("menu_categories")
              .update({ name: trimmedName, sort_order: item.final_sort_order })
              .eq("id", item.id);
          } else if (orig.sort_order !== item.final_sort_order) {
            return supabase
              .from("menu_categories")
              .update({ sort_order: item.final_sort_order })
              .eq("id", item.id);
          }
          return null;
        }).filter(Boolean);

        if (updates.length > 0) {
          await Promise.all(updates);
        }
      }

      toast.success("Category saved");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to save category");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={initial ? "Edit category" : "New category"}
      onClose={onClose}
      footer={
        <button
          onClick={isDemo ? undefined : () => void save()}
          disabled={busy || !name.trim() || isDemo}
          className={cn(
            "w-full rounded-full px-5 py-2.5 text-sm font-semibold transition",
            isDemo 
              ? "bg-muted text-muted-foreground border border-border cursor-not-allowed" 
              : "btn-primary-action"
          )}
        >
          {isDemo ? "🔒 Disabled in Public Demo" : busy ? "Saving…" : "Save"}
        </button>
      }
    >
      <div>
        <label className="block text-xs font-medium text-muted-foreground">Name</label>
        <input
          value={name}
          disabled={isDemo}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35"
        />
        <label className="mt-3 block text-xs font-medium text-muted-foreground">Sort order</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={sort}
          disabled={isDemo}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "") {
              setSort("");
            } else {
              const cleaned = val.replace(/\D/g, "");
              if (cleaned === "") {
                setSort("");
              } else {
                const parsed = parseInt(cleaned, 10);
                setSort(parsed);
              }
            }
          }}
          className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35"
        />
        {isDemo && (
          <p className="mt-4 text-[11px] text-amber-600 bg-amber-500/8 border border-amber-500/20 p-2.5 rounded-xl text-center font-medium">
            This action is disabled in the public demo.
          </p>
        )}
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
  const permissions = usePermissions();
  const isDemo = permissions.isDemo;
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

  // Cropper states
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

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

  useEffect(() => {
    return () => {
      if (imageSrc && imageSrc.startsWith("blob:") && imageSrc !== preview) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [imageSrc, preview]);

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
      if (prev && prev.startsWith("blob:") && prev !== preview) {
        URL.revokeObjectURL(prev);
      }
      return objectUrl;
    });
    setIsCropOpen(true);
    if (fileRef.current) fileRef.current.value = "";
  };

  const uploadCropped = async (croppedBlob: Blob) => {
    setUploading(true);
    try {
      const ext = "png";
      const path = `${cafeId}/${generateUUID()}.${ext}`;
      const file = new File([croppedBlob], `item.${ext}`, { type: "image/png" });
      const { error } = await supabase.storage.from("menu-images").upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      setImagePath(`menu-images/${path}`);
      toast.success("Image uploaded");
      setIsCropOpen(false);
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
    <>
      <Dialog
      title={isEdit ? "Edit item" : "New item"}
      onClose={onClose}
      footer={
        <button
          onClick={isDemo ? undefined : () => void save()}
          disabled={busy || !name.trim() || isDemo}
          className={cn(
            "w-full rounded-full px-5 py-2.5 text-sm font-semibold transition",
            isDemo
              ? "bg-muted text-muted-foreground border border-border cursor-not-allowed"
              : "btn-primary-action"
          )}
        >
          {isDemo ? "🔒 Disabled in Public Demo" : busy ? "Saving…" : "Save"}
        </button>
      }
    >
      <div className="space-y-4 pb-2">
        <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
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
            disabled={uploading || isDemo}
            className={cn(
              "grid aspect-square w-full place-items-center overflow-hidden rounded-2xl bg-secondary text-muted-foreground hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
              isDemo && "cursor-not-allowed opacity-75 hover:opacity-75"
            )}
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
            onChange={handleFileChange}
          />
          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <input
                value={name}
                disabled={isDemo}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Price</label>
                <input
                  inputMode="decimal"
                  value={price}
                  disabled={isDemo}
                  onChange={(e) => setPrice(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <select
                  value={category}
                  disabled={isDemo}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35"
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
            disabled={isDemo}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            className="mt-1 w-full resize-none rounded-2xl border border-border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60 disabled:opacity-60 disabled:bg-muted/35"
          />
        </div>
        <label className={cn("flex items-center gap-2 text-sm select-none", isDemo ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
          <input
            type="checkbox"
            checked={available}
            disabled={isDemo}
            onChange={(e) => setAvailable(e.target.checked)}
            className="rounded border-border text-primary focus:ring-ring"
          />
          <span>Available on menu</span>
        </label>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Veg / Non-Veg</label>
          <Select disabled={isDemo} value={vegType} onValueChange={(val) => setVegType(val as typeof vegType)}>
            <SelectTrigger
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/60 focus:ring-offset-0 flex items-center justify-between h-[42px] font-normal"
            >
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent
              className="rounded-xl border border-border bg-card shadow-soft p-2 space-y-1.5 min-w-[var(--radix-select-trigger-width)] duration-120 z-[100]"
            >
              <RightSelectItem value="unspecified">Not specified</RightSelectItem>
              <RightSelectItem value="veg">Veg</RightSelectItem>
              <RightSelectItem value="non_veg">Non-Veg</RightSelectItem>
            </SelectContent>
          </Select>
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
                  disabled={isDemo}
                  onClick={isDemo ? undefined : () => {
                    setTags((prev) =>
                      prev.includes(lbl) ? prev.filter((t) => t !== lbl) : [...prev, lbl]
                    );
                  }}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium border transition-all active:scale-95",
                    active
                      ? "bg-primary border-primary text-primary-foreground font-semibold"
                      : "bg-background border-border text-muted-foreground hover:bg-secondary",
                    isDemo && "cursor-not-allowed opacity-60 active:scale-100"
                  )}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
        </div>
        {isDemo && (
          <p className="text-[11px] text-amber-600 bg-amber-500/8 border border-amber-500/20 p-2.5 rounded-xl text-center font-medium">
            This action is disabled in the public demo.
          </p>
        )}
      </div>
    </Dialog>
    <ImageCropperModal
      isOpen={isCropOpen}
      imageSrc={imageSrc}
      onClose={() => setIsCropOpen(false)}
      onSave={uploadCropped}
      onChooseAnother={() => fileRef.current?.click()}
      saveLabel="Save"
      title="Edit Image"
      isSaving={uploading}
    />
    </>
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
  children: ReactNode;
  footer?: ReactNode;
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
