import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useFarmData } from '../store/FarmDataProvider';
import { type SmsMessageRecord, type WorkerRecord } from '../types/appState';
import { isWorkerActive } from '../lib/workerUi';
import { 
  Search, 
  Send, 
  MessageSquare, 
  Smartphone, 
  User, 
  Clock, 
  ExternalLink,
  Edit2,
  Check
} from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35 },
  },
};

export function SmsManagement() {
  const { state, updateState } = useFarmData();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [messageText, setMessageText] = useState('');
  
  // Admin details
  const [adminPhone, setAdminPhone] = useState('+63 917 123 4567');
  const [isEditingPhone, setIsEditingPhone] = useState(false);

  const workers = state.workers || [];
  const messages = state.smsMessages || [];

  const activeWorkersCount = useMemo(() => workers.filter(isWorkerActive).length, [workers]);

  // Filter workers list
  const filteredWorkers = useMemo(() => {
    return workers.filter(w => {
      const active = isWorkerActive(w);
      if (statusFilter === 'active' && !active) return false;
      if (statusFilter === 'inactive' && active) return false;
      const nameMatch = w.name.toLowerCase().includes(searchQuery.toLowerCase());
      const roleMatch = (w.roleRate || '').toLowerCase().includes(searchQuery.toLowerCase());
      return nameMatch || roleMatch;
    });
  }, [workers, searchQuery, statusFilter]);

  // Set default selected worker if none selected
  const activeWorker = useMemo(() => {
    if (selectedWorkerId) {
      return workers.find(w => w.workerId === selectedWorkerId);
    }
    return filteredWorkers[0] || null;
  }, [workers, selectedWorkerId, filteredWorkers]);

  // Filter messages for active worker thread
  const activeThread = useMemo(() => {
    if (!activeWorker) return [];
    return messages.filter(msg => {
      const wName = (activeWorker.name || '').toLowerCase();
      const sender = (msg.senderName || '').toLowerCase();
      const recipient = (msg.recipientName || '').toLowerCase();
      return (
        (sender === 'admin' && recipient === wName) ||
        (sender === wName && recipient === 'admin')
      );
    }).sort((a, b) => a.timestamp - b.timestamp);
  }, [messages, activeWorker]);

  // Character limit calculations
  const maxChars = 160;
  const charsLeft = maxChars - messageText.length;
  const isOverLimit = charsLeft < 0;

  const handleSendMessage = async (viaExternalSms = false) => {
    if (!messageText.trim() || !activeWorker) return;

    const workerPhone = activeWorker.phoneNumber || '';
    const workerName = activeWorker.name || 'Worker';
    const textToSend = messageText.trim();

    const newMsg: SmsMessageRecord = {
      messageId: `SMS-${Date.now()}`,
      senderName: 'admin',
      senderPhone: adminPhone,
      recipientName: workerName,
      recipientPhone: workerPhone,
      messageBody: textToSend,
      timestamp: Date.now(),
      status: 'Sent',
      viaGateway: viaExternalSms ? 'External App' : 'Firebase Direct',
    };

    // If external SMS selected, trigger sms: scheme
    if (viaExternalSms && workerPhone) {
      const encodedText = encodeURIComponent(textToSend);
      window.open(`sms:${workerPhone}?body=${encodedText}`, '_blank');
    }

    // Save to Firestore via updateState
    await updateState((prev) => ({
      ...prev,
      smsMessages: [...(prev.smsMessages || []), newMsg],
    }));

    setMessageText('');
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex-1 flex flex-col max-w-[1600px] mx-auto pb-8 font-sans"
    >
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-heading text-foreground">
              SMS Broadcast & Worker Communication
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Cellular Gateway Active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Send SMS broadcasts to farm personnel, log cellular dispatches, and manage worker threads.
          </p>
        </div>

        {/* Admin Phone config widget */}
        <div className="flex items-center gap-3 bg-card border border-border/80 px-4 py-2 rounded-xl shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center text-accent">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-mono font-bold uppercase leading-none">Broadcaster Phone</p>
            {isEditingPhone ? (
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="text"
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  className="text-xs font-mono font-bold text-foreground bg-transparent border-b border-accent focus:outline-none w-28"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsEditingPhone(false)}
                  className="p-0.5 text-accent hover:bg-accent/10 rounded"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono font-bold text-foreground">{adminPhone}</span>
                <button
                  type="button"
                  onClick={() => setIsEditingPhone(true)}
                  className="p-0.5 text-muted-foreground hover:text-accent"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Main Dual-pane Container */}
      <motion.div variants={itemVariants} className="h-[calc(100vh-15rem)] min-h-[500px] bg-card/95 border border-border/80 rounded-xl overflow-hidden shadow-sm flex">
        
        {/* Left Pane: Workers list */}
        <div className="w-[320px] border-r border-border/60 flex flex-col shrink-0">
          <div className="p-3 border-b border-border/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-heading text-foreground">Staff Directory</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/15 text-accent font-bold">
                {activeWorkersCount} Active / {workers.length} Total
              </span>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background border border-border/80 focus:border-accent rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none text-foreground placeholder:text-muted-foreground font-sans"
              />
            </div>
            <div className="flex items-center gap-1">
              {(['all', 'active', 'inactive'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setStatusFilter(mode)}
                  className={`flex-1 py-1 rounded-md text-[10px] font-mono font-medium transition-all ${
                    statusFilter === mode
                      ? 'bg-accent text-accent-foreground font-bold'
                      : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-muted/20">
            {filteredWorkers.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground font-mono">
                No staff records found.
              </div>
            ) : (
              filteredWorkers.map(w => {
                const isActive = activeWorker?.workerId === w.workerId;
                const isStaffActive = isWorkerActive(w);
                
                const workerMsgs = messages.filter(m => {
                  const wName = (w.name || '').toLowerCase();
                  const sender = (m.senderName || '').toLowerCase();
                  const recipient = (m.recipientName || '').toLowerCase();
                  return (
                    (sender === 'admin' && recipient === wName) ||
                    (sender === wName && recipient === 'admin')
                  );
                }).sort((a,b) => b.timestamp - a.timestamp);
                const lastMsg = workerMsgs[0];

                return (
                  <button
                    key={w.workerId || w.name}
                    type="button"
                    onClick={() => setSelectedWorkerId(w.workerId || '')}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all ${
                      isActive
                        ? 'bg-accent/15 border border-accent/30 text-accent font-bold'
                        : 'hover:bg-muted/60 border border-transparent text-foreground'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center font-bold text-xs shrink-0 font-mono relative">
                      {w.name ? w.name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase() : '?'}
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${isStaffActive ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs font-heading text-foreground truncate">{w.name}</span>
                        {lastMsg && (
                          <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                            {new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[10px] text-muted-foreground font-mono leading-none truncate">{w.roleRate || 'Field Staff'}</p>
                        <span className={`text-[9px] font-mono px-1 rounded ${isStaffActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                          {isStaffActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1 italic">
                        {lastMsg ? lastMsg.messageBody : 'No communication yet.'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Thread View */}
        <div className="flex-1 flex flex-col bg-card">
          {activeWorker ? (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center font-bold text-sm font-mono">
                    {activeWorker.name ? activeWorker.name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase() : '?'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm font-heading text-foreground">{activeWorker.name}</h3>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border ${
                        isWorkerActive(activeWorker)
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}>
                        {isWorkerActive(activeWorker) ? 'Active Staff' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {activeWorker.roleRate || 'Worker'} • {activeWorker.phoneNumber || 'No phone number linked'}
                    </p>
                  </div>
                </div>

                {activeWorker.phoneNumber && (
                  <button
                    type="button"
                    onClick={() => handleSendMessage(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted border border-border/80 text-xs font-medium text-foreground hover:bg-accent/10 hover:border-accent/40 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-accent" />
                    Open Native SMS App
                  </button>
                )}
              </div>

              {/* Chat Thread Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
                {activeThread.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-6">
                    <MessageSquare className="w-8 h-8 mb-2 opacity-40 text-accent" />
                    <p className="text-xs font-mono font-medium">No messages exchanged yet with {activeWorker.name}.</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Type a broadcast message below to begin cellular dispatch.</p>
                  </div>
                ) : (
                  activeThread.map((msg) => {
                    const isAdmin = (msg.senderName || '').toLowerCase() === 'admin';
                    return (
                      <div
                        key={msg.messageId}
                        className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl p-3.5 text-xs shadow-2xs ${
                            isAdmin
                              ? 'bg-accent text-accent-foreground rounded-tr-xs'
                              : 'bg-muted/60 text-foreground border border-border/60 rounded-tl-xs'
                          }`}
                        >
                          <p className="leading-relaxed font-sans">{msg.messageBody}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1 px-1">
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {msg.viaGateway && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-muted border border-border/40 text-muted-foreground">
                              {msg.viaGateway}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Message Composer */}
              <div className="p-3 border-t border-border/60 bg-card space-y-2">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                  <span>Send to: <strong className="text-foreground">{activeWorker.phoneNumber || activeWorker.name}</strong></span>
                  <span className={isOverLimit ? 'text-rose-500 font-bold' : ''}>
                    {charsLeft} chars remaining ({Math.ceil(messageText.length / 160) || 1} SMS)
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type SMS message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(false);
                      }
                    }}
                    className="flex-1 bg-background border border-border/80 focus:border-accent rounded-xl px-3.5 py-2 text-xs focus:outline-none text-foreground placeholder:text-muted-foreground font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => handleSendMessage(false)}
                    disabled={!messageText.trim() || isOverLimit}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-accent-foreground font-bold text-xs hover:bg-accent/90 disabled:opacity-50 transition-all cursor-pointer shadow-2xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
              <User className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">Select a field staff worker from the left pane to view conversation history.</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
