import { TrendingUp } from "lucide-react";
import { AnalyticsCard, AnalyticsEmptyState } from "../components";

/* Trends: this conference against its earlier editions. A conference here is one edition, so there is no history to compare and this tab
   always shows the prototype's empty state (it only shows numbers for the prototype's sample conference). */
export default function TrendsTab() {
  return (
    <AnalyticsCard>
      <AnalyticsEmptyState icon={TrendingUp} title="No multi-year history" message="This conference doesn't have prior editions to compare against yet." />
    </AnalyticsCard>
  );
}
