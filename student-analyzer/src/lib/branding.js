/**
 * ─── BRANDING CONFIG ─────────────────────────────────────────────────────────
 *
 * Change product name, logo, colors, and URLs here — one file, affects
 * everything across the web app. Mobile has its own mirror at:
 *   mobile/src/lib/branding.ts
 *
 * To update:
 *   - productName       : shown in headers, page titles, emails
 *   - productTagline    : shown on landing page and auth screens
 *   - logoEmoji         : shown where a logo image isn't available yet
 *   - logoUrl           : set to your hosted logo image URL (png/svg)
 *   - supportEmail      : shown in footers and error messages
 *   - websiteUrl        : root domain
 *   - schoolPortalUrl   : where schools log in
 *   - appStoreUrl       : iOS App Store link (once published)
 *   - playStoreUrl      : Google Play link (once published)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const BRAND = {
  // ── Identity ──────────────────────────────────────────────────────────────
  productName:    "Kelzo",
  productTagline: "AI-powered answer sheet grading for schools",
  logoEmoji:      "📝",                        // fallback when no image set
  logoUrl:        null,                        // e.g. "https://cdn.kelzo.ai/logo.svg"
  faviconUrl:     null,

  // ── Contact / support ─────────────────────────────────────────────────────
  supportEmail:   "support@kelzo.ai",
  companyName:    "Kelzo AI",

  // ── URLs ──────────────────────────────────────────────────────────────────
  websiteUrl:     "https://www.kelzo.ai",
  schoolPortalUrl:"https://app.kelzo.ai",      // where schools sign in
  appStoreUrl:    null,                        // fill once published
  playStoreUrl:   null,                        // fill once published

  // ── Social ────────────────────────────────────────────────────────────────
  twitter:        null,
  linkedin:       null,
};

/** Helper — returns "ProductName" or a logo <img> tag when logoUrl is set */
export function brandLogo(style = {}) {
  if (BRAND.logoUrl) {
    return { type: "img", src: BRAND.logoUrl, alt: BRAND.productName, style };
  }
  return { type: "text", value: `${BRAND.logoEmoji} ${BRAND.productName}` };
}
