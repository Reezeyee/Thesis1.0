import { useFarmData } from '../store/FarmDataProvider';
import { Hammer } from 'lucide-react';

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
      <div className="pb-2 border-b border-border/60">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-heading text-foreground">
          Maintenance & Operations
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Field logs and maintenance tracking.</p>
      </div>

      <div className="bg-card/95 border border-border/80 rounded-xl p-10 shadow-sm flex flex-col items-center justify-center text-center gap-2">
        <div className="w-12 h-12 rounded-lg bg-[#4a2c2a]/15 flex items-center justify-center">
          <Hammer className="w-6 h-6 text-foreground" />
        </div>
        <p className="text-sm font-semibold text-foreground">Nothing here yet</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          Maintenance content is being set up. (The buyer locations map that used to live here has moved to the
          Nearby Buyers module.)
        </p>
      </div>
    </div>
  );
}
