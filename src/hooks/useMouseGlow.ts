import { useEffect, type RefObject } from "react";

// Drives a mouse-follow spotlight: writes the pointer position as CSS custom
// properties (--mx/--my, in percent of the element's own box) so a
// radial-gradient in CSS can track the cursor. rAF-throttled, and it seeds a
// sane default position immediately so the glow doesn't start at (0,0)
// before the first pointer move.
export function useMouseGlow(ref: RefObject<HTMLElement | null>, defaultX = 70, defaultY = 15) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--mx", `${defaultX}%`);
    el.style.setProperty("--my", `${defaultY}%`);

    let raf = 0;
    function onMove(e: MouseEvent) {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const node = ref.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        node.style.setProperty("--mx", `${x.toFixed(2)}%`);
        node.style.setProperty("--my", `${y.toFixed(2)}%`);
      });
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
