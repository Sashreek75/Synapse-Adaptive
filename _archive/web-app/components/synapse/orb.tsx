import { cn } from "@/lib/utils";

/**
 * THE SYNAPSE ORB — the living center of the product.
 *
 * A calm, breathing sphere built entirely from layered CSS gradients (no image,
 * no canvas, no JS animation loop), so it's cheap to render anywhere and respects
 * prefers-reduced-motion. This is Synapse's "presence": when it's on screen, the
 * product should feel like an intelligence is here, paying attention.
 *
 *   <SynapseOrb size={120} state="thinking" />
 */
export function SynapseOrb({
  size = 96,
  state = "idle",
  className,
}: {
  size?: number;
  /** idle = slow breathing; thinking = quicker pulse + ping ring */
  state?: "idle" | "thinking";
  className?: string;
}) {
  return (
    <div
      className={cn("orb", className)}
      data-state={state}
      style={{ ["--orb" as string]: `${size}px` }}
      aria-hidden
    >
      <span className="orb-bloom" />
      <span className="orb-ring" />
      <span className="orb-core" />
      <span className="orb-sheen" />
    </div>
  );
}
