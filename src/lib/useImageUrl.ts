import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CachedUrl {
  url: string;
  expiresAt: number; // Unix timestamp in ms
}

// Memory caches for URLs and active in-flight requests
const urlCache = new Map<string, CachedUrl>();
const pendingPromises = new Map<string, Promise<string | null>>();

const SAFETY_MARGIN_MS = 60 * 1000; // 1 minute safety buffer for expiration
const DEFAULT_SIGNED_TTL_SEC = 60 * 60 * 24 * 7; // 7 days default TTL

/**
 * Synchronously resolves a stored image source path to a displayable URL.
 * 
 * Strategy:
 * 1. Empty/null source -> null
 * 2. Non-"menu-images/" source -> verbatim string
 * 3. Check memory cache for valid, unexpired URL
 * 4. For "menu-images/", compute public URL via getPublicUrl() synchronously (0 HTTP requests!)
 */
export function resolveImageUrlSync(source: string | null | undefined): string | null {
  if (!source) return null;
  if (!source.startsWith("menu-images/")) return source;

  // 1. Check valid in-memory cache first
  const cached = urlCache.get(source);
  if (cached && cached.expiresAt > Date.now() + SAFETY_MARGIN_MS) {
    return cached.url;
  }

  // 2. Synchronously resolve public storage URL (0 HTTP network calls!)
  const path = source.slice("menu-images/".length);
  const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
  if (data?.publicUrl) {
    // Public URLs do not expire
    urlCache.set(source, { url: data.publicUrl, expiresAt: Infinity });
    return data.publicUrl;
  }

  return null;
}

/**
 * Resolves a signed URL asynchronously with shared promise deduplication and expiration handling.
 * Used if a signed URL is explicitly required or as a fallback handler.
 */
export async function getSignedImageUrl(
  source: string,
  ttlSeconds: number = DEFAULT_SIGNED_TTL_SEC
): Promise<string | null> {
  if (!source) return null;
  if (!source.startsWith("menu-images/")) return source;

  // 1. Check valid in-memory cache
  const cached = urlCache.get(source);
  if (cached && cached.expiresAt > Date.now() + SAFETY_MARGIN_MS) {
    return cached.url;
  }

  // 2. Deduplicate concurrent/in-flight requests for the exact same source path
  if (pendingPromises.has(source)) {
    return pendingPromises.get(source)!;
  }

  const promise = (async () => {
    try {
      const path = source.slice("menu-images/".length);
      const { data, error } = await supabase.storage
        .from("menu-images")
        .createSignedUrl(path, ttlSeconds);

      if (data?.signedUrl) {
        const expiresAt = Date.now() + ttlSeconds * 1000;
        urlCache.set(source, { url: data.signedUrl, expiresAt });
        return data.signedUrl;
      }
      if (error) {
        console.warn("[getSignedImageUrl] Storage signed URL error:", error.message);
      }
    } catch (err) {
      console.warn("[getSignedImageUrl] Exception:", err);
    } finally {
      pendingPromises.delete(source);
    }
    // Fallback to synchronous public URL resolution
    return resolveImageUrlSync(source);
  })();

  pendingPromises.set(source, promise);
  return promise;
}

/**
 * React Hook to resolve an image URL.
 * Immediately returns synchronous public URL on first render (0ms latency, 0 REST calls),
 * eliminating the N+1 Supabase Storage request flood.
 */
export function useImageUrl(source: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => resolveImageUrlSync(source));

  useEffect(() => {
    if (!source) {
      setUrl(null);
      return;
    }

    const resolved = resolveImageUrlSync(source);
    if (resolved) {
      setUrl(resolved);
      return;
    }

    let cancelled = false;
    void getSignedImageUrl(source).then((signedUrl) => {
      if (!cancelled && signedUrl) {
        setUrl(signedUrl);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [source]);

  return url;
}

/** Utility to clear image URL cache (useful for testing or cache reset) */
export function clearImageUrlCache(): void {
  urlCache.clear();
  pendingPromises.clear();
}
