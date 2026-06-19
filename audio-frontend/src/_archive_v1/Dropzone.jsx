import { useState, useRef, useEffect } from "react";

export default function Dropzone({ onFileDrop }) {
  // --- 1. حالات التطبيق (State) ---
  const [isDragging, setIsDragging] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // --- 2. مراجع الذاكرة (Refs) ---
  const mediaRecorderRef = useRef(null); // للاحتفاظ بمحرك التسجيل
  const chunksRef = useRef([]);          // لتجميع أجزاء الصوت المسجل
  const timerRef = useRef(null);         // للاحتفاظ بعداد الوقت

  // --- 3. وظائف السحب والإفلات ---
  const handleDragOver = (e) => {
    e.preventDefault();
    if (!isRecording) setIsDragging(true); // نمنع السحب إذا كنا نسجل
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (isRecording) return; // نمنع الإفلات إذا كنا نسجل

    const file = e.dataTransfer.files[0];
    if (file) {
      console.log("File received successfully:", file.name);
      onFileDrop(file); 
    }
  };

  // --- 4. وظائف التسجيل المباشر (الميكروفون) ---
  const startRecording = async () => {
    try {
      // طلب إذن الميكروفون من المتصفح
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // تهيئة محرك التسجيل
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = []; // تصفير الأجزاء السابقة إن وجدت

      // عندما يلتقط الميكروفون صوتاً، نضعه في المصفوفة
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      // عندما نوقف التسجيل، نجمع الأجزاء ونحولها لملف
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/wav" });
        // نصنع ملفاً وهمياً (File) لكي يقبله التطبيق كأنه ملف مرفوع!
        const file = new File([blob], `Live_Recording_${Date.now()}.wav`, { type: "audio/wav" });
        onFileDrop(file); // نرسل الملف للأب (App.jsx)
        
        // إغلاق الميكروفون بالكامل حتى لا تظل اللمبة الحمراء مضاءة في المتصفح
        stream.getTracks().forEach(track => track.stop());
      };

      // بدء التشغيل
      mediaRecorder.start();
      setIsRecording(true);
      
      // تشغيل العداد الزمني (يزيد ثانية كل 1000 ملي ثانية)
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Please allow microphone access to use this feature. 🎙️");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
      setRecordingTime(0); // تصفير العداد
    }
  };

  // دالة مساعدة لتنسيق الثواني (مثال: 01:05)
  const formatTime = (seconds) => {
    const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // تنظيف الذاكرة إذا تم إغلاق المكون فجأة
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // --- 5. الواجهة البصرية (Render) ---
  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full h-full flex flex-col items-center justify-center border-2 rounded-xl transition-all duration-300 ${
        isRecording 
          ? "border-red-500 bg-red-500/10 shadow-[0_0_50px_rgba(239,68,68,0.2)]" 
          : isDragging
          ? "border-emerald-500 bg-emerald-500/10 scale-[1.02] border-dashed cursor-pointer"
          : "border-gray-700 border-dashed bg-[#0f0f0f] hover:border-gray-500 hover:bg-[#151515] cursor-pointer"
      }`}
    >
      {/* عرض واجهة التسجيل إذا كنا نسجل، وإلا نعرض واجهة الرفع العادية */}
      {isRecording ? (
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75"></div>
            <div className="relative bg-red-500 rounded-full w-20 h-20 flex items-center justify-center text-4xl shadow-[0_0_20px_rgba(239,68,68,0.6)]">
              🎙️
            </div>
          </div>
          <div className="text-4xl font-mono text-red-400 font-bold tracking-widest">
            {formatTime(recordingTime)}
          </div>
          <button 
            onClick={stopRecording}
            className="mt-4 px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
          >
            <span className="w-4 h-4 bg-white rounded-sm"></span> Stop & Process
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className={`text-5xl mb-2 transition-transform duration-300 ${isDragging ? "animate-bounce" : ""}`}>
            📥
          </div>
          <h3 className={`text-xl font-bold ${isDragging ? "text-emerald-400" : "text-gray-300"}`}>
            {isDragging ? "Drop the audio file here!" : "Drag & Drop your file here"}
          </h3>
          
          <div className="flex items-center gap-4 mt-6 w-full px-12">
            <div className="h-[1px] flex-1 bg-gray-800"></div>
            <span className="text-gray-600 text-xs font-bold uppercase tracking-widest">OR</span>
            <div className="h-[1px] flex-1 bg-gray-800"></div>
          </div>

          <button 
            onClick={(e) => {
              e.stopPropagation(); // لمنع تفعيل أحداث السحب بالخطأ
              startRecording();
            }}
            className="mt-4 px-6 py-3 bg-[#1a1a1a] border border-gray-700 hover:border-red-500 hover:text-red-400 text-gray-300 font-bold rounded-lg transition-all flex items-center gap-3 group"
          >
            <div className="w-3 h-3 bg-red-500 rounded-full group-hover:animate-pulse"></div>
            Record Live Audio
          </button>
        </div>
      )}
    </div>
  );
}