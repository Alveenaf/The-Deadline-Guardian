import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Zap, 
  Coffee, 
  Sparkles, 
  Heart,
  Smile,
  Trophy,
  Volume1,
  Volume2,
  VolumeX,
  Compass,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Award,
  BookOpen,
  CloudRain,
  Music,
  Moon,
  AlertTriangle,
  Brain,
  Timer,
  Check,
  Target,
  Shield,
  Lightbulb
} from "lucide-react";
import { UserSettings } from "../types";

interface FocusModeViewProps {
  settings: UserSettings;
  onAddHistory: (action: string, details: string) => void;
}

interface FocusSession {
  id: string;
  goal: string;
  duration: number; // minutes
  completed: boolean;
  distractions: number;
  timestamp: string;
}

// Calming coaching phrases that update dynamically based on elapsed time & state
const coachingPhrases = {
  idle: [
    "Ready to cultivate deep clarity? Select a time and tap play.",
    "One task. No interruptions.",
    "Your focus is a sanctuary. Protect it today.",
    "Breathe in calm, breathe out comparison. Let's begin."
  ],
  working: [
    "You're doing well. Just focus on this exact moment.",
    "Stay focused. Everything else can wait.",
    "Feel the quiet momentum. One step at a time.",
    "It is okay if your mind wanders. Just gently guide it back.",
    "You're making incredible progress. Your future-self is smiling."
  ],
  halfway: [
    "You are halfway through this focus sprint. Superb pacing!",
    "Maintain the rhythm. Stay relaxed, jaw unclenched.",
    "Deep clarity is active. Keep going, you have this."
  ],
  warning: [
    "15 minutes left. Finish strong, focus on the core objective.",
    "The finish line is approaching. Let's finish this block elegantly."
  ],
  break: [
    "Rest deeply. Unclench, look away from monitors, hydrate.",
    "Enjoy this mindful pause. You earned this space.",
    "Deep rest restores high focus. Breathe slowly."
  ]
};

