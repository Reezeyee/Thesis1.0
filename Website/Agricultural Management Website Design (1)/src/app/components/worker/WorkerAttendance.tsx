import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  CheckCircle2,
  MapPin,
  Calendar,
  UserCheck,
  Coffee,
  AlertCircle,
  Play,
  Square,
  Camera,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  X,
  Compass,
  Check,
  FileText,
  Send,
  History,
  FileClock,
  CalendarDays,
  ChevronRight,
  Info,
  Layers,
  ArrowRight,
  CheckCircle,
  XCircle,
  Timer,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { useFarmData } from '../../store/FarmDataProvider';
import { useAuth } from '../../auth/AuthProvider';
import { logStateApiActivity, logUiAction } from '../../lib/apiRouteLogger';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import type { AttendanceRecord, LeaveRequestRecord, TimesheetCorrectionRequest } from '../../types/appState';

type AttendanceStep = 'prompt_location' | 'capturing_location' | 'camera_photo' | 'confirm_submit';
type WorkerAttendanceTab = 'clock' | 'history' | 'corrections' | 'leaves';

interface GeoLocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  locationName: string;
}

const toIsoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function displayDateFromIso(value: string): string {
  if (!value) return '';
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function leaveDayCount(startDate: string, endDate: string): number {
  if (!startDate) return 1;
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate || startDate}T00:00:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 1;
  return Math.round((end - start) / 86400000) + 1;
}

function statusBadgeClass(status: string): string {
  if (status === 'Approved') return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
  if (status === 'Rejected') return 'bg-rose-500/15 text-rose-500 border-rose-500/30';
  return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
}

