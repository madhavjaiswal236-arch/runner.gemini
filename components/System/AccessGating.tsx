import React, { useState, useEffect, useRef } from "react";
import { 
  Lock, Key, Shield, Settings, Trash2, Plus, 
  RefreshCw, AlertTriangle, Play, Maximize2, CheckCircle2, X, Eye, EyeOff
} from "lucide-react";
import { triggerVibrate } from "../../store";

interface AccessGatingProps {
  onValidated: (sessionToken: string, durationMinutes: number, expiresAt: number) => void;
  onLogout: () => void;
  sessionToken: string | null;
  setSessionToken: (token: string | null) => void;
}

interface CodeEntry {
  code: string;
  durationMinutes: number;
  status: "unused" | "active" | "used";
  activatedAt: number | null;
  expiresAt: number | null;
  sessionToken: string | null;
}

export function AccessGating({ onValidated, onLogout, sessionToken, setSessionToken }: AccessGatingProps) {
  // Gating screen states: 'gating' | 'launch' | 'playing' | 'expired'
  const [gameState, setGameState] = useState<"gating" | "launch" | "playing" | "expired">("gating");
  const [accessCode, setAccessCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [expiresAtState, setExpiresAtState] = useState<number | null>(null);

  // Countdown timer state
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Fullscreen guard state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Admin Portal states
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  // Admin code management states
  const [codes, setCodes] = useState<CodeEntry[]>([]);
  const [summary, setSummary] = useState({ total: 0, unused: 0, active: 0, used: 0 });
  const [bulkCodes, setBulkCodes] = useState("");
  const [bulkDuration, setBulkDuration] = useState(10);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");

  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initial mounting check for existing sessionStorage token
  useEffect(() => {
    const savedToken = sessionStorage.getItem("active_runner_session");
    if (savedToken) {
      checkExistingSession(savedToken);
    }
  }, []);

  // 2. Validate session status helper
  const checkExistingSession = async (token: string) => {
    try {
      setLoading(true);
      const res = await fetch("/api/session-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: token }),
      });
      const data = await res.json();
      if (data.status === "active") {
        setSessionToken(token);
        setDuration(data.durationMinutes);
        setExpiresAtState(data.expiresAt);
        const secs = Math.max(0, Math.round(data.remainingMs / 1000));
        setRemainingSeconds(secs);
        
        // If they were already in fullscreen, jump to playing, else launch
        if (document.fullscreenElement) {
          setGameState("playing");
          setIsFullscreen(true);
          onValidated(token, data.durationMinutes, data.expiresAt);
        } else {
          setGameState("launch");
        }
      } else {
        sessionStorage.removeItem("active_runner_session");
      }
    } catch (e) {
      console.error("Failed to re-authenticate active session:", e);
    } finally {
      setLoading(false);
    }
  };

  // 3. Access code submission handler
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) {
      setErrorMsg("Please input a valid access code.");
      return;
    }

    setErrorMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/validate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: accessCode.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      // Success! Valid code entered
      sessionStorage.setItem("active_runner_session", data.sessionToken);
      setSessionToken(data.sessionToken);
      setDuration(data.durationMinutes);
      setExpiresAtState(data.expiresAt);
      
      const secs = Math.max(0, Math.round((data.expiresAt - Date.now()) / 1000));
      setRemainingSeconds(secs);

      triggerVibrate([80, 50, 80]); // Success vibration pulse
      setGameState("launch");
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid code. Please try again.");
      triggerVibrate([300]); // Error vibration
    } finally {
      setLoading(false);
    }
  };

  // 4. Force Fullscreen and launch the game canvas
  const handleLaunchGame = async () => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((el as any).webkitRequestFullscreen) {
        await (el as any).webkitRequestFullscreen();
      } else if ((el as any).msRequestFullscreen) {
        await (el as any).msRequestFullscreen();
      }
      
      setIsFullscreen(true);
      setGameState("playing");
      
      if (sessionToken && duration && expiresAtState) {
        onValidated(sessionToken, duration, expiresAtState);
      }
    } catch (e) {
      console.warn("Fullscreen request blocked or failed:", e);
      // Fallback: Proceed even if fullscreen is blocked (e.g. within iframe development), but notify
      setIsFullscreen(true);
      setGameState("playing");
      if (sessionToken && duration && expiresAtState) {
        onValidated(sessionToken, duration, expiresAtState);
      }
    }
  };

  // 5. Handle global fullscreen exit events
  useEffect(() => {
    const onFullscreenChange = () => {
      const activeFullscreen = !!document.fullscreenElement;
      setIsFullscreen(activeFullscreen);

      if (gameState === "playing" && !activeFullscreen) {
        // Exited fullscreen while playing! Trigger warning vibration
        triggerVibrate([200, 100, 200]);
      }
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    document.addEventListener("mozfullscreenchange", onFullscreenChange);
    document.addEventListener("MSFullscreenChange", onFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      document.removeEventListener("mozfullscreenchange", onFullscreenChange);
      document.removeEventListener("MSFullscreenChange", onFullscreenChange);
    };
  }, [gameState]);

  // 6. Sync active countdown and server heartbeat status checks
  useEffect(() => {
    if (gameState !== "playing" || !sessionToken) {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      return;
    }

    // A. Countdown timer (updates once a second)
    countdownIntervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          handleSessionExpired();
          return 0;
        }

        // Haptic feedback alert for final 10 seconds (vibrate once a second)
        if (prev <= 11) {
          triggerVibrate(60);
        }

        return prev - 1;
      });
    }, 1000);

    // B. Server Heartbeat validation (every 5 seconds)
    heartbeatIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/session-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionToken }),
        });
        const data = await res.json();

        if (data.status === "active") {
          const serverSecs = Math.max(0, Math.round(data.remainingMs / 1000));
          // Synchronize with server-authoritative remaining time
          setRemainingSeconds(serverSecs);
        } else {
          // Status is expired or invalid
          handleSessionExpired();
        }
      } catch (err) {
        console.warn("Heartbeat update failed (network lag):", err);
      }
    }, 5000);

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, [gameState, sessionToken]);

  // 7. Expired Session action
  const handleSessionExpired = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    
    // Play intense alert vibrations
    triggerVibrate([400, 100, 400, 100, 600]);

    // Exit Fullscreen mode
    if (document.fullscreenElement) {
      try {
        document.exitFullscreen();
      } catch (e) {
        console.warn("Failed to exit fullscreen:", e);
      }
    }

    sessionStorage.removeItem("active_runner_session");
    setGameState("expired");
    onLogout();
  };

  const handleConfirmQuit = () => {
    triggerVibrate(100);
    setShowQuitConfirm(true);
  };

  const executeQuitAndVoid = async () => {
    setLoading(true);
    try {
      await fetch("/api/void-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken }),
      });
    } catch (e) {
      console.error("Failed to void session on server:", e);
    }
    
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    
    sessionStorage.removeItem("active_runner_session");
    
    if (document.fullscreenElement) {
      try {
        document.exitFullscreen();
      } catch (e) {
        console.warn("Failed to exit fullscreen:", e);
      }
    }

    setGameState("expired");
    setShowQuitConfirm(false);
    onLogout();
    setLoading(false);
    triggerVibrate([300, 100, 300]);
  };

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
  };

  // ================= ADMIN PORTAL FUNCTIONS =================

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === "mj235689@#%") {
      setAdminAuthed(true);
      setAdminError("");
      fetchCodesStatus();
    } else {
      setAdminError("Incorrect Administrator Access Code.");
      triggerVibrate([200]);
    }
  };

  const fetchCodesStatus = async () => {
    try {
      setAdminLoading(true);
      const res = await fetch("/api/admin/status");
      const data = await res.json();
      setCodes(data.codes);
      setSummary(data.summary);
    } catch (e) {
      console.error("Failed to load codes:", e);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleBulkAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkCodes.trim()) {
      setAdminMessage("Please paste at least one code.");
      return;
    }

    // Split by newlines, commas, or spaces
    const list = bulkCodes
      .split(/[\n, ]+/)
      .map((x) => x.trim())
      .filter((x) => x.length > 0);

    if (list.length === 0) {
      setAdminMessage("No valid codes found after parsing.");
      return;
    }

    setAdminLoading(true);
    setAdminMessage("");

    try {
      const res = await fetch("/api/admin/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codesList: list,
          durationMinutes: bulkDuration
        }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setAdminMessage(`Successfully added ${data.addedCount} codes!`);
        setBulkCodes("");
        fetchCodesStatus();
        triggerVibrate([100, 50, 100]);
      } else {
        setAdminMessage(data.error || "Failed to add codes.");
      }
    } catch (e) {
      setAdminMessage("Network error trying to upload codes.");
    } finally {
      setAdminLoading(false);
    }
  };

  const handleDeleteCode = async (codeToDelete: string) => {
    if (!confirm(`Are you sure you want to delete code: ${codeToDelete}?`)) return;

    try {
      const res = await fetch("/api/admin/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeToDelete }),
      });
      if (res.ok) {
        fetchCodesStatus();
        triggerVibrate(100);
      }
    } catch (e) {
      console.error("Failed to delete code:", e);
    }
  };

  const handleResetDb = async () => {
    if (!confirm("Wipe the entire active list and reload the default developer codes?")) return;

    try {
      const res = await fetch("/api/admin/reset-db", { method: "POST" });
      if (res.ok) {
        fetchCodesStatus();
        triggerVibrate([150, 50, 150]);
      }
    } catch (e) {
      console.error("Failed to reset database:", e);
    }
  };

  const handleExitAdmin = () => {
    setShowAdmin(false);
    setAdminAuthed(false);
    setAdminPassword("");
    setAdminError("");
    setAdminMessage("");
  };

  // Render components
  return (
    <>
      {/* 1. SECURE LOCK GATING VIEW */}
      {gameState === "gating" && !showAdmin && (
        <div id="gate-container" className="absolute inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050011] text-white p-6 font-cyber">
          {/* Neon Grid Background Effect */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.2),rgba(255,255,255,0))] select-none pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%] opacity-40 pointer-events-none" />

          <div className="w-full max-w-md bg-[#0a0520] border-2 border-[#ff0055] rounded-lg p-8 shadow-[0_0_25px_rgba(255,0,85,0.35)] relative overflow-hidden backdrop-blur-md">
            {/* Cyan Accent Corner lines */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#00ffff]" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#00ffff]" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#00ffff]" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#00ffff]" />

            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-red-950/40 border border-red-500/50 flex items-center justify-center text-red-500 animate-pulse mb-4 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                <Lock className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold tracking-widest text-[#ff0055] uppercase">
                Access Gated
              </h1>
              <p className="text-gray-400 text-xs mt-2 uppercase font-sans tracking-wider">
                This application requires a secure validation key to play.
              </p>
            </div>

            <form onSubmit={handleVerifyCode} className="space-y-4 font-sans">
              <div>
                <label className="block text-xs uppercase text-[#00ffff] tracking-widest mb-1 font-cyber">
                  Enter Unlock Code
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="XMXX-XXXX-XXXX-XXXX"
                    className="w-full bg-[#11072d] border border-gray-700 focus:border-[#ff0055] focus:ring-1 focus:ring-[#ff0055] rounded-md px-10 py-3 text-sm text-white tracking-widest placeholder-gray-600 focus:outline-none uppercase font-mono transition-all"
                    disabled={loading}
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-900/50 p-3 rounded-md animate-bounce">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#ff0055] to-[#7a00cc] hover:from-[#ff3385] hover:to-[#9900ff] active:scale-[0.98] transition-all text-white font-cyber text-xs uppercase py-3.5 rounded-md font-bold tracking-widest shadow-[0_4px_15px_rgba(255,0,85,0.4)] hover:shadow-[0_4px_25px_rgba(255,0,85,0.6)] flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    Verify System Access
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 border-t border-gray-800/60 pt-4 flex justify-between items-center text-[10px] text-gray-500 uppercase tracking-widest font-sans">
              <span>System Status: Fully Operational</span>
              <span>Secure Gateway</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. FORCE FULLSCREEN LAUNCH PAGE */}
      {gameState === "launch" && (
        <div id="launch-container" className="absolute inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050011] text-white p-6 font-cyber">
          {/* Cyber scanlines */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(0,255,255,0.15),rgba(255,255,255,0))] pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(0,255,0,0.02),rgba(0,255,255,0.05),rgba(255,0,0,0.02))] bg-[size:100%_4px,3px_100%] opacity-40 pointer-events-none" />

          <div className="w-full max-w-md bg-[#020d1c]/90 border-2 border-[#00ffff] rounded-lg p-8 shadow-[0_0_25px_rgba(0,255,255,0.35)] relative overflow-hidden backdrop-blur-md">
            {/* Cyber Corner lines */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#ff0055]" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#ff0055]" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#ff0055]" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#ff0055]" />

            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-cyan-950/40 border border-cyan-500/50 flex items-center justify-center text-[#00ffff] mb-4 animate-bounce shadow-[0_0_15px_rgba(0,255,255,0.2)]">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h1 className="text-xl font-bold tracking-widest text-[#00ffff] uppercase">
                Access Code Validated
              </h1>
              <div className="bg-[#111c2e] border border-[#00ffff]/30 px-4 py-2.5 rounded-md mt-4 w-full">
                <span className="block text-[10px] text-gray-400 uppercase tracking-widest">
                  Allocated Game Duration:
                </span>
                <span className="text-2xl font-bold text-white tracking-widest">
                  {duration} MINUTES
                </span>
              </div>
            </div>

            <div className="space-y-4 font-sans text-xs text-gray-400 leading-relaxed text-center mb-6">
              <p className="flex items-center justify-center gap-1.5 text-yellow-400 font-cyber text-[10px] uppercase tracking-wider">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Mandatory Environment constraint
              </p>
              <p className="uppercase text-[10px] tracking-wider">
                To prevent bypass, this application must be played in <span className="text-[#00ffff] font-bold font-cyber">Full-Screen (Full Page) Mode only</span> with <span className="text-[#ff0055] font-bold font-cyber">Haptic Vibrations</span> enabled.
              </p>
              <p className="text-[9px] text-gray-500 uppercase tracking-widest">
                If you exit fullscreen during play, the game is paused until you return. When the timer hits zero, the session is cleared, and the code is banned.
              </p>
            </div>

            <button
              onClick={handleLaunchGame}
              className="w-full bg-gradient-to-r from-[#00ffff] to-[#0088ff] hover:from-[#33ffff] hover:to-[#33a3ff] active:scale-[0.98] transition-all text-black font-cyber text-xs uppercase py-4 rounded-md font-bold tracking-widest shadow-[0_4px_15px_rgba(0,255,255,0.4)] hover:shadow-[0_4px_25px_rgba(0,255,255,0.6)] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
              Launch Fullscreen Game
            </button>
          </div>
        </div>
      )}

      {/* 3. ACTIVE GAME COUNTER HUD (ONLY IF STATE IS PLAYING) */}
      {gameState === "playing" && (
        <>
          <div 
            id="secure-timer-overlay" 
            className={`absolute top-4 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-3 px-6 py-2.5 rounded-full border-2 bg-black/80 backdrop-blur-md text-white select-none transition-all font-cyber tracking-widest ${
              remainingSeconds < 60 
                ? "border-[#ff0055] text-[#ff0055] shadow-[0_0_15px_rgba(255,0,85,0.5)] scale-110 animate-pulse" 
                : "border-[#00ffff] text-[#00ffff] shadow-[0_0_10px_rgba(0,255,255,0.25)]"
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-current animate-ping shrink-0" />
            <span className="text-xs uppercase tracking-wider text-gray-400">Secure Session Time:</span>
            <span className="text-base font-bold font-mono">{formatTime(remainingSeconds)}</span>
          </div>

          <button
            onClick={handleConfirmQuit}
            className="absolute top-4 right-4 z-[999] flex items-center gap-2 px-4 py-2 border border-red-500/50 hover:border-red-500 bg-black/80 hover:bg-red-950/40 text-red-500 hover:text-red-400 font-cyber text-xs uppercase tracking-widest rounded-md cursor-pointer transition-all shadow-[0_0_10px_rgba(239,68,68,0.2)] hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]"
          >
            <X className="w-3.5 h-3.5" />
            Quit Game
          </button>
        </>
      )}

      {/* 4. FULLSCREEN LOCKOUT GUARD INTERCEPT */}
      {gameState === "playing" && !isFullscreen && (
        <div id="fullscreen-blocker" className="absolute inset-0 z-[99999] flex flex-col items-center justify-center bg-[#050011]/95 text-white p-6 font-cyber">
          <div className="w-full max-w-sm bg-red-950/30 border-2 border-[#ff0055] rounded-lg p-8 shadow-[0_0_30px_rgba(255,0,85,0.5)] text-center relative backdrop-blur-md animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-red-950/60 border border-red-500/50 flex items-center justify-center text-red-500 mx-auto mb-4 animate-bounce">
              <AlertTriangle className="w-8 h-8" />
            </div>
            
            <h2 className="text-lg font-bold tracking-widest text-[#ff0055] uppercase mb-2">
              FULL SCREEN EXITED
            </h2>
            <p className="font-sans text-xs text-gray-300 uppercase tracking-wide leading-relaxed mb-6">
              This application is played on <span className="text-[#00ffff] font-bold">full page mode only</span>. The game is paused. Please return to full screen to resume your session.
            </p>

            <button
              onClick={handleLaunchGame}
              className="w-full bg-[#ff0055] hover:bg-[#ff3385] text-white font-cyber text-xs uppercase py-3.5 rounded-md font-bold tracking-widest shadow-[0_4px_15px_rgba(255,0,85,0.4)] cursor-pointer transition-colors"
            >
              Resume Full Screen
            </button>
          </div>
        </div>
      )}

      {/* 5. SESSION EXPIRED & BANNED SCREEN */}
      {gameState === "expired" && (
        <div id="expired-lockout" className="absolute inset-0 z-[99999] flex flex-col items-center justify-center bg-[#050011] text-white p-6 font-cyber">
          {/* Cyber scanlines */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%] opacity-40 pointer-events-none" />

          <div className="w-full max-w-md bg-[#0a0520] border-2 border-red-600 rounded-lg p-8 shadow-[0_0_30px_rgba(220,38,38,0.5)] text-center relative backdrop-blur-md">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-red-600" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-red-600" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-red-600" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-red-600" />

            <div className="w-16 h-16 rounded-full bg-red-950/60 border border-red-600 flex items-center justify-center text-red-500 mx-auto mb-6 shadow-[0_0_15px_rgba(220,38,38,0.3)]">
              <Lock className="w-8 h-8" />
            </div>

            <h1 className="text-2xl font-bold tracking-widest text-red-500 uppercase mb-3">
              Session Terminated
            </h1>
            <h2 className="text-[#ff0055] text-xs font-semibold uppercase tracking-widest border border-[#ff0055]/30 bg-[#ff0055]/10 py-1.5 rounded-md mb-6 px-4">
              Access Code Permanently Banned & Disposed
            </h2>

            <div className="space-y-4 font-sans text-xs text-gray-400 leading-relaxed mb-8">
              <p className="uppercase tracking-wider">
                Your allocated play timer has run out. The associated access key has been <span className="text-red-500 font-bold">invalidated</span> and <span className="text-red-500 font-bold">deleted</span> from the registry.
              </p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider border-t border-gray-800 pt-4">
                Attempts to refresh, restart, or re-input this code will fail. Please request a new unique code to enter again.
              </p>
            </div>

            <button
              onClick={() => {
                setGameState("gating");
                setAccessCode("");
                setErrorMsg("");
              }}
              className="w-full bg-[#11072d] hover:bg-[#1a0c44] border border-gray-700 hover:border-[#ff0055] text-gray-300 hover:text-white font-cyber text-xs uppercase py-3 rounded-md tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Return to Gate
            </button>
          </div>
        </div>
      )}

      {/* ================= ADMIN CONSOLE MODAL ================= */}
      {showAdmin && (
        <div id="admin-modal" className="absolute inset-0 z-[999999] flex items-center justify-center bg-[#03010b]/98 text-white p-4 font-sans overflow-y-auto">
          <div className="w-full max-w-4xl bg-[#0a0520] border-2 border-[#00ffff] rounded-lg shadow-[0_0_40px_rgba(0,255,255,0.4)] overflow-hidden relative max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="bg-[#110c2e] border-b border-[#00ffff]/30 px-6 py-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#00ffff] animate-pulse" />
                <span className="font-cyber font-bold tracking-widest text-[#00ffff] text-sm uppercase">
                  Developer Code Administration
                </span>
              </div>
              <button
                onClick={handleExitAdmin}
                className="text-gray-400 hover:text-[#ff0055] transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Admin Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Login block if not authed */}
              {!adminAuthed ? (
                <div className="max-w-md mx-auto py-12">
                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div className="text-center mb-6">
                      <Lock className="w-12 h-12 text-[#00ffff] mx-auto mb-2" />
                      <h3 className="text-white font-cyber uppercase tracking-wider">Unlock Secure Panel</h3>
                      <p className="text-gray-500 text-xs mt-1">Provide developer administrative credentials</p>
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">
                        Admin Secret Passcode
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-[#11072d] border border-gray-700 focus:border-[#00ffff] rounded-md px-4 py-2 text-sm text-white focus:outline-none transition-all tracking-widest"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {adminError && (
                      <p className="text-xs text-red-400 font-semibold bg-red-950/20 p-2.5 rounded border border-red-900/40">
                        {adminError}
                      </p>
                    )}

                    <p className="text-[10px] text-gray-500 text-center uppercase tracking-wider">
                      Default AI Studio Admin Code: <code className="text-[#00ffff] font-mono">mj235689@#%</code>
                    </p>

                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-[#00ffff] to-[#0088ff] text-black font-cyber text-xs uppercase font-bold py-2.5 rounded hover:shadow-[0_0_15px_rgba(0,255,255,0.4)] transition-all cursor-pointer"
                    >
                      Enter Console
                    </button>
                  </form>
                </div>
              ) : (
                // Authenticated Admin Panel
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* LEFT PANEL: Bulk Import Codes */}
                  <div className="bg-[#110a2f]/70 border border-gray-800 rounded-lg p-5">
                    <h3 className="text-xs font-cyber tracking-widest text-[#00ffff] uppercase mb-3 flex items-center gap-1.5 border-b border-gray-800 pb-2">
                      <Plus className="w-4 h-4" /> Load Codes List
                    </h3>

                    <form onSubmit={handleBulkAdd} className="space-y-4">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-gray-400 mb-1">
                          Play Mode Duration
                        </label>
                        <select
                          value={bulkDuration}
                          onChange={(e) => setBulkDuration(Number(e.target.value))}
                          className="w-full bg-[#18113e] border border-gray-700 rounded p-2 text-xs text-white focus:outline-none focus:border-[#00ffff]"
                        >
                          <option value={10}>10 Minutes Playtime</option>
                          <option value={20}>20 Minutes Playtime</option>
                          <option value={30}>30 Minutes Playtime</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-gray-400 mb-1">
                          Paste Key Codes List
                        </label>
                        <textarea
                          rows={6}
                          value={bulkCodes}
                          onChange={(e) => setBulkCodes(e.target.value)}
                          placeholder="Paste a comma, space, or newline separated list of unique codes here..."
                          className="w-full bg-[#08031a] border border-gray-700 rounded p-2 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-[#00ffff]"
                        />
                        <span className="text-[9px] text-gray-500 uppercase mt-1 block leading-relaxed">
                          Enter custom code lists. Duplicates will be auto-filtered.
                        </span>
                      </div>

                      {adminMessage && (
                        <p className="text-xs text-yellow-400 bg-yellow-950/20 p-2 border border-yellow-900/40 rounded">
                          {adminMessage}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={adminLoading}
                        className="w-full bg-gradient-to-r from-[#00ffff] to-[#0088ff] hover:shadow-[0_0_10px_rgba(0,255,255,0.2)] text-black font-cyber text-xs uppercase font-bold py-2.5 rounded transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        {adminLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Import Codes List"}
                      </button>
                    </form>

                    <div className="mt-6 border-t border-gray-800 pt-4">
                      <h4 className="text-[10px] font-cyber uppercase text-red-500 tracking-wider mb-2">Danger Zone</h4>
                      <button
                        onClick={handleResetDb}
                        className="w-full border border-red-500/30 hover:border-red-500 text-red-500 hover:bg-red-950/20 text-xs py-2 rounded transition-colors flex items-center justify-center gap-1 cursor-pointer font-semibold uppercase tracking-wider"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Reset All (Seed Codes)
                      </button>
                    </div>
                  </div>

                  {/* RIGHT PANEL: Current Codes Status & Registry (Takes 2 Columns) */}
                  <div className="lg:col-span-2 bg-[#110a2f]/70 border border-gray-800 rounded-lg p-5 flex flex-col h-[520px]">
                    
                    {/* Registry Stats Summary */}
                    <div className="grid grid-cols-4 gap-2 mb-4 shrink-0 text-center">
                      <div className="bg-[#18113e] p-2 rounded border border-gray-800">
                        <span className="block text-[8px] uppercase text-gray-400">Total</span>
                        <span className="text-sm font-bold font-cyber text-white">{summary.total}</span>
                      </div>
                      <div className="bg-[#111e1c] p-2 rounded border border-green-900/30">
                        <span className="block text-[8px] uppercase text-green-400">Unused</span>
                        <span className="text-sm font-bold font-cyber text-green-400">{summary.unused}</span>
                      </div>
                      <div className="bg-[#111b2d] p-2 rounded border border-blue-900/30 animate-pulse">
                        <span className="block text-[8px] uppercase text-blue-400">Active</span>
                        <span className="text-sm font-bold font-cyber text-blue-400">{summary.active}</span>
                      </div>
                      <div className="bg-[#24111f] p-2 rounded border border-red-900/30">
                        <span className="block text-[8px] uppercase text-red-400">Banned</span>
                        <span className="text-sm font-bold font-cyber text-red-400">{summary.used}</span>
                      </div>
                    </div>

                    <h3 className="text-xs font-cyber tracking-widest text-[#00ffff] uppercase mb-2 shrink-0 pb-1 flex justify-between items-center border-b border-gray-800">
                      <span>Secure Code Registry</span>
                      <button 
                        onClick={fetchCodesStatus}
                        className="text-gray-400 hover:text-[#00ffff] transition-colors p-1 cursor-pointer"
                        title="Reload table data"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </h3>

                    {/* Table View */}
                    <div className="flex-1 overflow-y-auto pr-1">
                      {codes.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 text-xs">
                          No codes loaded in database. Use the left panel to load codes.
                        </div>
                      ) : (
                        <div className="w-full text-xs text-left">
                          <div className="grid grid-cols-12 bg-[#1b1244] p-2 text-[10px] text-gray-400 uppercase font-semibold tracking-wider rounded-t border-b border-gray-800 shrink-0">
                            <span className="col-span-5">Code Key</span>
                            <span className="col-span-2">Limit</span>
                            <span className="col-span-3">Status</span>
                            <span className="col-span-2 text-right">Action</span>
                          </div>

                          <div className="divide-y divide-gray-800/60 font-mono">
                            {codes.map((item) => (
                              <div key={item.code} className="grid grid-cols-12 py-2 px-2 hover:bg-white/5 items-center">
                                <span className={`col-span-5 font-bold tracking-wider text-xs ${item.status === 'used' ? 'line-through text-gray-600' : 'text-white'}`}>
                                  {item.code}
                                </span>
                                <span className="col-span-2 text-gray-400 text-xs">
                                  {item.durationMinutes}m
                                </span>
                                <span className="col-span-3">
                                  {item.status === "unused" && (
                                    <span className="bg-green-950/40 text-green-400 border border-green-900/60 px-1.5 py-0.5 rounded text-[9px] font-sans font-semibold tracking-wider uppercase">
                                      Unused
                                    </span>
                                  )}
                                  {item.status === "active" && (
                                    <span className="bg-blue-950/40 text-blue-400 border border-blue-900/60 px-1.5 py-0.5 rounded text-[9px] font-sans font-semibold tracking-wider uppercase animate-pulse">
                                      Active
                                    </span>
                                  )}
                                  {item.status === "used" && (
                                    <span className="bg-red-950/40 text-red-400 border border-red-900/60 px-1.5 py-0.5 rounded text-[9px] font-sans font-semibold tracking-wider uppercase">
                                      Banned
                                    </span>
                                  )}
                                </span>
                                <span className="col-span-2 text-right">
                                  <button
                                    onClick={() => handleDeleteCode(item.code)}
                                    className="text-gray-500 hover:text-red-500 p-1 cursor-pointer"
                                    title="Delete code"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* 6. QUIT CONFIRMATION POPUP */}
      {showQuitConfirm && (
        <div id="quit-confirm-modal" className="absolute inset-0 z-[99999] flex flex-col items-center justify-center bg-[#050011]/95 text-white p-6 font-cyber">
          <div className="w-full max-w-sm bg-red-950/20 border-2 border-red-500 rounded-lg p-8 shadow-[0_0_30px_rgba(239,68,68,0.45)] text-center relative backdrop-blur-md">
            <div className="w-16 h-16 rounded-full bg-red-950/60 border border-red-500/50 flex items-center justify-center text-red-500 mx-auto mb-4 animate-bounce">
              <AlertTriangle className="w-8 h-8" />
            </div>
            
            <h2 className="text-lg font-bold tracking-widest text-[#ff0055] uppercase mb-2">
              QUIT & VOID CODE?
            </h2>
            <p className="font-sans text-xs text-gray-300 uppercase tracking-wide leading-relaxed mb-6">
              Quitting now will <span className="text-[#ff0055] font-bold font-cyber">permanently dispose</span> and <span className="text-[#ff0055] font-bold font-cyber">ban your access code</span>. You will not be able to reuse this code ever again.
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={executeQuitAndVoid}
                disabled={loading}
                className="w-full bg-[#ff0055] hover:bg-[#ff3385] text-white font-cyber text-xs uppercase py-3.5 rounded-md font-bold tracking-widest shadow-[0_4px_15px_rgba(255,0,85,0.4)] cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "YES, VOID CODE & QUIT"}
              </button>
              
              <button
                onClick={() => {
                  setShowQuitConfirm(false);
                  triggerVibrate(50);
                }}
                disabled={loading}
                className="w-full bg-[#110c2e] hover:bg-[#1a1242] border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-cyber text-xs uppercase py-3 rounded-md tracking-widest transition-all cursor-pointer"
              >
                NO, RESUME PLAY
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
