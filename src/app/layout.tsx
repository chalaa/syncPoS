import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "syncPoS",
  description: "Machinery retail POS and management system",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
