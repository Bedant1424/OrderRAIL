import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const SIGNED_TTL = 60 * 60 * 24 * 365 * 10; // 10 years
const cache = new Map<string, string>();

/** Resolves a stored image_url to a displayable URL.
 *  If it starts with "menu-images/", produce a signed URL from the private bucket.
 *  Otherwise return it verbatim. */
export function useImageUrl(source: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!source) return null;
    if (!source.startsWith("menu-images/")) return source;
    return cache.get(source) ?? null;
  });

  useEffect(() => {
    let cancelled = false;
    if (!source) {
      setUrl(null);
      return;
    }
    if (!source.startsWith("menu-images/")) {
      setUrl(source);
      return;
    }
    const cached = cache.get(source);
    if (cached) {
      setUrl(cached);
      return;
    }
    const bucketName = "menu-images";
    const path = source.slice("menu-images/".length);
    void supabase.storage
      .from(bucketName)
      .createSignedUrl(path, SIGNED_TTL)
      .then((response) => {
        console.log("[INSTRUMENTATION useImageUrl]", JSON.stringify({
          originalDatabaseValue: source,
          pathAfterSlice: path,
          bucketNameUsed: bucketName,
          exactPathPassedToCreateSignedUrl: path,
          completeSupabaseResponse: {
            data: response.data,
            error: response.error ? {
              message: response.error.message,
              name: response.error.name,
              statusCode: (response.error as any).statusCode || (response.error as any).status || 400,
              error: (response.error as any).error || "not_found",
              code: (response.error as any).code || "NoSuchKey"
            } : null
          },
          finalUrlGenerated: response.data?.signedUrl ?? null
        }, null, 2));

        if (cancelled) return;
        if (response.data?.signedUrl) {
          cache.set(source, response.data.signedUrl);
          setUrl(response.data.signedUrl);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  return url;
}
