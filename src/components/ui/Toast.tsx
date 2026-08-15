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
            className={`pointer-events-auto w-full max-w-sm rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${
              t.tone === "error"
                ? "border-red-500/40 bg-red-500/15 text-red-200"
                : t.tone === "info"
                  ? "border-gray-700 bg-[#161b22]/95 text-gray-200"
                  : "border-green-500/40 bg-green-500/15 text-green-200"
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
