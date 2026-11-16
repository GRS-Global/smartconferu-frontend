// Crops a band out of a QA screenshot: node crop.mjs <in.png> <out.png> <y> <h> [x] [w]
import fs from "node:fs";
import { PNG } from "pngjs";
const [inp, out, y, h, x = "0", w = "0"] = process.argv.slice(2);
const src = PNG.sync.read(fs.readFileSync(inp));
const X = Number(x), W = Number(w) || src.width - X, Y = Number(y), H = Math.min(Number(h), src.height - Y);
const dst = new PNG({ width: W, height: H });
PNG.bitblt(src, dst, X, Y, W, H, 0, 0);
fs.writeFileSync(out, PNG.sync.write(dst));
console.log("cropped", W, H, "of", src.width, src.height);
