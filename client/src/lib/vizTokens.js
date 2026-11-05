// Chart colours: hex values from the dataviz reference palette, validated with
// validate_palette.js against the white card surface (#ffffff):
//   categorical  blue, orange          → all six checks pass (CVD ΔE 24.7, normal ΔE 33.6, ≥3:1)
//   ordinal      blue 600 / 450 / 300  → monotone, ΔL ≥ 0.06, light end 2.50:1
// Change a value here only after re-running the validator.
export const VIZ = {
  surface: "#ffffff",
  ink: "#0b0b0b",
  ink2: "#52514e",
  muted: "#898781",
  grid: "#e1e0d9",
  axis: "#c3c2b7",
  hoverBand: "#f0efec",
  series: ["#2a78d6", "#eb6834"], // categorical slots 1, 2 (fixed order, never cycled)
  ordinal: ["#184f95", "#2a78d6", "#6da7ec"], // blue 600 → 450 → 300 (funnel stages)
};
