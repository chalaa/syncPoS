import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mesud Machinery POS - syncPoS",
    short_name: "syncPoS",
    description: "Unified POS, inventory control, purchasing, sales, and financial management platform.",
    start_url: "/admin",
    display: "standalone",
    background_color: "#073B35",
    theme_color: "#0B5D4B",
    orientation: "any",
    categories: ["business", "finance", "productivity", "utilities"],
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Sales Workspace",
        short_name: "Sales",
        description: "Open Sales & Quotations Workspace",
        url: "/admin/sales",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Purchasing Workspace",
        short_name: "Purchasing",
        description: "Open Procurement & Vendor Orders",
        url: "/admin/purchasing",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Stock & Inventory",
        short_name: "Inventory",
        description: "View Stock Balances & Warehouse Control",
        url: "/admin/inventory",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Expenses",
        short_name: "Expenses",
        description: "Record and track operating expenses",
        url: "/admin/operations/expenses",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
    ],
  };
}
