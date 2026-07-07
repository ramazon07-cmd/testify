import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Testify — PDFdan onlayn test",
  description: "O‘qituvchilar uchun PDF test converter platformasi",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="uz"><body><Navbar />{children}</body></html>;
}
