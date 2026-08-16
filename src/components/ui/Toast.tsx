"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastTone = "success" | "error" | "info";

type Toast = { id: number; message: string; tone: ToastTone };

type ToastContextValue = {
  toast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Minimal toast queue. The database sits in Frankfurt, so a write plus the
 * page refetch takes a noticeable moment — telling the user what happened the
 * instant it lands matters more here than it would on a local database.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        // Bottom on a phone (thumb end, clear of the header), bottom-right up.
        className="pointer-events-none fixed inset-x-3 bottom-3 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`notice pointer-events-auto w-full max-w-sm shadow-[0_16px_36px_-18px_rgb(16_26_46/0.5)] ${
              t.tone === "error"
                ? "notice-error"
                : t.tone === "info"
                  ? "border-seam bg-card text-ink"
                  : "notice-approved"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  // A no-op fallback keeps components usable outside the provider (tests,
  // previews) instead of crashing on a missing context.
  return context ?? { toast: () => {} };
}
