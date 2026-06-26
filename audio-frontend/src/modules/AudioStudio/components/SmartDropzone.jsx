// src/modules/AudioStudio/components/SmartDropzone.jsx
import { useState, useRef } from "react";

export default function SmartDropzone({ onFileDrop }) {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // --- حالات نظام التسجيل الحي (Live Mic States) ---
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // 1. التعامل مع السحب والإفلات (Drag & Drop)
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("audio/")) {
        onFileDrop(file);
      } else {
        alert("⚠️ Please drop a valid audio file (MP3, WAV, M4A)...");
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onFileDrop(e.target.files[0]);
    }
  };

  // 2. محرك التسجيل الحي من الميكروفون (Microphone Engine)
  const startRecording = async () => {
    try {
      // طلب الإذن من المستخدم لفتح الميكروفون
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      // إعداد مسجل الصوت
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // عند إيقاف التسجيل، تحويل الصوت إلى ملف مادي
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        
        // توليد اسم فريد للتسجيل يحتوي على الوقت الحالي
        const timestamp = new Date().getTime().toString().slice(-5);
        const file = new File([audioBlob], `Live_Recording_${timestamp}.wav`, {
          type: "audio/wav",
          lastModified: Date.now()
        });

        // إغلاق الميكروفون تماماً بعد الانتهاء لحماية الخصوصية
        stream.getTracks().forEach(track => track.stop());

        // ضخ الملف في الاستوديو!
        onFileDrop(file);
      };

      // بدء التسجيل وتفعيل عداد الثواني
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.error(err);
      alert("❌ Could not access your microphone. Please check permissions!");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  // دالة مساعدة لتنسيق وقت التسجيل (00:00)
  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div 
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      className={`w-full max-w-3xl h-96 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center p-8 transition-all duration-500 relative overflow-hidden bg-[#050505]/40 backdrop-blur-md ${
        isDragActive 
          ? "border-emerald-500 bg-emerald-500/5 scale-[1.01] shadow-[0_0_40px_rgba(16,185,129,0.1)]" 
          : "border-gray-900 hover:border-gray-800"
      }`}
    >
      <input 
        ref={fileInputRef}
        type="file" 
        accept="audio/*" 
        onChange={handleFileChange}
        className="hidden"
      />

      {/* شاشة التسجيل النشط يغير شكل الواجهة */}
      {isRecording ? (
        <div className="flex flex-col items-center justify-center animate-pulse">
          <div className="w-20 h-20 bg-red-500/10 border-2 border-red-500 text-red-500 rounded-full flex items-center justify-center text-2xl mb-6 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
            🛑
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Recording Live Audio...</h3>
          <p className="text-red-400 font-mono text-2xl font-black tracking-widest mb-8 bg-red-950/20 px-4 py-1.5 rounded-xl border border-red-900/30">
            {formatTimer(recordingTime)}
          </p>
          <button 
            onClick={stopRecording}
            className="px-8 py-3.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.2)] active:scale-95"
          >
            Finish & Load to Studio
          </button>
        </div>
      ) : (
        // شاشة الرفع والسحب الافتراضية
        <>
          <div 
            onClick={() => fileInputRef.current.click()}
            className="w-16 h-16 bg-gray-900/60 border border-gray-800 rounded-2xl flex items-center justify-center text-2xl mb-6 cursor-pointer hover:scale-105 hover:border-gray-700 transition-all shadow-md group"
          >
            <span className="group-hover:animate-bounce">☁️</span>
          </div>

          <h3 className="text-xl font-bold text-gray-200 mb-2 tracking-wide">Drag & Drop Audio File</h3>
          <p className="text-gray-500 text-sm max-w-sm text-center leading-relaxed mb-6">
            Upload any MP3, WAV, or M4A file to start the deep-learning extraction process.
          </p>

          <div className="flex items-center gap-4 w-full max-w-xs justify-center mb-6">
            <div className="h-px bg-gray-900 flex-1"></div>
            <span className="text-gray-600 font-mono text-[10px] tracking-widest uppercase">OR</span>
            <div className="h-px bg-gray-900 flex-1"></div>
          </div>

          {/* تفعيل زر الميكروفون الحي كودياً وتصميمياً */}
          <button 
            onClick={startRecording}
            className="flex items-center gap-3 px-6 py-3.5 bg-gray-950 border border-gray-800 hover:border-red-500/40 text-gray-300 hover:text-white rounded-2xl transition-all font-semibold text-sm shadow-md active:scale-95 group hover:shadow-[0_0_30px_rgba(239,68,68,0.05)]"
          >
            <span className="text-red-500 animate-pulse group-hover:scale-110 transition-transform">🔴</span> 
            Initialize Live Mic
          </button>
        </>
      )}
    </div>
  );
}