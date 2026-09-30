"use client";

import { useEffect, useState } from "react";
import { DownloadIcon, WifiOffIcon, XIcon } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // 1. Service Worker Registration
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("[PWA] ServiceWorker registered with scope:", reg.scope);
          })
          .catch((err) => {
            console.warn("[PWA] ServiceWorker registration failed:", err);
          });
      });
    }

    // 2. Install Prompt Handler
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 3. Online/Offline Monitoring
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      console.log("[PWA] User accepted the install prompt");
    }
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  }

  return (
    <>
      {/* Offline Toast Banner */}
      {isOffline ? (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-950/90 px-4 py-2 text-xs font-semibold text-amber-200 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-4">
          <WifiOffIcon className="size-4 animate-pulse text-amber-400" />
          <span>You are working offline. Saved drafts remain available.</span>
        </div>
      ) : null}

      {/* PWA Install Banner for Mobile, Tablet, Desktop */}
      {showInstallBanner && deferredPrompt ? (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-[90] flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-card p-3.5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B5D4B] to-[#052E26] text-amber-400 shadow-sm">
              <DownloadIcon className="size-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Install syncPoS App</p>
              <p className="text-[11px] text-muted-foreground">Add to home screen for desktop & mobile POS</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleInstallClick}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition-transform active:scale-95 hover:brightness-110"
            >
              Install
            </button>
            <button
              type="button"
              onClick={() => setShowInstallBanner(false)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close install prompt"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
