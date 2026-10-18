import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: { default: "Olympia — учись, пробуй, побеждай", template: "%s · Olympia" },
  description: "Образовательная платформа для школьных олимпиад, предметных тестов и личного прогресса.",
  applicationName: "Olympia",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body><Header /><main className="main-shell">{children}</main><Footer /></body></html>;
}
