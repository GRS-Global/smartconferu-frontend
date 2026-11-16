import fs from "node:fs"; import { PNG } from "pngjs";
const [tag, from, to, x0 = "288", x1 = "1440", dn = "0"] = process.argv.slice(2);
for (const k of ["proto", "next"]) {
  const p = PNG.sync.read(fs.readFileSync(`out/dd/${tag}-${k}.png`)); const w = +x1 - +x0, h = Math.min(+to, p.height) - +from;
  const o = new PNG({ width: w, height: h }); const off = k === "next" ? +dn : 0; PNG.bitblt(p, o, +x0, +from + off, w, Math.min(h, p.height - +from - off), 0, 0);
  fs.writeFileSync(`out/dd/s-${k}-${from}.png`, PNG.sync.write(o));
}
