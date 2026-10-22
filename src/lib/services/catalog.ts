export const PRICE_PLACEHOLDER_LABEL = "PLACEHOLDER — Billy will confirm the real price.";

export const SERVICE_PACKAGES = [
  {
    code: "website_build",
    name: "Website build",
    kind: "website_build",
    summary: "A marketing website. This amount is a placeholder until Billy confirms the real price.",
    priceCents: 1_500_000,
  },
  {
    code: "app_build",
    name: "App build",
    kind: "app_build",
    summary: "A custom app. This amount is a placeholder until Billy confirms the real price.",
    priceCents: 4_500_000,
  },
  {
    code: "marketing_launch",
    name: "Marketing launch package",
    kind: "marketing",
    summary: "A launch marketing package. This amount is a placeholder until Billy confirms the real price.",
    priceCents: 800_000,
  },
  {
    code: "marketing_growth",
    name: "Marketing growth package",
    kind: "marketing",
    summary: "A growth marketing package. This amount is a placeholder until Billy confirms the real price.",
    priceCents: 1_800_000,
  },
] as const;

export type ServicePackageCode = (typeof SERVICE_PACKAGES)[number]["code"];

export function servicePackage(code: string) {
  return SERVICE_PACKAGES.find((item) => item.code === code) ?? null;
}

export function formatPackageZar(cents: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
