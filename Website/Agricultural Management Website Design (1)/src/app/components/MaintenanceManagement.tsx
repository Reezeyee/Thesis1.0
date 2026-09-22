import { useState } from 'react';
import { useFarmData } from '../store/FarmDataProvider';
import { BookUser, ShoppingBag } from 'lucide-react';
import { BuyerRecords } from './BuyerRecords';
import { BuyerOrdersManagement } from './BuyerOrdersManagement';

export function MaintenanceManagement() {
  const { loading } = useFarmData();
  const [activeTab, setActiveTab] = useState<'records' | 'buyers'>('records');

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

      <div className="flex bg-muted/40 p-1 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('records')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
            activeTab === 'records' ? 'bg-[#2d5016] text-white shadow' : 'text-muted-foreground hover:bg-[#4a2c2a]/5'
          }`}
        >
          <BookUser className="w-3.5 h-3.5" /> Buyer Records
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('buyers')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
            activeTab === 'buyers' ? 'bg-[#2d5016] text-white shadow' : 'text-muted-foreground hover:bg-[#4a2c2a]/5'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" /> Buyers
        </button>
      </div>

      {activeTab === 'records' ? (
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
      ) : (
        <BuyerOrdersManagement />
      )}
    </div>
  );
}
