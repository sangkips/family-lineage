import type { Metadata } from "next";
import { Saira, Source_Sans_3 } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

// Saira carries a width axis, so caps labels can sit semi-condensed and read
// like lettering printed onto cloth.
const saira = Saira({
  variable: "--font-saira",
  subsets: ["latin"],
  axes: ["wdth"],
});

// Source Sans holds its shape at 13px on a cheap Android panel, which is what
// most of this register is read on.
const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "The Family Register",
  description:
    "Who married who, and every child of the house. Anyone can add a relative; an admin approves each entry before it appears.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${saira.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
