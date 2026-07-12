import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

export interface OverlayRegistration {
  id: string;
  close: () => void;
}

declare global {
  interface Window {
    __customerOverlays?: OverlayRegistration[];
    __ignoreNextPopstate?: boolean;
  }
}

const getParentRoute = (pathname: string, tableId: string): string | null => {
  const path = pathname.replace(/\/$/, "");
  
  if (path === `/t/${tableId}/cart`) {
    return `/t/${tableId}`;
  }
  if (path === `/t/${tableId}/call`) {
    return `/t/${tableId}`;
  }
  if (path.match(new RegExp(`^/t/${tableId}/order/[^/]+$`))) {
    return `/t/${tableId}/cart`;
  }
  if (path.match(new RegExp(`^/t/${tableId}/service-request/[^/]+$`))) {
    return `/t/${tableId}/call`;
  }
  
  return null;
};

export function useCustomerBackNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { tableId } = useParams();

  useEffect(() => {
    if (!tableId) return;

    const parentRoute = getParentRoute(location.pathname, tableId);
    if (parentRoute) {
      // If we are on a page that has a parent route, push a dummy page state if not already present
      if (!window.history.state?.isPageDummy) {
        window.history.pushState({ isPageDummy: true, path: location.pathname }, "");
      }
    }
  }, [location.pathname, tableId]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (window.__ignoreNextPopstate) {
        window.__ignoreNextPopstate = false;
        return;
      }

      // Check if we have any active overlays to close
      if (window.__customerOverlays && window.__customerOverlays.length > 0) {
        const overlay = window.__customerOverlays[window.__customerOverlays.length - 1];
        if (overlay) {
          overlay.close();
          return;
        }
      }

      // Perform parent-route back navigation if applicable
      if (tableId) {
        const parentRoute = getParentRoute(location.pathname, tableId);
        if (parentRoute) {
          navigate(parentRoute, { replace: true });
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [location.pathname, tableId, navigate]);
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
