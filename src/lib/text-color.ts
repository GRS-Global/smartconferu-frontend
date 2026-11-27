/** A colour as text: 60% of it mixed with black. Any decision colour a chair can pick then reads at 4.5:1 or better on white and on its own
 *  light tint (the plain colour may be 2:1, e.g. amber). Fills, dots and borders keep the plain colour. */
export const textColor = (color: string): string => `color-mix(in srgb, ${color} 60%, #000000)`;
