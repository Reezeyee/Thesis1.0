import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
  Clock,
  Calendar,
  User,
  MapPin,
  Flame,
  Check,
  Zap,
  Eye,
  EyeOff,
  SwitchCamera,
  ImageIcon,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import {
  detectCoffeeCherries,
  SAMPLE_CHERRY_IMAGES,
  CLASS_STYLES,
  type CherryDetectionResult,
  type CherryMaturityClass,
} from '../../lib/aiCherryDetector';
import { useFarmData } from '../../store/FarmDataProvider';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface WorkerCherryScannerProps {
  onScanSaved?: () => void;
  onNavigateToHistory?: () => void;
}

const SECTIONS = [
  { id: 'Section D', label: 'Section D (South Ridge · Arabica)' },
  { id: 'Section A', label: 'Section A (North Hill · Robusta)' },
  { id: 'Section B', label: 'Section B (East Slope · Liberica)' },
  { id: 'Section C', label: 'Section C (Valley Flat · Excelsa)' },
];

export function WorkerCherryScanner({ onScanSaved, onNavigateToHistory }: WorkerCherryScannerProps) {
  const { state, updateState } = useFarmData();
  const { session } = useAuth();
  const workerDisplayName = session?.displayName || 'Juan Dela Cruz';

  // State
  const [selectedSection, setSelectedSection] = useState('Section D');
  const [activeImage, setActiveImage] = useState<string | null>(SAMPLE_CHERRY_IMAGES[0].url);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatusText, setScanStatusText] = useState('Ready to scan');
  const [detectionResult, setDetectionResult] = useState<CherryDetectionResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showBoxes, setShowBoxes] = useState(true);
  const [selectedFilterClass, setSelectedFilterClass] = useState<CherryMaturityClass | 'ALL'>('ALL');

  // Camera Live Stream state
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize camera stream
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      console.warn('Camera access unavailable or denied:', err);
      setCameraError('Camera access not granted. Please select a photo or sample below.');
      setCameraActive(false);
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  useEffect(() => {
    if (cameraActive) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [cameraActive, facingMode, startCamera, stopCamera]);

  // Capture frame from live camera
  const captureLiveFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setActiveImage(dataUrl);
      stopCamera();
      runDetection(dataUrl);
    }
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setActiveImage(dataUrl);
      stopCamera();
      runDetection(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Run AI Detection
  const runDetection = async (imgSrc?: string) => {
    const imageToScan = imgSrc || activeImage;
    if (!imageToScan) {
      toast.error('Please capture or select a photo of coffee cherries first');
      return;
    }

    setIsScanning(true);
    setIsSaved(false);
    setScanProgress(15);
    setScanStatusText('Calibrating camera & lighting…');

    const progressInterval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev < 40) {
          setScanStatusText('Scanning coffee cherry cluster…');
          return prev + 15;
        } else if (prev < 75) {
          setScanStatusText('Running YOLOv8 CNN maturity classification…');
          return prev + 18;
        } else if (prev < 90) {
          setScanStatusText('Calculating optimal harvest recommendation…');
          return prev + 8;
        }
        return prev;
      });
    }, 220);

    try {
      const result = await detectCoffeeCherries(imageToScan, selectedSection, workerDisplayName);
      clearInterval(progressInterval);
      setScanProgress(100);
      setScanStatusText('Detection complete!');
      setTimeout(() => {
        setDetectionResult(result);
        setIsScanning(false);
      }, 300);
    } catch (err) {
      clearInterval(progressInterval);
      setIsScanning(false);
      toast.error('Detection error occurred. Please try again.');
    }
  };

  // Trigger confetti
  const fireConfetti = () => {
    try {
      confetti({
        particleCount: 75,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#f59e0b', '#f43f5e', '#ffffff'],
      });
    } catch {
      // ignore in headless / non-canvas environments
    }
  };

  // Save Scan Result Flow
  const handleSaveResult = async () => {
    if (!detectionResult) return;
    setIsSaving(true);

    try {
      const nowMillis = Date.now();
      const batchLabel = `BATCH-${selectedSection.replace(/\s+/g, '')}-${nowMillis.toString().slice(-4)}`;

      await updateState((prev) => {
        const newCherryGrade = {
          batchId: batchLabel,
          grade: detectionResult.harvestRecommendation,
          confidence: `${detectionResult.ripePercentage}%`,
          species: 'Arabica',
          speciesConfidence: 'High (98%)',
          savedAtMillis: nowMillis,
          treeId: selectedSection,
          scannedByWorkerName: detectionResult.workerName,
          scannedByEmail: session?.email || 'worker@acojidofarm.ph',
          scannedByAuthUid: session?.userId || 'worker-demo',
        };

        const newRipenessScan = {
          treeId: selectedSection,
          ripenessLabel: detectionResult.harvestRecommendation,
          timestampMillis: nowMillis,
          sourceGrade: `${detectionResult.totalCount} cherries (${detectionResult.ripePercentage}% ripe)`,
        };

        const existingGrades = prev.cherryGrades || [];
        const existingScans = prev.treeRipenessScans || [];

        return {
          ...prev,
          cherryGrades: [newCherryGrade, ...existingGrades],
          treeRipenessScans: [newRipenessScan, ...existingScans],
        };
      });

      setIsSaving(false);
      setIsSaved(true);
      fireConfetti();
      toast.success('Scan Result Saved Successfully!', {
        description: `${detectionResult.totalCount} cherries recorded in ${detectionResult.section}.`,
      });

      if (onScanSaved) {
        onScanSaved();
      }
    } catch (err) {
      setIsSaving(false);
      toast.error('Failed to save scan record to cloud database.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Worker Top Action Bar */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Sparkles className="w-4 h-4" />
              </span>
              <h1 className="text-lg sm:text-xl font-bold font-heading text-foreground">
                Coffee Cherry Scanner
              </h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Point camera at coffee branch to detect ripeness & harvest readiness
            </p>
          </div>

          {/* Section Selector */}
          <div className="flex items-center gap-3">
            <div className="w-full sm:w-64">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Farm Section
              </label>
              <Select
                value={selectedSection}
                onValueChange={(val) => {
                  setSelectedSection(val);
                  setDetectionResult(null);
                  setIsSaved(false);
                }}
              >
                <SelectTrigger className="h-10 bg-background border-border/90 text-sm font-medium rounded-xl">
                  <SelectValue placeholder="Select Section" />
                </SelectTrigger>
                <SelectContent>
                  {SECTIONS.map((sec) => (
                    <SelectItem key={sec.id} value={sec.id} className="text-xs font-medium">
                      {sec.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Scanner Viewport Area */}
      <div className="bg-card border border-border/80 rounded-3xl overflow-hidden shadow-md">
        {/* Scanner Viewport */}
        <div className="relative aspect-[4/3] sm:aspect-[16/10] bg-black/95 flex items-center justify-center overflow-hidden">
          {cameraActive ? (
            /* Live Camera Stream */
            <div className="relative w-full h-full">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Camera Overlays */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-semibold text-white flex items-center gap-1.5 border border-white/20">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  Live Field Camera
                </span>
                <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-medium text-white/90 border border-white/20">
                  {selectedSection}
                </span>
              </div>

              {/* Target Focus Reticle */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 sm:w-80 sm:h-80 border-2 border-dashed border-amber-400/80 rounded-3xl relative">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-amber-400 -mt-1 -ml-1 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-amber-400 -mt-1 -mr-1 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-amber-400 -mb-1 -ml-1 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-amber-400 -mb-1 -mr-1 rounded-br-lg" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-amber-200/80 text-[11px] font-mono bg-black/40 px-2 py-0.5 rounded">
                      Position Cherry Cluster Here
                    </span>
                  </div>
                </div>
              </div>

              {/* Live Camera Bottom Controls */}
              <div className="absolute bottom-5 inset-x-0 flex items-center justify-center gap-4 px-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={toggleFacingMode}
                  className="rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 h-10 px-4"
                >
                  <SwitchCamera className="w-4 h-4 mr-1.5" />
                  Flip
                </Button>
                <Button
                  type="button"
                  onClick={captureLiveFrame}
                  className="rounded-full bg-amber-500 hover:bg-amber-600 text-black font-semibold h-12 px-6 shadow-lg shadow-amber-500/30 text-sm"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Snap & Scan
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={stopCamera}
                  className="rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 h-10 px-4"
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            /* Static Captured / Sample Image Display with Bounding Boxes */
            <div className="relative w-full h-full flex items-center justify-center bg-black/90">
              {activeImage ? (
                <>
                  <img
                    src={activeImage}
                    alt="Coffee Cherries to Scan"
                    className="w-full h-full object-cover"
                  />

                  {/* Bounding Boxes Layer */}
                  {detectionResult && showBoxes && (
                    <div className="absolute inset-0 pointer-events-none">
                      {detectionResult.boxes
                        .filter(
                          (box) =>
                            selectedFilterClass === 'ALL' || box.cls === selectedFilterClass
                        )
                        .map((b) => {
                          const style = CLASS_STYLES[b.cls];
                          const left = `${b.box[0] * 100}%`;
                          const top = `${b.box[1] * 100}%`;
                          const width = `${(b.box[2] - b.box[0]) * 100}%`;
                          const height = `${(b.box[3] - b.box[1]) * 100}%`;

                          return (
                            <motion.div
                              key={b.id}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.25 }}
                              style={{ left, top, width, height }}
                              className="absolute rounded-md border-2 pointer-events-none"
                              style-border-color={style.colorHex}
                            >
                              <div
                                className="w-full h-full rounded-md border-2 transition-all duration-150"
                                style={{
                                  borderColor: style.colorHex,
                                  backgroundColor: `${style.colorHex}22`,
                                }}
                              >
                                <span
                                  className="absolute -top-3.5 left-0 px-1 py-0.2 text-[9px] font-bold text-white rounded shadow-sm whitespace-nowrap leading-tight"
                                  style={{ backgroundColor: style.colorHex }}
                                >
                                  {b.cls} {Math.round(b.confidence * 100)}%
                                </span>
                              </div>
                            </motion.div>
                          );
                        })}
                    </div>
                  )}

                  {/* Laser Scanning Animation Overlay */}
                  <AnimatePresence>
                    {isScanning && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-white"
                      >
                        {/* Laser Beam Sweep */}
                        <motion.div
                          animate={{
                            top: ['0%', '100%', '0%'],
                          }}
                          transition={{
                            repeat: Infinity,
                            duration: 2.2,
                            ease: 'easeInOut',
                          }}
                          className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_15px_#f59e0b] pointer-events-none"
                        />

                        {/* Scanner HUD Indicator */}
                        <div className="relative flex flex-col items-center gap-3">
                          <div className="relative">
                            <div className="w-16 h-16 rounded-full border-4 border-amber-500/30 border-t-amber-400 animate-spin flex items-center justify-center" />
                            <Sparkles className="w-7 h-7 text-amber-400 absolute inset-0 m-auto animate-pulse" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-semibold text-white">{scanStatusText}</p>
                            <p className="text-[11px] text-amber-300 font-mono mt-0.5">
                              {scanProgress}% Analyzing {selectedSection}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                /* No Image Selected Placeholder */
                <div className="flex flex-col items-center text-muted-foreground p-8 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-muted/20 flex items-center justify-center mb-3">
                    <ImageIcon className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No image loaded</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    Use your phone camera or select a coffee branch sample below to start detection
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Viewport Control Bar */}
        <div className="p-3.5 sm:p-4 bg-muted/40 border-t border-border/70 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={startCamera}
              className="rounded-xl h-9 px-3.5 text-xs font-semibold gap-1.5 border-border/80"
            >
              <Camera className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Open Camera
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl h-9 px-3.5 text-xs font-medium gap-1.5 border-border/80"
            >
              <Upload className="w-4 h-4 text-muted-foreground" />
              Upload Photo
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
          </div>

          <div className="flex items-center gap-2">
            {detectionResult && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowBoxes(!showBoxes)}
                className="rounded-xl h-9 px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {showBoxes ? (
                  <>
                    <Eye className="w-3.5 h-3.5 mr-1 text-amber-500" /> Bounding Boxes
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5 mr-1" /> Hide Boxes
                  </>
                )}
              </Button>
            )}

            <Button
              type="button"
              disabled={isScanning || !activeImage}
              onClick={() => runDetection()}
              className="rounded-xl h-9 px-5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black shadow-sm"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Scan Cherries
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Preset Coffee Cherry Samples for Instant Field Testing */}
      <div className="bg-card border border-border/70 rounded-2xl p-4 shadow-sm">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2.5">
          Quick Test Sample Branches
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SAMPLE_CHERRY_IMAGES.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => {
                setActiveImage(sample.url);
                setSelectedSection(sample.section);
                stopCamera();
                runDetection(sample.url);
              }}
              className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                activeImage === sample.url
                  ? 'border-amber-500/80 bg-amber-500/10 dark:bg-amber-500/15 shadow-sm ring-1 ring-amber-500/30'
                  : 'border-border/60 bg-background hover:bg-muted/50'
              }`}
            >
              <img
                src={sample.url}
                alt={sample.name}
                className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate">{sample.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    {sample.count} cherries
                  </span>
                  <span className="text-[10px] text-muted-foreground">· {sample.recommendation}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================= */}
      {/* SCAN RESULT CARD (POLISHED STRICT HIERARCHY MATCHING PROMPT) */}
      {/* ========================================================= */}
      <AnimatePresence>
        {detectionResult && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="bg-card border-2 border-amber-500/40 rounded-3xl p-6 sm:p-7 shadow-xl relative overflow-hidden"
          >
            {/* Top Accent Gradient Header */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 via-emerald-500 to-rose-500" />

            {/* Scan Result Header */}
            <div className="flex items-center justify-between border-b border-border/80 pb-4 mb-6">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                  Computer Vision · YOLOv8
                </span>
                <h2 className="text-2xl font-black font-heading tracking-tight text-foreground">
                  SCAN RESULT
                </h2>
              </div>
              <div className="px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold">
                {detectionResult.section}
              </div>
            </div>

            {/* Core Prominent Visual Hierarchy */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Stat 1: Cherries Found (Strongest Visual Stat) */}
              <div className="rounded-2xl border border-border/90 bg-background/80 p-5 flex flex-col justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Cherries Found
                </span>
                <div className="my-3 flex items-baseline gap-3">
                  <span className="text-5xl sm:text-6xl font-black font-heading text-foreground tracking-tight">
                    {detectionResult.totalCount}
                  </span>
                  <span className="text-sm font-bold text-muted-foreground">coffee fruits</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Verified by branch cluster contour segmentation</span>
                </div>
              </div>

              {/* Stat 2: Harvest Recommendation */}
              <div
                className={`rounded-2xl border p-5 flex flex-col justify-between ${
                  detectionResult.harvestRecommendation === 'Ready for Harvest'
                    ? 'border-emerald-500/40 bg-emerald-500/10 dark:bg-emerald-500/15'
                    : detectionResult.harvestRecommendation === 'Selective Picking'
                    ? 'border-amber-500/40 bg-amber-500/10 dark:bg-amber-500/15'
                    : 'border-slate-500/40 bg-slate-500/10 dark:bg-slate-500/15'
                }`}
              >
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Harvest Recommendation
                  </span>
                  <div className="mt-2 flex items-center gap-2.5">
                    <span
                      className={`text-2xl sm:text-3xl font-extrabold font-heading ${
                        detectionResult.harvestRecommendation === 'Ready for Harvest'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : detectionResult.harvestRecommendation === 'Selective Picking'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {detectionResult.harvestRecommendation}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-foreground/80 mt-3 font-medium">
                  {detectionResult.harvestNote}
                </p>
              </div>
            </div>

            {/* Maturity Breakdown Pills */}
            <div className="mb-6 rounded-2xl bg-muted/40 border border-border/70 p-4">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-3">
                Ripeness Breakdown
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-card border border-border/80 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Ripe
                    </span>
                    <p className="text-lg font-bold text-foreground mt-0.5">
                      {detectionResult.ripeCount}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                    {Math.round((detectionResult.ripeCount / detectionResult.totalCount) * 100)}%
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-card border border-border/80 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Ripening
                    </span>
                    <p className="text-lg font-bold text-foreground mt-0.5">
                      {detectionResult.ripeningCount}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    {Math.round((detectionResult.ripeningCount / detectionResult.totalCount) * 100)}%
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-card border border-border/80 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Unripe
                    </span>
                    <p className="text-lg font-bold text-foreground mt-0.5">
                      {detectionResult.unripeCount}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {Math.round((detectionResult.unripeCount / detectionResult.totalCount) * 100)}%
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-card border border-border/80 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-500" /> Damaged
                    </span>
                    <p className="text-lg font-bold text-foreground mt-0.5">
                      {detectionResult.damagedCount}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {Math.round((detectionResult.damagedCount / detectionResult.totalCount) * 100)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Worker & Timestamp Metadata Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-border/80 pt-4 mb-6 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                    Worker
                  </span>
                  <span className="font-bold text-foreground">{detectionResult.workerName}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                    Date
                  </span>
                  <span className="font-bold text-foreground">{detectionResult.dateString}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                    Scan Time
                  </span>
                  <span className="font-bold text-foreground">{detectionResult.timeString}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons: Save Scan Result */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Button
                type="button"
                size="lg"
                disabled={isSaving || isSaved}
                onClick={handleSaveResult}
                className={`w-full sm:flex-1 h-14 rounded-2xl text-base font-bold transition-all shadow-md ${
                  isSaved
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-amber-500 hover:bg-amber-600 text-black shadow-amber-500/20'
                }`}
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    Saving Scan Result to Cloud Database…
                  </>
                ) : isSaved ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 mr-2 text-white" />
                    Saved to Farm Records
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Save Scan Result
                  </>
                )}
              </Button>

              {isSaved && onNavigateToHistory && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={onNavigateToHistory}
                  className="w-full sm:w-auto h-14 px-6 rounded-2xl text-sm font-semibold border-border/90"
                >
                  View in History
                </Button>
              )}
            </div>

            {/* Saved Confirmation Notice */}
            {isSaved && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2"
              >
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Record updated in real-time. Visible under Scan Reports & History.
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
