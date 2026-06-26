import { useState, useEffect, useRef } from "react";
import SmartDropzone from "./components/SmartDropzone";
import StudioWaveform from "./components/StudioWaveform";
import Transcript from "./components/Transcript";

// --- دالة تحويل الصوت إلى WAV المادية عند التصدير ---
function bufferToWave(abuffer, len) {
  let numOfChan = abuffer.numberOfChannels, length = len * numOfChan * 2 + 44,
      buffer = new ArrayBuffer(length), view = new DataView(buffer),
      channels = [], i, sample, offset = 0, pos = 0;
  function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
  function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }
  setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157);
  setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
  setUint32(abuffer.sampleRate); setUint32(abuffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164); setUint32(length - pos - 4);
  for(i = 0; i < abuffer.numberOfChannels; i++) channels.push(abuffer.getChannelData(i));
  while(pos < length) {
    for(i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0;
      view.setInt16(pos, sample, true); pos += 2;
    }
    offset++;
  }
  return new Blob([buffer], {type: "audio/wav"});
}
// --- دالة تقطيع الصوت الفيزيائي (Web Audio Slicer - V2) ---
// --- دالة تقطيع الصوت الفيزيائي (Web Audio Slicer - V3 Robust) ---
  const applyCutsToAudio = async (file, keptRegions) => {
    try {
      console.log("🛠️ [Slicer] Starting...", keptRegions);
      
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      let newDuration = 0;
      // تنظيف الأرقام لتجنب أي انهيار في محرك الصوت
      const validRegions = keptRegions.map(region => {
        const start = Math.max(0, Math.min(region.start, audioBuffer.duration));
        const end = Math.max(0, Math.min(region.end, audioBuffer.duration));
        newDuration += (end - start);
        return { start, end, duration: end - start };
      }).filter(r => r.duration > 0.01); // تجاهل القطع متناهية الصغر

      if (newDuration <= 0) throw new Error("Trimmed duration is 0");

      const totalFrames = Math.max(1, Math.ceil(audioCtx.sampleRate * newDuration));
      const offlineCtx = new OfflineAudioContext(audioBuffer.numberOfChannels, totalFrames, audioCtx.sampleRate);

      let currentTimeOffset = 0;
      validRegions.forEach(region => {
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineCtx.destination);
        source.start(currentTimeOffset, region.start, region.duration);
        currentTimeOffset += region.duration;
      });

      const renderedBuffer = await offlineCtx.startRendering();
      const blob = bufferToWave(renderedBuffer, renderedBuffer.length);
      
      console.log("✅ [Slicer] Success! Creating new file...");
      return new File([blob], `Trimmed_${Date.now()}.wav`, { type: "audio/wav" });
      
    } catch (error) {
      console.error("💥 [Slicer CRITICAL ERROR]:", error);
      throw error; // إعادة توجيه الخطأ ليظهر في التنبيهات
    }
  };

// --- دالة تشغيل القص (مع صائد الأخطاء الشامل) ---
  const handleSmartTrimSilence = async () => {
    if (!activeTranscriptId) return alert("⚠️ Please load or fetch a project transcript from API first!");
    setIsProcessing(true);
    setProcessLog(`✂️ Scanning timeline using [${trimmerMode === 'ai_speech' ? 'AI Speech' : 'Acoustic'}] mode...`);
    
    try {
      console.log("🚀 [Trim] Sending request to Backend...");
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:5000/api/trim-silence/${activeTranscriptId}`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({ mode: trimmerMode })
      });
      
      if (!response.ok) throw new Error("Failed to trim silence from backend");
      const data = await response.json();
      
      console.log("📥 [Trim] Backend Response:", data);

      // +++ السحر الفيزيائي + صائد الأخطاء +++
      if (data.keptRegions && data.keptRegions.length > 0 && data.timeSaved > 0) {
        setProcessLog("✂️ Physically slicing and stitching the audio file in browser... ⏳");
        try {
            console.log("⚙️ [Trim] Slicing audio in browser...");
            const trimmedAudioFile = await applyCutsToAudio(audioFile, data.keptRegions);
            setAudioFile(trimmedAudioFile); // تحديث الملف الفيزيائي في الشاشة
        } catch (slicerError) {
            // هذا التنبيه سيكشف لنا السر إذا فشل المتصفح في القص!
            alert(`🚨 Browser Slicer Error: ${slicerError.message}\n(Press F12 and check Console for details)`);
            throw slicerError; // إيقاف العملية
        }
      }

      pushToHistory({ transcriptionData: data.chunks });
      if (data.chunks.length > 0) setDuration(data.chunks[data.chunks.length - 1].endTime);

      if (data.timeSaved && data.timeSaved > 0) {
        alert(`✨ Silence Trimming Complete!\nAI successfully shaved off ${data.timeSaved.toFixed(2)} seconds of dead air!`);
      } else {
        alert(`ℹ️ AI Notice: ${data.message || "No significant silence found to trim."}`);
      }

    } catch (error) {
      console.error("❌ [Trim Error]:", error);
      alert(`❌ Error processing silence trimmer: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProcessLog("");
    }
  };
  
