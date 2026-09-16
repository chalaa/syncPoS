"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function LoginClientGuard() {
  const router = useRouter();

  useEffect(() => {
    function checkAndRedirect() {
      if (typeof document !== "undefined" && document.cookie.includes("syncpos_logged_in=1")) {
        router.replace("/admin");
      }
    }

    checkAndRedirect();

    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        window.location.reload();
      } else {
        checkAndRedirect();
      }
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [router]);

  return null;
}
