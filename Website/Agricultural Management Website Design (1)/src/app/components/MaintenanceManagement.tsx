import { useFarmData } from '../store/FarmDataProvider';
import { BookUser } from 'lucide-react';
import { BuyerRecords } from './BuyerRecords';

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

      <div className="bg-card/95 border border-border/80 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#4a2c2a]/15 flex items-center justify-center">
            <BookUser className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h3>Buyer Records</h3>
            <p className="text-sm text-muted-foreground">
              Name, contact info, address, buyer type, and purchase history for every registered buyer.
            </p>
          </div>
        </div>
        <BuyerRecords />
      </div>
    </div>
  );
}