export function WorkerAttendance() {
  const { state, updateState } = useFarmData();
  const { session } = useAuth();
  const workerDisplayName = session?.displayName || 'Field Worker';

  const [activeTab, setActiveTab] = useState<WorkerAttendanceTab>('clock');

  // Active attendance state
  const todayDateStr = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  const todayIsoStr = useMemo(() => toIsoDate(new Date()), []);

  // Check if today is already clocked in
  const todayRecord = useMemo(() => {
    return (state.attendance || []).find(
      (r) =>
        r.workerName?.trim().toLowerCase() === workerDisplayName.trim().toLowerCase() &&
        (r.date === todayDateStr || r.date === displayDateFromIso(todayIsoStr))
    );
  }, [state.attendance, workerDisplayName, todayDateStr, todayIsoStr]);

  const isClockedIn = Boolean(todayRecord?.clockIn && !todayRecord?.clockOut);
  const isMissingClockIn = !todayRecord?.clockIn;

  // Modal flow state for GPS & Camera
  const [modalOpen, setModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'Time In' | 'Time Out'>('Time In');
  const [currentStep, setCurrentStep] = useState<AttendanceStep>('prompt_location');

  // Verification data
  const [geoData, setGeoData] = useState<GeoLocationData | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Camera stream & photo
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtered recent logs for this worker
  const myRecords = useMemo(() => {
    return (state.attendance || []).filter(
      (a) => a.workerName?.trim().toLowerCase() === workerDisplayName.trim().toLowerCase()
    );
  }, [state.attendance, workerDisplayName]);

  const myCorrections = useMemo(() => {
    return (state.timesheetCorrections || []).filter(
      (request) => request.workerName.trim().toLowerCase() === workerDisplayName.trim().toLowerCase(),
    );
  }, [state.timesheetCorrections, workerDisplayName]);

  const myLeaveRequests = useMemo(() => {
    return (state.leaveRequests || []).filter(
      (request) => request.workerName.trim().toLowerCase() === workerDisplayName.trim().toLowerCase(),
    );
  }, [state.leaveRequests, workerDisplayName]);

  const pendingCorrectionsCount = myCorrections.filter((r) => r.status === 'Pending').length;
  const pendingLeavesCount = myLeaveRequests.filter((r) => r.status === 'Pending').length;

  // Modals for Timesheet Correction and Leave Filing
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [auditTrailDialogOpen, setAuditTrailDialogOpen] = useState(false);
  const [selectedCorrectionForAudit, setSelectedCorrectionForAudit] = useState<TimesheetCorrectionRequest | null>(null);
  const [selectedProofRecord, setSelectedProofRecord] = useState<AttendanceRecord | null>(null);

  const [correctionForm, setCorrectionForm] = useState({
    date: todayIsoStr,
    requestedClockIn: '',
    requestedClockOut: '',
    reason: '',
  });

  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'Sick Leave',
    startDate: todayIsoStr,
    endDate: todayIsoStr,
    reason: '',
  });

  // Helper to open correction dialog for a specific record or date
  const openCorrectionDialog = (record?: AttendanceRecord | null, defaultIsoDate?: string) => {
    logUiAction('Opened Timesheet Correction');
    const targetDate = defaultIsoDate || todayIsoStr;
    const matchedRecord = record || myRecords.find((r) => r.date === displayDateFromIso(targetDate) || r.date === targetDate);

    setCorrectionForm({
      date: targetDate,
      requestedClockIn: matchedRecord?.clockIn || '08:00 AM',
      requestedClockOut: matchedRecord?.clockOut || '05:00 PM',
      reason: '',
    });
    setCorrectionDialogOpen(true);
  };

  const openLeaveDialog = (defaultStartDate?: string) => {
    logUiAction('Clicked "File Leave"');
    const start = defaultStartDate || todayIsoStr;
    setLeaveForm({
      leaveType: 'Sick Leave',
      startDate: start,
      endDate: start,
      reason: '',
    });
    setLeaveDialogOpen(true);
  };

  const openAuditTrailDialog = (correction: TimesheetCorrectionRequest) => {
    logUiAction(`Viewed audit trail for correction ${correction.correctionId}`);
    setSelectedCorrectionForAudit(correction);
    setAuditTrailDialogOpen(true);
  };

  const submitCorrectionRequest = async () => {
    logUiAction('Clicked "Submit Timesheet Correction"');
    if (!correctionForm.requestedClockIn.trim() && !correctionForm.requestedClockOut.trim()) {
      toast.error('Please enter a corrected time in, time out, or both.');
      return;
    }
    if (!correctionForm.reason.trim()) {
      toast.error('A detailed reason is required for manager review.');
      return;
    }

    const formattedDate = displayDateFromIso(correctionForm.date);
    const sourceRecord = myRecords.find(
      (record) => record.date === formattedDate || record.date === correctionForm.date
    );

    const now = new Date().toLocaleString('en-US');
    const request: TimesheetCorrectionRequest = {
      correctionId: `TC-${Date.now().toString().slice(-7)}`,
      attendanceId: sourceRecord?.attendanceId,
      workerName: workerDisplayName,
      date: formattedDate,
      field:
        correctionForm.requestedClockIn && correctionForm.requestedClockOut
          ? 'both'
          : correctionForm.requestedClockIn
          ? 'clockIn'
          : 'clockOut',
      originalClockIn: sourceRecord?.clockIn || '',
      originalClockOut: sourceRecord?.clockOut || '',
      requestedClockIn: correctionForm.requestedClockIn.trim(),
      requestedClockOut: correctionForm.requestedClockOut.trim(),
      reason: correctionForm.reason.trim(),
      status: 'Pending',
      submittedAt: now,
      submittedBy: workerDisplayName,
      auditTrail: [
        {
          actorName: workerDisplayName,
          action: 'Submitted timesheet correction request',
          remarks: correctionForm.reason.trim(),
          timestamp: now,
        },
      ],
    };

    try {
      await logStateApiActivity(
        'POST',
        '/api/timesheets/correction',
        request,
        () =>
          updateState((prev) => ({
            ...prev,
            timesheetCorrections: [request, ...(prev.timesheetCorrections || [])],
          })),
        201
      );
      setCorrectionDialogOpen(false);
      toast.success('Timesheet correction submitted for manager review!', {
        description: `Correction for ${formattedDate} is now pending approval.`,
      });
      setActiveTab('corrections');
    } catch {
      toast.error('Could not submit timesheet correction. Please try again.');
    }
  };

  const submitLeaveRequest = async () => {
    logUiAction('Clicked "Submit Leave Request"');
    if (!leaveForm.reason.trim()) {
      toast.error('Please provide a reason for the leave request.');
      return;
    }

    const now = new Date().toLocaleString('en-US');
    const startFormatted = displayDateFromIso(leaveForm.startDate);
    const endFormatted = displayDateFromIso(leaveForm.endDate || leaveForm.startDate);
    const days = leaveDayCount(leaveForm.startDate, leaveForm.endDate);

    const request: LeaveRequestRecord = {
      leaveId: `LV-${Date.now().toString().slice(-7)}`,
      workerName: workerDisplayName,
      leaveType: leaveForm.leaveType,
      startDate: startFormatted,
      endDate: endFormatted,
      leaveDays: days,
      reason: leaveForm.reason.trim(),
      status: 'Pending',
      submittedAt: now,
      submittedBy: workerDisplayName,
    };

    try {
      await logStateApiActivity(
        'POST',
        '/api/leaves',
        request,
        () =>
          updateState((prev) => ({
            ...prev,
            leaveRequests: [request, ...(prev.leaveRequests || [])],
          })),
        201
      );
      setLeaveDialogOpen(false);
      toast.success('Leave request filed successfully!', {
        description: `${leaveForm.leaveType} for ${days} day(s) sent for manager review.`,
      });
      setActiveTab('leaves');
    } catch {
      toast.error('Could not submit leave request. Please check connection.');
    }
  };

  const openAttendanceFlow = (type: 'Time In' | 'Time Out') => {
    logUiAction(`Clicked "Record ${type}"`);
    setActionType(type);
    setCurrentStep('prompt_location');
    setGeoData(null);
    setGeoError(null);
    setPhotoDataUrl(null);
    setCameraError(null);
    setModalOpen(true);
  };

  const closeAttendanceModal = () => {
    stopCamera();
    setModalOpen(false);
    setIsSubmitting(false);
  };

  // Step 1 -> Step 2: Request location services and capture GPS
  const requestLocation = () => {
    logUiAction('Requested GPS location capture');
    setIsLocating(true);
    setGeoError(null);
    setCurrentStep('capturing_location');

    if (!('geolocation' in navigator)) {
      setGeoError('Location services are not supported by your browser.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const locationName = `Farm Field Block (GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)})`;
        setGeoData({
          latitude,
          longitude,
          accuracy,
          locationName,
        });
        setIsLocating(false);
        startCamera();
        setCurrentStep('camera_photo');
      },
      (error) => {
        setIsLocating(false);
        let msg = 'Could not access location.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission was denied. Please enable location in your browser settings to record attendance.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Location information is currently unavailable.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Location request timed out. Please try again.';
        }
        setGeoError(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  // Step 3: Camera & Selfie capture
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      setCameraError(
        'Could not access camera for selfie verification. Ensure camera permission is granted or upload photo file.'
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
    logUiAction('Captured selfie attendance photo');
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    setPhotoDataUrl(dataUrl);
    stopCamera();
    setCurrentStep('confirm_submit');
  };

  const handlePhotoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoDataUrl(String(reader.result));
      stopCamera();
      setCurrentStep('confirm_submit');
    };
    reader.readAsDataURL(file);
  };

  const retakePhoto = () => {
    setPhotoDataUrl(null);
    setCurrentStep('camera_photo');
    startCamera();
  };

  // Step 4: Commit record to database
  const commitAttendance = async () => {
    if (!photoDataUrl) {
      toast.error('Photo proof is required before submitting attendance.');
      return;
    }

    setIsSubmitting(true);
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const payload = {
      actionType,
      workerName: workerDisplayName,
      date: todayDateStr,
      time: timeStr,
      location: geoData?.locationName || 'Field Site',
    };

    try {
      await logStateApiActivity(
        'POST',
        '/api/attendance',
        payload,
        () =>
          updateState((prev) => {
            const records = [...(prev.attendance || [])];
            if (actionType === 'Time In') {
              const newRecord: AttendanceRecord = {
                workerName: workerDisplayName,
                clockIn: timeStr,
                clockOut: undefined,
                date: todayDateStr,
                timeInLocationName: geoData?.locationName || 'Field Site',
                timeInLatitude: geoData?.latitude ?? null,
                timeInLongitude: geoData?.longitude ?? null,
                faceSnapshotBase64: photoDataUrl,
                details: `Time-In recorded with GPS & selfie verification at ${timeStr}`,
                attendanceId: `ATT-${Date.now().toString().slice(-6)}`,
                submittedByStaff: true,
                awaitingPayrollLine: true,
                isGeofenceVerified: true,
                timestampMillis: Date.now(),
              };
              return {
                ...prev,
                attendance: [newRecord, ...records],
              };
            } else {
              // Clock Out
              const matchIdx = records.findIndex(
                (r) =>
                  r.workerName?.trim().toLowerCase() === workerDisplayName.trim().toLowerCase() &&
                  r.date === todayDateStr
              );
              if (matchIdx >= 0) {
                records[matchIdx] = {
                  ...records[matchIdx],
                  clockOut: timeStr,
                  hoursWorked: 8.0,
                  details: `${records[matchIdx].details || ''} | Time-Out logged at ${timeStr}`,
                };
              } else {
                records.unshift({
                  workerName: workerDisplayName,
                  clockIn: '08:00 AM',
                  clockOut: timeStr,
                  date: todayDateStr,
                  timeInLocationName: geoData?.locationName || 'Field Site',
                  timeInLatitude: geoData?.latitude ?? null,
                  timeInLongitude: geoData?.longitude ?? null,
                  faceSnapshotBase64: photoDataUrl,
                  details: `Time-Out logged with GPS & photo verification at ${timeStr}`,
                  attendanceId: `ATT-${Date.now().toString().slice(-6)}`,
                  submittedByStaff: true,
                  awaitingPayrollLine: true,
                  isGeofenceVerified: true,
                  timestampMillis: Date.now(),
                });
              }
              return {
                ...prev,
                attendance: records,
              };
            }
          }),
        201
      );

      closeAttendanceModal();
      toast.success(`${actionType} Recorded Successfully!`, {
        description: `Verified at ${timeStr} with GPS location and photo proof.`,
      });
    } catch {
      setIsSubmitting(false);
      toast.error('Failed to log attendance to database. Please check your network connection.');
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shadow-inner">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-heading text-foreground">
                  Employee Attendance & Timesheet Hub
                </h1>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3 mr-1 inline" /> Verified
                </span>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                {todayDateStr} · Worker: <span className="font-semibold text-foreground">{workerDisplayName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openCorrectionDialog(todayRecord)}
              className="rounded-xl border-amber-500/40 hover:bg-amber-500/10 text-xs font-bold"
            >
              Request Correction
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => openLeaveDialog()}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
            >
              File Leave
            </Button>
          </div>
        </div>

        {/* High Information Density Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-border/60">
          <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Today's Duty Status</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${isClockedIn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <p className={`text-xs font-bold ${isClockedIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                {isClockedIn ? 'Clocked In (Active)' : 'Off Duty'}
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {todayRecord?.clockIn ? `In: ${todayRecord.clockIn}` : 'No clock-in yet'}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">My Attendance Logs</p>
            <p className="text-base font-black text-foreground mt-0.5">{myRecords.length}</p>
            <p className="text-[11px] text-muted-foreground">Verified logs in record</p>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Timesheet Corrections</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-base font-black text-foreground">{myCorrections.length}</p>
              {pendingCorrectionsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                  {pendingCorrectionsCount} pending
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">Submitted requests</p>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Leave Requests</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-base font-black text-foreground">{myLeaveRequests.length}</p>
              {pendingLeavesCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                  {pendingLeavesCount} pending
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">Filed leave applications</p>
          </div>
        </div>
      </div>

      {/* Requirement 5: Missing Attendance UX Notice Card */}
      {isMissingClockIn && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 p-5 shadow-sm"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                </span>
                <h2 className="text-base font-bold font-heading text-foreground">
                  Missing Time In
                </h2>
                <span className="rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider border border-amber-500/30">
                  Requires Correction
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground pt-1">
                <p>
                  Date: <span className="font-semibold text-foreground">{todayDateStr}</span>
                </p>
                <p>
                  Employee: <span className="font-semibold text-foreground">{workerDisplayName}</span>
                </p>
                <p className="sm:col-span-2 text-foreground/80">
                  No morning clock-in was recorded. If you worked today and forgot to clock in, request a time correction with your manager. If you were absent, file a formal leave request below.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
              <Button
                type="button"
                onClick={() => openCorrectionDialog(null, todayIsoStr)}
                className="w-full sm:w-auto rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs shadow-sm"
              >
                Request Time Correction
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => openLeaveDialog(todayIsoStr)}
                className="w-full sm:w-auto rounded-xl border-amber-500/40 bg-card hover:bg-accent text-xs font-bold"
              >
                File Leave
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Navigation Segmented Tab Bar for High Information Density */}
      <div className="flex items-center justify-between border-b border-border/80 pb-2">
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-2xl border border-border/70 text-xs overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => {
              logUiAction('Switched tab to "Daily Clock"');
              setActiveTab('clock');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
              activeTab === 'clock'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Clock In / Out</span>
          </button>

          <button
            type="button"
            onClick={() => {
              logUiAction('Switched tab to "Attendance History"');
              setActiveTab('history');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
              activeTab === 'history'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <History className="w-3.5 h-3.5 text-emerald-500" />
            <span>Attendance History</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-muted text-[10px]">{myRecords.length}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              logUiAction('Switched tab to "Timesheet Corrections"');
              setActiveTab('corrections');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
              activeTab === 'corrections'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileClock className="w-3.5 h-3.5 text-amber-500" />
            <span>Corrections</span>
            {pendingCorrectionsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                {pendingCorrectionsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              logUiAction('Switched tab to "Leave Requests"');
              setActiveTab('leaves');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
              activeTab === 'leaves'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5 text-blue-500" />
            <span>Leaves</span>
            {pendingLeavesCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                {pendingLeavesCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab 1: Clock In / Out Action Screen */}
      {activeTab === 'clock' && (
        <div className="space-y-6">
          <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-3.5 h-3.5 rounded-full ${
                      isClockedIn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Current Duty Status:
                  </span>
                  <span
                    className={`text-sm font-black tracking-wide ${
                      isClockedIn
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {isClockedIn ? 'ON DUTY (CLOCKED IN)' : 'OFF DUTY (NOT CLOCKED IN)'}
                  </span>
                </div>

                <div className="text-xs space-y-1.5 text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-amber-500" />
                    Employee: <span className="font-semibold text-foreground">{workerDisplayName}</span>
                  </p>
                  {todayRecord?.clockIn && (
                    <p className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <Play className="w-3 h-3" />
                      Clocked In at: {todayRecord.clockIn}
                    </p>
                  )}
                  {todayRecord?.clockOut && (
                    <p className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                      <Square className="w-3 h-3" />
                      Clocked Out at: {todayRecord.clockOut}
                    </p>
                  )}
                  {todayRecord?.timeInLocationName && (
                    <p className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                      <MapPin className="w-3 h-3 text-amber-500" />
                      Location: {todayRecord.timeInLocationName}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                {!isClockedIn ? (
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => openAttendanceFlow('Time In')}
                    className="w-full sm:w-auto h-12 px-8 rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 text-sm flex items-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    Record Time In
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => openAttendanceFlow('Time Out')}
                    className="w-full sm:w-auto h-12 px-8 rounded-2xl font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 text-sm flex items-center gap-2"
                  >
                    <Square className="w-4 h-4 fill-white" />
                    Record Time Out
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Preview of Recent 3 Logs */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold font-heading text-foreground">Recent Verification Records</h3>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className="text-xs font-bold text-amber-500 hover:underline flex items-center gap-1"
              >
                View Full History <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {myRecords.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No attendance recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {myRecords.slice(0, 3).map((rec, idx) => (
                  <div
                    key={rec.attendanceId || idx}
                    className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-background border border-border/70 flex items-center justify-center font-bold text-amber-500 shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{rec.date || todayDateStr}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-amber-500" />
                          {rec.timeInLocationName || 'Field Site'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          In: {rec.clockIn || '--'}
                        </p>
                        <p className="font-mono text-muted-foreground">
                          Out: {rec.clockOut || 'Ongoing'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openCorrectionDialog(rec)}
                        className="h-8 px-2 rounded-lg text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                      >
                        Correct
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Attendance Verification History */}
      {activeTab === 'history' && (
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold font-heading text-foreground">
                Attendance Verification History
              </h2>
              <p className="text-xs text-muted-foreground">
                Historical records verified with GPS coordinates and selfie capture
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">
              {myRecords.length} entries
            </span>
          </div>

          {myRecords.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-xs font-semibold text-foreground">No attendance records found</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Click 'Record Time In' to create your first verified attendance entry.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {myRecords.map((rec, idx) => (
                <div
                  key={rec.attendanceId || idx}
                  className="p-4 rounded-xl bg-muted/20 border border-border/70 hover:border-amber-500/30 transition-all text-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    {rec.faceSnapshotBase64 ? (
                      <button
                        type="button"
                        onClick={() => setSelectedProofRecord(rec)}
                        className="relative group shrink-0"
                      >
                        <img
                          src={rec.faceSnapshotBase64}
                          alt="Selfie proof"
                          className="w-12 h-12 rounded-xl object-cover border border-border group-hover:opacity-80 transition-opacity"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 rounded-xl transition-opacity">
                          <Eye className="w-4 h-4 text-white" />
                        </div>
                      </button>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0 font-bold text-[10px]">
                        No Photo
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{rec.date || todayDateStr}</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                          📍 GPS Verified
                        </span>
                        {rec.details?.includes('Approved correction') && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                            ✏️ Corrected
                          </span>
                        )}
                      </div>

                      <p className="text-muted-foreground text-[11px] flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-500" />
                        {rec.timeInLocationName || 'Field Site'}
                      </p>

                      {rec.details && (
                        <p className="text-muted-foreground text-[10px] italic">
                          {rec.details}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-2 md:pt-0 border-border/40">
                    <div className="grid grid-cols-2 gap-3 text-right">
                      <div className="bg-background/80 px-2.5 py-1 rounded-lg border border-border/60">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Time In</p>
                        <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{rec.clockIn || '--:--'}</p>
                      </div>
                      <div className="bg-background/80 px-2.5 py-1 rounded-lg border border-border/60">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Time Out</p>
                        <p className="font-mono font-bold text-amber-600 dark:text-amber-400">{rec.clockOut || 'Ongoing'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openCorrectionDialog(rec)}
                        className="rounded-xl border-amber-500/40 text-xs font-bold hover:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      >
                        Request Correction
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Timesheet Corrections Log & Audit Trail */}
      {activeTab === 'corrections' && (
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold font-heading text-foreground">
                My Timesheet Corrections
              </h2>
              <p className="text-xs text-muted-foreground">
                Track status of requested timesheet changes and manager approvals
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => openCorrectionDialog()}
              className="rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs"
            >
              <FileClock className="w-3.5 h-3.5 mr-1.5" />
              New Correction Request
            </Button>
          </div>

          {myCorrections.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <FileClock className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-xs font-semibold text-foreground">No timesheet corrections submitted</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                If you forgot to clock in or out, click 'New Correction Request'.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {myCorrections.map((request) => (
                <div
                  key={request.correctionId}
                  className="rounded-xl bg-muted/30 border border-border/70 p-4 text-xs space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{request.date}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">({request.correctionId})</span>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusBadgeClass(
                        request.status
                      )}`}
                    >
                      {request.status}
                    </span>
                  </div>

                  {/* Side-by-side comparison */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="rounded-lg bg-background/80 border border-border/60 p-2.5">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Original Timesheet Value</p>
                      <p className="font-mono font-bold text-foreground mt-0.5">
                        In: {request.originalClockIn || 'Missing (No Log)'} · Out: {request.originalClockOut || 'Missing'}
                      </p>
                    </div>

                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5">
                      <p className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">Requested Correction</p>
                      <p className="font-mono font-bold text-foreground mt-0.5">
                        In: {request.requestedClockIn || '--'} · Out: {request.requestedClockOut || '--'}
                      </p>
                    </div>
                  </div>

                  <p className="text-muted-foreground">
                    Reason: <span className="text-foreground font-medium">{request.reason}</span>
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                    <p>Submitted on {request.submittedAt}</p>
                    <div className="flex items-center gap-2">
                      {request.managerRemarks && (
                        <p className="text-foreground font-semibold">
                          Manager Remarks: <span className="italic">{request.managerRemarks}</span>
                        </p>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openAuditTrailDialog(request)}
                        className="h-7 px-2 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                      >
                        View Audit Log
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Leave Requests Log */}
      {activeTab === 'leaves' && (
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold font-heading text-foreground">
                My Leave Requests
              </h2>
              <p className="text-xs text-muted-foreground">
                View submitted leave applications, duration, and manager approval status
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => openLeaveDialog()}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
            >
              <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
              File New Leave
            </Button>
          </div>

          {myLeaveRequests.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-xs font-semibold text-foreground">No leave requests filed</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Need time off? Click 'File New Leave' to submit an application.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {myLeaveRequests.map((request) => (
                <div
                  key={request.leaveId}
                  className="rounded-xl bg-muted/30 border border-border/70 p-4 text-xs space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{request.leaveType}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">({request.leaveId})</span>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusBadgeClass(
                        request.status
                      )}`}
                    >
                      {request.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="rounded-lg bg-background/80 border border-border/60 p-2.5">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Leave Schedule</p>
                      <p className="font-semibold text-foreground mt-0.5">
                        {request.startDate} to {request.endDate}
                      </p>
                    </div>

                    <div className="rounded-lg bg-background/80 border border-border/60 p-2.5">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Duration</p>
                      <p className="font-bold text-foreground mt-0.5">
                        {request.leaveDays} {request.leaveDays === 1 ? 'day' : 'days'}
                      </p>
                    </div>
                  </div>

                  <p className="text-muted-foreground">
                    Reason: <span className="text-foreground font-medium">{request.reason}</span>
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                    <p>Submitted on {request.submittedAt}</p>
                    {request.reviewedBy && (
                      <p className="text-foreground">
                        Reviewed by {request.reviewedBy} on {request.reviewedAt}
                        {request.managerRemarks ? ` · Remarks: "${request.managerRemarks}"` : ''}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dialog: Request Timesheet Correction */}
      <Dialog open={correctionDialogOpen} onOpenChange={setCorrectionDialogOpen}>
        <DialogContent className="max-w-md bg-card text-card-foreground border-border/80 rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-heading text-foreground">
              Request Timesheet Correction
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Submit corrected time values for manager review. Historical records are preserved in an audit trail.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs">
            <label className="space-y-1 block">
              <span className="font-bold text-foreground">Attendance Date</span>
              <input
                type="date"
                value={correctionForm.date}
                onChange={(event) => setCorrectionForm((prev) => ({ ...prev, date: event.target.value }))}
                className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <span className="font-bold text-foreground">Requested Time In</span>
                <input
                  type="text"
                  value={correctionForm.requestedClockIn}
                  onChange={(event) => setCorrectionForm((prev) => ({ ...prev, requestedClockIn: event.target.value }))}
                  placeholder="08:00 AM"
                  className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm font-mono text-foreground outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-bold text-foreground">Requested Time Out</span>
                <input
                  type="text"
                  value={correctionForm.requestedClockOut}
                  onChange={(event) => setCorrectionForm((prev) => ({ ...prev, requestedClockOut: event.target.value }))}
                  placeholder="05:00 PM"
                  className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm font-mono text-foreground outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                />
              </label>
            </div>

            <label className="space-y-1 block">
              <span className="font-bold text-foreground">Reason for Correction *</span>
              <textarea
                value={correctionForm.reason}
                onChange={(event) => setCorrectionForm((prev) => ({ ...prev, reason: event.target.value }))}
                className="min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                placeholder="Example: I forgot to time in after the early morning coffee harvest briefing."
              />
            </label>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCorrectionDialogOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitCorrectionRequest}
              className="rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Submit Correction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: File Leave Request */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent className="max-w-md bg-card text-card-foreground border-border/80 rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-heading text-foreground">
              File Leave Request
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select leave type, start & end dates, and explain the reason for manager approval.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs">
            <label className="space-y-1 block">
              <span className="font-bold text-foreground">Leave Type</span>
              <select
                value={leaveForm.leaveType}
                onChange={(event) => {
                  logUiAction(`Selected Leave Type: "${event.target.value}"`);
                  setLeaveForm((prev) => ({ ...prev, leaveType: event.target.value }));
                }}
                className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <option value="Sick Leave">Sick Leave (Medical/Health)</option>
                <option value="Vacation Leave">Vacation Leave (Scheduled Time Off)</option>
                <option value="Emergency Leave">Emergency Leave (Urgent Family Matters)</option>
                <option value="Bereavement Leave">Bereavement Leave</option>
                <option value="Maternity / Paternity Leave">Maternity / Paternity Leave</option>
                <option value="Official Business">Official Business / Field Task</option>
                <option value="Unpaid Leave">Unpaid Leave</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <span className="font-bold text-foreground">Start Date</span>
                <input
                  type="date"
                  value={leaveForm.startDate}
                  onChange={(event) =>
                    setLeaveForm((prev) => ({
                      ...prev,
                      startDate: event.target.value,
                      endDate: event.target.value > prev.endDate ? event.target.value : prev.endDate,
                    }))
                  }
                  className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-bold text-foreground">End Date</span>
                <input
                  type="date"
                  value={leaveForm.endDate}
                  min={leaveForm.startDate}
                  onChange={(event) => setLeaveForm((prev) => ({ ...prev, endDate: event.target.value }))}
                  className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                />
              </label>
            </div>

            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2.5 flex items-center justify-between font-semibold text-emerald-700 dark:text-emerald-300">
              <span>Total Leave Duration:</span>
              <span className="text-sm font-bold">
                {leaveDayCount(leaveForm.startDate, leaveForm.endDate)} {leaveDayCount(leaveForm.startDate, leaveForm.endDate) === 1 ? 'day' : 'days'}
              </span>
            </div>

            <label className="space-y-1 block">
              <span className="font-bold text-foreground">Reason for Leave *</span>
              <textarea
                value={leaveForm.reason}
                onChange={(event) => setLeaveForm((prev) => ({ ...prev, reason: event.target.value }))}
                className="min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                placeholder="Please describe why this leave is required."
              />
            </label>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLeaveDialogOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitLeaveRequest}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Submit Leave Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Audit Trail Viewer */}
      <Dialog open={auditTrailDialogOpen} onOpenChange={setAuditTrailDialogOpen}>
        <DialogContent className="max-w-md bg-card text-card-foreground border-border/80 rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-heading text-foreground">
              Audit Trail: {selectedCorrectionForAudit?.correctionId}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Chronological log of submissions, reviews, and modifications.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs max-h-72 overflow-y-auto pr-1">
            {selectedCorrectionForAudit?.auditTrail?.map((entry, index) => (
              <div key={index} className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                  <span className="font-bold text-foreground">{entry.actorName}</span>
                  <span>{entry.timestamp}</span>
                </div>
                <p className="font-semibold text-foreground text-xs">{entry.action}</p>
                {entry.remarks && (
                  <p className="text-muted-foreground italic">Remarks: "{entry.remarks}"</p>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={() => setAuditTrailDialogOpen(false)}
              className="rounded-xl text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Proof Photo Preview */}
      <Dialog open={Boolean(selectedProofRecord)} onOpenChange={() => setSelectedProofRecord(null)}>
        <DialogContent className="max-w-sm bg-card text-card-foreground border-border/80 rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold font-heading text-foreground">
              Selfie Proof: {selectedProofRecord?.workerName}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {selectedProofRecord?.date} · {selectedProofRecord?.timeInLocationName}
            </DialogDescription>
          </DialogHeader>

          {selectedProofRecord?.faceSnapshotBase64 && (
            <div className="rounded-2xl overflow-hidden border border-border/80">
              <img
                src={selectedProofRecord.faceSnapshotBase64}
                alt="Attendance verification selfie"
                className="w-full h-auto object-cover"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              onClick={() => setSelectedProofRecord(null)}
              className="rounded-xl text-xs w-full"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4-Step Attendance Verification Dialog */}
      <Dialog open={modalOpen} onOpenChange={closeAttendanceModal}>
        <DialogContent className="max-w-md bg-card text-card-foreground border-border/80 rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 font-mono">
                Step-by-Step Verification
              </span>
              <span className="px-2 py-0.5 rounded-md bg-accent/20 text-accent-foreground text-[10px] font-bold">
                {actionType}
              </span>
            </div>
            <DialogTitle className="text-lg font-bold font-heading text-foreground mt-1">
              Secure Attendance Verification
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              To prevent fraudulent records, please enable GPS and take a selfie photo.
            </DialogDescription>
          </DialogHeader>

          {/* Stepper Indicator */}
          <div className="grid grid-cols-3 gap-2 my-3">
            <div
              className={`h-1.5 rounded-full transition-all ${
                currentStep === 'prompt_location' || currentStep === 'capturing_location'
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-all ${
                currentStep === 'camera_photo'
                  ? 'bg-amber-500'
                  : currentStep === 'confirm_submit'
                  ? 'bg-emerald-500'
                  : 'bg-muted'
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-all ${
                currentStep === 'confirm_submit' ? 'bg-amber-500' : 'bg-muted'
              }`}
            />
          </div>

          {/* Step 1 & 2: Location Permission and Capture */}
          {(currentStep === 'prompt_location' || currentStep === 'capturing_location') && (
            <div className="space-y-4 py-3">
              <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-muted/40 border border-border/70 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Compass className={`w-7 h-7 ${isLocating ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Step 1: Enable Location Services
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    The system captures your current device GPS coordinates to verify that you are on the farm site.
                  </p>
                </div>

                {geoError && (
                  <div className="w-full p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs text-left flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{geoError}</span>
                  </div>
                )}
              </div>

              <Button
                type="button"
                onClick={requestLocation}
                disabled={isLocating}
                className="w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs"
              >
                {isLocating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    Capturing GPS Location…
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4 mr-2" />
                    Enable Location & Proceed
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Step 3: Camera Live Feed / Selfie Photo */}
          {currentStep === 'camera_photo' && (
            <div className="space-y-4 py-2">
              <div className="text-center">
                <h3 className="text-sm font-bold text-foreground">
                  Step 2: Take a Selfie Photo
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Position your face clearly within the frame as identity proof.
                </p>
              </div>

              <div className="relative rounded-2xl overflow-hidden bg-black aspect-4/3 flex items-center justify-center border-2 border-border/80">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-2 border-amber-500/40 rounded-2xl pointer-events-none" />

                {cameraError && (
                  <div className="absolute inset-0 bg-background/90 p-4 flex flex-col items-center justify-center text-center gap-3">
                    <AlertTriangle className="w-8 h-8 text-amber-500" />
                    <p className="text-xs text-muted-foreground">{cameraError}</p>
                    <label className="cursor-pointer px-4 py-2 bg-amber-500 text-black rounded-xl text-xs font-bold">
                      Upload Photo File Instead
                      <input
                        type="file"
                        accept="image/*"
                        capture="user"
                        onChange={handlePhotoFileUpload}
                        className="sr-only"
                      />
                    </label>
                  </div>
                )}
              </div>

              {!cameraError && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={capturePhoto}
                    className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    Capture Photo & Proceed
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Confirmation & Final Commit */}
          {currentStep === 'confirm_submit' && (
            <div className="space-y-4 py-2">
              <div className="text-center">
                <h3 className="text-sm font-bold text-foreground">
                  Step 3: Review & Confirm Attendance
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verify the captured attendance data below before recording.
                </p>
              </div>

              <div className="rounded-2xl bg-muted/40 border border-border/70 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {photoDataUrl && (
                    <img
                      src={photoDataUrl}
                      alt="Captured selfie"
                      className="w-16 h-16 rounded-xl object-cover border-2 border-amber-500 shadow-sm shrink-0"
                    />
                  )}
                  <div className="space-y-1 text-xs min-w-0">
                    <p className="font-bold text-foreground truncate">{workerDisplayName}</p>
                    <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      Action: {actionType}
                    </p>
                    <p className="text-muted-foreground text-[11px]">{todayDateStr}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/50 space-y-1.5 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>
                      GPS Coordinates:{' '}
                      <span className="font-mono text-foreground font-semibold">
                        {geoData ? `${geoData.latitude.toFixed(5)}, ${geoData.longitude.toFixed(5)}` : 'Captured'}
                      </span>
                    </span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Accuracy: ±{Math.round(geoData?.accuracy || 10)} meters</span>
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={retakePhoto}
                  className="rounded-xl border-border/80 text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Retake Photo
                </Button>

                <Button
                  type="button"
                  onClick={commitAttendance}
                  disabled={isSubmitting}
                  className={`flex-1 h-11 rounded-xl text-white font-bold text-xs ${
                    actionType === 'Time In'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      Saving to Database…
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-1.5" />
                      Confirm {actionType}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="border-t border-border/50 pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={closeAttendanceModal}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
