import { ClipboardList } from "lucide-react";
import { AnalyticsCard, AnalyticsEmptyState } from "../components";

export default function ReviewTab() {
  return (
    <AnalyticsCard>
      <AnalyticsEmptyState
        icon={ClipboardList}
        title="Review Analysis"
        message="Reviewer scores, review counts, and decision correlation will go here once review data is wired in."
      />
    </AnalyticsCard>
  );
}
