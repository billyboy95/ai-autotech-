import type { Metadata, Viewport } from "next";
import { Montserrat, Poppins } from "next/font/google";
import Script from "next/script";
import { resolveRequestBrand } from "@/lib/brand/request";
import { PWA_THEME_COLOR } from "@/lib/pwa/manifest";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const viewport: Viewport = {
  themeColor: PWA_THEME_COLOR,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

function installShell(appleTitle: string): Metadata {
  return {
    applicationName: appleTitle,
    appleWebApp: {
      capable: true,
      title: appleTitle,
      statusBarStyle: "default",
    },
    icons: {
      icon: [
        { url: "/icons/aios-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/aios-512.png", sizes: "512x512", type: "image/png" },
        { url: "/icons/aios.svg", type: "image/svg+xml" },
      ],
      apple: "/icons/apple-touch-icon.png",
    },
    other: {
      "mobile-web-app-capable": "yes",
      "apple-mobile-web-app-capable": "yes",
    },
  };
}

const platformMetadata: Metadata = {
  ...installShell("AIOS"),
  metadataBase: new URL("https://ai-autotech.co.za"),
  title: {
    default: "AI AutoTech",
    template: "%s | AI AutoTech",
  },
  description:
    "AI AutoTech is a premium operating system for automation, CRM, AI agents, projects, proposals, invoices, and client portals.",
  openGraph: {
    title: "AI AutoTech",
    description:
      "Automation, AI, software, and digital transformation for South African SMEs.",
    url: "https://ai-autotech.co.za",
    siteName: "AI AutoTech",
    locale: "en_ZA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI AutoTech",
    description:
      "A scalable internal operating system evolving into a client-facing SaaS platform.",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const brand = await resolveRequestBrand();
  if (!brand || brand.showPlatformName) return platformMetadata;
  const description = `${brand.productName} workspace.`;
  return {
    ...installShell(brand.productName),
    title: {
      default: brand.productName,
      template: `%s | ${brand.productName}`,
    },
    description,
    openGraph: {
      title: brand.productName,
      description,
      siteName: brand.productName,
      locale: "en_ZA",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: brand.productName,
      description,
    },
    robots: { index: false, follow: false },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

  return (
    <html lang="en" className={`${montserrat.variable} ${poppins.variable}`}>
      <body>
        {children}
        {gaId ? (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        ) : null}
        {metaPixelId ? (
          <Script id="meta-pixel" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
              n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
              (window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${metaPixelId}');
              fbq('track', 'PageView');
            `}
          </Script>
        ) : null}
        {clarityId ? (
          <Script id="microsoft-clarity" strategy="afterInteractive">
            {`
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "${clarityId}");
            `}
          </Script>
        ) : null}
      </body>
    </html>
  );
}
