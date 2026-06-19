import { useState } from "react";
import SmartDropzone from "./components/SmartDropzone";
import StudioWaveform from "./components/StudioWaveform";
import { useAI } from "../../hooks/useAI";

export default function AudioWorkspace({ onBack }) {
  const [audioFile, setAudioFile] = useState(null); 
  const [activeTrack, setActiveTrack] = useState(null);
  const [currentTime, setCurrentTime] = useState(0); 
  const [isPlaying, setIsPlaying] = useState(false); 
  const [duration, setDuration] = useState(0);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processLog, setProcessLog] = useState("");
  const [isSplit, setIsSplit] = useState(false); 
  const [isEnhanced, setIsEnhanced] = useState(false); // حالة جديدة لمعرفة هل تم التعديل
  
  const { isReady, transcriber } = useAI();
  const [transcriptionData, setTranscriptionData] = useState([]);

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
      setIsEnhanced(true); // نعتبر أن الملف تم تعديله لنُظهر زر "التصدير"
    }, 4000); 
  };

  const handleTranscribe = async () => {
    if (!audioFile) return alert("⚠️ Load an audio file first!");
    if (!isReady || !transcriber) return alert("⚠️ AI Engine is still loading in background. Please wait.");
    
    setIsProcessing(true);
    setProcessLog("🧠 [AI] Analyzing audio & Auto-detecting language...");

    try {
      const audioUrl = URL.createObjectURL(audioFile);
      const result = await transcriber(audioUrl, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
      });

      if (result && result.chunks) {
        const realData = result.chunks.map((chunk, index) => ({
          id: index,
          start: chunk.timestamp[0], 
          end: chunk.timestamp[1] || chunk.timestamp[0] + 2, 
          text: chunk.text 
        }));
        setTranscriptionData(realData);
      }
      URL.revokeObjectURL(audioUrl);
    } catch (error) {
      console.error("Transcription error:", error);
      alert("❌ Transcription failed! Check the console for details.");
    } finally {
      setIsProcessing(false);
      setProcessLog("");
    }
  };

  // +++ دالة التنزيل السحرية الموحدة +++
  const downloadAudio = (prefix = "") => {
    if (!audioFile) return;
    
    // إنشاء رابط وهمي في المتصفح للملف
    const url = URL.createObjectURL(audioFile);
    const a = document.createElement("a");
    a.href = url;
    
    // تحديد اسم الملف عند التنزيل (مثال: Mastered_recording.wav)
    a.download = prefix ? `${prefix}_${audioFile.name}` : audioFile.name;
    
    document.body.appendChild(a);
    a.click(); // محاكاة ضغطة المستخدم
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url); // تنظيف الذاكرة
  };
        
  return (
    <div className="h-screen w-full bg-[#030303] text-gray-200 flex flex-col overflow-hidden font-sans select-none">
      
      {/* 1. Header (Updated with Export Buttons) */}
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
          {/* +++ أزرار التنزيل الجديدة +++ */}
          {audioFile && (
            <div className="flex items-center gap-2 mr-4 border-r border-gray-800 pr-4">
              <button 
                onClick={() => downloadAudio()}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 text-xs font-medium rounded transition-colors"
                title="Download original raw file"
              >
                📥 Original
              </button>
              
              {/* يظهر هذا الزر فقط إذا طبقنا أي فلتر */}
              {(isSplit || isEnhanced) && (
                <button 
                  onClick={() => downloadAudio("AI_Mastered")}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 font-bold text-xs rounded transition-colors shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                  title="Download AI processed file"
                >
                  ✨ Export Processed
                </button>
              )}
            </div>
          )}

          <div className="font-mono text-xs text-gray-500 tracking-widest bg-black/40 px-3 py-1.5 rounded-md border border-gray-900 flex items-center gap-4">
            <span className={`flex items-center gap-1 ${isReady ? 'text-emerald-500' : 'text-yellow-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isReady ? 'bg-emerald-500' : 'bg-yellow-500 animate-pulse'}`}></span>
              {isReady ? 'AI Engine Ready' : 'Downloading AI...'}
            </span>
            <span className="text-gray-700">|</span>
            <span>TOTAL TIME: <span className="text-emerald-400 font-bold">{formatTime(duration)}</span></span>
          </div>
        </div>
      </header>

      {/* 2. Main Workspace */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        
        {/* Sidebar Tools */}
        <aside className="w-72 shrink-0 bg-[#060606] border-r border-gray-950 p-4 flex flex-col gap-3 overflow-y-auto min-w-0 relative">
          <div className="text-[10px] font-mono uppercase tracking-wider text-gray-600 mb-1">Neural Audio Filters</div>
          
          <button onClick={() => applyAIFilter("Vocal & BGM Splitter")} disabled={isProcessing} className={`w-full bg-[#0a0a0a] border ${isProcessing ? 'border-gray-900 opacity-50 cursor-not-allowed' : 'border-gray-900 hover:border-emerald-500/40'} p-3 rounded-xl text-left transition-all group`}>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xl group-hover:scale-110 transition-transform">🎛️</span>
              <span className="text-sm font-semibold text-gray-200">Vocal & BGM Splitter</span>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">Extract crystal clear acapella and background music.</p>
          </button>

          <button onClick={handleTranscribe} disabled={isProcessing || !isReady} className={`w-full bg-[#0a0a0a] border ${(isProcessing || !isReady) ? 'border-gray-900 opacity-50 cursor-not-allowed' : 'border-gray-900 hover:border-purple-500/40'} p-3 rounded-xl text-left transition-all group`}>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xl group-hover:scale-110 transition-transform">📝</span>
              <span className="text-sm font-semibold text-gray-200">Auto-Transcribe (SRT)</span>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">Generate perfect subtitles from vocal audio using Whisper AI.</p>
          </button>

          <button onClick={() => applyAIFilter("AI Studio Enhance")} disabled={isProcessing} className={`w-full bg-[#0a0a0a] border ${isProcessing ? 'border-gray-900 opacity-50 cursor-not-allowed' : 'border-gray-900 hover:border-emerald-500/40'} p-3 rounded-xl text-left transition-all group`}>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xl group-hover:scale-110 transition-transform">✨</span>
              <span className="text-sm font-semibold text-gray-200">AI Studio Enhance</span>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">Automatically balance frequencies (EQ) and compress.</p>
          </button>

          {isProcessing && (
            <div className="absolute bottom-4 left-4 right-4 bg-emerald-950/80 border border-emerald-500/30 p-3 rounded-xl backdrop-blur-sm animate-pulse shadow-lg z-10">
              <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span>
                PROCESSING AUDIO...
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
          
          {/* المؤشر المتحرك */}
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
                <div className="flex gap-1">
                  <button className="w-5 h-5 rounded bg-[#111] hover:bg-red-900/50 border border-gray-800 text-gray-500 hover:text-red-400 flex items-center justify-center text-[9px] transition-colors">M</button>
                  <button className="w-5 h-5 rounded bg-[#111] hover:bg-yellow-900/50 border border-gray-800 text-gray-500 hover:text-yellow-400 flex items-center justify-center text-[9px] transition-colors">S</button>
                </div>
              </div>
              <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500/50 w-full"></div>
              </div>
            </div>
            
            <div className="flex-1 h-full relative flex items-center py-2">
              {audioFile && (
                <div className="h-12 w-full bg-gradient-to-r from-emerald-900/80 to-emerald-800/40 border border-emerald-500/40 rounded-r-md flex flex-col justify-center px-3 text-xs font-mono text-emerald-300 relative overflow-hidden shadow-lg cursor-pointer hover:border-emerald-400 transition-colors">
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
                <div className="flex gap-1">
                  <button className="w-5 h-5 rounded bg-[#111] hover:bg-red-900/50 border border-gray-800 text-gray-500 hover:text-red-400 flex items-center justify-center text-[9px] transition-colors">M</button>
                  <button className="w-5 h-5 rounded bg-[#111] hover:bg-yellow-900/50 border border-gray-800 text-gray-500 hover:text-yellow-400 flex items-center justify-center text-[9px] transition-colors">S</button>
                </div>
              </div>
              <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500/50 w-full"></div>
              </div>
            </div>
            
            <div className="flex-1 h-full relative flex items-center py-2">
              {isSplit && (
                <div className="h-12 w-full bg-gradient-to-r from-cyan-900/80 to-cyan-800/40 border border-cyan-500/40 rounded-r-md flex flex-col justify-center px-3 text-xs font-mono text-cyan-300 relative overflow-hidden shadow-lg cursor-pointer hover:border-cyan-400 transition-colors animate-fade-in">
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
                <div className="flex gap-1">
                  <button className="w-5 h-5 rounded bg-[#111] hover:bg-blue-900/50 border border-gray-800 text-gray-500 hover:text-blue-400 flex items-center justify-center text-[9px] transition-colors">✎</button>
                </div>
              </div>
            </div>
            
            <div className="flex-1 h-full relative flex items-center py-1 overflow-hidden">
              {transcriptionData.length > 0 && transcriptionData.map((clip) => {
                const leftPos = (clip.start / Math.max(duration, 10)) * 100;
                const widthPos = ((clip.end - clip.start) / Math.max(duration, 10)) * 100;
                
                const isActive = currentTime >= clip.start && currentTime <= clip.end;

                return (
                  <div 
                    key={clip.id}
                    className={`absolute h-8 rounded border flex flex-col justify-center px-2 text-[10px] font-mono transition-colors shadow-sm cursor-text ${isActive ? 'bg-purple-500/30 border-purple-400 text-white z-10 scale-105' : 'bg-gray-800/50 border-gray-700 text-gray-400'}`}
                    style={{ left: `${leftPos}%`, width: `${widthPos}%` }}
                  >
                    <span className="truncate">{clip.text}</span>
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