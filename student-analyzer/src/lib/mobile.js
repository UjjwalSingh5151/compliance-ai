import { useState, useEffect } from "react";

export function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 680);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 680);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mobile;
}
