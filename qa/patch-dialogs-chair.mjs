// One-off edit helper: the author's paper dialogs also serve the chair of the conference (asChair): the chair need not be one of the authors, and the withdraw / files wording speaks of "the authors".
import fs from "node:fs";
const f = "../src/features/author/components/paper-dialogs.tsx";
let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 90)); return; } s = s.replace(a, () => b); n += 1; };
rep("interface CommonProps { paper: AuthorPaper; open: boolean;", "interface CommonProps { /** The chair of the conference editing the paper for its authors (not one of them). */ asChair?: boolean; paper: AuthorPaper; open: boolean;");
// authors
rep("function AuthorsForm({ paper, onClose, onSaved, onSessionEnded }: Omit<CommonProps, \"open\">) {", "function AuthorsForm({ paper, asChair = false, onClose, onSaved, onSessionEnded }: Omit<CommonProps, \"open\">) {");
rep("const meListed = rows.some((a) => mine.has(a.email.trim().toLowerCase()));", "const meListed = asChair || rows.some((a) => mine.has(a.email.trim().toLowerCase()));");
rep("<AuthorsForm paper={props.paper} onClose={props.onClose}", "<AuthorsForm paper={props.paper} asChair={props.asChair} onClose={props.onClose}");
// withdraw
rep("function WithdrawForm({ paper, registered, onClose, onSaved, onSessionEnded }: Omit<CommonProps, \"open\"> & { registered: boolean }) {", "function WithdrawForm({ paper, registered, asChair = false, onClose, onSaved, onSessionEnded }: Omit<CommonProps, \"open\"> & { registered: boolean }) {");
rep("  const message = paper.status === \"accepted\"", "  const message = asChair\n    ? `\"${paper.title}\" will be withdrawn for its authors and removed from review. The authors are emailed. This can't be undone.`\n    : paper.status === \"accepted\"");
rep('saveLabel="Withdraw submission" danger', 'saveLabel={asChair ? "Withdraw for the authors" : "Withdraw submission"} danger');
rep('<Dialog open={props.open} onClose={props.onClose} title="Withdraw this paper?" size="md">\n      <WithdrawForm paper={props.paper} registered={props.paper.result === "registered"}', '<Dialog open={props.open} onClose={props.onClose} title={props.asChair ? "Withdraw for the authors?" : "Withdraw this paper?"} size="md">\n      <WithdrawForm paper={props.paper} asChair={props.asChair} registered={props.paper.result === "registered"}');
// files
rep("description={`${props.paper.id} · replace your paper or add other documents`}", "description={`${props.paper.id} · replace ${props.asChair ? \"the\" : \"your\"} paper or add other documents`}");
fs.writeFileSync(f, s); console.log("applied", n);
