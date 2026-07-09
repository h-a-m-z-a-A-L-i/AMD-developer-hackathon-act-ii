/**
 * GlycoSwarm logo. Same artwork in both themes — the original mark's
 * colors (dark teal/blue) were tuned for a white surface, so in dark
 * mode we apply a CSS filter (brighter + more saturated) to the exact
 * same image rather than swapping to a different asset.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <img
      src="/glycoswarmlogo.png"
      alt="GlycoSwarm AI"
      className={`dark:[filter:brightness(1.7)_saturate(1.4)] ${className}`}
    />
  );
}
