"use client";

import { Mail, MailOpen, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import type { AppNotification } from "@/types/notification";
import { AUDIENCE_LABEL, type Audience, type NotificationAction } from "../destinations";
import { fullWhen, whenLabel } from "../grouping";
import { kindStyle } from "../kind-style";

interface NotificationCardProps {
  item: AppNotification;
  /** Its action button (prototype: the card's primary action), when its destination is a page of this app. */
  action: NotificationAction | null;
  /** Whose notification it is: the role on the conference chip. */
  audience: Audience;
  /** An update for this row is running, or "mark all" is. */
  busy: boolean;
  onAction: () => void;
  /** An email copy's "View email" button (and what the card opens when it has no other action). */
  onViewEmail: () => void;
  onToggleRead: () => void;
  onDismiss: () => void;
}

/** One notification, as the prototype's card: the unread dot, the kind's icon, the title with its conference chip, the
 *  body, its action button, and on the right the time with the read / unread toggle and Dismiss. Clicking the card (not one
 *  of its buttons) does its action, when it has one. Titles and bodies are stored text and are rendered as text only. */
export function NotificationCard({ item, action, audience, busy, onAction, onViewEmail, onToggleRead, onDismiss }: NotificationCardProps) {
  const { icon: Icon, className: tile } = kindStyle(item.kind);
  // The time label ("Just now", "12 min ago") is read again every minute, so an open page never shows a stale age.
  const [, setMinute] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setMinute((m) => m + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  const titleId = `notification-${item.id}`;
  const toggle = item.read ? "Mark as unread" : "Mark as read";
  const isEmail = !!item.email;
  // The prototype's card does its page action; an email with nowhere to go opens the email.
  const clickable = !!action || isEmail;
  const secondary = "rounded-lg border border-line bg-white px-3 py-1.5 text-[12.5px] font-bold text-navy transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60";
  const primary = "rounded-lg bg-primary px-3 py-1.5 text-[12.5px] font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60";
  return (
    <article
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
      onClick={(e) => {
        if (busy || (e.target as HTMLElement).closest("button, a, input, select")) return;
        if (action) onAction();
        else if (isEmail) onViewEmail();
      }}
      className={cn(
        "flex gap-3 border-b border-muted px-4 py-4 transition-colors last:border-b-0 hover:bg-canvas sm:gap-3.5 sm:px-5",
        item.read ? "bg-white" : "bg-[#FAFAFF]",
        clickable && "cursor-pointer",
      )}
    >
      <span aria-hidden="true" className={cn("mt-4 h-2 w-2 shrink-0 rounded-full", item.read ? "bg-transparent" : "bg-primary")} />
      <span aria-hidden="true" className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tile)}><Icon size={18} /></span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={titleId} className={cn("break-words text-sm", item.read ? "font-bold text-ink" : "font-extrabold text-navy")}>
            {!item.read && <span className="sr-only">Unread: </span>}
            {item.title}
          </h3>
          {item.conference && (
            <span className="inline-flex items-center rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">
              {item.conference.acronym} · {AUDIENCE_LABEL[audience]}
            </span>
          )}
        </div>
        {item.email && <div className="text-xs text-ink-muted">From {item.email.from}</div>}
        {item.body && <p className={cn("break-words text-[13px] leading-relaxed text-ink-soft", isEmail ? "line-clamp-2" : "whitespace-pre-line")}>{item.body}</p>}
        {(action || isEmail) && (
          <div className="mt-1.5 flex flex-wrap gap-2">
            {action && (
              <button type="button" onClick={onAction} disabled={busy} className={primary}>
                {action.label}
                <span className="sr-only">: {item.title}</span>
              </button>
            )}
            {isEmail && (
              <button type="button" onClick={onViewEmail} disabled={busy} className={action ? secondary : primary}>
                View email
                <span className="sr-only">: {item.title}</span>
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <time dateTime={item.createdAt} title={fullWhen(item.createdAt)} className="whitespace-nowrap text-xs text-ink-faint">{whenLabel(item.createdAt)}</time>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onToggleRead}
            disabled={busy}
            aria-label={`${toggle}: ${item.title}`}
            title={toggle}
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-canvas hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {item.read ? <MailOpen size={14} aria-hidden="true" /> : <Mail size={14} aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            disabled={busy}
            aria-label={`Dismiss: ${item.title}`}
            title="Dismiss"
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-canvas hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
