/**
 * Animated ambient background — slow-drifting gradient "aurora" blobs.
 * Pure CSS (GPU transforms), respects reduced-motion, sits behind content.
 */
export function AnimatedBackground({ variant = "app" }: { variant?: "app" | "hero" }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className={`absolute -left-40 -top-40 h-[42rem] w-[42rem] rounded-full blur-3xl opacity-40 sa-blob sa-blob-1 ${variant === "hero" ? "opacity-60" : ""}`} />
      <div className="absolute right-[-10rem] top-[-6rem] h-[34rem] w-[34rem] rounded-full blur-3xl opacity-30 sa-blob sa-blob-2" />
      <div className="absolute bottom-[-12rem] left-1/3 h-[38rem] w-[38rem] rounded-full blur-3xl opacity-25 sa-blob sa-blob-3" />
      <div className="absolute inset-0 bg-surface-2/40" />
    </div>
  );
}
