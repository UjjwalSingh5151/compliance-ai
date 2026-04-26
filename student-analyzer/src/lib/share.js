// Use VITE_APP_URL in production (set on your hosting platform).
// Falls back to window.location.origin so localhost works in dev.
export function shareUrl(token) {
  const base = import.meta.env.VITE_APP_URL || window.location.origin;
  return `${base}/#/share/${token}`;
}

export function whatsappUrl(token, studentName, testName) {
  const url = shareUrl(token);
  const text = encodeURIComponent(
    `${studentName || "Student"}'s result for ${testName || "Test"}: ${url}`
  );
  return `https://wa.me/?text=${text}`;
}
