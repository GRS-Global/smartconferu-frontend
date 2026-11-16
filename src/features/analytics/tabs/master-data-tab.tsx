import { Database } from "lucide-react";
import { AnalyticsCard, AnalyticsEmptyState } from "../components";

/* Master Data: matching authors and organisations against a shared cross-conference master database. The database has no such data, so this tab
   always shows the prototype's empty state (it only shows numbers for the prototype's sample conference). */
export default function MasterDataTab() {
  return (
    <AnalyticsCard>
      <AnalyticsEmptyState icon={Database} title="No master data" message="This conference doesn't have identity-resolution data to match against a shared master database." />
    </AnalyticsCard>
  );
}
