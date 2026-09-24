import { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import "./globals.css";

export const metadata = {
  title: "FreshNest Laundry",
  description: "Laundry pickup, processing, and delivery.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