export default function FocusModeView({ settings, onAddHistory }: FocusModeViewProps) {
  // Configs
  const preferredBlock = settings.preferredWorkBlock || 25;

  // Primary states
  const [sessionGoal, setSessionGoal] = useState("Complete study objectives and prepare core sketches");
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number>(preferredBlock); // 25, 45, 60, 90
  
  const [timeLeft, setTimeLeft] = useState(preferredBlock * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionType, setSessionType] = useState<"Work" | "Break">("Work");
  
  // Dynamic Live Coaching message
  const [coachMsg, setCoachMsg] = useState("One step at a time. Tap play when you are ready.");
  
  // Custom Live Stats
  const [completedSessions, setCompletedSessions] = useState(2); // Mock some starting values for realism
  const [totalTimeFocused, setTotalTimeFocused] = useState(50); // minutes
  const [distractionsCount, setDistractionsCount] = useState(1);
  const [totalAttempts, setTotalAttempts] = useState(3);

  // Focus Session History log
  const [history, setHistory] = useState<FocusSession[]>([
    {
      id: "fs-1",
      goal: "Prepare rough draft outline for milestone",
      duration: 25,
      completed: true,
      distractions: 1,
      timestamp: "Today, 8:15 AM"
    },
    {
      id: "fs-2",
      goal: "Review algebra requirements & constraints",
      duration: 25,
      completed: true,
      distractions: 0,
      timestamp: "Today, 7:30 AM"
    },
    {
      id: "fs-3",
      goal: "Drafting the essay skeleton",
      duration: 45,
      completed: false,
      distractions: 3,
      timestamp: "Yesterday, 4:00 PM"
    }
  ]);

  // Ambient sound modes: Rain, Lo-fi, Night, Library
  const [ambientMode, setAmbientMode] = useState<"None" | "Rain" | "Lo-fi" | "Night" | "Library">("None");
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [ambientVolume, setAmbientVolume] = useState(0.8);
  const ambientVolumeRef = useRef(ambientVolume);
  ambientVolumeRef.current = ambientVolume;

  // End Session modal state for celebrating / supporting
  const [endSessionFeedback, setEndSessionFeedback] = useState<{
    show: boolean;
    type: "success" | "support";
    title: string;
    description: string;
    durationFocused: number;
  } | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Audio tone synthesizer for beautiful focus notifications
  const playSootheTone = (type: "Work" | "Break") => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Let's make an elegant, gentle, organic, multi-oscillator chiming sound
      const now = audioCtx.currentTime;
      
      const playTone = (freq: number, delay: number, dur: number, vol: number) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.frequency.setValueAtTime(freq, now + delay);
        gainNode.gain.setValueAtTime(0, now + delay);
        gainNode.gain.linearRampToValueAtTime(vol, now + delay + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
        
        osc.start(now + delay);
        osc.stop(now + delay + dur);
      };

      if (type === "Work") {
        // High harmonic ascending sparkle
        playTone(523.25, 0, 0.8, 0.08); // C5
        playTone(659.25, 0.15, 0.8, 0.08); // E5
        playTone(783.99, 0.3, 1.2, 0.08); // G5
        playTone(1046.5, 0.45, 1.5, 0.08); // C6
      } else {
        // Calming warm descension
        playTone(392.00, 0, 1.0, 0.1); // G4
        playTone(349.23, 0.2, 1.0, 0.1); // F4
        playTone(261.63, 0.4, 1.5, 0.1); // C4
      }
    } catch (e) {
      console.warn("Calming Web Audio synth initialized offline", e);
    }
  };

  // Live Ambient synth generator
  const ambientOscillatorRef = useRef<any>(null);
  const ambientGainRef = useRef<any>(null);
  const ambientCtxRef = useRef<any>(null);
  const rainIntervalRef = useRef<any>(null);
  const chordIntervalRef = useRef<any>(null);
  const pageIntervalRef = useRef<any>(null);

  useEffect(() => {
    // Stop and clean up any existing oscillators/context first to prevent overlap/resource leaks
    const cleanupActiveAudio = () => {
      console.log("[Audio] Cleanup executed");
      try {
        if (rainIntervalRef.current) {
          clearInterval(rainIntervalRef.current);
          rainIntervalRef.current = null;
        }
        if (chordIntervalRef.current) {
          clearInterval(chordIntervalRef.current);
          chordIntervalRef.current = null;
        }
        if (pageIntervalRef.current) {
          clearInterval(pageIntervalRef.current);
          pageIntervalRef.current = null;
        }

        if (ambientOscillatorRef.current) {
          if (Array.isArray(ambientOscillatorRef.current)) {
            ambientOscillatorRef.current.forEach(osc => {
              try { 
                osc.stop(); 
                console.log("[Audio] Stopped oscillator in array");
              } catch (e) {}
            });
          } else {
            try { 
              ambientOscillatorRef.current.stop(); 
              console.log("[Audio] Stopped single oscillator");
            } catch (e) {}
          }
          ambientOscillatorRef.current = null;
        }
        if (ambientCtxRef.current) {
          try { 
            ambientCtxRef.current.close(); 
            console.log("[Audio] Closed AudioContext");
          } catch (e) {}
          ambientCtxRef.current = null;
        }
      } catch (err) {
        console.warn("Cleanup audio error:", err);
      }
    };

    if (audioPlaying && ambientMode !== "None") {
      cleanupActiveAudio(); // clear previous context first

      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContext();
        ambientCtxRef.current = ctx;
        console.log("[Audio] AudioContext created", ctx);

        const gainNode = ctx.createGain();
        // Set volume with the independent ambience volume setting
        const gainValueMap: Record<string, number> = {
          "Rain": 1.0,
          "Lo-fi": 1.0,
          "Night": 1.0,
          "Library": 1.0
        };
        const baseGain = gainValueMap[ambientMode] || 1.0;
        const initialGainValue = baseGain * ambientVolumeRef.current;
        gainNode.gain.setValueAtTime(initialGainValue, ctx.currentTime);
        ambientGainRef.current = gainNode;
        console.log(`[Audio] Gain created for ${ambientMode}, current volume level:`, initialGainValue);

        gainNode.connect(ctx.destination);
        console.log("[Audio] Connected to destination");

        // Resume context explicitly to bypass browser autoplay blocks
        if (ctx.state === "suspended") {
          ctx.resume()
            .then(() => {
              console.log("[Audio] AudioContext resumed successfully, state:", ctx.state);
            })
            .catch(e => console.warn("Failed to resume context:", e));
        } else {
          console.log("[Audio] AudioContext already active, state:", ctx.state);
        }

        const activeModeAtStart = ambientMode;

        // Custom High-Fidelity Synthesized Soundscapes Fallback Engine
        const startSynthesizerFallback = (audioCtx: AudioContext, destination: GainNode, mode: string) => {
          console.log(`[Audio] Initiating high-fidelity synthetic ambient engine for: ${mode}`);
          
          const bufferSize = audioCtx.sampleRate * 2.0; // 2 seconds loop
          const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
          const outputData = noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            outputData[i] = Math.random() * 2 - 1;
          }

          const activeNodes: any[] = [];

          if (mode === "Rain") {
            // --- Rain Sound Synthesis ---
            const noiseNode = audioCtx.createBufferSource();
            noiseNode.buffer = noiseBuffer;
            noiseNode.loop = true;

            const bandpass = audioCtx.createBiquadFilter();
            bandpass.type = "bandpass";
            bandpass.frequency.setValueAtTime(800, audioCtx.currentTime);
            bandpass.Q.setValueAtTime(1.0, audioCtx.currentTime);

            const lowpass = audioCtx.createBiquadFilter();
            lowpass.type = "lowpass";
            lowpass.frequency.setValueAtTime(1500, audioCtx.currentTime);

            const rainGain = audioCtx.createGain();
            rainGain.gain.setValueAtTime(0.35, audioCtx.currentTime);

            noiseNode.connect(bandpass);
            bandpass.connect(lowpass);
            lowpass.connect(rainGain);
            rainGain.connect(destination);

            noiseNode.start();
            activeNodes.push(noiseNode);

            // Modulating slow wind waves
            const lfo = audioCtx.createOscillator();
            lfo.type = "sine";
            lfo.frequency.setValueAtTime(0.08, audioCtx.currentTime);

            const lfoGain = audioCtx.createGain();
            lfoGain.gain.setValueAtTime(0.12, audioCtx.currentTime);

            lfo.connect(lfoGain);
            lfoGain.connect(rainGain.gain);

            lfo.start();
            activeNodes.push(lfo);

            // Gentle random raindrop pitter-patter
            const interval = setInterval(() => {
              if (audioCtx.state === "closed" || !ambientCtxRef.current) {
                clearInterval(interval);
                return;
              }
              try {
                const dropSource = audioCtx.createBufferSource();
                dropSource.buffer = noiseBuffer;
                
                const dropFilter = audioCtx.createBiquadFilter();
                dropFilter.type = "bandpass";
                dropFilter.frequency.setValueAtTime(1400 + Math.random() * 800, audioCtx.currentTime);
                dropFilter.Q.setValueAtTime(4.0, audioCtx.currentTime);

                const dropGain = audioCtx.createGain();
                const now = audioCtx.currentTime;
                dropGain.gain.setValueAtTime(0.001, now);
                dropGain.gain.linearRampToValueAtTime(0.04 + Math.random() * 0.06, now + 0.008);
                dropGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04 + Math.random() * 0.04);

                dropSource.connect(dropFilter);
                dropFilter.connect(dropGain);
                dropGain.connect(destination);

                dropSource.start(now);
                dropSource.stop(now + 0.15);
              } catch (e) {}
            }, 140);

            rainIntervalRef.current = interval;

          } else if (mode === "Lo-fi") {
            // --- Lo-fi Chill Synthesis ---
            const chordProgression = [
              [196.00, 246.94, 293.66, 329.63], // G3, B3, D4, E4 (Gmaj7/Em9)
              [174.61, 220.00, 261.63, 329.63], // F3, A3, C4, E4 (Fmaj7)
              [164.81, 196.00, 246.94, 293.66], // E3, G3, B3, D4 (Em7)
              [220.00, 261.63, 329.63, 392.00], // A3, C4, E4, G4 (Am7)
            ];

            let chordIndex = 0;
            const playNextChord = () => {
              if (audioCtx.state === "closed" || !ambientCtxRef.current) return;
              try {
                const now = audioCtx.currentTime;
                const chords = chordProgression[chordIndex];
                chordIndex = (chordIndex + 1) % chordProgression.length;

                const chordFilter = audioCtx.createBiquadFilter();
                chordFilter.type = "lowpass";
                chordFilter.frequency.setValueAtTime(280, now);

                const chordGainNode = audioCtx.createGain();
                chordGainNode.gain.setValueAtTime(0, now);
                chordGainNode.gain.linearRampToValueAtTime(0.18, now + 0.8); // gentle attack
                chordGainNode.gain.setValueAtTime(0.18, now + 3.0);
                chordGainNode.gain.exponentialRampToValueAtTime(0.001, now + 3.9); // smooth release

                chords.forEach(freq => {
                  const osc = audioCtx.createOscillator();
                  osc.type = "triangle";
                  osc.frequency.setValueAtTime(freq, now);
                  osc.detune.setValueAtTime(Math.random() * 6 - 3, now);

                  osc.connect(chordFilter);
                  osc.start(now);
                  osc.stop(now + 3.95);
                });

                chordFilter.connect(chordGainNode);
                chordGainNode.connect(destination);
              } catch (e) {}
            };

            playNextChord();
            const chordInterval = setInterval(playNextChord, 4000);
            chordIntervalRef.current = chordInterval;

            // Soft highpass vinyl dust crackling
            const crackleNode = audioCtx.createBufferSource();
            crackleNode.buffer = noiseBuffer;
            crackleNode.loop = true;

            const crackleFilter = audioCtx.createBiquadFilter();
            crackleFilter.type = "highpass";
            crackleFilter.frequency.setValueAtTime(6000, audioCtx.currentTime);

            const crackleGain = audioCtx.createGain();
            crackleGain.gain.setValueAtTime(0.02, audioCtx.currentTime);

            crackleNode.connect(crackleFilter);
            crackleFilter.connect(crackleGain);
            crackleGain.connect(destination);
            crackleNode.start();
            activeNodes.push(crackleNode);

          } else if (mode === "Night") {
            // --- High-Fidelity Cosmic Night Drone Synthesis ---
            // A warm, rich, therapeutic space drone with deep sub-bass and celestial star chimes.
            const baseFreqs = [55.0, 82.4, 110.0, 164.8, 220.0]; // A1, E2, A2, E3, A3
            
            const mainFilter = audioCtx.createBiquadFilter();
            mainFilter.type = "lowpass";
            mainFilter.frequency.setValueAtTime(220, audioCtx.currentTime);
            mainFilter.Q.setValueAtTime(2.0, audioCtx.currentTime);
            mainFilter.connect(destination);

            baseFreqs.forEach((freq, idx) => {
              for (let d = 0; d < 2; d++) {
                const osc = audioCtx.createOscillator();
                osc.type = "triangle";
                const detuneAmt = d === 0 ? -0.35 : 0.35;
                osc.frequency.setValueAtTime(freq + detuneAmt, audioCtx.currentTime);
                
                const oscGain = audioCtx.createGain();
                const volume = idx === 0 ? 0.08 : (idx === 1 ? 0.07 : 0.05);
                oscGain.gain.setValueAtTime(volume, audioCtx.currentTime);

                osc.connect(oscGain);
                oscGain.connect(mainFilter);
                osc.start();
                activeNodes.push(osc);
              }
            });

            // Very slow, soothing filter cutoff sweep (simulate cosmic nebula waves)
            const lfo = audioCtx.createOscillator();
            lfo.type = "sine";
            lfo.frequency.setValueAtTime(0.04, audioCtx.currentTime); // slow wave cycle (25 seconds)

            const lfoGain = audioCtx.createGain();
            lfoGain.gain.setValueAtTime(90, audioCtx.currentTime); // wider filter modulation sweep range (+/- 90Hz)

            lfo.connect(lfoGain);
            lfoGain.connect(mainFilter.frequency);
            lfo.start();
            activeNodes.push(lfo);

            // Gentle Cosmic Star Sparks (occasional sparkling chime sounds in deep space)
            const interval = setInterval(() => {
              if (audioCtx.state === "closed" || !ambientCtxRef.current) {
                clearInterval(interval);
                return;
              }
              if (Math.random() > 0.6) {
                try {
                  const now = audioCtx.currentTime;
                  const sparkOsc = audioCtx.createOscillator();
                  sparkOsc.type = "sine";
                  const scale = [880, 987.77, 1174.66, 1318.51, 1567.98, 1760]; // A5, B5, D6, E6, G6, A6
                  const randomFreq = scale[Math.floor(Math.random() * scale.length)];
                  sparkOsc.frequency.setValueAtTime(randomFreq, now);

                  const sparkFilter = audioCtx.createBiquadFilter();
                  sparkFilter.type = "bandpass";
                  sparkFilter.frequency.setValueAtTime(randomFreq, now);
                  sparkFilter.Q.setValueAtTime(5.0, now);

                  const sparkGain = audioCtx.createGain();
                  sparkGain.gain.setValueAtTime(0, now);
                  sparkGain.gain.linearRampToValueAtTime(0.015 + Math.random() * 0.015, now + 0.1);
                  sparkGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5 + Math.random() * 1.5);

                  sparkOsc.connect(sparkFilter);
                  sparkFilter.connect(sparkGain);
                  sparkGain.connect(destination);

                  sparkOsc.start(now);
                  sparkOsc.stop(now + 4.5);
                } catch (e) {}
              }
            }, 3500);

            rainIntervalRef.current = interval;

          } else if (mode === "Library") {
            // --- High-Fidelity Cozy Library & Hearth Fireplace Synthesis ---
            // 1. Filtered soft air-flow room tone (instead of raw sub-bass hum)
            const airSource = audioCtx.createBufferSource();
            airSource.buffer = noiseBuffer;
            airSource.loop = true;

            const airFilter = audioCtx.createBiquadFilter();
            airFilter.type = "bandpass";
            airFilter.frequency.setValueAtTime(350, audioCtx.currentTime); // quiet library air rustle
            airFilter.Q.setValueAtTime(0.6, audioCtx.currentTime);

            const airGain = audioCtx.createGain();
            airGain.gain.setValueAtTime(0.08, audioCtx.currentTime);

            airSource.connect(airFilter);
            airFilter.connect(airGain);
            airGain.connect(destination);
            airSource.start();
            activeNodes.push(airSource);

            // 2. Hearth fireplace low rumble
            const roarSource = audioCtx.createBufferSource();
            roarSource.buffer = noiseBuffer;
            roarSource.loop = true;

            const roarFilter = audioCtx.createBiquadFilter();
            roarFilter.type = "lowpass";
            roarFilter.frequency.setValueAtTime(90, audioCtx.currentTime);

            const roarGain = audioCtx.createGain();
            roarGain.gain.setValueAtTime(0.12, audioCtx.currentTime);

            // Modulate the fireplace roar randomly for organic heat waves
            const roarLFO = audioCtx.createOscillator();
            roarLFO.type = "sine";
            roarLFO.frequency.setValueAtTime(0.3, audioCtx.currentTime);

            const roarLFOGain = audioCtx.createGain();
            roarLFOGain.gain.setValueAtTime(0.04, audioCtx.currentTime);

            roarLFO.connect(roarLFOGain);
            roarLFOGain.connect(roarGain.gain);

            roarSource.connect(roarFilter);
            roarFilter.connect(roarGain);
            roarGain.connect(destination);

            roarSource.start();
            roarLFO.start();
            activeNodes.push(roarSource, roarLFO);

            // 3. Muted Academic Study Music (Distant Warm Lo-fi Piano Chords)
            const studyChords = [
              [146.83, 196.00, 246.94, 293.66], // D3, G3, B3, D4 (Gmaj7/D)
              [164.81, 196.00, 246.94, 329.63], // E3, G3, B3, E4 (Em7)
              [130.81, 196.00, 261.63, 329.63], // C3, G3, C4, E4 (Cmaj9)
              [146.83, 220.00, 293.66, 369.99], // D3, A3, D4, F#4 (Dadd9)
            ];

            let chordIndex = 0;
            const playAcademicChord = () => {
              if (audioCtx.state === "closed" || !ambientCtxRef.current) return;
              try {
                const now = audioCtx.currentTime;
                const notes = studyChords[chordIndex];
                chordIndex = (chordIndex + 1) % studyChords.length;

                const chordFilter = audioCtx.createBiquadFilter();
                chordFilter.type = "lowpass";
                chordFilter.frequency.setValueAtTime(180, now); // deeply muffled

                const chordGainNode = audioCtx.createGain();
                chordGainNode.gain.setValueAtTime(0, now);
                chordGainNode.gain.linearRampToValueAtTime(0.14, now + 1.2); // extra gentle rise
                chordGainNode.gain.setValueAtTime(0.14, now + 4.5);
                chordGainNode.gain.exponentialRampToValueAtTime(0.001, now + 5.95);

                notes.forEach(freq => {
                  const osc = audioCtx.createOscillator();
                  osc.type = "triangle";
                  osc.frequency.setValueAtTime(freq, now);
                  osc.detune.setValueAtTime(Math.random() * 8 - 4, now); // cozy tape detune

                  osc.connect(chordFilter);
                  osc.start(now);
                  osc.stop(now + 6.0);
                });

                chordFilter.connect(chordGainNode);
                chordGainNode.connect(destination);
              } catch (e) {}
            };

            playAcademicChord();
            const chordInterval = setInterval(playAcademicChord, 6000);
            chordIntervalRef.current = chordInterval;

            // 4. Random Wooden Hearth Log Pops (Crackling Fireplace)
            const fireInterval = setInterval(() => {
              if (audioCtx.state === "closed" || !ambientCtxRef.current) {
                clearInterval(fireInterval);
                return;
              }
              if (Math.random() > 0.75) {
                try {
                  const now = audioCtx.currentTime;
                  const popSource = audioCtx.createBufferSource();
                  popSource.buffer = noiseBuffer;

                  const popFilter = audioCtx.createBiquadFilter();
                  popFilter.type = "bandpass";
                  popFilter.frequency.setValueAtTime(1500 + Math.random() * 1200, now);
                  popFilter.Q.setValueAtTime(8.0, now);

                  const popGain = audioCtx.createGain();
                  popGain.gain.setValueAtTime(0.001, now);
                  popGain.gain.linearRampToValueAtTime(0.03 + Math.random() * 0.05, now + 0.002);
                  popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.01 + Math.random() * 0.02);

                  popSource.connect(popFilter);
                  popFilter.connect(popGain);
                  popGain.connect(destination);

                  popSource.start(now);
                  popSource.stop(now + 0.1);
                } catch (e) {}
              }
            }, 200);
            rainIntervalRef.current = fireInterval;

            // 5. Cozy page flipping & pen scratching noises
            const pageInterval = setInterval(() => {
              if (audioCtx.state === "closed" || !ambientCtxRef.current) {
                clearInterval(pageInterval);
                return;
              }
              try {
                const now = audioCtx.currentTime;
                const pageSource = audioCtx.createBufferSource();
                pageSource.buffer = noiseBuffer;

                const pageFilter = audioCtx.createBiquadFilter();
                pageFilter.type = "bandpass";
                pageFilter.frequency.setValueAtTime(1800 + Math.random() * 600, now);
                pageFilter.Q.setValueAtTime(1.2, now);

                const pageGain = audioCtx.createGain();
                pageGain.gain.setValueAtTime(0.001, now);
                pageGain.gain.linearRampToValueAtTime(0.02, now + 0.15); // slow page swipe
                pageGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

                pageSource.connect(pageFilter);
                pageFilter.connect(pageGain);
                pageGain.connect(destination);

                pageSource.start(now);
                pageSource.stop(now + 0.7);
              } catch (e) {}
            }, 5200);

            pageIntervalRef.current = pageInterval;
          }

          ambientOscillatorRef.current = activeNodes;
        };

        // Fetch directly from the absolute root path to avoid relative router fallbacks returning index.html
        const filenameMap: Record<string, string> = {
          "Rain": "rain.wav",
          "Lo-fi": "lofi.wav",
          "Night": "night.wav",
          "Library": "library.wav"
        };
        const filename = filenameMap[ambientMode];
        const audioPath = `/audio/${filename}`;

        console.log(`[Audio] Fetching real looping audio asset: ${audioPath}`);
        fetch(audioPath)
          .then(res => {
            if (!res.ok) {
              throw new Error(`HTTP error ${res.status}`);
            }
            const contentType = res.headers.get("content-type");
            if (contentType && contentType.includes("text/html")) {
              throw new Error("Received HTML fallback instead of real audio file");
            }
            return res.arrayBuffer();
          })
          .then(arrayBuffer => ctx.decodeAudioData(arrayBuffer))
          .then(decodedBuffer => {
            if (!ambientCtxRef.current || ctx !== ambientCtxRef.current || ambientMode !== activeModeAtStart) {
              console.log("[Audio] Mode changed or audio context cleaned up during load; discarding buffer.");
              return;
            }

            const source = ctx.createBufferSource();
            source.buffer = decodedBuffer;
            source.loop = true;
            console.log(`[Audio] Buffer source created successfully for real audio: ${ambientMode}`);

            source.connect(gainNode);
            console.log(`[Audio] Connected: ${ambientMode} Real Source -> GainNode`);

            source.start();
            console.log(`[Audio] Looping playback started for real audio: ${ambientMode}`);
            ambientOscillatorRef.current = source;
          })
          .catch(err => {
            console.warn(`[Audio] Failed to load real audio file for ${ambientMode} (err: ${err.message}). Activating high-fidelity Web Audio Synthesizer fallback.`, err);
            // Decouple to synthesizer fallback if fetch fails or decoding fails
            if (ambientCtxRef.current && ctx === ambientCtxRef.current && ambientMode === activeModeAtStart) {
              startSynthesizerFallback(ctx, gainNode, ambientMode);
            }
          });

      } catch (err) {
        console.warn("Ambient Audio Context block", err);
      }
    } else {
      cleanupActiveAudio();
    }

    return () => {
      cleanupActiveAudio();
    };
  }, [audioPlaying, ambientMode]);

  // Dynamic Real-time Volume Adjustment without restarting AudioContext
  useEffect(() => {
    if (ambientGainRef.current && ambientCtxRef.current) {
      const gainValueMap: Record<string, number> = {
        "Rain": 1.0,
        "Lo-fi": 1.0,
        "Night": 1.0,
        "Library": 1.0
      };
      const baseGain = gainValueMap[ambientMode] || 1.0;
      const targetGain = baseGain * ambientVolume;
      try {
        ambientGainRef.current.gain.setValueAtTime(targetGain, ambientCtxRef.current.currentTime);
        console.log("[Audio] Dynamic ambient gain adjusted to:", targetGain);
      } catch (e) {
        console.warn("[Audio] Could not dynamically set gain value:", e);
      }
    }
  }, [ambientVolume, ambientMode]);

  // Adjust live coaching statements depending on state and progress
  useEffect(() => {
    if (!isRunning) {
      setCoachMsg(coachingPhrases.idle[Math.floor(Math.random() * coachingPhrases.idle.length)]);
      return;
    }

    if (sessionType === "Break") {
      setCoachMsg(coachingPhrases.break[Math.floor(Math.random() * coachingPhrases.break.length)]);
      return;
    }

    const durationSeconds = selectedDuration * 60;
    const elapsedSeconds = durationSeconds - timeLeft;

    if (timeLeft <= 15 * 60 && timeLeft > 14 * 60) {
      setCoachMsg("15 minutes left. Stay focused, you are doing incredibly well.");
    } else if (timeLeft <= 5 * 60 && timeLeft > 4 * 60) {
      setCoachMsg("5 minutes remaining. Let's elegantly finish this block.");
    } else if (elapsedSeconds > durationSeconds * 0.5 && elapsedSeconds < durationSeconds * 0.5 + 30) {
      setCoachMsg(coachingPhrases.halfway[Math.floor(Math.random() * coachingPhrases.halfway.length)]);
    } else {
      // Regular rotating phrases
      const interval = setInterval(() => {
        setCoachMsg(coachingPhrases.working[Math.floor(Math.random() * coachingPhrases.working.length)]);
      }, 35000);
      return () => clearInterval(interval);
    }
  }, [isRunning, sessionType, timeLeft, selectedDuration]);

  // Primary timer tick engine
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsRunning(false);

            const durationMinutes = selectedDuration;

            if (sessionType === "Work") {
              playSootheTone("Work");
              setCompletedSessions(c => c + 1);
              setTotalTimeFocused(t => t + durationMinutes);
              
              // Add to history list
              const newSession: FocusSession = {
                id: "fs-" + Date.now(),
                goal: sessionGoal,
                duration: durationMinutes,
                completed: true,
                distractions: 0,
                timestamp: "Just now"
              };
              setHistory(h => [newSession, ...h]);
              onAddHistory("Completed Focus Block", `Mindful success! Completed a beautiful ${durationMinutes}-minute deep work block for: "${sessionGoal}".`);

              // Trigger Celebration feedback modal
              setEndSessionFeedback({
                show: true,
                type: "success",
                title: "🌱 Mindful Success!",
                description: `Beautifully done! You successfully defended your concentration for a full ${durationMinutes} minutes. You are training your mind to conquer procrastination. Let's rest now.`,
                durationFocused: durationMinutes
              });

              // Prep break session automatically
              setSessionType("Break");
              return 5 * 60; // 5 minute rest
            } else {
              playSootheTone("Break");
              onAddHistory("Break Concluded", "Stepped out of restorational rest block to re-engage.");
              setSessionType("Work");
              return selectedDuration * 60;
            }
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, sessionType, selectedDuration, sessionGoal]);

  // Reset/Abort Timer with custom supportive logic for unfinished sessions
  const handleAbortSession = () => {
    if (!isRunning && timeLeft === selectedDuration * 60) return;

    const durationMinutes = selectedDuration;
    const elapsedSeconds = (durationMinutes * 60) - timeLeft;
    const minutesFocused = Math.floor(elapsedSeconds / 60);

    setIsRunning(false);
    
    if (sessionType === "Work" && minutesFocused >= 2) {
      // Log partial progress to stats and history to provide compassionate reinforcement
      setTotalTimeFocused(t => t + minutesFocused);
      
      const partialSession: FocusSession = {
        id: "fs-" + Date.now(),
        goal: sessionGoal,
        duration: minutesFocused,
        completed: false,
        distractions: distractionsCount,
        timestamp: "Just now (Partial)"
      };
      setHistory(h => [partialSession, ...h]);
      onAddHistory("Focus Block Completed Partially", `Ended work block early but salvaged ${minutesFocused} productive minutes.`);

      // Open Supportive Modal
      setEndSessionFeedback({
        show: true,
        type: "support",
        title: "It's okay. Every minute counts. 🤍",
        description: `You focused intensely for ${minutesFocused} minutes! That is still an amazing achievement. Do not judge yourself—progress is non-linear, and showing up is 90% of the battle. Take a break and re-try when ready.`,
        durationFocused: minutesFocused
      });
    } else {
      onAddHistory("Timer Reset", "Returned countdown to idle.");
    }

    // Reset countdown parameters
    setTimeLeft(selectedDuration * 60);
    setSessionType("Work");
    setDistractionsCount(0);
  };

  // Toggle active play state
  const handleTogglePlay = () => {
    if (!isRunning) {
      setTotalAttempts(a => a + 1);
      onAddHistory("Initiated Focus Sprint", `Launched active countdown container set for ${selectedDuration}m.`);
    }
    setIsRunning(prev => !prev);
  };

  // Preset option clicker
  const handleSelectPreset = (mins: number) => {
    if (isRunning) return;
    setSelectedDuration(mins);
    setTimeLeft(mins * 60);
    setSessionType("Work");
  };

  // Log distraction callback
  const handleLogDistraction = () => {
    setDistractionsCount(prev => prev + 1);
    
    // Comforting live toast notice
    setCoachMsg("It's okay. Gently guide your thoughts back. Take a deep, slow breath now.");
    onAddHistory("Logged Focus Interruption", "Self-reported distraction block during concentration.");
  };

  // Progress metrics calculation
  const totalDurationSeconds = sessionType === "Work" ? selectedDuration * 60 : 5 * 60;
  const progressPercent = ((totalDurationSeconds - timeLeft) / totalDurationSeconds) * 100;

  // Formatting minutes/seconds
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Dynamic Ambient background colors & atmosphere simulation
  const getAmbientClasses = () => {
    if (ambientMode === "Rain") return "from-slate-900/40 via-blue-950/20 to-slate-900/40 border-blue-500/20";
    if (ambientMode === "Lo-fi") return "from-[#1a1726]/40 via-[#261f30]/20 to-[#1a1726]/40 border-purple-500/20";
    if (ambientMode === "Night") return "from-gray-950/40 via-indigo-950/20 to-gray-950/40 border-indigo-500/20";
    if (ambientMode === "Library") return "from-slate-900/40 via-amber-950/10 to-slate-900/40 border-amber-500/20";
    return "from-[#151D33]/40 to-[#151D33]/40 border-white/5";
  };

  const getAmbientParticleColor = () => {
    if (ambientMode === "Rain") return "bg-blue-400/20";
    if (ambientMode === "Lo-fi") return "bg-purple-400/20";
    if (ambientMode === "Night") return "bg-indigo-300/20";
    if (ambientMode === "Library") return "bg-amber-400/15";
    return "bg-transparent";
  };

  // Distraction quote responses
  const completionPercentage = totalAttempts > 0 ? Math.round((completedSessions / totalAttempts) * 100) : 100;

  return (
    <div id="focus-refined-container" className="space-y-6 w-full max-w-7xl mx-auto">
      
      {/* Celebration / Support Modal Layer */}
      <AnimatePresence>
        {endSessionFeedback?.show && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#121625] border border-white/10 p-8 rounded-3xl max-w-md w-full text-center space-y-6 relative overflow-hidden shadow-2xl"
            >
              {/* Decorative light ring */}
              <div className="absolute top-[-50px] left-[-50px] w-48 h-48 bg-indigo-500/10 rounded-full blur-[80px]" />

              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center text-3xl bg-white/5 border border-white/10 shadow-inner">
                {endSessionFeedback.type === "success" ? "🌱" : "🤍"}
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white tracking-tight">{endSessionFeedback.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">{endSessionFeedback.description}</p>
              </div>

              {endSessionFeedback.durationFocused > 0 && (
                <div className="py-2.5 px-4 bg-white/5 border border-white/5 rounded-2xl inline-flex items-center gap-2 text-xs font-mono text-indigo-300 mx-auto">
                  <Timer className="w-3.5 h-3.5" />
                  <span>+{endSessionFeedback.durationFocused} Focused Minutes Added</span>
                </div>
              )}

              <button
                onClick={() => setEndSessionFeedback(null)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/15 cursor-pointer"
              >
                Continue Calming Flow
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Panel (Forest/Mindfulness-inspired, elegant) */}
      <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-6 relative overflow-hidden shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-teal-500/5 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
            Focus Mode<span className="text-indigo-500">.</span>
          </h1>
          <p className="text-xs text-slate-400 font-sans">
            Sal · 50m focused today · 67% completion rate
          </p>
        </div>

        {/* Today's Goal Component (Editable & Centered) */}
        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex-1 max-w-md space-y-1 relative group">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span className="flex items-center gap-1">
              <Target className="w-3 h-3 text-indigo-400" /> TODAY'S CONCENTRATION GOAL:
            </span>
            <button 
              onClick={() => setIsEditingGoal(!isEditingGoal)}
              className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline cursor-pointer transition"
            >
              {isEditingGoal ? "Save Goal" : "Change"}
            </button>
          </div>
          
          {isEditingGoal ? (
            <input 
              type="text"
              value={sessionGoal}
              onChange={(e) => setSessionGoal(e.target.value)}
              onBlur={() => setIsEditingGoal(false)}
              onKeyDown={(e) => { if (e.key === "Enter") setIsEditingGoal(false); }}
              autoFocus
              className="w-full bg-[#121214] text-xs text-white px-2 py-1.5 rounded border border-white/10 focus:outline-none focus:border-indigo-500"
            />
          ) : (
            <p className="text-xs text-slate-200 font-sans font-bold leading-relaxed truncate group-hover:text-white transition">
              "{sessionGoal || "Tackle all pending study blocks..."}"
            </p>
          )}
        </div>
      </div>

      {/* Main Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (8 cols): Elegant Central Timer & Ambient Control */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Main Visual Clock Box */}
          <div className={`bg-gradient-to-b ${getAmbientClasses()} backdrop-blur-xl border rounded-3xl p-6 flex flex-col items-center justify-center space-y-6 relative overflow-hidden shadow-2xl transition-all duration-700 min-h-[420px]`}>
            
            {/* Dynamic Falling Rain/Dust Particles for Atmospheric Ambience */}
            {ambientMode !== "None" && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute w-full h-full flex justify-around">
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      className={`w-1 rounded-full ${getAmbientParticleColor()}`}
                      animate={{
                        y: ["-10%", "110%"],
                        height: ambientMode === "Rain" ? ["10px", "40px", "10px"] : ["6px", "6px", "6px"],
                        opacity: [0, 0.6, 0]
                      }}
                      transition={{
                        duration: ambientMode === "Rain" ? 1.5 + Math.random() : 4 + Math.random() * 3,
                        repeat: Infinity,
                        delay: Math.random() * 2,
                        ease: "linear"
                      }}
                      style={{
                        transform: `rotate(${ambientMode === "Rain" ? "15deg" : "0deg"})`
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Core Companion Live Coaching Header Bubble */}
            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 max-w-sm text-center relative z-10 shadow-inner flex items-center gap-2.5">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              <p className="text-[11px] text-slate-200 leading-normal font-sans italic font-medium">
                "{coachMsg}"
              </p>
            </div>

            {/* Centralized Timer Ring (Optimized & Reduced Size) */}
            <div className="relative w-52 h-52 flex items-center justify-center z-10 scale-95 md:scale-100 transition-transform">
              <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                <circle
                  cx="104"
                  cy="104"
                  r="88"
                  className="stroke-white/5 fill-none"
                  strokeWidth="8"
                />
                <motion.circle
                  cx="104"
                  cy="104"
                  r="88"
                  className={`fill-none transition-colors duration-500
                    ${sessionType === "Work" ? "stroke-indigo-500" : "stroke-teal-400"}`}
                  strokeWidth="8"
                  strokeDasharray="552.92"
                  strokeDashoffset={552.92 - (552.92 * progressPercent) / 100}
                  strokeLinecap="round"
                />
              </svg>

              {/* Central Time Metrics */}
              <div className="text-center space-y-1 relative z-10">
                <span className="text-[9px] uppercase font-mono tracking-widest font-extrabold text-slate-500">
                  {sessionType === "Work" ? "CONCENTRATING" : "REST PERIOD"}
                </span>
                <div className="text-4xl font-mono font-black text-white tracking-tighter">
                  {formatTime(timeLeft)}
                </div>
                <div className="text-[9px] text-indigo-400 font-mono tracking-wide font-bold">
                  {completedSessions} blocks locked
                </div>
              </div>
            </div>

            {/* Controls Drawer */}
            <div className="flex items-center gap-3.5 relative z-10">
              {/* Reset/Stop Button */}
              <button
                onClick={handleAbortSession}
                className="p-3 bg-[#121214] hover:bg-rose-950/20 border border-white/5 hover:border-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition cursor-pointer"
                title="Reset or Abort current concentration slot"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Play / Pause button with a subtle calm breathing animation */}
              <motion.button
                onClick={handleTogglePlay}
                whileTap={{ scale: 0.95 }}
                animate={isRunning ? {
                  scale: [1, 1.04, 1],
                  boxShadow: [
                    "0 10px 15px -3px rgba(99, 102, 241, 0.25)",
                    "0 10px 25px 2px rgba(139, 92, 246, 0.45)",
                    "0 10px 15px -3px rgba(99, 102, 241, 0.25)"
                  ]
                } : {}}
                transition={isRunning ? {
                  duration: 4, // 4-second breathing cycle representing calm breathing exercises
                  repeat: Infinity,
                  ease: "easeInOut"
                } : {}}
                className={`px-6 py-3 rounded-2xl font-bold text-xs transition-all duration-200 shadow-lg flex items-center gap-1.5 cursor-pointer
                  ${sessionType === "Work" 
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 text-white border border-white/10" 
                    : "bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-teal-900/10"}`}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-3.5 h-3.5" /> Pause Flow
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white text-white" /> Start Block
                  </>
                )}
              </motion.button>

              {/* Self-Report Distraction Button */}
              {isRunning && sessionType === "Work" && (
                <button
                  onClick={handleLogDistraction}
                  className="px-3.5 py-3 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 text-amber-300 rounded-xl text-[10px] font-mono font-bold transition cursor-pointer animate-pulse"
                  title="I got distracted (Logs metric gracefully)"
                >
                  Distracted 🚨
                </button>
              )}
            </div>

          </div>

          {/* Calming Ambient Soundscapes Grid */}
          <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Background sounds</h3>
              </div>
              <button
                onClick={() => setAudioPlaying(!audioPlaying)}
                disabled={ambientMode === "None"}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg border flex items-center gap-1.5 transition cursor-pointer disabled:opacity-30
                  ${audioPlaying 
                    ? "bg-emerald-600 border-emerald-500 text-white" 
                    : "bg-[#121214] border-white/5 text-slate-400"}`}
              >
                {audioPlaying ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                {audioPlaying 
                  ? `Playing ${
                      ambientMode === "Rain" ? "Rainstorm" : 
                      ambientMode === "Lo-fi" ? "Lo-fi Waves" : 
                      ambientMode === "Night" ? "Cosmic Drone" : 
                      ambientMode === "Library" ? "Cozy Library" : "Soundscape"
                    }` 
                  : "Muted"}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Rain */}
              <button
                onClick={() => {
                  setAmbientMode("Rain");
                  setAudioPlaying(true);
                  onAddHistory("Selected Ambient Frequency", "Switched bio-frequency to Calming Rainstorm.");
                }}
                className={`p-3 rounded-2xl border text-left transition duration-200 cursor-pointer flex flex-col justify-between h-[80px]
                  ${ambientMode === "Rain" 
                    ? "bg-blue-600/10 border-blue-500 text-blue-300" 
                    : "bg-[#121214] border-white/5 hover:border-white/10 text-slate-400"}`}
              >
                <CloudRain className="w-4 h-4 text-blue-400 mb-2" />
                <span className="text-[11px] font-bold">Rainstorm</span>
              </button>

              {/* Lo-fi */}
              <button
                onClick={() => {
                  setAmbientMode("Lo-fi");
                  setAudioPlaying(true);
                  onAddHistory("Selected Ambient Frequency", "Switched bio-frequency to Warm Lo-fi Waves.");
                }}
                className={`p-3 rounded-2xl border text-left transition duration-200 cursor-pointer flex flex-col justify-between h-[80px]
                  ${ambientMode === "Lo-fi" 
                    ? "bg-purple-600/10 border-purple-500 text-purple-300" 
                    : "bg-[#121214] border-white/5 hover:border-white/10 text-slate-400"}`}
              >
                <Music className="w-4 h-4 text-purple-400 mb-2" />
                <span className="text-[11px] font-bold">Lo-fi Waves</span>
              </button>

              {/* Night */}
              <button
                onClick={() => {
                  setAmbientMode("Night");
                  setAudioPlaying(true);
                  onAddHistory("Selected Ambient Frequency", "Switched bio-frequency to Cosmic Cosmic Drone.");
                }}
                className={`p-3 rounded-2xl border text-left transition duration-200 cursor-pointer flex flex-col justify-between h-[80px]
                  ${ambientMode === "Night" 
                    ? "bg-indigo-600/10 border-indigo-500 text-indigo-300" 
                    : "bg-[#121214] border-white/5 hover:border-white/10 text-slate-400"}`}
              >
                <Moon className="w-4 h-4 text-indigo-400 mb-2" />
                <span className="text-[11px] font-bold">Cosmic Drone</span>
              </button>

              {/* Library */}
              <button
                onClick={() => {
                  setAmbientMode("Library");
                  setAudioPlaying(true);
                  onAddHistory("Selected Ambient Frequency", "Switched bio-frequency to Cozy Library Focus.");
                }}
                className={`p-3 rounded-2xl border text-left transition duration-200 cursor-pointer flex flex-col justify-between h-[80px]
                  ${ambientMode === "Library" 
                    ? "bg-amber-600/10 border-amber-500 text-amber-300" 
                    : "bg-[#121214] border-white/5 hover:border-white/10 text-slate-400"}`}
              >
                <BookOpen className="w-4 h-4 text-amber-400 mb-2" />
                <span className="text-[11px] font-bold">Cozy Library</span>
              </button>
            </div>

            {/* Dedicated Ambience Volume Slider */}
            <div className={`pt-3 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-300 ${ambientMode === "None" ? "opacity-30 pointer-events-none" : "opacity-100"}`}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Ambience Volume</span>
                <span className="text-[10px] font-mono font-extrabold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                  {ambientMode === "None" ? "Muted" : `${Math.round(ambientVolume * 100)}%`}
                </span>
              </div>
              
              <div className="flex items-center gap-2.5 flex-1 max-w-[280px]">
                <button 
                  onClick={() => {
                    if (ambientMode !== "None") {
                      setAmbientVolume(prev => prev === 0 ? 0.8 : 0);
                    }
                  }}
                  disabled={ambientMode === "None"}
                  className="text-slate-400 hover:text-white transition cursor-pointer focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {ambientVolume === 0 || ambientMode === "None" ? (
                    <VolumeX className="w-4 h-4 text-slate-500" />
                  ) : ambientVolume < 0.4 ? (
                    <Volume1 className="w-4 h-4 text-indigo-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-indigo-400 animate-pulse" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={ambientVolume}
                  onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
                  disabled={ambientMode === "None"}
                  className="w-full h-1 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {ambientMode !== "None" && (
              <p className="text-[10px] text-indigo-300 font-sans mt-1 flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>High-fidelity looping ambient soundscapes are active. Unclench, breathe, and align with the soundscape.</span>
              </p>
            )}
          </div>

        </div>

        {/* Right Column (4 cols): Focus Presets, Stats & Logs */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Work Block Focus Preset Options */}
          <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-5 space-y-3 shadow-xl">
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> Session length
            </h3>
            
            <div className="grid grid-cols-2 gap-2">
              {[25, 45, 60, 90].map((mins) => (
                <button
                  key={mins}
                  onClick={() => handleSelectPreset(mins)}
                  disabled={isRunning}
                  className={`py-2.5 rounded-xl border font-mono text-xs font-bold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:opacity-40
                    ${selectedDuration === mins 
                      ? "bg-indigo-600/15 border-indigo-500 text-white" 
                      : "bg-[#121214] border-white/5 hover:border-white/15 text-slate-400 hover:text-white"}`}
                >
                  <span>{mins} Minutes</span>
                  <span className="text-[9px] text-slate-500 font-sans font-normal">
                    {mins === 25 ? "Standard Pomodoro" : mins === 45 ? "Balanced Study" : mins === 60 ? "Deep Pacing" : "Ultra Sprints"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Calming Live Session Stats */}
          <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl">
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" /> Focus Session Stats
            </h3>

            <div className="grid grid-cols-2 gap-3">
              {/* Time Focused */}
              <div className="p-3 bg-[#121214]/50 border border-white/5 rounded-2xl">
                <span className="text-[9px] font-mono text-slate-500 block uppercase font-bold">Time Focused</span>
                <span className="text-lg font-black text-white">{totalTimeFocused}m</span>
              </div>

              {/* Sessions completed */}
              <div className="p-3 bg-[#121214]/50 border border-white/5 rounded-2xl">
                <span className="text-[9px] font-mono text-slate-500 block uppercase font-bold">Sessions Locked</span>
                <span className="text-lg font-black text-white">{completedSessions}</span>
              </div>

              {/* Completion % */}
              <div className="p-3 bg-[#121214]/50 border border-white/5 rounded-2xl">
                <span className="text-[9px] font-mono text-slate-500 block uppercase font-bold">Completion Rate</span>
                <span className="text-lg font-black text-white">{completionPercentage}%</span>
              </div>

              {/* Distractions reported */}
              <div className="p-3 bg-[#121214]/50 border border-white/5 rounded-2xl">
                <span className="text-[9px] font-mono text-slate-500 block uppercase font-bold">Distractions logged</span>
                <span className="text-lg font-black text-white">{distractionsCount}</span>
              </div>
            </div>
          </div>

          {/* Focus history log */}
          <div className="bg-[#151D33]/40 border border-white/5 rounded-3xl p-5 space-y-4 shadow-xl">
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-400" /> Focus History Log
            </h3>

            <div className="space-y-2.5 max-h-[190px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5">
              {history.map((item) => (
                <div key={item.id} className="p-2.5 bg-[#121214]/40 border border-white/5 rounded-xl text-xs space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-white truncate max-w-[140px]">
                      {item.goal}
                    </span>
                    <span className={`px-2 py-0.5 rounded-[5px] text-[8.5px] font-mono uppercase font-bold shrink-0
                      ${item.completed 
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" 
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/10"}`}>
                      {item.completed ? "Success" : "Partial"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>⏱️ {item.duration}m focused</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
