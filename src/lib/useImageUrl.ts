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
    const path = source.slice("menu-images/".length);
    void supabase.storage
      .from("menu-images")
      .createSignedUrl(path, SIGNED_TTL)
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.signedUrl) {
          cache.set(source, data.signedUrl);
          setUrl(data.signedUrl);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  return url;
}
