/**
 * ─── BRANDING CONFIG (Mobile) ────────────────────────────────────────────────
 * Mirror of student-analyzer/src/lib/branding.js
 * Keep both files in sync when changing product identity.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const BRAND = {
  productName:    "Kelzo",
  productTagline: "AI-powered answer sheet grading",
  logoEmoji:      "📝",
  supportEmail:   "support@kelzo.ai",
  companyName:    "Kelzo AI",
  websiteUrl:     "https://www.kelzo.ai",
  schoolPortalUrl:"https://app.kelzo.ai",
  appStoreUrl:    null as string | null,
  playStoreUrl:   null as string | null,
};

/** Builds a shareable result URL. Single source of truth for the app domain. */
export const shareUrl = (token: string): string =>
  `${BRAND.schoolPortalUrl}/share/${token}`;
