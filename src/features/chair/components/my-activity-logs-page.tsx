"use client";

import { MyActivityLogsPage } from "./activity-logs-page";

/** Author › Activity Log and Reviewer › Activity Log (one page each, see MyActivityLogsPage). */
export const AuthorActivityLogsPage = ({ slug }: { slug: string }) => <MyActivityLogsPage slug={slug} role="author" />;
export const ReviewerActivityLogsPage = ({ slug }: { slug: string }) => <MyActivityLogsPage slug={slug} role="reviewer" />;
