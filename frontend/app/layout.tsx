import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Testify — O‘quv markazlari uchun sinov operatsiyalari",
  description: "Qog‘oz va online mock testlarni tekshirish, DTM 90/189 scoring, guruh reytingi va ota-ona hisobotlari.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="uz" data-scroll-behavior="smooth"><body><a className="skip-link" href="#main-content">Asosiy qismga o‘tish</a><Navbar /><div id="main-content">{children}</div></body></html>;
}
