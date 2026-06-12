import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Dropzone from "./components/Dropzone";
import Terminal from "./components/Terminal";
import Transcript from "./components/Transcript";
import WaveformPlayer from "./components/WaveformPlayer";
import { processAudioWithAI } from "./services/assembly";

export default function App() {
  const [logs, setLogs] = useState([
    "> [System] AI Audio Studio Initialized...",
    "> [System] Awaiting audio file input..."
  ]);

  const [activeFile, setActiveFile] = useState(null);
  const [processedFile, setProcessedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessedFile, setIsProcessedFile] = useState(false);
  
  const [currentTime, setCurrentTime] = useState(0);    
  const [seekRequest, setSeekRequest] = useState(null);    
  const [transcriptData, setTranscriptData] = useState([]); 

  const [applyStudioSound, setApplyStudioSound] = useState(false);
  const [applyNoiseReduction, setApplyNoiseReduction] = useState(false);
  const [applyTrimSilence, setApplyTrimSilence] = useState(false);

  const handleFileReceived = (file) => {
    setActiveFile(file);
    setProcessedFile(null);
    setCurrentTime(0);
    setIsProcessedFile(false);
    setTranscriptData([]);       
    setApplyStudioSound(false);  
    setApplyNoiseReduction(false);
    setApplyTrimSilence(false);
    setLogs((prev) => [
      ...prev, 
      `> [Action] File uploaded: ${file.name}`,
      "> [System] Audio engine ready. Awaiting tool selection..."
    ]);
  };

  const handleClearFile = () => {
    setActiveFile(null);
    setProcessedFile(null);
    setCurrentTime(0);
    setTranscriptData([]);
    setApplyStudioSound(false);
    setLogs((prev) => [
      ...prev, 
      "> [System] Audio file cleared from memory.",
      "> [System] Awaiting new audio file..."
    ]);
  };

  const handleProcessAudio = async () => {
    if (!activeFile) return;
    
    setIsProcessing(true);
    setLogs((prev) => [
      ...prev, 
      "> [System] Uploading to Python Backend...",
      "> [AI] Engine is processing the audio. Please wait... ⏳"
    ]);

    const formData = new FormData();
    formData.append("file", activeFile);
    formData.append("applyTrim", applyTrimSilence ? "true" : "false");
    formData.append("applyNoise", applyNoiseReduction ? "true" : "false");
    formData.append("applyStudio", applyStudioSound ? "true" : "false");

    try {
      const response = await fetch("http://127.0.0.1:8000/api/process", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Backend processing failed!");

      // +++ التصحيح: هنا نستقبل الـ blob أولاً ثم نصنع الملف +++
      const blob = await response.blob();
      const newProcessedFile = new File([blob], `AI_Mastered_${activeFile.name}.wav`, { type: "audio/wav" });
      
      setProcessedFile(newProcessedFile);
      setIsProcessedFile(true);
      
      setApplyStudioSound(false);
      setApplyNoiseReduction(false);
      setApplyTrimSilence(false);

      setLogs((prev) => [
        ...prev, 
        "> [Success] Audio processed successfully! ✨",
        `> [System] Loaded: ${newProcessedFile.name}`
      ]);
      
    } catch (error) {
      setLogs((prev) => [...prev, `> [Error] Backend connection failed: ${error.message}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToolSelect = async (toolName) => {
    if (!activeFile) {
      setLogs((prev) => [...prev, `> [Error] Please upload an audio file first.`]);
      return; 
    }
    
    if (toolName === "AI Transcribe") {
      if (isProcessing) return;
      setIsProcessing(true);
      const words = await processAudioWithAI(activeFile, (msg) => setLogs(prev => [...prev, msg]));
      if (words) {
        let segments = [];
        let currentSegment = { id: 0, startTime: 0, text: "" };
        words.forEach((word, index) => {
          if (index % 10 === 0 && index !== 0) {
            segments.push(currentSegment);
            currentSegment = { id: segments.length, startTime: word.start / 1000, text: word.text };
          } else {
            currentSegment.text += " " + word.text;
            if (index === 0) currentSegment.startTime = word.start / 1000;
          }
        });
        segments.push(currentSegment);
        const finalData = segments.map(seg => {
          const totalSeconds = Math.floor(seg.startTime);
          const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
          const secs = String(totalSeconds % 60).padStart(2, '0');
          return { ...seg, timeString: `${mins}:${secs}` };
        });
        setTranscriptData(finalData);
      }
      setIsProcessing(false);
    } 
    else if (toolName === "Studio Sound") {
      setApplyStudioSound(prev => {
        const newState = !prev;
        setLogs(logs => [...logs, `> [System] Studio Sound ${newState ? "ACTIVATED ✨" : "DEACTIVATED ❌"}`]);
        return newState;
      });
    }
    else if (toolName === "Noise Reduction") {
      setApplyNoiseReduction(prev => {
        const newState = !prev;
        setLogs(logs => [...logs, `> [System] Noise Reduction ${newState ? "ACTIVATED 🔇" : "DEACTIVATED ❌"}`]);
        return newState;
      });
    }
    else if (toolName === "Trim Silence") {
      setApplyTrimSilence(prev => {
        const newState = !prev;
        setLogs(logs => [...logs, `> [System] Trim Silence (Gate) ${newState ? "ACTIVATED ✂️" : "DEACTIVATED ❌"}`]);
        return newState;
      });
    }
    else {
      setLogs((prev) => [...prev, `> [AI] Applying ${toolName}...`]);
      setTimeout(() => {
        setIsProcessing(false);
        setLogs((prev) => [...prev, `> [Success] ${toolName} applied successfully! ✨`]);
      }, 3000);
    }
  };

  return (
    <div className="w-screen h-screen bg-[#020202] text-gray-200 flex overflow-hidden font-sans selection:bg-emerald-500/30">
      
      <Sidebar onToolSelect={handleToolSelect} isProcessing={isProcessing} />

      <main className="flex-1 h-full flex flex-col p-4 gap-4 overflow-hidden relative bg-[#050505] border-x border-gray-800/40 min-w-0">
        
        <section className="w-full shrink-0 flex flex-col">
           {activeFile ? (
             <WaveformPlayer 
               file={activeFile} 
               processedFile={processedFile}
               onClear={handleClearFile} 
               onTimeUpdate={setCurrentTime} 
               seekRequest={seekRequest}
               applyStudioSound={applyStudioSound}
               applyNoiseReduction={applyNoiseReduction}
               applyTrimSilence={applyTrimSilence}    
               onProcess={handleProcessAudio}
               isProcessing={isProcessing}
               isProcessed={isProcessedFile}
             />
           ) : (
             <Dropzone onFileDrop={handleFileReceived} />
           )}
        </section>

        <section className="w-full flex-1 bg-[#0a0a0a] border border-gray-800/50 rounded-xl overflow-hidden p-5 shadow-inner relative min-h-0">
          <Transcript 
            currentTime={currentTime} 
            onSeek={setSeekRequest} 
            transcriptData={transcriptData} 
          />
        </section>
      </main>

      <aside className="w-[300px] shrink-0 h-full bg-[#050505] p-4 flex flex-col gap-3 z-20 overflow-hidden shadow-2xl">
        <div className="text-[10px] text-gray-400 font-mono uppercase tracking-widest border-b border-gray-800/80 pb-2 flex justify-between items-center">
          <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Action Logs</span>
          <span className="text-gray-600">v1.0.0</span>
        </div>
        <div className="flex-1 overflow-hidden rounded-lg bg-[#000000] border border-gray-800/40 shadow-inner">
          <Terminal logs={logs} />
        </div>
      </aside>

    </div>
  );
}