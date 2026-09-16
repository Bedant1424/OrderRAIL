import React, { useState } from "react";
import { Utensils, Coffee, Pizza, Sandwich } from "lucide-react";
import { useImageUrl } from "@/lib/useImageUrl";

export interface CounterMenuImageProps {
  src?: string | null;
  imagePath?: string | null;
  alt?: string;
  altText?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  category?: string;
  categoryName?: string;
}

export const CounterMenuImage: React.FC<CounterMenuImageProps> = ({
  src,
  imagePath,
  alt = "",
  altText = "",
  className = "",
  size = "md",
  category = "",
  categoryName = "",
}) => {
  const effectiveSrc = src !== undefined ? src : imagePath;
  const effectiveAlt = alt || altText;
  const effectiveCategory = category || categoryName;
  const imageUrl = useImageUrl(effectiveSrc);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  const getFallbackIcon = () => {
    const cat = effectiveCategory.toLowerCase();
    const name = effectiveAlt.toLowerCase();

    if (cat.includes("coffee") || cat.includes("beverage") || cat.includes("shake") || cat.includes("tea") || name.includes("coffee") || name.includes("shake")) {
      return <Coffee className="w-4 h-4 text-zinc-500" />;
    }
    if (cat.includes("pizza") || name.includes("pizza")) {
      return <Pizza className="w-4 h-4 text-zinc-500" />;
    }
    if (cat.includes("sandwich") || cat.includes("burger") || cat.includes("wrap") || name.includes("burger") || name.includes("sandwich")) {
      return <Sandwich className="w-4 h-4 text-zinc-500" />;
    }
    return <Utensils className="w-4 h-4 text-zinc-500" />;
  };

  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return "w-10 h-10 rounded-lg";
      case "lg":
        return "w-24 h-24 rounded-xl";
      case "md":
      default:
        return "w-16 h-16 rounded-xl";
    }
  };

  const isInvalid =
    !imageUrl ||
    typeof imageUrl !== "string" ||
    imageUrl === "null" ||
    imageUrl === "undefined" ||
    imageUrl.trim() === "";

  if (isInvalid || error) {
    return (
      <div
        className={`shrink-0 bg-zinc-900 border border-zinc-800/80 flex flex-col items-center justify-center select-none ${getSizeClasses()} ${className}`}
        aria-hidden="true"
      >
        {getFallbackIcon()}
        {size === "lg" && (
          <span className="text-[10px] text-zinc-500 mt-1 font-medium">No Photo</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-zinc-900 border border-zinc-800/80 ${getSizeClasses()} ${className}`}
    >
      {loading && (
        <div className="absolute inset-0 animate-pulse bg-zinc-800/60 flex items-center justify-center">
          <Utensils className="w-3.5 h-3.5 text-zinc-600 animate-pulse" />
        </div>
      )}
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          loading ? "opacity-0" : "opacity-100"
        }`}
      />
    </div>
  );
};
