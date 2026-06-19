import { useState } from "react";
// تأكد من أن المسار هنا يطابق المجلدات التي أنشأناها
import AudioWorkspace from "./modules/AudioStudio/AudioWorkspace"; 

export default function App() {
  // حالة التطبيق: هل نحن في الشاشة الرئيسية، أم الاستوديو الصوتي، أم الدبلجة؟
  const [activeModule, setActiveModule] = useState("home");

  // 1. إذا اختار المستخدم الاستوديو الصوتي
  if (activeModule === "audio") {
    return <AudioWorkspace onBack={() => setActiveModule("home")} />;
  }

  // 2. إذا اختار المستخدم استوديو الدبلجة (سنبني هذه الواجهة لاحقاً)
  if (activeModule === "dubbing") {
    return (
      <div className="w-full min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold text-cyan-400 mb-4">🎬 AI Video Dubbing Workspace</h1>
        <p className="text-gray-400 mb-8">This module is under construction...</p>
        <button onClick={() => setActiveModule("home")} className="px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  // 3. الواجهة الرئيسية (بوابة الدخول) - تظهر فقط إذا كانت الحالة "home"
  return (
    <div className="w-full min-h-screen bg-[#020202] text-gray-200 flex flex-col items-center justify-center p-6 selection:bg-emerald-500/30 font-sans relative overflow-hidden">
      
      {/* إضاءات خلفية ضبابية (Ambient Glow) */}
      <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-emerald-600/20 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-cyan-600/20 rounded-full blur-[120px]"></div>

      {/* الرأس (Header) */}
      <header className="text-center mb-16 z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-800/50 border border-gray-700 text-xs font-mono text-gray-400 mb-6">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          System Online • v2.0
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-4">
          Next-Gen <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">AI Studio</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Select your workspace. Leverage neural networks to master audio or completely dub video content with absolute precision.
        </p>
      </header>

      {/* خيارات المنصة (Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl z-10">
        
        {/* بطاقة الاستوديو الصوتي */}
        <button 
          onClick={() => setActiveModule("audio")}
          className="group relative text-left bg-[#0a0a0a]/80 backdrop-blur-xl border border-gray-800 hover:border-emerald-500/50 rounded-2xl p-8 transition-all duration-500 hover:shadow-[0_0_40px_rgba(16,185,129,0.15)] hover:-translate-y-2 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="w-16 h-16 rounded-xl bg-emerald-500/10 flex items-center justify-center text-3xl mb-6 border border-emerald-500/20 group-hover:scale-110 transition-transform duration-500">
            🎙️
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">AI Audio Master</h2>
          <p className="text-gray-400 mb-6 text-sm leading-relaxed">
            Professional audio suite. Clean noise, auto-master LUFS, extract text, and apply deep voice morphing filters instantly.
          </p>
          <ul className="text-xs font-mono text-gray-500 space-y-2">
            <li className="flex items-center gap-2">✨ Noise Isolation</li>
            <li className="flex items-center gap-2">✂️ Smart Silence Trimmer</li>
            <li className="flex items-center gap-2">🎭 Voice Morphing Engine</li>
          </ul>
        </button>

        {/* بطاقة الدبلجة */}
        <button 
          onClick={() => setActiveModule("dubbing")}
          className="group relative text-left bg-[#0a0a0a]/80 backdrop-blur-xl border border-gray-800 hover:border-cyan-500/50 rounded-2xl p-8 transition-all duration-500 hover:shadow-[0_0_40px_rgba(6,182,212,0.15)] hover:-translate-y-2 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="w-16 h-16 rounded-xl bg-cyan-500/10 flex items-center justify-center text-3xl mb-6 border border-cyan-500/20 group-hover:scale-110 transition-transform duration-500">
            🎬
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Deep-Dub Studio</h2>
          <p className="text-gray-400 mb-6 text-sm leading-relaxed">
            Ultimate video localization. Separate vocal tracks, record your voice, auto-sync lips, and generate cinematic subtitles.
          </p>
          <ul className="text-xs font-mono text-gray-500 space-y-2">
            <li className="flex items-center gap-2">🎛️ Vocal & BGM Separation</li>
            <li className="flex items-center gap-2">👄 Deep-Fake Lip Sync</li>
            <li className="flex items-center gap-2">📝 Auto-Subtitling (SRT)</li>
          </ul>
        </button>

      </div>
    </div>
  );
}