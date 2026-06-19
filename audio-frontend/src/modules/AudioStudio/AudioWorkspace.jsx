import { useState } from "react";
import SmartDropzone from "./components/SmartDropzone";
import StudioWaveform from "./components/StudioWaveform";

export default function AudioWorkspace({ onBack }) {
  // حالات إدارة الملفات والوقت
  const [audioFile, setAudioFile] = useState(null); 
  const [activeTrack, setActiveTrack] = useState(null);
  const [currentTime, setCurrentTime] = useState(0); 
  const [isPlaying, setIsPlaying] = useState(false); 
  const [duration, setDuration] = useState(0);

  // حالات أدوات المعالجة
  const [isProcessing, setIsProcessing] = useState(false);
  const [processLog, setProcessLog] = useState("");
  const [isSplit, setIsSplit] = useState(false); 
  const [isEnhanced, setIsEnhanced] = useState(false); 

  // +++ حالات الـ API واللغات الجديدة +++
  const [audioLanguage, setAudioLanguage] = useState("ja"); // لغة الصوت الفعلي (الافتراضي ياباني)
  const [translateTo, setTranslateTo] = useState("none");  // لغة الترجمة المطلوبة
  const [transcriptionData, setTranscriptionData] = useState([]);

  // رابط السيرفر الخاص بك (قم بتغيير المنفذ 5000 إلى منفذ سيرفر بايثون الخاص بك إذا كان مختلفاً)
  const BACKEND_API_URL = "http://localhost:5000/api/transcribe";

  const formatTime = (timeInSeconds) => {
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    const ms = Math.floor((timeInSeconds % 1) * 100);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(ms).padStart(2, '0')}`;
  };

  const handleFileReceived = (file) => {
    setAudioFile(file);
    setIsSplit(false); 
    setIsEnhanced(false);
    setTranscriptionData([]); 
  };

  const applyAIFilter = (filterName) => {
    if (!audioFile) return alert("⚠️ Please load an audio file first!");
    if (isProcessing) return;

    setIsProcessing(true);
    setProcessLog(`[System] Initializing ${filterName}...`);

    setTimeout(() => {
      setProcessLog(`[AI] Analyzing audio frequencies & isolating nodes... ⏳`);
    }, 1500);

    setTimeout(() => {
      setIsProcessing(false);
      setProcessLog(""); 
      if (filterName === "Vocal & BGM Splitter") setIsSplit(true);
      setIsEnhanced(true); 
    }, 4000); 
  };

  // +++ دالة استدعاء الـ API الخارجي والترجمة الحقيقية +++
  const handleTranscribeWithAPI = async () => {
    if (!audioFile) return alert("⚠️ Load an audio file first!");
    
    setIsProcessing(true);
    setProcessLog("🚀 [API] Uploading audio to neural server & computing weights...");

    try {
      // تجهيز البيانات لإرسالها كمستند صلب (Multipart FormData)
      const formData = new FormData();
      formData.append("audio_file", audioFile);
      formData.append("language", audioLanguage); // إرسال لغة الصوت الأصلية
      formData.append("translate_to", translateTo); // إرسال لغة الترجمة المطلوبة

      // إرسال الطلب للسيرفر الفعلي
      const response = await fetch(BACKEND_API_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const result = await response.json();
      console.log("[API] Successful response from backend:", result);

      // ربط مخرجات السيرفر بالتايم لاين
      if (result && result.chunks) {
        const realData = result.chunks.map((chunk, index) => ({
          id: index,
          // نتوقع أن يرسل السيرفر الوقت بصيغة ثوانٍ [start, end]
          start: chunk.start, 
          end: chunk.end || chunk.start + 2, 
          text: chunk.text // النص (سواء كان الأصلي أو المترجم القادم من السيرفر)
        }));
        setTranscriptionData(realData);
      } else {
        alert("⚠️ API executed but returned an invalid data structure.");
      }

    } catch (error) {
      console.error("[API Error] Setup connection failed:", error);
      alert("❌ Failed to connect to the audio server! Make sure your Python backend is running.");
    } finally {
      setIsProcessing(false);
      setProcessLog("");
    }
  };

  const downloadAudio = (prefix = "") => {
    if (!audioFile) return;
    const url = URL.createObjectURL(audioFile);
    const a = document.createElement("a");
    a.href = url;
    a.download = prefix ? `${prefix}_${audioFile.name}` : audioFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url); 
  };
        
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

        <div className="flex items-center gap-4">
          {audioFile && (
            <div className="flex items-center gap-2 mr-4 border-r border-gray-800 pr-4">
              <button onClick={() => downloadAudio()} className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 text-xs font-medium rounded transition-colors">
                📥 Original
              </button>
              {(isSplit || isEnhanced) && (
                <button onClick={() => downloadAudio("AI_Mastered")} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 font-bold text-xs rounded transition-colors shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                  ✨ Export Processed
                </button>
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
        
{/* Sidebar Tools */}
        <aside className="w-72 shrink-0 bg-[#060606] border-r border-gray-950 p-4 flex flex-col gap-4 overflow-y-auto min-w-0 relative">
          <div className="text-[10px] font-mono uppercase tracking-wider text-gray-600 shrink-0">Neural Audio Filters</div>
          
          {/* فلتر العزل */}
          <button onClick={() => applyAIFilter("Vocal & BGM Splitter")} disabled={isProcessing} className={`w-full shrink-0 bg-[#0a0a0a] border ${isProcessing ? 'border-gray-900 opacity-50 cursor-not-allowed' : 'border-gray-900 hover:border-emerald-500/40'} p-3 rounded-xl text-left transition-all group`}>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xl group-hover:scale-110 transition-transform">🎛️</span>
              <span className="text-sm font-semibold text-gray-200">Vocal & BGM Splitter</span>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">Extract crystal clear acapella and background music.</p>
          </button>

          {/* +++ لوحة هندسة الترجمة والتفريغ عبر الـ API (تم إصلاح الانضغاط هنا بـ shrink-0) +++ */}
          <div className="w-full shrink-0 bg-[#090a0e]/60 border border-purple-500/20 p-3 rounded-xl flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-purple-500/5 rounded-full blur-xl"></div>
            <div className="flex items-center gap-3">
              <span className="text-xl">📝</span>
              <span className="text-sm font-semibold text-purple-400">Speech-To-Text API</span>
            </div>

            {/* اختيار لغة الصوت الأصلية */}
            <div className="flex flex-col gap-1 z-10">
              <label className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">1. Audio Language</label>
              <select 
                value={audioLanguage} 
                onChange={(e) => setAudioLanguage(e.target.value)}
                className="bg-[#040404] border border-gray-800 text-xs rounded-lg p-2 text-gray-300 focus:border-purple-500/50 outline-none cursor-pointer"
              >
                <option value="ja">Japanese (日本語)</option>
                <option value="en">English (US/UK)</option>
                <option value="ar">Arabic (العربية)</option>
                <option value="auto">Auto Detect Language</option>
              </select>
            </div>

            {/* اختيار الترجمة الآلية */}
            <div className="flex flex-col gap-1 z-10">
              <label className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">2. Machine Translation</label>
              <select 
                value={translateTo} 
                onChange={(e) => setTranslateTo(e.target.value)}
                className="bg-[#040404] border border-gray-800 text-xs rounded-lg p-2 text-purple-300 font-medium focus:border-purple-500/50 outline-none cursor-pointer"
              >
                <option value="none">⚠️ Keep Original Language</option>
                <option value="ar">Translate to Arabic (العربية)</option>
                <option value="en">Translate to English</option>
              </select>
            </div>

            {/* زر تشغيل الـ API */}
            <button 
              onClick={handleTranscribeWithAPI} 
              disabled={isProcessing} 
              className="w-full mt-2 py-2.5 z-10 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg transition-all shadow-[0_0_15px_rgba(147,51,234,0.2)] disabled:opacity-40"
            >
              Analyze & Generate Script
            </button>
          </div>

          {/* فلتر التحسين */}
          <button onClick={() => applyAIFilter("AI Studio Enhance")} disabled={isProcessing} className={`w-full shrink-0 bg-[#0a0a0a] border ${isProcessing ? 'border-gray-900 opacity-50 cursor-not-allowed' : 'border-gray-900 hover:border-emerald-500/40'} p-3 rounded-xl text-left transition-all group`}>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xl group-hover:scale-110 transition-transform">✨</span>
              <span className="text-sm font-semibold text-gray-200">AI Studio Enhance</span>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">Automatically balance frequencies (EQ) and compress.</p>
          </button>

          {isProcessing && (
            <div className="absolute bottom-4 left-4 right-4 bg-[#081510]/95 border border-emerald-500/30 p-3 rounded-xl backdrop-blur-sm animate-pulse shadow-lg z-50">
              <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span>
                PROCESSING SYSTEM NODE...
              </div>
              <div className="text-xs text-gray-300 font-mono leading-tight">{processLog}</div>
            </div>
          )}
        </aside>

        {/* Waveform Stage */}
        <main className="flex-1 bg-[#040404] p-6 flex flex-col items-center justify-center relative min-w-0 z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
          {!audioFile ? (
            <SmartDropzone onFileDrop={handleFileReceived} />
          ) : (
          <StudioWaveform 
              file={audioFile} 
              onClear={() => {
                setAudioFile(null);
                setCurrentTime(0);
                setDuration(0);
                setIsSplit(false);
                setIsEnhanced(false);
                setTranscriptionData([]);
              }} 
              onTimeUpdate={setCurrentTime}
              onPlayStateChange={setIsPlaying}
              onDurationChange={setDuration}
            />
          )}
        </main>
      </div>

      {/* 3. The Pro Timeline */}
      <footer className="h-72 shrink-0 bg-[#070707] border-t border-gray-900 flex flex-col min-h-0 z-20 relative">
        <div className="h-10 border-b border-gray-900 bg-[#0a0a0a] px-4 flex items-center justify-between text-xs text-gray-500 font-mono relative z-20">
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1 hover:text-emerald-400 transition-colors">
              <span className="text-sm">▶</span> Play
            </button>
            <button className="flex items-center gap-1 hover:text-red-400 transition-colors">
              <span className="text-sm">⏸</span> Pause
            </button>
            <span className="text-gray-800">|</span>
            <span className="text-gray-600 flex items-center gap-2">
              <span className="w-3 h-3 bg-gray-800 rounded-sm inline-block"></span> Tool: Selection
            </span>
          </div>
          <div className="text-emerald-500 bg-emerald-950/30 px-2 py-1 rounded border border-emerald-900/50">
            {formatTime(currentTime)}
          </div>
        </div>

        <div 
          className="flex-1 overflow-y-auto flex flex-col relative"
          style={{
            backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 99px, #111 99px, #111 100px)",
            backgroundSize: "100px 100%"
          }}
        >
          
          {/* Playhead */}
          {audioFile && duration > 0 && (
            <div 
              className="absolute top-0 bottom-0 w-[2px] bg-red-600 z-50 pointer-events-none shadow-[0_0_12px_rgba(220,38,38,1)]"
              style={{
                left: `calc(224px + ((100% - 224px) * ${currentTime / duration}))`,
                willChange: 'left'
              }}
            >
              <div className="absolute top-0 left-[-5px] w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-transparent border-t-red-600"></div>
            </div>
          )}

          {/* Track 1: Vocal */}
          <div className="flex h-20 min-h-[80px] items-center border-b border-gray-900/50 group">
            <div className="w-56 shrink-0 h-full bg-[#0a0a0a] border-r border-gray-900 flex flex-col justify-center px-4 font-mono relative z-10 shadow-[5px_0_15px_rgba(0,0,0,0.5)]">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-gray-200 flex items-center gap-2">
                  <span className="text-emerald-500">🎙️</span> Vocal Track
                </span>
              </div>
              <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500/50 w-full"></div>
              </div>
            </div>
            
            <div className="flex-1 h-full relative flex items-center py-2">
              {audioFile && (
                <div className="h-12 w-full bg-gradient-to-r from-emerald-900/80 to-emerald-800/40 border border-emerald-500/40 rounded-r-md flex flex-col justify-center px-3 text-xs font-mono text-emerald-300 relative overflow-hidden shadow-lg">
                  <div className="absolute top-0 left-0 bottom-0 w-1 bg-emerald-400"></div>
                  <span className="truncate font-semibold z-10 drop-shadow-md">{audioFile.name}</span>
                  <span className="text-[9px] text-emerald-500/70 z-10">Neural Extracted</span>
                </div>
              )}
            </div>
          </div>

          {/* Track 2: BGM */}
          <div className="flex h-20 min-h-[80px] items-center border-b border-gray-900/50 group">
            <div className="w-56 shrink-0 h-full bg-[#0a0a0a] border-r border-gray-900 flex flex-col justify-center px-4 font-mono relative z-10 shadow-[5px_0_15px_rgba(0,0,0,0.5)]">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-gray-200 flex items-center gap-2">
                  <span className="text-cyan-500">🎵</span> BGM Track
                </span>
              </div>
              <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500/50 w-full"></div>
              </div>
            </div>
            
            <div className="flex-1 h-full relative flex items-center py-2">
              {isSplit && (
                <div className="h-12 w-full bg-gradient-to-r from-cyan-900/80 to-cyan-800/40 border border-cyan-500/40 rounded-r-md flex flex-col justify-center px-3 text-xs font-mono text-cyan-300 relative overflow-hidden shadow-lg">
                  <div className="absolute top-0 left-0 bottom-0 w-1 bg-cyan-400"></div>
                  <span className="truncate font-semibold z-10 drop-shadow-md">Isolated_Instrumental_Track.wav</span>
                  <span className="text-[9px] text-cyan-500/70 z-10">Stereo Mix</span>
                </div>
              )}
            </div>
          </div>

          {/* Track 3: Subtitles / Transcripts */}
          <div className="flex h-16 min-h-[64px] items-center border-b border-gray-900/50 group">
            <div className="w-56 shrink-0 h-full bg-[#0a0a0a] border-r border-gray-900 flex flex-col justify-center px-4 font-mono relative z-10 shadow-[5px_0_15px_rgba(0,0,0,0.5)]">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-gray-200 flex items-center gap-2">
                  <span className="text-purple-500">📝</span> Subtitles
                </span>
              </div>
            </div>
            
            <div className="flex-1 h-full relative flex items-center py-1 overflow-visible">
              {transcriptionData.length > 0 && transcriptionData.map((clip) => {
                const leftPos = (clip.start / Math.max(duration, 10)) * 100;
                const widthPos = ((clip.end - clip.start) / Math.max(duration, 10)) * 100;
                const isActive = currentTime >= clip.start && currentTime <= clip.end;

                return (
                  <div 
                    key={clip.id}
                    className={`absolute h-8 rounded border flex flex-col justify-center px-2 text-[10px] font-mono transition-colors shadow-sm cursor-text group ${isActive ? 'bg-purple-500/30 border-purple-400 text-white z-25 scale-105 shadow-[0_0_10px_rgba(168,85,247,0.4)]' : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:z-30 hover:bg-gray-700'}`}
                    style={{ left: `${leftPos}%`, width: `${Math.max(widthPos, 4)}%` }}
                  >
                    <span className="truncate group-hover:absolute group-hover:bg-gray-950 group-hover:border group-hover:border-purple-500 group-hover:p-2 group-hover:rounded group-hover:z-50 group-hover:w-max group-hover:text-white transition-all shadow-xl">
                      {clip.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}