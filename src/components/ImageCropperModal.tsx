import React, { useState, useEffect, useRef, useCallback } from "react";
import Cropper from "react-easy-crop";

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (err) => reject(err));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });
}

export async function getCroppedImg(
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

interface ImageCropperModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onSave: (croppedBlob: Blob) => Promise<void> | void;
  onChooseAnother?: () => void;
  saveLabel?: string;
  title?: string;
  isSaving?: boolean;
}

export default function ImageCropperModal({
  isOpen,
  imageSrc,
  onClose,
  onSave,
  onChooseAnother,
  saveLabel = "Save",
  title = "Edit Image",
  isSaving = false,
}: ImageCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset when open or imageSrc changes
  useEffect(() => {
    if (isOpen) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setPreviewUrl(null);
    }
  }, [isOpen, imageSrc]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Clean up timeout
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Esc key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleSave = async () => {
    if (!imageSrc || !croppedPixels) return;
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedPixels);
      await onSave(croppedBlob);
    } catch (e) {
      console.error("Failed to crop image on save", e);
    }
  };

  if (!isOpen || !imageSrc) return null;

  return (
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
              <h3 className="font-display text-lg font-semibold">{title}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Pinch to zoom. Drag to position.
              </p>
            </div>

            {/* Advanced Controls Toggle */}
            <div className="space-y-3 hidden md:block">
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
            <div className="flex gap-3">
              {onChooseAnother && (
                <button
                  type="button"
                  onClick={onChooseAnother}
                  className="flex-1 py-2 rounded-full border border-border text-xs font-semibold hover:bg-secondary transition active:scale-95 text-center"
                >
                  Choose photo
                </button>
              )}
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-2 rounded-full border border-border text-xs font-semibold hover:bg-secondary transition active:scale-95 text-center"
              >
                Reset
              </button>
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-full border border-border text-xs font-semibold hover:bg-secondary transition active:scale-95 text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !previewUrl}
                className="flex-1 py-2.5 rounded-full btn-primary-action text-xs font-semibold transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5"
              >
                {isSaving ? "Saving…" : saveLabel}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
