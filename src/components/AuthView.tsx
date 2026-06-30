import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  googleProvider 
} from "../lib/firebase";
import { 
  Mail, 
  Lock, 
  ArrowRight, 
  Sparkles, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  AlertCircle,
  Loader2,
  ChevronRight,
  Globe
} from "lucide-react";
import DeadlineGuardianLogo from "./DeadlineGuardianLogo";

interface AuthViewProps {
  onAuthSuccess: (user: { uid: string; email: string | null; isGuest: boolean }) => void;
  onContinueAsGuest: () => void;
}

export default function AuthView({ onAuthSuccess, onContinueAsGuest }: AuthViewProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please fill out all fields.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        if (password.length < 6) {
          setError("Password must be at least 6 characters long.");
          setLoading(false);
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        onAuthSuccess({
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          isGuest: false
        });
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
        onAuthSuccess({
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          isGuest: false
        });
      }
    } catch (err: any) {
      console.warn("Email Auth Error:", err);
      let friendlyMessage = "Authentication failed. Please verify your credentials.";
      if (err.code === "auth/user-not-found") {
        friendlyMessage = "No account found with this email. Please sign up instead.";
      } else if (err.code === "auth/wrong-password") {
        friendlyMessage = "Incorrect password. Please try again.";
      } else if (err.code === "auth/email-already-in-use") {
        friendlyMessage = "This email is already registered. Please sign in instead.";
      } else if (err.code === "auth/invalid-email") {
        friendlyMessage = "Invalid email format.";
      } else if (err.code === "auth/weak-password") {
        friendlyMessage = "Password should be at least 6 characters.";
      }
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      onAuthSuccess({
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        isGuest: false
      });
    } catch (err: any) {
      console.warn("Google Sign-In Error:", err);
      if (err.code !== "auth/popup-closed-by-user") {
        setError("Failed to sign in with Google. Please try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen overflow-hidden bg-[#070b14] text-slate-200 flex items-center justify-center p-4 select-none relative antialiased font-sans">
      {/* Background radial glowing gradients */}
      <div className="absolute top-[-15%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-15%] left-[-10%] w-[500px] h-[500px] bg-purple-600/80 rounded-full blur-[180px] opacity-[0.08] pointer-events-none z-0"></div>

      <div className="w-full max-w-md z-10">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="bg-[#0b101c]/90 border border-white/5 backdrop-blur-2xl p-8 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col items-center"
        >
          {/* Subtle accent header line */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#6D5DFC] to-transparent"></div>

          {/* Logo Concept */}
          <div className="w-20 h-20 mb-5 relative group">
            <DeadlineGuardianLogo variant="app-icon" glowing />
          </div>

          <div className="text-center space-y-1 mb-8">
            <h2 className="text-xl font-extrabold text-white uppercase tracking-tight font-sans">
              THE DEADLINE GUARDIAN
            </h2>
            <p className="text-[11px] text-[#6D5DFC] font-mono tracking-widest font-black uppercase">
              DEFEND YOUR CALM & WORKFLOW
            </p>
            <p className="text-slate-400 text-xs max-w-xs mx-auto leading-relaxed pt-2">
              An autonomous cognitive shield powered by localized learning and sovereign timeline protection.
            </p>
          </div>

          {/* Form Switch tabs */}
          <div className="flex w-full bg-white/5 border border-white/5 p-1 rounded-2xl mb-6 select-none">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(false);
                setError(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                !isSignUp 
                  ? "bg-[#6D5DFC] text-white shadow-md shadow-[#6D5DFC]/10" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(true);
                setError(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isSignUp 
                  ? "bg-[#6D5DFC] text-white shadow-md shadow-[#6D5DFC]/10" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error Banner */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                className="w-full mb-5"
              >
                <div className="flex items-center gap-2.5 bg-rose-500/10 border border-rose-500/25 text-rose-300 p-3.5 rounded-xl text-xs font-medium leading-relaxed shadow-lg shadow-rose-500/5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{error}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Auth form */}
          <form onSubmit={handleEmailAuth} className="w-full space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-500 font-mono uppercase font-bold tracking-tight">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[#060a12] border border-white/5 focus:border-[#6D5DFC] focus:outline-none pl-11 pr-4 py-3.5 text-xs text-white rounded-xl placeholder:text-slate-600 font-sans transition-colors"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-500 font-mono uppercase font-bold tracking-tight">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#060a12] border border-white/5 focus:border-[#6D5DFC] focus:outline-none pl-11 pr-11 py-3.5 text-xs text-white rounded-xl placeholder:text-slate-600 font-sans transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-0.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-[#6D5DFC] hover:from-indigo-500 hover:to-[#6D5DFC]/90 text-white rounded-xl text-xs font-bold tracking-wide shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sovereign link establishing...</span>
                </>
              ) : (
                <>
                  <span>{isSignUp ? "Create Secure Vault" : "Defend Timeline"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Separator */}
          <div className="flex items-center w-full my-6 text-slate-600">
            <div className="flex-1 h-[1px] bg-white/5"></div>
            <span className="text-[9px] font-mono px-3 uppercase tracking-wider font-bold">OR SECURE VIA</span>
            <div className="flex-1 h-[1px] bg-white/5"></div>
          </div>

          {/* Social Sign-In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading || googleLoading}
            className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : (
              <Globe className="w-4 h-4 text-indigo-400" />
            )}
            <span>Continue with Google</span>
          </button>

          {/* Guest Mode footer */}
          <div className="mt-8 pt-6 border-t border-white/5 w-full text-center">
            <button
              type="button"
              onClick={onContinueAsGuest}
              className="text-slate-400 hover:text-[#6D5DFC] text-[11px] font-mono tracking-tight font-black uppercase transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
            >
              <span>⚡ ENTER OFFLINE GUEST MODE</span>
              <ChevronRight className="w-3 h-3" />
            </button>
            <p className="text-[9px] text-slate-500 font-sans mt-2 max-w-xs mx-auto">
              Saves timeline data exclusively on this browser using IndexedDB. Free and secure.
            </p>
          </div>
        </motion.div>

        {/* Security / Sovereignty Assurance Footer */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-[10px] text-slate-500 font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>ZERO-CLOUD DATA PERSISTENCE SECURITY COMPLIANT</span>
        </div>
      </div>
    </div>
  );
}
