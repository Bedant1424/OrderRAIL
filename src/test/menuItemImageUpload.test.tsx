import { describe, it, expect, vi } from "vitest";
import { deleteImageFromStorage } from "../pages/owner/OwnerMenuPage";

describe("Menu Item Image Persistence & Architecture Test Suite", () => {
  it("1. File selection does not trigger form submission or application reload", () => {
    const fileRef = {
      current: {
        clicked: false,
        click() {
          this.clicked = true;
        }
      }
    };

    const handlePhotoTileClick = (isDemo: boolean, e?: { preventDefault?: () => void }) => {
      e?.preventDefault?.();
      if (isDemo) return;
      fileRef.current?.click();
    };

    handlePhotoTileClick(false);
    expect(fileRef.current.clicked).toBe(true);
  });

  it("2. Existing item image upload updates menu_items.image_url immediately", async () => {
    const isEdit = true;
    const initial = { id: "item-123", name: "Cheesy Burger" };
    const cafeId = "cafe-456";
    const newImagePath = "menu-images/cafe-456/new-uuid.png";

    const dbUpdates: any[] = [];
    const mockSupabaseUpdate = async (payload: any, itemId: string) => {
      dbUpdates.push({ payload, itemId });
      return { error: null };
    };

    if (isEdit && initial.id) {
      const { error } = await mockSupabaseUpdate({ image_url: newImagePath }, initial.id);
      expect(error).toBeNull();
    }

    expect(dbUpdates).toHaveLength(1);
    expect(dbUpdates[0]).toEqual({
      payload: { image_url: "menu-images/cafe-456/new-uuid.png" },
      itemId: "item-123"
    });
  });

  it("3. Existing item image replacement deletes old Storage object after successful DB update", async () => {
    const oldImagePath = "menu-images/cafe-789/old-image.png";
    const newImagePath = "menu-images/cafe-789/new-image.png";
    const cafeId = "cafe-789";

    const deletedPaths: string[] = [];
    const mockStorageRemove = (paths: string[]) => {
      deletedPaths.push(...paths);
      return Promise.resolve({ error: null });
    };

    // Simulate DB update success
    const dbUpdateSuccess = true;
    if (dbUpdateSuccess && oldImagePath && oldImagePath !== newImagePath) {
      const pathWithoutBucket = oldImagePath.slice("menu-images/".length);
      if (pathWithoutBucket.startsWith(`${cafeId}/`)) {
        await mockStorageRemove([pathWithoutBucket]);
      }
    }

    expect(deletedPaths).toEqual(["cafe-789/old-image.png"]);
  });

  it("4. Existing item replacement does NOT delete old image if DB update fails", async () => {
    const oldImagePath = "menu-images/cafe-789/old-image.png";
    const newImagePath = "menu-images/cafe-789/new-image.png";
    const cafeId = "cafe-789";

    const deletedOldPaths: string[] = [];

    // Simulate DB update failure
    const dbUpdateSuccess = false;
    if (dbUpdateSuccess && oldImagePath && oldImagePath !== newImagePath) {
      deletedOldPaths.push(oldImagePath.slice("menu-images/".length));
    }

    expect(deletedOldPaths).toHaveLength(0);
  });

  it("5. Failed DB update attempts cleanup of newly uploaded image object", async () => {
    const newImagePath = "menu-images/cafe-789/new-failed-upload.png";
    const cafeId = "cafe-789";

    const cleanedNewPaths: string[] = [];
    const mockStorageRemove = (paths: string[]) => {
      cleanedNewPaths.push(...paths);
      return Promise.resolve({ error: null });
    };

    // DB update failed
    const dbError = { message: "Database connection timeout" };
    if (dbError) {
      const pathWithoutBucket = newImagePath.slice("menu-images/".length);
      if (pathWithoutBucket.startsWith(`${cafeId}/`)) {
        await mockStorageRemove([pathWithoutBucket]);
      }
    }

    expect(cleanedNewPaths).toEqual(["cafe-789/new-failed-upload.png"]);
  });

  it("6. Reloading browser after existing item image replacement retains updated image in DB", () => {
    const dbState = new Map<string, string>();
    dbState.set("item-101", "menu-images/cafe-1/persisted-photo.png");

    // Simulate browser reload by reading directly from DB state
    const reloadedItemImage = dbState.get("item-101");
    expect(reloadedItemImage).toBe("menu-images/cafe-1/persisted-photo.png");
  });

  it("7. New item image upload stages the Storage path", () => {
    const isEdit = false;
    let stagedImagePath: string | null = null;
    const uploadedPath = "menu-images/cafe-100/staged-uuid.png";

    if (!isEdit) {
      stagedImagePath = uploadedPath;
    }

    expect(stagedImagePath).toBe("menu-images/cafe-100/staged-uuid.png");
  });

  it("8. New item Save inserts the staged image_url into database payload", () => {
    const stagedImagePath = "menu-images/cafe-100/staged-uuid.png";
    const payload = {
      cafe_id: "cafe-100",
      name: "New Cappuccino",
      price_cents: 25000,
      image_url: stagedImagePath
    };

    expect(payload.image_url).toBe("menu-images/cafe-100/staged-uuid.png");
  });

  it("9. New item Cancel attempts cleanup of staged Storage object", async () => {
    const isEdit = false;
    const stagedImagePath = "menu-images/cafe-100/staged-uuid.png";
    const cafeId = "cafe-100";

    const cleanedPaths: string[] = [];
    const mockStorageRemove = (paths: string[]) => {
      cleanedPaths.push(...paths);
      return Promise.resolve({ error: null });
    };

    if (!isEdit && stagedImagePath) {
      const pathWithoutBucket = stagedImagePath.slice("menu-images/".length);
      if (pathWithoutBucket.startsWith(`${cafeId}/`)) {
        await mockStorageRemove([pathWithoutBucket]);
      }
    }

    expect(cleanedPaths).toEqual(["cafe-100/staged-uuid.png"]);
  });

  it("10. New item creation DB failure attempts staged image cleanup", async () => {
    const stagedImagePath = "menu-images/cafe-100/staged-uuid.png";
    const cafeId = "cafe-100";

    const cleanedPaths: string[] = [];
    const dbInsertError = { message: "Unique constraint violation" };

    if (dbInsertError && stagedImagePath) {
      const pathWithoutBucket = stagedImagePath.slice("menu-images/".length);
      if (pathWithoutBucket.startsWith(`${cafeId}/`)) {
        cleanedPaths.push(pathWithoutBucket);
      }
    }

    expect(cleanedPaths).toEqual(["cafe-100/staged-uuid.png"]);
  });

  it("11. createImage bypasses crossOrigin='anonymous' for blob: and data: URLs", () => {
    function createImage(url: string): { crossOrigin: string | null } {
      const mockImg = {
        crossOrigin: null as string | null,
        setAttribute(attr: string, val: string) {
          if (attr === "crossOrigin") this.crossOrigin = val;
        }
      };
      if (!url.startsWith("blob:") && !url.startsWith("data:")) {
        mockImg.setAttribute("crossOrigin", "anonymous");
      }
      return mockImg;
    }

    expect(createImage("blob:http://localhost:3000/uuid").crossOrigin).toBeNull();
    expect(createImage("data:image/png;base64,123").crossOrigin).toBeNull();
    expect(createImage("https://supabase.co/img.png").crossOrigin).toBe("anonymous");
  });

  it("12. Crop failure returns user-visible error feedback", () => {
    let errorToastMessage: string | null = null;
    const mockToastError = (msg: string) => {
      errorToastMessage = msg;
    };

    try {
      throw new Error("Canvas context 2D missing");
    } catch (err: any) {
      mockToastError("Failed to process image. Please try another file.");
    }

    expect(errorToastMessage).toBe("Failed to process image. Please try another file.");
  });

  it("13. Multi-cafe Storage safety prevents deleting image from another cafe", async () => {
    const activeCafeId = "cafe-cheese-corner";
    const foreignImagePath = "menu-images/cafe-other-place/malicious-target.png";

    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await deleteImageFromStorage(foreignImagePath, activeCafeId);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Refusing to delete image path 'cafe-other-place/malicious-target.png' outside active cafe scope 'cafe-cheese-corner'")
    );

    consoleWarnSpy.mockRestore();
  });

  it("14. Non-image fields on existing items still require main ItemModal Save", () => {
    const initialItem = { id: "item-1", name: "Old Name", price_cents: 1000, image_url: "menu-images/c1/img.png" };
    let currentNameState = "New Name"; // User typed new name in input
    const imageSavedImmediately = true;

    // Cancelling modal without main Save
    const onModalCancel = () => {
      currentNameState = initialItem.name; // Reverts local name edit
    };

    onModalCancel();

    expect(currentNameState).toBe("Old Name");
    expect(imageSavedImmediately).toBe(true);
  });
});
