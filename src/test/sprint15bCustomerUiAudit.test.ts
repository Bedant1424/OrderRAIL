import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("Sprint 15B — Customer UI Visual Audit & Standardization", () => {
  it("1. MenuImage: verifies universal container size classes and single borders", () => {
    const menuImageContent = readFileSync(
      resolve(__dirname, "../components/customer/MenuImage.tsx"),
      "utf-8"
    );

    // Verify 4 container size definitions
    expect(menuImageContent).toContain('case "xs":');
    expect(menuImageContent).toContain("h-12 w-12 rounded-xl border border-cc-border");

    expect(menuImageContent).toContain('case "sm":');
    expect(menuImageContent).toContain("h-16 w-16 rounded-xl border border-cc-border");

    expect(menuImageContent).toContain('case "full":');
    expect(menuImageContent).toContain("h-full w-full rounded-none border-0");

    expect(menuImageContent).toContain("h-24 w-24 rounded-2xl border border-cc-border");

    // Verify unified fallback contains both coffee emoji and No Image text
    expect(menuImageContent).toContain("☕");
    expect(menuImageContent).toContain("No Image");
  });

  it("2. MenuItemCard: verifies single border card thumbnail, rounded-t-2xl banner, and strokeWidth={2.2}", () => {
    const menuItemCardContent = readFileSync(
      resolve(__dirname, "../components/customer/MenuItemCard.tsx"),
      "utf-8"
    );

    // Uses MenuImage with size="lg"
    expect(menuItemCardContent).toContain('<MenuImage src={item.image_url} alt={item.name} size="lg" />');

    // Drawer banner uses rounded-t-2xl and size="full"
    expect(menuItemCardContent).toContain('rounded-t-2xl border-b border-cc-border');
    expect(menuItemCardContent).toContain('<MenuImage src={item.image_url} alt={item.name} size="full" />');

    // Action button Plus/Minus use strokeWidth={2.2}
    expect(menuItemCardContent).toContain('<Plus className="h-3.5 w-3.5" strokeWidth={2.2} />');
    expect(menuItemCardContent).toContain('<Minus className="h-3.5 w-3.5" strokeWidth={2.2} />');
  });

  it("3. CartView: verifies size='sm' thumbnails, single border, and normalized icon sizes", () => {
    const cartViewContent = readFileSync(
      resolve(__dirname, "../components/customer/CartView.tsx"),
      "utf-8"
    );

    // Uses MenuImage with size="sm"
    expect(cartViewContent).toContain('<MenuImage src={l.item.image_url} alt={l.item.name} size="sm" />');

    // Quick Actions icons normalized from h-4.5 to h-4 and strokeWidth={2.2}
    expect(cartViewContent).not.toContain('h-4.5 w-4.5');
    expect(cartViewContent).toContain('<Plus className="h-4 w-4 text-cc-text" strokeWidth={2.2} />');
    expect(cartViewContent).toContain('<Star className="h-4 w-4 text-cc-accent" strokeWidth={2.2} />');
    expect(cartViewContent).toContain('<PhoneCall className="h-4 w-4 text-emerald-600" strokeWidth={2.2} />');
    expect(cartViewContent).toContain('<Receipt className="h-4 w-4 text-cc-text" strokeWidth={2.2} />');
  });

  it("4. OrderStatusView: verifies size='xs' thumbnails without redundant outer borders", () => {
    const orderStatusContent = readFileSync(
      resolve(__dirname, "../components/customer/OrderStatusView.tsx"),
      "utf-8"
    );

    // Uses MenuImage with size="xs" directly without redundant outer wrapper div
    expect(orderStatusContent).toContain('<MenuImage src={i.menu_items?.image_url} alt={i.name} size="xs" />');
    expect(orderStatusContent).not.toContain('h-12 w-12 shrink-0 rounded-xl overflow-hidden border');

    // Stepper node icons use strokeWidth={2.2}
    expect(orderStatusContent).toContain('<Icon className="h-5 w-5" strokeWidth={2.2} />');
  });

  it("5. ReviewForm & TableLayout: verifies consistent icon strokeWidth={2.2} and sizing hierarchy", () => {
    const reviewFormContent = readFileSync(
      resolve(__dirname, "../components/customer/ReviewForm.tsx"),
      "utf-8"
    );
    const tableLayoutContent = readFileSync(
      resolve(__dirname, "../layouts/TableLayout.tsx"),
      "utf-8"
    );

    // ReviewForm Google review icon size standardized to h-3.5 w-3.5 and strokeWidth={2.2}
    expect(reviewFormContent).toContain('<ExternalLink className="h-3.5 w-3.5" strokeWidth={2.2} />');
    expect(reviewFormContent).toContain('<Sparkles className="h-4 w-4 shrink-0 text-cc-accent animate-pulse" strokeWidth={2.2} />');

    // TableLayout icons use strokeWidth={2.2}
    expect(tableLayoutContent).toContain('<WifiOff className="h-3 w-3" strokeWidth={2.2} />');
    expect(tableLayoutContent).toContain('<Info className="h-4 w-4" strokeWidth={2.2} />');
    expect(tableLayoutContent).toContain('<AlertCircle className="h-5 w-5" strokeWidth={2.2} />');
  });
});
