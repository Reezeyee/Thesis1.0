import { useState, useMemo } from 'react';
import { useFarmData } from '../store/FarmDataProvider';
import { type SmsMessageRecord, type WorkerRecord } from '../types/appState';
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

export function SmsManagement() {
  const { state, updateState } = useFarmData();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [messageText, setMessageText] = useState('');
  
  // Admin details
  const [adminPhone, setAdminPhone] = useState('+63 917 123 4567');
  const [isEditingPhone, setIsEditingPhone] = useState(false);

  const workers = state.workers || [];
  const messages = state.smsMessages || [];

  // Filter workers list
  const filteredWorkers = useMemo(() => {
    return workers.filter(w => {
      const nameMatch = w.name.toLowerCase().includes(searchQuery.toLowerCase());
      const roleMatch = (w.roleRate || '').toLowerCase().includes(searchQuery.toLowerCase());
      return nameMatch || roleMatch;
    });
  }, [workers, searchQuery]);

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
      const wName = activeWorker.name;
      return (
        (msg.senderName === 'Admin' && msg.recipientName === wName) ||
        (msg.senderName === wName && msg.recipientName === 'Admin')
      );
    }).sort((a, b) => a.timestamp - b.timestamp);
  }, [messages, activeWorker]);

  // Character limit calculations
  const charLimit = 160;
  const charsLeft = charLimit - messageText.length;
  const segments = Math.ceil(messageText.length / charLimit) || 1;

  const templates = [
    "Instruction: Please complete the daily harvest report for Section 3.",
    "Notice: Weekly team alignment is scheduled for tomorrow at 8:00 AM.",
    "Equipment check: Please inspect the coffee pulper before use.",
    "Supplies notice: New fertilizer bags have been delivered to the shed.",
    "Emergency reply: Please head to the main warehouse immediately."
  ];

  const handleSend = async (viaExternalSms: boolean) => {
    if (!messageText.trim() || !activeWorker) return;

    const workerPhone = activeWorker.phoneNumber || '';
    const textToSend = messageText.trim();

    // Create the message log
    const newMsg: SmsMessageRecord = {
      messageId: `MSG-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      senderName: 'Admin',
      senderRole: 'Admin',
      recipientName: activeWorker.name,
      recipientPhoneNumber: workerPhone,
      messageBody: textToSend,
      timestamp: Date.now(),
      sentViaCellularSms: viaExternalSms,
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex-1 flex flex-col mx-[-1rem]">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold text-[#3e2723]">Worker Communication Portal</h2>
          <p className="text-[#8d6e63]">Send SMS alerts and view synchronized chat histories with farm staff.</p>
        </div>

        {/* Admin Phone config widget */}
        <div className="flex items-center gap-3 bg-white border border-[#d7ccc8] px-4 py-2.5 rounded-2xl shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-[#2d5016]/10 flex items-center justify-center text-[#2d5016]">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] text-[#8d6e63] font-semibold uppercase leading-none">Admin Phone (Broadcaster)</p>
            {isEditingPhone ? (
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="text"
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  className="text-xs font-bold text-[#3e2723] bg-transparent border-b border-[#2d5016] focus:outline-none w-28"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsEditingPhone(false)}
                  className="p-0.5 text-[#2d5016] hover:bg-[#2d5016]/10 rounded"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-bold text-[#3e2723]">{adminPhone}</span>
                <button
                  type="button"
                  onClick={() => setIsEditingPhone(true)}
                  className="p-0.5 text-[#8d6e63] hover:text-[#2d5016]"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Dual-pane Container */}
      <div className="h-[calc(100vh-15rem)] min-h-[480px] bg-white border border-[#e0e0e0] rounded-3xl overflow-hidden shadow-sm flex">
        
        {/* Left Pane: Workers list */}
        <div className="w-[340px] border-r border-[#e0e0e0] flex flex-col shrink-0">
          <div className="p-4 border-b border-[#f5f5f5]">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8d6e63]" />
              <input
                type="text"
                placeholder="Search staff name or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#fbe9e7]/30 border border-[#d7ccc8] focus:border-[#2d5016] rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none text-[#3e2723] placeholder-[#b0bec5]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-[#fafafa]">
            {filteredWorkers.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#b0bec5]">
                No matching staff records found.
              </div>
            ) : (
              filteredWorkers.map(w => {
                const isActive = activeWorker?.workerId === w.workerId;
                
                // Get preview of last message
                const workerMsgs = messages.filter(m => 
                  (m.senderName === 'Admin' && m.recipientName === w.name) ||
                  (m.senderName === w.name && m.recipientName === 'Admin')
                ).sort((a,b) => b.timestamp - a.timestamp);
                const lastMsg = workerMsgs[0];

                return (
                  <button
                    key={w.workerId || w.name}
                    type="button"
                    onClick={() => setSelectedWorkerId(w.workerId || '')}
                    className={`w-full flex items-start gap-3 p-3 rounded-2xl text-left transition-all ${
                      isActive
                        ? 'bg-[#2d5016]/10 border border-[#2d5016]/20'
                        : 'hover:bg-black/5 border border-transparent'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#8d6e63]/10 text-[#5d4037] flex items-center justify-center font-bold text-sm shrink-0">
                      {w.name ? w.name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase() : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-sm text-[#3e2723] truncate">{w.name}</span>
                        {lastMsg && (
                          <span className="text-[10px] text-[#8d6e63] whitespace-nowrap">
                            {new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#8d6e63] font-medium leading-none mt-0.5 truncate">{w.roleRate || 'Field Staff'}</p>
                      <p className="text-xs text-[#546e7a] truncate mt-1.5 italic">
                        {lastMsg ? lastMsg.messageBody : 'No communication yet.'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Conversation Details */}
        <div className="flex-1 flex flex-col min-w-0">
          {activeWorker ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-[#e0e0e0] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#2d5016]/10 text-[#2d5016] flex items-center justify-center font-bold shrink-0">
                    {activeWorker.name ? activeWorker.name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase() : '?'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-[#3e2723] leading-none truncate">{activeWorker.name}</h3>
                    <p className="text-xs text-[#8d6e63] mt-1 truncate">{activeWorker.phoneNumber || 'No phone number registered'}</p>
                  </div>
                </div>
                {activeWorker.phoneNumber && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-[#2d5016]/10 rounded-full text-xs text-[#2d5016] font-semibold shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2d5016] animate-pulse"></span>
                    SMS Ready
                  </div>
                )}
              </div>

              {/* Chat Thread */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#fdfbf7]/50">
                {activeThread.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-8">
                    <MessageSquare className="w-12 h-12 text-[#d7ccc8] mb-3" />
                    <p className="font-medium text-sm text-[#5d4037]">No messages yet</p>
                    <p className="text-xs text-[#8d6e63] max-w-xs mt-1">
                      Start communication by typing a message below. It will sync in-app instantly.
                    </p>
                  </div>
                ) : (
                  activeThread.map(msg => {
                    const isAdmin = msg.senderRole === 'Admin';
                    return (
                      <div
                        key={msg.messageId}
                        className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm break-words ${
                            isAdmin
                              ? 'bg-[#2d5016] text-white rounded-tr-none'
                              : 'bg-white text-[#3e2723] border border-[#e0e0e0] rounded-tl-none'
                          }`}
                        >
                          <p className="leading-relaxed whitespace-pre-wrap break-all">{msg.messageBody}</p>
                          <div
                            className={`flex items-center gap-1.5 mt-1.5 text-[9px] font-medium ${
                              isAdmin ? 'text-white/60' : 'text-[#8d6e63]'
                            }`}
                          >
                            <Clock className="w-2.5 h-2.5" />
                            <span>
                              {new Date(msg.timestamp).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {msg.sentViaCellularSms && (
                              <span className="px-1.5 py-0.5 rounded bg-black/10 uppercase tracking-wide">
                                SMS
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-[#e0e0e0]">
                {/* Templates row */}
                <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-1.5 scrollbar-thin">
                  {templates.map((temp, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setMessageText(temp)}
                      className="px-3 py-1.5 bg-[#fafafa] hover:bg-[#2d5016]/5 border border-[#d7ccc8] hover:border-[#2d5016]/40 text-[#5d4037] text-xs font-medium rounded-full whitespace-nowrap transition-all"
                    >
                      {temp.length > 25 ? temp.substring(0, 25) + '...' : temp}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <textarea
                    rows={3}
                    placeholder={`Type message to ${activeWorker.name}...`}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="w-full bg-[#fafafa] border border-[#d7ccc8] focus:border-[#2d5016] rounded-2xl p-4 pr-12 text-sm focus:outline-none text-[#3e2723] resize-none"
                  />
                  <div className="absolute right-3 bottom-3 text-[10px] font-semibold text-[#8d6e63]">
                    {charsLeft >= 0 ? (
                      <span>{messageText.length}/{charLimit} (seg {segments})</span>
                    ) : (
                      <span className="text-red-500">Exceeds standard 1-seg: {messageText.length} chars</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                  <p className="text-[11px] text-[#8d6e63] min-w-[240px] flex-1">
                    In-app logs will sync to the worker's device when connected online.
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-2.5 justify-end">
                    <button
                      type="button"
                      disabled={!messageText.trim()}
                      onClick={() => handleSend(false)}
                      className="px-4 py-2 border border-[#d7ccc8] hover:bg-black/5 text-[#5d4037] disabled:opacity-50 text-xs font-semibold rounded-xl flex items-center gap-2 transition-all whitespace-nowrap"
                    >
                      Sync In-App Only
                    </button>

                    <button
                      type="button"
                      disabled={!messageText.trim() || !activeWorker.phoneNumber}
                      onClick={() => handleSend(true)}
                      className="px-4 py-2 bg-[#2d5016] hover:bg-[#1b3310] text-white disabled:opacity-50 text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-sm whitespace-nowrap"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send via SMS Link
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#fafafa]">
              <MessageSquare className="w-16 h-16 text-[#d7ccc8] mb-4" />
              <h3 className="text-lg font-bold text-[#5d4037]">No recipient selected</h3>
              <p className="text-sm text-[#8d6e63] max-w-sm mt-2">
                Select a worker from the sidebar list to see conversation history and initiate SMS broadcasting.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
