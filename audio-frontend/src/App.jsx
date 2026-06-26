import { useState, useEffect } from "react";
import AudioWorkspace from "./modules/AudioStudio/AudioWorkspace"; 
import Dashboard from "./modules/AudioStudio/components/Dashboard";
// +++ 1. استيراد شاشة الدخول +++
import AuthScreen from "./modules/AudioStudio/components/AuthScreen";

export default function App() {
  // +++ 2. حالة المستخدم (التحقق مما إذا كان مسجلاً للدخول من الذاكرة المحلية) +++
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

   // +++ كود المزامنة الصامتة الجديد +++
  useEffect(() => {
    const syncProfile = async () => {
      const token = localStorage.getItem("token");
      if (!token || !user) return; // إذا لم يكن مسجلاً للدخول، لا تفعل شيئاً

      try {
        const response = await fetch("http://localhost:5000/api/auth/me", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          // تحديث الشاشة والذاكرة المحلية بأحدث رصيد قادم من قاعدة البيانات
          setUser(data.user);
          localStorage.setItem("user", JSON.stringify(data.user));
        }
      } catch (error) {
        console.error("Silent sync failed:", error);
      }
    };

    syncProfile();
  }, []); // تعمل مرة واحدة عند فتح أو تحديث الصفحة
  // ------------------------------------

  
  const [activeModule, setActiveModule] = useState("home");
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  // +++ 3. دالة تسجيل الخروج +++
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setActiveModule("home"); // إعادته للرئيسية عند تسجيل الخروج
  };

  const handleNewAudioProject = () => {
    setSelectedProjectId(null); 
    setActiveModule("audio-workspace"); 
  };

  const handleOpenAudioProject = (id) => {
    setSelectedProjectId(id);
    setActiveModule("audio-workspace");
  };


  // +++ الدالة الجديدة لتحديث الرصيد بنعومة وبدون تحديث الصفحة +++
  const handleCreditUpdate = (newCredits) => {
    const updatedUser = { ...user, credits: newCredits };
    setUser(updatedUser); // تحديث الشاشة العلوية فوراً
    localStorage.setItem("user", JSON.stringify(updatedUser)); // تحديث الذاكرة المحلية
  };



  if (activeModule === "audio-workspace") {
    return (
      <AudioWorkspace 
        onBack={() => setActiveModule("audio-dashboard")}
        projectId={selectedProjectId} 
        user={user}              // نمرر بيانات المستخدم
        setUser={setUser}        // نمرر دالة التحديث
      />
    );
  }
  
  if (activeModule === "audio-dashboard") {
    return (
      <Dashboard 
        onNewProject={handleNewAudioProject} 
        onOpenProject={handleOpenAudioProject} 
        onBack={() => setActiveModule("home")}
      />
    );
  }

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

  // +++ 4. حارس البوابة: إذا لم يكن هناك مستخدم، نعرض شاشة الدخول فقط +++
  if (!user) {
    return <AuthScreen onLoginSuccess={(userData) => setUser(userData)} />;
  }

  // --- الواجهة الرئيسية (بوابة الدخول للمنصة) ---
  return (
    <div className="w-full min-h-screen bg-[#020202] text-gray-200 flex flex-col items-center justify-center p-6 selection:bg-emerald-500/30 font-sans relative overflow-hidden">
      
      {/* إضاءات الخلفية */}
      <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-emerald-600/20 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-cyan-600/20 rounded-full blur-[120px]"></div>

      {/* +++ 5. شريط معلومات الحساب (يظهر للمستخدم المسجل) +++ */}
      <div className="absolute top-6 right-8 flex items-center gap-4 z-20 bg-[#0a0a0a]/60 px-4 py-2 rounded-xl border border-gray-800 backdrop-blur-md shadow-lg">
        <span className="text-sm text-gray-400 flex items-center gap-2">
          <span className="w-6 h-6 bg-emerald-500/20 text-emerald-400 flex items-center justify-center rounded-full text-xs font-bold border border-emerald-500/30">
            {user.name.charAt(0).toUpperCase()}
          </span>
          Hi, <span className="text-emerald-400 font-bold">{user.name.split(' ')[0]}</span>
          <span className="mx-1 text-gray-700">|</span>
          🪙 <span className="text-yellow-400 font-mono tracking-wider">{user.credits} Credits</span>
        </span>
        <button 
          onClick={handleLogout} 
          className="ml-2 px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-lg border border-red-500/30 transition-colors"
        >
          Logout
        </button>
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl z-10">
        
        <button 
          onClick={() => setActiveModule("audio-dashboard")}
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