// --- دالة توليد الصدى لمحرك التصدير ---
const generateReverbImpulse = (ctx) => {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * 2.5; 
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);
  for (let i = 0; i < length; i++) {
    const decay = Math.pow(1 - i / length, 3);
    left[i] = (Math.random() * 2 - 1) * decay;
    right[i] = (Math.random() * 2 - 1) * decay;
  }
  return impulse;
};

export default function AudioWorkspace({ onBack, projectId, onCreditUpdate, user, setUser }) { 
  // 1. الحالات الأساسية
  const [audioFile, setAudioFile] = useState(null); 
  const [currentTime, setCurrentTime] = useState(0); 
  const [isPlaying, setIsPlaying] = useState(false); 
  const [duration, setDuration] = useState(0);

  // 2. حالات التحجيم والقفز الزمني
  const [seekToTime, setSeekToTime] = useState(null);
  const [timelineHeight, setTimelineHeight] = useState(288); 

  // 3. محرك التراجع والتقدم (Undo/Redo Engine)
  const [history, setHistory] = useState([{ isSplit: false, isEnhanced: false, transcriptionData: [] }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const currentState = history[historyIndex];
  const { isSplit, isEnhanced, transcriptionData } = currentState;

  // 4. حالات واجهة الذكاء الاصطناعي والترجمة
  const [isProcessing, setIsProcessing] = useState(false);
  const [processLog, setProcessLog] = useState("");
  const [audioLanguage, setAudioLanguage] = useState("auto"); 
  const [translateTo, setTranslateTo] = useState("none");  
  const [activeTranscriptId, setActiveTranscriptId] = useState(projectId || null);
  // 7. حالة محرك القص الذكي
  const [trimmerMode, setTrimmerMode] = useState("ai_speech");
  // 5. حالات الفلاتر الصوتية الحية (Live FX Engine)
  const [pitch, setPitch] = useState(1); 
  const [reverbAmount, setReverbAmount] = useState(0); 

  // +++ 6. حالة تحديد نظام العمل التصديري الجديد +++
  // 'instant' = تحميل تلقائي بعد كل تعديل | 'multi' = تعديلات متعددة وحفظ يدوي
  const [workflowMode, setWorkflowMode] = useState("multi");

  // جلب بيانات المشروع القديم إذا تم تمرير ID
  useEffect(() => {
    setActiveTranscriptId(projectId);
    if (projectId) {
      const fetchSavedProject = async () => {
        setIsProcessing(true);
        setProcessLog("📥 Loading project data from Database...");
        try {
          const res = await fetch(`http://localhost:5000/api/transcript/${projectId}`);
          if (!res.ok) throw new Error("Failed to fetch project");
          const data = await res.json();
          setHistory([{ isSplit: false, isEnhanced: false, transcriptionData: data.chunks }]);
          setHistoryIndex(0);
        } catch (error) {
          console.error(error);
          alert("❌ Could not load the saved project.");
        } finally {
          setIsProcessing(false);
          setProcessLog("");
        }
      };
      fetchSavedProject();
    }
  }, [projectId]);

  // --- محرك التصدير والتحميل الاحترافي الشامل ---
  const downloadAudio = async (prefix = "") => {
    if (!audioFile) return;

    if (prefix === "AI_Mastered" && (isEnhanced || pitch !== 1 || reverbAmount > 0)) {
      setIsProcessing(true);
      setProcessLog("✨ Rendering Audio Matrix with all layers... Please wait.");

      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = await audioFile.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const newDuration = audioBuffer.duration * (1 / pitch);
        
        const offlineCtx = new OfflineAudioContext(
          audioBuffer.numberOfChannels,
          audioCtx.sampleRate * newDuration, 
          audioCtx.sampleRate
        );

        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = pitch;

        let activeSource = source;

        if (isEnhanced) {
          const compressor = offlineCtx.createDynamicsCompressor();
          compressor.threshold.value = -24;
          compressor.ratio.value = 12;
          const eq = offlineCtx.createBiquadFilter();
          eq.type = "highshelf";
          eq.frequency.value = 3000;
          eq.gain.value = 6;
          const gainNode = offlineCtx.createGain();
          gainNode.gain.value = 1.5;

          activeSource.connect(compressor);
          compressor.connect(eq);
          eq.connect(gainNode);
          activeSource = gainNode;
        }

        if (reverbAmount > 0) {
          const convolver = offlineCtx.createConvolver();
          convolver.buffer = generateReverbImpulse(offlineCtx);
          const dryGain = offlineCtx.createGain();
          const wetGain = offlineCtx.createGain();
          const wetRatio = reverbAmount / 100;
          
          wetGain.gain.value = wetRatio * 1.5;
          dryGain.gain.value = 1 - (wetRatio * 0.3);

          activeSource.connect(dryGain);
          activeSource.connect(convolver);
          convolver.connect(wetGain);
          dryGain.connect(offlineCtx.destination);
          wetGain.connect(offlineCtx.destination);
        } else {
          activeSource.connect(offlineCtx.destination);
        }

        source.start();
        const renderedBuffer = await offlineCtx.startRendering();
        const blob = bufferToWave(renderedBuffer, renderedBuffer.length);

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Mastered_${audioFile.name.replace(/\.[^/.]+$/, "")}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

      } catch (error) {
        console.error(error);
      } finally {
        setIsProcessing(false);
        setProcessLog("");
      }
    } else {
      const url = URL.createObjectURL(audioFile);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Raw_${audioFile.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // +++ +++ رادار نظام العمل التلقائي (Auto-Export Trigger) +++ +++
  useEffect(() => {
    if (workflowMode === "instant" && audioFile && (isEnhanced || pitch !== 1 || reverbAmount > 0)) {
      // إعطاء المستخدم ثانية واحدة للاستقرار على قيمة المؤشر لمنع تكرار التحميل العشوائي
      const autoSaveTimer = setTimeout(() => {
        downloadAudio("AI_Mastered");
      }, 1200);

      return () => clearTimeout(autoSaveTimer);
    }
  }, [isEnhanced, pitch, reverbAmount, workflowMode]);

  // --- دوال المساعدة للـ History ---
  const pushToHistory = (newStateChanges) => {
    const updatedState = { ...currentState, ...newStateChanges };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(updatedState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => { if (historyIndex > 0) setHistoryIndex(historyIndex - 1); };
  const redo = () => { if (historyIndex < history.length - 1) setHistoryIndex(historyIndex + 1); };

  const handleDragStart = (e) => {
    e.preventDefault();
    const handleMouseMove = (mouseEvent) => {
      const newHeight = window.innerHeight - mouseEvent.clientY;
      if (newHeight >= 150 && newHeight <= window.innerHeight - 200) setTimelineHeight(newHeight);
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const formatTime = (timeInSeconds) => {
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    const ms = Math.floor((timeInSeconds % 1) * 100);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(ms).padStart(2, '0')}`;
  };

  const handleFileReceived = (file) => {
    setAudioFile(file);
    setHistory([{ isSplit: false, isEnhanced: false, transcriptionData: [] }]);
    setHistoryIndex(0);
  };

// --- دالة تشغيل القص (مع أجهزة الاستشعار المنبثقة - Ultimate Debug) ---
 // --- دالة تشغيل القص (Professional English UI) ---
  const handleSmartTrimSilence = async () => {
    if (!activeTranscriptId) return alert("⚠️ Please load or fetch an API Transcript first!");
    setIsProcessing(true);
    setProcessLog(`✂️ Scanning timeline using [${trimmerMode === 'ai_speech' ? 'AI Speech' : 'Acoustic'}] mode...`);
    
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:5000/api/trim-silence/${activeTranscriptId}`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({ mode: trimmerMode })
      });
      
      if (!response.ok) throw new Error("Backend response not OK");
      const data = await response.json();

      if (data.timeSaved > 0 && data.keptRegions && data.keptRegions.length > 0) {
        setProcessLog("✂️ Physically slicing and stitching the audio file in browser... ⏳");
        try {
            const trimmedAudioFile = await applyCutsToAudio(audioFile, data.keptRegions);
            setAudioFile(trimmedAudioFile);
            
            // رسالة النجاح الاحترافية بالإنجليزية
            alert(`✨ Silence Trimming Complete!\nSuccessfully shaved off ${data.timeSaved.toFixed(2)} seconds of dead air.\nNew file: ${trimmedAudioFile.name}`);
        } catch (slicerError) {
            alert(`🚨 Audio Engine Error: Could not slice the physical file.\nDetails: ${slicerError.message}`);
            throw slicerError;
        }
      } else {
        alert(`ℹ️ Notice: ${data.message || "No significant silence detected based on your current mode settings."}`);
      }

      pushToHistory({ transcriptionData: data.chunks });
      if (data.chunks.length > 0) setDuration(data.chunks[data.chunks.length - 1].endTime);

    } catch (error) {
      alert(`❌ Process Failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProcessLog("");
    }
  };

  const handleTranscribeWithAPI = async () => {
    if (!audioFile) return alert("⚠️ Load an audio file first!");
    setIsProcessing(true);
    setProcessLog("🚀 Sending audio to your Node.js server...");
    try {
      const formData = new FormData();
      formData.append("audio_file", audioFile);
      formData.append("language", audioLanguage);
      formData.append("translate_to", translateTo);
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/transcribe", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Server responded with an error");
      }
      const finalResult = await response.json();
      if (finalResult.chunks && finalResult.chunks.length > 0) {
        pushToHistory({ transcriptionData: finalResult.chunks });
        setActiveTranscriptId(finalResult.transcriptId);
        if (user && setUser) {
            const updatedUser = { ...user, credits: finalResult.remainingCredits };
            setUser(updatedUser);
            localStorage.setItem("user", JSON.stringify(updatedUser));
        }
        alert(`🎉 Success! 1 credit deducted. Remaining credits: ${finalResult.remainingCredits}`);
      } else {
        alert("⚠️ AI couldn't detect any clear speech.");
      }
    } catch (error) {
      console.error(error);
      alert(`❌ Connection failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProcessLog("");
    }
  };

  const hasTranscriptData = transcriptionData && transcriptionData.length > 0;
        
  return (
    <div className="h-screen w-full bg-[#030303] text-gray-200 flex flex-col overflow-hidden font-sans select-none">
      
      {/* 1. Header */}
      <header className="h-14 shrink-0 border-b border-gray-900/60 flex items-center justify-between px-6 bg-[#080808]/90 backdrop-blur-md z-30">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-all text-sm font-medium flex items-center gap-1 bg-gray-900/40 hover:bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-800/50">
            ← Dashboard
          </button>
          <span className="text-gray-800">|</span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <h2 className="font-bold text-white text-sm tracking-wider uppercase">Audio Master AI</h2>
          </div>
        </div>

        {/* العداد الذهبي المتمركز في مساحتك المفضلة */}
        <div className="flex items-center gap-4">
          {user && (
            <div className="mr-2 bg-[#0a0a0a] px-4 py-1.5 rounded-xl border border-gray-800 flex items-center gap-3 shadow-inner">
                <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Balance</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">🪙</span>
                  <span className="text-emerald-400 font-extrabold font-mono text-sm">{user.credits}</span>
                </div>
            </div>
          )}

          <div className="flex items-center gap-2 mr-2 border-l border-r border-gray-800 px-4">
            <button onClick={undo} disabled={historyIndex === 0} className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 transition-opacity">↩️</button>
            <button onClick={redo} disabled={historyIndex === history.length - 1} className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 transition-opacity">↪️</button>
          </div>
          
          {audioFile && (
            <div className="flex items-center gap-2 mr-4 border-r border-gray-800 pr-4">
              <button onClick={() => downloadAudio()} className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded transition-colors">📥 Original</button>
              {workflowMode === "multi" && (isEnhanced || pitch !== 1 || reverbAmount > 0) && (
                <button onClick={() => downloadAudio("AI_Mastered")} className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 font-bold text-xs rounded transition-colors shadow-lg">✨ Export Master track</button>
              )}
            </div>
          )}
          <div className="font-mono text-xs text-gray-500 tracking-widest bg-black/40 px-3 py-1.5 rounded-md border border-gray-900">
            TOTAL TIME: <span className="text-emerald-400 font-bold">{formatTime(duration)}</span>
          </div>
        </div>
      </header>

      {/* 2. Main Workspace */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <aside className="w-72 shrink-0 bg-[#060606] border-r border-gray-950 p-4 flex flex-col gap-4 overflow-y-auto min-w-0 relative">
          
          {/* +++ +++ أزرار التحكم في نظام العمل الجديد (Workflow Mode Switcher) +++ +++ */}
          <div className="w-full shrink-0 bg-[#0c0d12] border border-gray-800 p-2 rounded-xl flex gap-1">
            <button 
              onClick={() => setWorkflowMode("instant")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${workflowMode === "instant" ? "bg-gradient-to-r from-amber-500 to-orange-600 text-black shadow-md" : "text-gray-500 hover:text-gray-300"}`}
            >
              <span>⚡ Auto-Export</span>
              <span className="text-[8px] opacity-70">تحميل بعد كل تعديل</span>
            </button>
            <button 
              onClick={() => setWorkflowMode("multi")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-0.5 ${workflowMode === "multi" ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-black shadow-md" : "text-gray-500 hover:text-gray-300"}`}
            >
              <span>🎛️ Studio Rack</span>
              <span className="text-[8px] opacity-70">تعديلات متعددة</span>
            </button>
          </div>

          <div className="text-[10px] font-mono uppercase tracking-wider text-gray-600 shrink-0">Neural Audio Tools</div>
          
{/* +++ محرك القص المزدوج الجديد +++ */}
          <div className="w-full shrink-0 bg-[#0a0a0a] border border-gray-800 p-3 rounded-xl flex flex-col gap-3 relative">
            <div className="flex items-center gap-2">
              <span className="text-xl">✂️</span>
              <span className="text-sm font-bold text-gray-200">Smart Trimmer</span>
            </div>
            
            <select 
              value={trimmerMode}
              onChange={(e) => setTrimmerMode(e.target.value)}
              className="bg-[#040404] border border-gray-700 text-xs rounded-lg p-2 text-emerald-400 outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="ai_speech">🤖 AI Speech Gate (Aggressive Cut)</option>
              <option value="acoustic">🔈 Acoustic Gate (Keep Natural Tone)</option>
            </select>

            <button 
              onClick={handleSmartTrimSilence} 
              disabled={isProcessing || !hasTranscriptData} 
              className={`w-full py-2 bg-gray-900 hover:bg-gray-800 border ${(!hasTranscriptData || isProcessing) ? 'border-gray-900 opacity-50 cursor-not-allowed' : 'border-gray-700 hover:border-emerald-500/40'} rounded-lg text-xs font-bold transition-all text-gray-300`}
            >
              Execute Trim
            </button>
            <p className="text-[9px] text-gray-500 leading-relaxed mt-1">
              {trimmerMode === 'ai_speech' ? "Removes any gap > 0.3s. Good for fast-paced videos." : "Removes only long gaps > 1.2s. Good for natural podcasts."}
            </p>
          </div>

          {/* محرك الترجمة الذكي */}
          <div className="w-full shrink-0 bg-[#090a0e]/60 border border-purple-500/20 p-3 rounded-xl flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-purple-500/5 rounded-full blur-xl"></div>
            <div className="flex items-center gap-3"><span className="text-xl">📝</span><span className="text-sm font-semibold text-purple-400">Cloud AI API</span></div>
            <div className="flex flex-col gap-1 z-10">
              <select value={audioLanguage} onChange={(e) => setAudioLanguage(e.target.value)} className="bg-[#040404] border border-gray-800 text-xs rounded-lg p-2 text-gray-300 outline-none">
                <option value="auto">Auto Detect Language</option>
                <option value="ja">Japanese (日本語)</option>
                <option value="en">English (US/UK)</option>
                <option value="ar">Arabic (العربية)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 z-10">
              <select value={translateTo} onChange={(e) => setTranslateTo(e.target.value)} className="bg-[#040404] border border-gray-800 text-xs rounded-lg p-2 text-purple-300 font-medium outline-none">
                <option value="none">⚠️ Keep Original Language</option>
                <option value="ar">Translate to Arabic (العربية)</option>
                <option value="en">Translate to English</option>
              </select>
            </div>
            <button onClick={handleTranscribeWithAPI} disabled={isProcessing} className="w-full mt-2 py-2.5 z-10 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 text-white font-bold text-xs rounded-lg transition-all disabled:opacity-40 shadow-lg">
              Fetch API Transcript
            </button>
          </div>

          {/* رف التأثيرات الاحترافي (FX Rack UI) */}
          <div className="w-full shrink-0 bg-[#070707] border border-gray-800 p-4 rounded-xl flex flex-col gap-4 relative overflow-hidden shadow-inner">
            <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-500 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                Active FX Rack
              </span>
              {workflowMode === "instant" && <span className="text-[9px] text-amber-500 font-bold animate-pulse">⚡ Auto Mode Active</span>}
            </div>
            
            {/* Layer 1: Auto Mastering */}
            <div className={`p-3 rounded-lg border transition-all ${isEnhanced ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-[#0a0a0a] border-gray-800'}`}>
              <div className="flex justify-between items-center mb-1">
                <span className={`text-xs font-bold ${isEnhanced ? 'text-emerald-400' : 'text-gray-400'}`}>✨ Studio Mastering</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={isEnhanced} onChange={() => pushToHistory({ isEnhanced: !isEnhanced })} />
                  <div className="w-7 h-4 bg-gray-700 peer-focus:outline-none rounded-full peer peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
              <p className="text-[9px] text-gray-500">EQ & Balanced Compression</p>
            </div>

            {/* Layer 2: Voice Morph */}
            <div className={`p-3 rounded-lg border transition-all ${pitch !== 1 ? 'bg-purple-900/10 border-purple-500/30' : 'bg-[#0a0a0a] border-gray-800'}`}>
              <div className="flex justify-between items-center mb-3">
                <span className={`text-xs font-bold ${pitch !== 1 ? 'text-purple-400' : 'text-gray-400'}`}>🎭 Voice Morph</span>
                <span className="text-xs font-mono bg-black px-1.5 rounded text-gray-400">{pitch.toFixed(2)}x</span>
              </div>
              <input type="range" min="0.5" max="1.5" step="0.05" value={pitch} onChange={(e) => setPitch(parseFloat(e.target.value))} className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-500" />
              <div className="flex justify-between text-[8px] text-gray-500 font-mono mt-1">
                <button onClick={() => setPitch(0.7)} className="hover:text-purple-400">Deep</button>
                <button onClick={() => setPitch(1)} className="hover:text-gray-300">Reset</button>
                <button onClick={() => setPitch(1.3)} className="hover:text-purple-400">High</button>
              </div>
            </div>

            {/* Layer 3: Reverb */}
            <div className={`p-3 rounded-lg border transition-all ${reverbAmount > 0 ? 'bg-cyan-900/10 border-cyan-500/30' : 'bg-[#0a0a0a] border-gray-800'}`}>
              <div className="flex justify-between items-center mb-3">
                <span className={`text-xs font-bold ${reverbAmount > 0 ? 'text-cyan-400' : 'text-gray-400'}`}>🏛️ Space Reverb</span>
                <span className="text-xs font-mono bg-black px-1.5 rounded text-gray-400">{reverbAmount}%</span>
              </div>
              <input type="range" min="0" max="100" step="1" value={reverbAmount} onChange={(e) => setReverbAmount(parseFloat(e.target.value))} className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
              <div className="flex justify-between text-[8px] text-gray-500 font-mono mt-1">
                <button onClick={() => setReverbAmount(0)} className="hover:text-gray-300">Off</button>
                <button onClick={() => setReverbAmount(50)} className="hover:text-cyan-400">Room</button>
                <button onClick={() => setReverbAmount(100)} className="hover:text-cyan-400">Hall</button>
              </div>
            </div>
          </div>

          {isProcessing && (
            <div className="absolute bottom-4 left-4 right-4 bg-[#081510]/95 border border-emerald-500/30 p-3 rounded-xl backdrop-blur-sm animate-pulse z-50">
              <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-2 mb-1"><span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span>PROCESSING...</div>
              <div className="text-xs text-gray-300 font-mono leading-tight">{processLog}</div>
            </div>
          )}
        </aside>

        <main className="flex-1 bg-[#040404] p-6 flex flex-row items-center justify-center relative min-w-0 z-10 shadow-2xl gap-6 overflow-hidden">
          {(!audioFile && !hasTranscriptData) ? ( 
            <SmartDropzone onFileDrop={handleFileReceived} /> 
          ) : (
            <>
              <div className="flex-1 flex flex-col items-center justify-center w-full max-w-5xl h-full">
                {audioFile ? (
                  <StudioWaveform 
                    key={audioFile.name + audioFile.size} // +++ هذا هو مفتاح السحر الذي يجبر الموجة على التحديث +++
                    file={audioFile} 
                    onClear={() => { 
                      setAudioFile(null); setCurrentTime(0); setDuration(0); setHistoryIndex(0); 
                      setHistory([{ isSplit: false, isEnhanced: false, transcriptionData: [] }]);
                      setPitch(1); setReverbAmount(0);
                    }} 
                    onTimeUpdate={setCurrentTime}
                    onPlayStateChange={setIsPlaying}
                    onDurationChange={setDuration}
                    seekToTime={seekToTime} 
                    isEnhanced={isEnhanced}
                    pitch={pitch}
                    reverbAmount={reverbAmount}
                  />
                ) : (
                  <div className="w-full max-w-2xl p-12 border-2 border-dashed border-gray-800 rounded-3xl flex flex-col items-center justify-center bg-gray-900/10 backdrop-blur-sm">
                    <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6"><span>☁️</span></div>
                    <h3 className="text-xl font-bold text-gray-200 mb-2">Transcript Loaded Successfully</h3>
                    <p className="text-gray-500 text-sm max-w-md text-center leading-relaxed">Your AI translations and texts have been securely loaded from the database.</p>
                  </div>
                )}
              </div>

              {hasTranscriptData && (
                <div className="w-80 h-full max-h-[450px] bg-[#0a0a0a]/90 backdrop-blur-md border border-gray-800 rounded-xl shadow-2xl p-4 flex flex-col overflow-hidden animate-fade-in">
                  <Transcript currentTime={currentTime} onSeek={(time) => setSeekToTime(time)} transcriptData={transcriptionData} />
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* 3. Timeline Resizer */}
      <div onMouseDown={handleDragStart} className="h-1.5 w-full bg-gray-900 hover:bg-emerald-500/50 cursor-ns-resize flex items-center justify-center z-50 transition-colors">
        <div className="w-12 h-[2px] bg-gray-500 rounded-full"></div>
      </div>

      {/* 4. Timeline */}
      <footer className="shrink-0 bg-[#070707] flex flex-col min-h-0 z-20 relative" style={{ height: `${timelineHeight}px` }}>
        <div className="h-10 border-b border-gray-900 bg-[#0a0a0a] px-4 flex items-center justify-between text-xs text-gray-500 font-mono z-20 shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-gray-600">🎛️ Virtual Timeline Track</span>
          </div>
          <div className="text-emerald-500 bg-emerald-950/30 px-2 py-1 rounded border border-emerald-900/50">{formatTime(currentTime)}</div>
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col relative">
          <div className="flex h-20 min-h-[80px] items-center border-b border-gray-900/50 relative">
            <div className="w-56 shrink-0 h-full bg-[#0a0a0a] border-r border-gray-900 flex flex-col justify-center px-4 font-mono z-10 shadow-md">
              <span className="text-xs font-bold text-gray-200 flex items-center gap-2">🎙️ Master Track</span>
            </div>
            <div className="flex-1 h-full relative flex items-center py-2 px-1">
              {audioFile && (
                <div className="h-12 w-full bg-gradient-to-r from-emerald-900/80 to-emerald-800/40 border border-emerald-500/40 rounded-r-md flex items-center px-3 text-xs font-mono text-emerald-300">
                  {audioFile.name} [Workflow: {workflowMode === 'instant' ? 'Auto-Baking' : 'Rack Layered'}]
                </div>
              )}
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}