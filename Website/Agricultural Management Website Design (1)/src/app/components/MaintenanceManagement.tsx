import { useFarmData } from '../store/FarmDataProvider';
import { Map as MapIcon } from 'lucide-react';
import { BuyerLocationsMap } from './BuyerLocationsMap';

export function MaintenanceManagement() {
  const { loading } = useFarmData();

  if (loading) {
    return (
      <div className="space-y-6">
        <h1>Maintenance Module</h1>
        <p className="text-muted-foreground">Loading maintenance data from Firebase…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap gap-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-heading text-foreground">
              Maintenance & Operations
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Active Operations
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Buyer accounts, their registered pickup/business locations, and purchase history.
          </p>
        </div>
      </div>

      {/* Buyer Locations Map Block */}
      <div className="bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#4a2c2a]/15 flex items-center justify-center">
            <MapIcon className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h3>Buyer locations map</h3>
            <p className="text-sm text-muted-foreground">
              Live map plotting the mandatory location every buyer sets when they register their own account, with
              their order history and total purchases.
            </p>
          </div>
        </div>
        <BuyerLocationsMap />
      </div>
    </div>
  );
}
