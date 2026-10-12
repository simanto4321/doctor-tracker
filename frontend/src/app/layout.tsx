import type { Metadata } from "next";
import {
  Fraunces,
  Noto_Sans_Arabic,
  Noto_Sans_Bengali,
  Noto_Sans_Devanagari,
  Plus_Jakarta_Sans,
} from "next/font/google";
import Script from "next/script";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bengali = Noto_Sans_Bengali({
  variable: "--font-bn",
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
});

const hindi = Noto_Sans_Devanagari({
  variable: "--font-hi",
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
});

const arabic = Noto_Sans_Arabic({
  variable: "--font-ar",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Doctor Tracker",
  description: "Secure admin portal for doctors, patients, and clinical analytics.",
};

const themeBoot = `
(() => {
  try {
    const raw = localStorage.getItem('doctor-tracker-theme');
    const parsed = raw ? JSON.parse(raw) : null;
    const theme = parsed?.state?.theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  } catch (_) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${bengali.variable} ${hindi.variable} ${arabic.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <Script id="theme-boot" strategy="beforeInteractive">
          {themeBoot}
        </Script>
        <Providers>
          {children}
          <Toaster
            richColors
            position="top-center"
            closeButton
            offset={16}
            mobileOffset={12}
            toastOptions={{
              classNames: {
                toast: "!items-start",
                closeButton: "!h-10 !w-10 !left-auto !right-0 !top-0 !transform-none",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
