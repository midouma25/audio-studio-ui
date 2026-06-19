import { useEffect } from "react";

export default function Transcript({ currentTime, onSeek, transcriptData }) {
  
  // خوارزمية الجملة النشطة
  let activeId = 0;
  if (transcriptData && transcriptData.length > 0) {
    for (let i = 0; i < transcriptData.length; i++) {
      if (currentTime >= transcriptData[i].startTime) {
        activeId = transcriptData[i].id;
      }
    }
  }

  // محرك التمرير التلقائي
  useEffect(() => {
    if (transcriptData && transcriptData.length > 0) {
      const activeElement = document.getElementById(`segment-${activeId}`);
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [activeId, transcriptData]);

  // +++ السحر الهندسي: محرك صناعة وتحميل الملفات (Blob Generator) +++
  const handleDownload = () => {
    if (!transcriptData || transcriptData.length === 0) return;

    // 1. تجميع النص: نضع الوقت بين قوسين، ثم الجملة، وننزل سطرين بين كل جملة
    const textContent = transcriptData
      .map((seg) => `[${seg.timeString}] ${seg.text}`)
      .join("\n\n");

    // 2. إنشاء كائن Blob (ملف نصي حقيقي داخل ذاكرة المتصفح)
    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    
    // 3. إنشاء رابط مؤقت لهذا الملف
    const url = URL.createObjectURL(blob);
    
    // 4. إنشاء زر مخفي، إعطاؤه الرابط، إجباره على النقر، ثم تدميره!
    const link = document.createElement("a");
    link.href = url;
    link.download = "AI_Audio_Studio_Transcript.txt"; // اسم الملف الذي سيتم تحميله
    
    document.body.appendChild(link);
    link.click(); // ضغطة برمجية
    document.body.removeChild(link); // تنظيف
    URL.revokeObjectURL(url); // مسح الرابط من الذاكرة
  };

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
        <h3 className="font-semibold text-gray-300 flex items-center gap-2">
          <span className="text-emerald-500">📝</span> AI Transcript
        </h3>
        
        {/* منطقة الأزرار العلوية */}
        <div className="flex items-center gap-3">
          
          {/* +++ زر التحميل: يظهر فقط إذا كانت هناك بيانات مفرغة +++ */}
          {transcriptData && transcriptData.length > 0 && (
            <button 
              onClick={handleDownload}
              className="text-xs px-3 py-1.5 bg-[#161616] hover:bg-emerald-600 hover:text-white transition-all duration-200 border border-gray-700 hover:border-emerald-500 rounded font-medium flex items-center gap-2 group"
            >
              <span className="group-hover:animate-bounce">💾</span> Download TXT
            </button>
          )}

          <span className="text-xs px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-400 font-mono animate-pulse">
            Auto-Sync: ON
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 text-left">
        {!transcriptData || transcriptData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-gray-800 rounded-lg">
             <span className="text-4xl mb-2">⏳</span>
             <p>Awaiting AI Transcription...</p>
             <p className="text-xs mt-1">Click "AI Transcribe" in the sidebar.</p>
          </div>
        ) : (
          <div className="space-y-4 pb-32"> 
            {transcriptData.map((segment) => (
              <div 
                id={`segment-${segment.id}`}
                key={segment.id}
                onClick={() => onSeek(segment.startTime)}
                className="flex gap-4 group cursor-pointer"
              >
                <span className={`font-mono text-xs pt-1 transition-colors duration-200 min-w-[45px] ${
                  activeId === segment.id ? "text-emerald-500 font-bold" : "text-gray-600 group-hover:text-gray-400"
                }`}>
                  {segment.timeString}
                </span>
                <p className={`text-lg transition-colors duration-200 leading-relaxed ${
                  activeId === segment.id ? "text-gray-100 bg-emerald-500/10 rounded px-1 -ml-1" : "text-gray-500 group-hover:text-gray-300"
                }`}>
                  {segment.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}