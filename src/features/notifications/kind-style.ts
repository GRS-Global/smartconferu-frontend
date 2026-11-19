import { Award, Check, Clock, FileText, FileUp, Mail, MapPin, Megaphone, Pencil, Send, ShieldCheck, UserMinus, UserPlus, X, type LucideIcon } from "lucide-react";

/* The icon tile of each kind — the prototype's KIND_META (src/author-module/NotificationsPage.jsx), entry for entry, so
   a kind the database starts writing later already has its tile. Kinds the prototype has no entry for (new_submission,
   invitation_answer, assignment_declined, conference_decision, conference_request, anything unknown) get its default,
   the announcement tile. */

interface KindStyle { icon: LucideIcon; className: string }

const PRIMARY = "bg-primary-soft text-primary";
const AMBER = "bg-[#FFF4E5] text-[#B45309]";
const WARNING = "bg-warning-soft text-warning";
const NEUTRAL = "bg-muted text-ink-soft";
const SUCCESS = "bg-success-soft text-[#15803D]";
const DANGER = "bg-danger-soft text-danger";

const STYLES: Record<string, KindStyle> = {
  accepted: { icon: Check, className: SUCCESS },
  room: { icon: MapPin, className: "bg-warning-soft text-[#B45309]" },
  final: { icon: FileUp, className: PRIMARY },
  certificate: { icon: Award, className: "bg-primary text-white" },
  changes: { icon: FileText, className: WARNING },
  announcement: { icon: Megaphone, className: NEUTRAL },
  cfp: { icon: Send, className: NEUTRAL },
  review: { icon: FileText, className: PRIMARY },
  invite: { icon: UserPlus, className: PRIMARY },
  reminder: { icon: Clock, className: WARNING },
  extension: { icon: Clock, className: WARNING },
  extension_request: { icon: Clock, className: WARNING },
  extension_answer: { icon: Clock, className: WARNING },
  extension_decision: { icon: Clock, className: WARNING },
  due_date_changed: { icon: Clock, className: WARNING },
  reviewer_message: { icon: Mail, className: PRIMARY },
  assignment_removed: { icon: UserMinus, className: NEUTRAL },
  fix_requested: { icon: FileText, className: WARNING },
  review_submitted: { icon: FileText, className: PRIMARY },
  license_decision: { icon: Clock, className: WARNING },
  "review-edited": { icon: Pencil, className: NEUTRAL },
  review_edited: { icon: Pencil, className: NEUTRAL },
  decision: { icon: Check, className: SUCCESS },
  declined: { icon: X, className: DANGER },
  review_reminder: { icon: Clock, className: WARNING },
  withdrawn: { icon: X, className: DANGER },
  coauthor_added: { icon: UserPlus, className: PRIMARY },
  member_invited: { icon: UserPlus, className: PRIMARY },
  review_assigned: { icon: FileText, className: PRIMARY },
  screening: { icon: ShieldCheck, className: AMBER },
  new_version: { icon: ShieldCheck, className: AMBER },
  unassigned: { icon: UserMinus, className: NEUTRAL },
  email: { icon: Mail, className: PRIMARY },
  plagiarism: { icon: ShieldCheck, className: AMBER },
};

const FALLBACK: KindStyle = STYLES.announcement;

export function kindStyle(kind: string): KindStyle {
  return Object.prototype.hasOwnProperty.call(STYLES, kind) ? STYLES[kind] : FALLBACK;
}
