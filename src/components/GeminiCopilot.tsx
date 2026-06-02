import React, { useState, useEffect, useRef } from "react";
import { Shift, Mutation, AuditFinding } from "../types/index";
import { nextShiftId } from "../lib/shiftIds";
import { ConfirmOptions } from "./ConfirmDialog";
import { 
  Sparkles, 
  Send, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle, 
  Wand2, 
  ShieldAlert, 
  Heart, 
  HelpCircle,
  Play,
  Check,
  RotateCcw,
  X
} from "lucide-react";

interface GeminiCopilotProps {
  shifts: Shift[];
  targets: number[];
  onApplyMutations: (mutations: Mutation[]) => void;
  onOverwriteShifts: (shifts: Shift[]) => void;
  requestConfirm: (options: ConfirmOptions, onConfirm: () => void) => void;
}

export default function GeminiCopilot({
  shifts,
  targets,
  onApplyMutations,
  onOverwriteShifts,
  requestConfirm
}: GeminiCopilotProps) {
  const [apiKeyStatus, setApiKeyStatus] = useState<"checking" | "ok" | "missing">("checking");
  const [activeTab, setActiveTab] = useState<"chat" | "audit">("chat");
  
  // Chat state
  const [inputMessage, setInputMessage] = useState("");
  const [chatLogs, setChatLogs] = useState<Array<{ sender: "user" | "ai" | "system"; text: string; time: string }>>([
    {
      sender: "ai",
      text: "Hello! I am Gemini 3.5 Flash, your ShiftSync Scheduling Copilot. You can ask me to modify the timeline, add/delete shifts, or generate recommendations using natural language! Try: 'Add a Cashier shift from 9 AM to 5 PM named Jane'.",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auditor state
  const [isAuditing, setIsAuditing] = useState(false);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Check backend gemini configuration on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/gemini/status");
        const data = await res.json();
        if (data.status === "ok") {
          setApiKeyStatus("ok");
        } else {
          setApiKeyStatus("missing");
        }
      } catch (e) {
        setApiKeyStatus("missing");
      }
    };
    checkStatus();
  }, []);

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLogs]);

  // Ask for confirmation before replacing the roster.
  const handleOptimizeClick = () => {
    requestConfirm(
      {
        title: "Auto-balance the schedule?",
        message: "Gemini will replace your current roster with a freshly generated, optimized set of shifts. This cannot be undone.",
        confirmLabel: "Auto-Balance",
        danger: false,
      },
      () => { handleOptimize(); }
    );
  };

  // Execute optimization
  const handleOptimize = async () => {
    setIsOptimizing(true);
    setActionError(null);
    try {
      const response = await fetch("/api/gemini/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets, currentShifts: shifts })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `Request failed (${response.status}).`);
      }
      if (data.shifts && Array.isArray(data.shifts)) {
        // Build clean sequential ids so later manual adds never collide.
        const generated: Shift[] = [];
        for (const s of data.shifts) {
          generated.push({
            id: nextShiftId(generated),
            name: s.name || "Auto Shift",
            role: s.role || "Associate",
            type: s.type === "FT" ? "FT" : "PT",
            start: typeof s.start === "number" ? s.start : 9,
            duration: typeof s.duration === "number" ? s.duration : 8,
            meal: s.meal
          });
        }

        onOverwriteShifts(generated);
        
        // Notify chat
        setChatLogs(prev => [
          ...prev,
          {
            sender: "system",
            text: "AI Schedule Optimization Completed.",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          },
          {
            sender: "ai",
            text: data.reasoning || "I've rebuilt and balanced your shift roster from scratch to optimally fit your staffing targets. PT/FT distributions have been optimized to cover peak periods.",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        
        // Trigger auto-audit to show updated score
        await triggerAudit(generated);
      }
    } catch (e: any) {
      console.error(e);
      setActionError(`Could not optimize schedule: ${e.message}`);
      setChatLogs(prev => [
        ...prev,
        {
          sender: "system",
          text: `Error optimizing schedule: ${e.message}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsOptimizing(false);
    }
  };

  // Trigger Schedule Audit
  const triggerAudit = async (customShifts?: Shift[]) => {
    setIsAuditing(true);
    setActionError(null);
    try {
      const response = await fetch("/api/gemini/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shifts: customShifts || shifts, targets })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `Request failed (${response.status}).`);
      }
      if (typeof data.healthScore === "number") {
        setHealthScore(data.healthScore);
        setFindings(data.findings || []);
        setRecommendations(data.recommendations || []);
      }
    } catch (e: any) {
      console.error("Audit error", e);
      setActionError(`Could not run audit: ${e.message}`);
    } finally {
      setIsAuditing(false);
    }
  };

  // Chat conversation
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isChatLoading) return;

    const userMsg = inputMessage;
    setInputMessage("");

    setChatLogs(prev => [
      ...prev,
      {
        sender: "user",
        text: userMsg,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);

    setIsChatLoading(true);

    try {
      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, currentShifts: shifts, targets })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `Request failed (${response.status}).`);
      }

      setChatLogs(prev => [
        ...prev,
        {
          sender: "ai",
          text: data.message || "I've updated the schedule according to your inputs.",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      if (data.mutations && Array.isArray(data.mutations) && data.mutations.length > 0) {
        onApplyMutations(data.mutations);
      }
    } catch (err: any) {
      setChatLogs(prev => [
        ...prev,
        {
          sender: "system",
          text: `Chat Service Unreachable: ${err.message}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Run initial audit when component loads and API key is OK
  useEffect(() => {
    if (apiKeyStatus === "ok" && healthScore === null && shifts.length > 0) {
      triggerAudit();
    }
  }, [apiKeyStatus, shifts]);

  const handleApplyFindingAction = (suggestedAction?: Mutation) => {
    if (!suggestedAction) return;
    onApplyMutations([suggestedAction]);

    // Remove the finding from the UI for instant feedback, then re-audit.
    setFindings(prev => prev.filter(f => f.suggestedAction !== suggestedAction));
    setTimeout(() => {
      triggerAudit();
    }, 1200);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm transition-all duration-200 overflow-hidden flex flex-col h-[520px]">
      {/* Title Bar */}
      <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              Gemini Flash Copilot <span className="text-[10px] font-extrabold text-white bg-indigo-600 px-1.5 py-0.5 rounded-full lowercase tracking-normal">3.5</span>
            </span>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Auto-Optimize & Compliance Auditor</p>
          </div>
        </div>

        {/* Action controls */}
        {apiKeyStatus === "ok" && (
          <div className="flex items-center gap-1 bg-slate-200/50 dark:bg-slate-800 p-1 rounded-lg">
            <button
              id="copilot-tab-chat"
              onClick={() => setActiveTab("chat")}
              className={`text-xs px-3 py-1.5 font-bold rounded-md transition-all ${
                activeTab === "chat"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              Copilot Chat
            </button>
            <button
              id="copilot-tab-audit"
              onClick={() => {
                setActiveTab("audit");
                triggerAudit();
              }}
              className={`text-xs px-3 py-1.5 font-bold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === "audit"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              Auditor
              {healthScore !== null && (
                <span className={`w-2 h-2 rounded-full ${healthScore >= 80 ? "bg-emerald-500" : healthScore >= 50 ? "bg-amber-500" : "bg-red-500"}`} />
              )}
            </button>
          </div>
        )}
      </div>

      {actionError && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1 leading-relaxed">{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label="Dismiss error"
            className="shrink-0 text-red-400 hover:text-red-600 dark:hover:text-red-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col min-h-0 bg-white dark:bg-slate-900">
        {apiKeyStatus === "checking" ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Loading Assistant services...</p>
          </div>
        ) : apiKeyStatus === "missing" ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/30 text-amber-500 rounded-full flex items-center justify-center mb-4">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-white">Gemini API Key Missing</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-2 leading-relaxed">
              We've created a fully interactive Gemini 3.5 Assistant. To unlock smart scheduling, auto-optimize, and compliance auditing, add your Gemini API Key.
            </p>
            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-[11px] rounded-lg max-w-sm text-left font-mono text-slate-500 dark:text-slate-400 space-y-1">
              <p>1. Open **Settings &gt; Secrets** panel</p>
              <p>2. Add **GEMINI_API_KEY** secret</p>
              <p>3. Refresh the application</p>
            </div>
            <div className="mt-6 text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1 justify-center">
              <Heart className="w-3.5 h-3.5 fill-current text-rose-500" />
              <span>Full-stack local simulator active</span>
            </div>
          </div>
        ) : activeTab === "chat" ? (
          /* Chat pane */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Thread logs */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 mb-3">
              {chatLogs.map((log, idx) => (
                <div 
                  key={idx} 
                  className={`flex flex-col max-w-[85%] ${
                    log.sender === "user" 
                      ? "ml-auto items-end" 
                      : log.sender === "system" 
                        ? "mx-auto items-center" 
                        : "items-start"
                  }`}
                >
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold mb-1 px-1">
                    {log.sender === "user" ? "Store Manager" : log.sender === "system" ? "SYSTEM ALERT" : "Gemini Copilot"}
                  </span>
                  <div className={`p-3 rounded-2xl text-xs md:text-sm leading-relaxed transition-colors ${
                    log.sender === "user"
                      ? "bg-indigo-600 text-white rounded-br-none font-medium shadow-sm"
                      : log.sender === "system"
                        ? "bg-slate-100 dark:bg-slate-800/50 text-slate-500 text-[10px] uppercase font-bold tracking-wide border border-slate-200 dark:border-slate-700/50 rounded-lg py-1 px-3"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-bl-none border border-slate-200/50 dark:border-slate-700/50"
                  }`}>
                    {log.text}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex flex-col items-start max-w-[85%]">
                  <span className="text-[9px] text-indigo-500 font-bold mb-1 px-1 animate-pulse">Gemini thinking...</span>
                  <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl rounded-bl-none border border-slate-200/50 dark:border-slate-700/50 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                    <span className="text-xs">Adjusting staff constraints...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Actions Panel */}
            <div className="flex flex-wrap gap-1.5 border-t border-slate-100 dark:border-slate-800 pt-3 pb-2 text-[10px]">
              <span className="text-slate-400 dark:text-slate-500 self-center font-bold uppercase tracking-wider mr-1">Suggest:</span>
              <button 
                onClick={() => setInputMessage("Add afternoon stocker shift starts 4pm duration 5 hours")}
                className="px-2 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                + afternoon stocker
              </button>
              <button 
                type="button"
                onClick={() => setInputMessage("Give Marcus Aurelius a meal break from 10am to 11am")}
                className="px-2 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                🍴 Adjust Marcus lunch
              </button>
              <button 
                type="button"
                onClick={() => setInputMessage("Remove david kim and Emily Wright")}
                className="px-2 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                🗑️ Delete staff Close
              </button>
            </div>

            {/* Text input form */}
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                id="gemini-chat-input"
                type="text"
                placeholder="Instruct Gemini to edit the shifts (e.g. 'add two supervisors at 8am')..."
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                className="flex-grow rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs md:text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-sm transition-all"
                disabled={isChatLoading}
              />
              <button
                id="gemini-send-btn"
                type="submit"
                disabled={!inputMessage.trim() || isChatLoading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg px-4 py-2 flex items-center justify-center shrink-0 shadow-sm transition-all active:scale-95"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          /* Audit pane */
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            
            {/* Score & General controls */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/50">
              <div className="flex flex-col justify-center items-center py-2 border-r border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-2">Schedule Health</span>
                {healthScore !== null ? (
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-black ${healthScore >= 85 ? "text-emerald-500" : healthScore >= 60 ? "text-amber-500" : "text-red-500"}`}>
                      {healthScore}
                    </span>
                    <span className="text-xs text-slate-400 uppercase font-extrabold">%</span>
                  </div>
                ) : (
                  <span className="text-slate-400 italic text-xs py-1">Run audit</span>
                )}
              </div>

              <div className="flex flex-col justify-center gap-1.5 px-2">
                <button
                  id="gemini-optimize-btn"
                  onClick={handleOptimizeClick}
                  disabled={isOptimizing}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-55 px-3 py-1.5 rounded-lg text-white font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all text-center"
                >
                  {isOptimizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                  Auto-Balance shifts
                </button>
                <button
                  id="gemini-re-audit-btn"
                  onClick={() => triggerAudit()}
                  disabled={isAuditing}
                  className="w-full bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 hover:bg-slate-300 disabled:opacity-55 px-3 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all text-center"
                >
                  {isAuditing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  Re-evaluate Health
                </button>
              </div>
            </div>

            {/* Audit findings list */}
            <div className="flex-grow overflow-y-auto pr-1 space-y-3 min-h-[220px]">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                Detected Bulletins ({findings.length})
              </span>

              {isAuditing ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  <span className="text-xs font-semibold">Running multi-variance compliance analysis...</span>
                </div>
              ) : findings.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl bg-indigo-50/20 border border-dashed border-indigo-200 dark:border-indigo-950/40">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mb-2" />
                  <p className="text-xs font-bold text-slate-800 dark:text-white">Schedule Fully Compliant!</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-[240px] mt-1 text-center">No missing meal breaks, exhausting shifts, or staffing targets shortfalls found by Gemini auditor.</p>
                </div>
              ) : (
                findings.map((item, id) => {
                  let alertIcon = <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />;
                  let alertBg = "bg-red-50/60 dark:bg-red-950/20 border-red-100 dark:border-red-950/40";
                  if (item.severity === "warning") {
                    alertIcon = <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
                    alertBg = "bg-amber-50/60 dark:bg-amber-950/20 border-amber-100 dark:border-amber-950/40";
                  } else if (item.severity === "info") {
                    alertIcon = <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0" />;
                    alertBg = "bg-indigo-50/60 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-950/40";
                  }

                  return (
                    <div key={id} className={`flex gap-3 p-3 rounded-lg border text-xs justify-between items-start transition-all ${alertBg}`}>
                      <div className="flex gap-2 min-w-0">
                        {alertIcon}
                        <p className="text-slate-600 dark:text-slate-300 font-medium leading-normal pr-1">{item.message}</p>
                      </div>

                      {item.suggestedAction && (
                        <button
                          type="button"
                          onClick={() => handleApplyFindingAction(item.suggestedAction)}
                          className="shrink-0 text-[10px] font-extrabold uppercase bg-white dark:bg-slate-800 py-1.5 px-3 rounded border border-slate-200 dark:border-slate-700 hover:border-slate-400 text-indigo-600 dark:text-indigo-400 hover:shadow-sm cursor-pointer active:scale-95 transition-transform"
                        >
                          Auto-Fix
                        </button>
                      )}
                    </div>
                  );
                })
              )}

              {/* recommendations / Compliance advisory rules */}
              {recommendations.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50 p-4 rounded-xl space-y-2 mt-4 text-xs">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-1">compliance advisory</span>
                  <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400">
                    {recommendations.map((txt, rIdx) => (
                      <li key={rIdx} className="leading-relaxed">{txt}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
