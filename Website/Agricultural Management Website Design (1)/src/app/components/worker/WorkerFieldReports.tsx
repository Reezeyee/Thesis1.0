import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wrench,
  Droplets,
  AlertTriangle,
  Send,
  CheckCircle2,
  Package,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { useFarmData } from '../../store/FarmDataProvider';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export function WorkerFieldReports() {
  const { state, updateState } = useFarmData();
  const { session } = useAuth();
  const workerDisplayName = session?.displayName || 'Juan Dela Cruz';

  const [reportType, setReportType] = useState<'EQUIPMENT' | 'IRRIGATION'>('EQUIPMENT');
  const [targetItem, setTargetItem] = useState('');
  const [zone, setZone] = useState('Section D');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      toast.error('Please describe the issue before submitting.');
      return;
    }

    setIsSubmitting(true);
    const nowIso = new Date().toISOString();

    try {
      await updateState((prev) => {
        if (reportType === 'EQUIPMENT') {
          const newReport = {
            reportId: `EQR-${Date.now().toString().slice(-5)}`,
            equipmentName: targetItem || 'Coffee Depulper #2',
            isWrecked: true,
            notes: notes.trim(),
            reportedAt: nowIso,
            reportedBy: workerDisplayName,
            reviewed: false,
          };
          return {
            ...prev,
            equipmentReports: [newReport, ...(prev.equipmentReports || [])],
          };
        } else {
          const newReport = {
            reportId: `IRR-${Date.now().toString().slice(-5)}`,
            zone: zone,
            sprinklerLabel: targetItem || 'Sprinkler Line D-4',
            details: notes.trim(),
            reportedAt: nowIso,
            reportedBy: workerDisplayName,
            status: 'Pending',
          };
          return {
            ...prev,
            irrigationDamageReports: [newReport, ...(prev.irrigationDamageReports || [])],
          };
        }
      });

      setIsSubmitting(false);
      setNotes('');
      setTargetItem('');
      toast.success('Field Report Submitted to Farm Admin!', {
        description: 'Thank you for keeping our equipment and fields operational.',
      });
    } catch {
      setIsSubmitting(false);
      toast.error('Failed to submit report.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-7 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-heading text-foreground">Field Issue Report</h1>
            <p className="text-xs text-muted-foreground">
              Notify farm management about damaged tools or irrigation problems
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                Report Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReportType('EQUIPMENT')}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    reportType === 'EQUIPMENT'
                      ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : 'border-border bg-background text-muted-foreground'
                  }`}
                >
                  <Wrench className="w-4 h-4" /> Equipment
                </button>
                <button
                  type="button"
                  onClick={() => setReportType('IRRIGATION')}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    reportType === 'IRRIGATION'
                      ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : 'border-border bg-background text-muted-foreground'
                  }`}
                >
                  <Droplets className="w-4 h-4" /> Irrigation / Water
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                Farm Section / Zone
              </label>
              <Select value={zone} onValueChange={setZone}>
                <SelectTrigger className="h-11 bg-background border-border rounded-xl text-xs">
                  <SelectValue placeholder="Select Zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Section D" className="text-xs">
                    Section D (South Ridge)
                  </SelectItem>
                  <SelectItem value="Section A" className="text-xs">
                    Section A (North Hill)
                  </SelectItem>
                  <SelectItem value="Section B" className="text-xs">
                    Section B (East Slope)
                  </SelectItem>
                  <SelectItem value="Section C" className="text-xs">
                    Section C (Valley Flat)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
              Equipment Name / Sprinkler Label
            </label>
            <Input
              value={targetItem}
              onChange={(e) => setTargetItem(e.target.value)}
              placeholder={
                reportType === 'EQUIPMENT'
                  ? 'e.g., Backpack Sprayer #4, Hand Pruner A'
                  : 'e.g., Sprinkler Line D-4, Main Valve 2'
              }
              className="h-11 bg-background border-border rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
              Issue Description / Notes
            </label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe the leak, broken parts, or damage observed..."
              className="bg-background border-border rounded-xl text-xs resize-none"
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-black text-sm"
          >
            <Send className="w-4 h-4 mr-2" />
            {isSubmitting ? 'Sending Report…' : 'Submit Field Report'}
          </Button>
        </form>
      </div>
    </div>
  );
}
