import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

export interface OverlayRegistration {
  id: string;
  close: () => void;
}

declare global {
  interface Window {
    __customerOverlays?: OverlayRegistration[];
    __ignoreNextPopstate?: boolean;
    __redirectAfterBack?: string;
  }
}

export const getPathDepth = (pathname: string, tableId: string): number => {
  const path = pathname.replace(/\/$/, "");
  if (path === `/t/${tableId}`) return 0;
  if (path.match(new RegExp(`^/t/${tableId}/order/[^/]+$`))) return 2;
  if (path.startsWith(`/t/${tableId}/`)) return 1;
  return 0;
};

export function useCustomerNavigate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tableId } = useParams();

  const customerNavigate = (targetPath: string, options?: { replace?: boolean }) => {
    if (!tableId) {
      navigate(targetPath, options);
      return;
    }

    const currentPath = location.pathname.replace(/\/$/, "");
    const normTarget = targetPath.replace(/\/$/, "");

    if (currentPath === normTarget) {
      return;
    }

    const currentDepth = getPathDepth(location.pathname, tableId);
    const targetDepth = getPathDepth(targetPath, tableId);

    if (targetDepth === 0) {
      // Going to Menu: go back in history to pop all subpages
      navigate(-currentDepth);
    } else if (currentDepth === 0) {
      // Going from Menu to subpage: push
      navigate(targetPath, options);
    } else if (targetDepth === 1 && currentDepth === 2) {
      // Going from child (depth 2) to top-level subpage (depth 1)
      if (normTarget === `/t/${tableId}/cart`) {
        navigate(-1);
      } else {
        (window as any).__redirectAfterBack = targetPath;
        navigate(-1);
      }
    } else if (targetDepth > currentDepth) {
      // Going deeper (e.g. Cart -> Order Details): push
      navigate(targetPath, options);
    } else {
      // Switching between peer subpages (depth 1 <-> depth 1): replace
      // Or going shallower: go back
      const diff = currentDepth - targetDepth;
      if (diff > 0) {
        navigate(-diff);
      } else {
        navigate(targetPath, { ...options, replace: true });
      }
    }
  };

  return customerNavigate;
}

export function useCustomerBackNavigation() {
  const { tableId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Rebuild the history stack if a user lands on a subpage directly
  useEffect(() => {
    if (!tableId) return;

    const sessionKey = `orderrail.nav_initialized.${tableId}`;
    const isInitialized = sessionStorage.getItem(sessionKey);
    if (!isInitialized) {
      sessionStorage.setItem(sessionKey, "true");

      const currentPath = window.location.pathname;
      const search = window.location.search;

      if (currentPath === `/t/${tableId}/cart` || currentPath === `/t/${tableId}/call`) {
        window.history.replaceState(null, "", `/t/${tableId}`);
        window.history.pushState(null, "", currentPath + search);
      } else if (currentPath.match(new RegExp(`^/t/${tableId}/order/[^/]+$`))) {
        window.history.replaceState(null, "", `/t/${tableId}`);
        window.history.pushState(null, "", `/t/${tableId}/cart`);
        window.history.pushState(null, "", currentPath + search);
      }
    }
  }, [tableId]);

  // Handle redirect after back navigation
  useEffect(() => {
    if ((window as any).__redirectAfterBack) {
      const target = (window as any).__redirectAfterBack;
      (window as any).__redirectAfterBack = undefined;
      navigate(target, { replace: true });
    }
  }, [location.pathname, navigate]);

  // Handle overlay closing on back button press
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (window.__ignoreNextPopstate) {
        window.__ignoreNextPopstate = false;
        return;
      }

      // Close overlays if active
      if (window.__customerOverlays && window.__customerOverlays.length > 0) {
        const overlay = window.__customerOverlays[window.__customerOverlays.length - 1];
        if (overlay) {
          overlay.close();
          return;
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);
}

export function useCustomerOverlay(isOpen: boolean, setIsOpen: (open: boolean) => void, id: string) {
  useEffect(() => {
    if (!isOpen) return;

    // Push dummy history entry for the overlay
    window.history.pushState({ isOverlay: true, overlayId: id }, "");

    const registration: OverlayRegistration = {
      id,
      close: () => {
        setIsOpen(false);
      },
    };

    window.__customerOverlays = window.__customerOverlays || [];
    window.__customerOverlays.push(registration);

    return () => {
      window.__customerOverlays = (window.__customerOverlays || []).filter(
        (o) => o.id !== id
      );

      // Clean up the dummy state if closed manually
      if (window.history.state?.isOverlay && window.history.state?.overlayId === id) {
        window.__ignoreNextPopstate = true;
        window.history.back();
      }
    };
  }, [isOpen, setIsOpen, id]);
}
