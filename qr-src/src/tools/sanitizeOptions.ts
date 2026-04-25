import { RequiredOptions } from "../core/QROptions";
import { Gradient } from "../types";

function sanitizeGradient(gradient: Gradient): Gradient {
  const g = { ...gradient };
  if (!g.colorStops || !g.colorStops.length) throw "Field 'colorStops' is required in gradient";
  g.rotation = g.rotation ? Number(g.rotation) : 0;
  g.colorStops = g.colorStops.map(cs => ({ ...cs, offset: Number(cs.offset) }));
  return g;
}

export default function sanitizeOptions(options: RequiredOptions): RequiredOptions {
  const o = { ...options };
  o.width = Number(o.width); o.height = Number(o.height); o.margin = Number(o.margin);
  o.imageOptions = { ...o.imageOptions, hideBackgroundDots: Boolean(o.imageOptions.hideBackgroundDots), imageSize: Number(o.imageOptions.imageSize), margin: Number(o.imageOptions.margin) };
  if (o.margin > Math.min(o.width, o.height)) o.margin = Math.min(o.width, o.height);
  o.dotsOptions = { ...o.dotsOptions };
  if (o.dotsOptions.gradient) o.dotsOptions.gradient = sanitizeGradient(o.dotsOptions.gradient);
  if (o.cornersSquareOptions) { o.cornersSquareOptions = { ...o.cornersSquareOptions }; if (o.cornersSquareOptions.gradient) o.cornersSquareOptions.gradient = sanitizeGradient(o.cornersSquareOptions.gradient); }
  if (o.cornersDotOptions) { o.cornersDotOptions = { ...o.cornersDotOptions }; if (o.cornersDotOptions.gradient) o.cornersDotOptions.gradient = sanitizeGradient(o.cornersDotOptions.gradient); }
  if (o.backgroundOptions) { o.backgroundOptions = { ...o.backgroundOptions }; if (o.backgroundOptions.gradient) o.backgroundOptions.gradient = sanitizeGradient(o.backgroundOptions.gradient); }
  return o;
}
