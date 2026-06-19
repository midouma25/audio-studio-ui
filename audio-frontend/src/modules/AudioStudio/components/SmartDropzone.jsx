import { useState, useRef, useEffect } from "react";

export default function SmartDropzone({ onFileDrop }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!isRecording) setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (isRecording) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      onFileDrop(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/wav" });
        const file = new File([blob], `Live_Recording_${Date.now()}.wav`, { type: "audio/wav" });
        onFileDrop(file);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Mic error:", err);
      alert("Please allow microphone access to record audio. 🎙️");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
      setRecordingTime(0);
    }
  };

  const formatTime = (seconds) => {
    const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full max-w-xl aspect-video mx-auto flex flex-col items-center justify-center rounded-2xl transition-all duration-500 border-2 ${
        isRecording 
          ? "border-red-500/50 bg-red-950/10 shadow-[0_0_60px_rgba(239,68,68,0.1)]" 
          : isDragging
          ? "border-emerald-500 bg-emerald-950/20 scale-[1.02] border-dashed"
          : "border-gray-800/50 bg-[#0a0a0a]/50 border-dashed hover:border-gray-700 hover:bg-[#0a0a0a]"
      }`}
    >
      {isRecording ? (
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20"></div>
            <div className="relative bg-gradient-to-b from-red-500 to-red-700 rounded-full w-20 h-20 flex items-center justify-center text-4xl shadow-[0_0_30px_rgba(239,68,68,0.4)] border border-red-400/50">
              🎙️
            </div>
          </div>
          <div className="text-5xl font-mono text-red-400 font-bold tracking-widest drop-shadow-[0_0_10px_rgba(248,113,113,0.5)]">
            {formatTime(recordingTime)}
          </div>
          <button 
            onClick={stopRecording}
            className="mt-4 px-8 py-3 bg-red-500/10 border border-red-500/50 hover:bg-red-500 hover:text-white text-red-400 font-bold rounded-xl transition-all flex items-center gap-3 group"
          >
            <span className="w-3 h-3 bg-current rounded-sm group-hover:scale-90 transition-transform"></span> 
            Stop Recording
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <div className={`text-5xl mb-2 transition-transform duration-500 ${isDragging ? "animate-bounce scale-110" : "text-gray-600 grayscale opacity-50"}`}>
            📥
          </div>
          <h3 className={`text-xl font-bold tracking-wide ${isDragging ? "text-emerald-400" : "text-gray-300"}`}>
            {isDragging ? "Release to drop audio!" : "Drag & Drop Audio File"}
          </h3>
          <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
            Upload any MP3, WAV, or M4A file to start the deep-learning extraction process.
          </p>
          
          <div className="flex items-center gap-4 mt-4 w-full px-12 opacity-50">
            <div className="h-[1px] flex-1 bg-gray-700"></div>
            <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">OR</span>
            <div className="h-[1px] flex-1 bg-gray-700"></div>
          </div>

          <button 
            onClick={startRecording}
            className="mt-4 px-6 py-3 bg-gray-900/80 border border-gray-800 hover:border-red-500/50 hover:text-red-400 text-gray-400 font-bold rounded-xl transition-all flex items-center gap-3 group"
          >
            <div className="w-2.5 h-2.5 bg-red-500/80 rounded-full group-hover:animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
            Initialize Live Mic
          </button>
        </div>
      )}
    </div>
  );
}