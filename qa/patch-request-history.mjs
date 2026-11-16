import fs from "node:fs";
const f = "../src/features/conferences/components/request-detail-page.tsx"; let s = fs.readFileSync(f, "utf8");
const a = `  // The correspondence this app has: the request being sent and, for a declined one, the note from the Super Admin.
  const history: Array<{ type: "system"; text: string; at: string } | { type: "message"; from: string; to: string; at: string; text: string }> = [
    { type: "system", text: "You submitted this request", at: r.submittedAt },`;
if (!s.includes(a)) throw new Error("x");
s = s.replace(a, () => `  // The correspondence this app has: the email that confirmed the request (sent when it was submitted) and, for a declined one, the note from the Super Admin.
  const history: Array<{ type: "message"; from: string; to: string; at: string; text: string }> = [
    { type: "message", from: "Smartconferu", to: "You", at: r.submittedAt, text: \`We received your installation request for \${r.acronym} (\${r.title}). As soon as possible, our team will check it and either grant it or contact you if we need more information.\n\nThank you for using Smartconferu.\` },`);
s = s.replace(/\{history\.map\(\(h, i\) => h\.type === "system" \? \(\n\s*<p key=\{i\}[^\n]*\n\s*\) : \(\n/, () => `{history.map((h, i) => (\n`);
s = s.replace(`                    </div>\n                  ))}\n                </div>\n                <div className="mt-5 border-t border-line pt-5">`, `                    </div>\n                  ))}\n                </div>\n                <div className="mt-5 border-t border-line pt-5">`);
fs.writeFileSync(f, s); console.log("ok");
