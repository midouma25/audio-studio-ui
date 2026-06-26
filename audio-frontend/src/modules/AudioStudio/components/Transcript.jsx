import { useRef, useEffect } from "react";

export default function Transcript({ currentTime, onSeek, transcriptData }) {
  const containerRef = useRef(null);
  const activeChunkRef = useRef(null);

  // عمل Scroll تلقائي لتتبع الكلام المسموع
  useEffect(() => {
    if (activeChunkRef.current && containerRef.current) {
      activeChunkRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentTime]);

  if (!transcriptData || transcriptData.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 font-mono text-xs opacity-50">
        <span className="text-3xl mb-2">📝</span>
        <p>No Transcript Available</p>
      </div>
    );
  }

  // +++ دالة لتوليد لون مميز لكل متحدث +++
  const getSpeakerColor = (speaker) => {
    if (speaker === "A") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (speaker === "B") return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
    if (speaker === "C") return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4 shrink-0">
        <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
          <span className="text-purple-500">📝</span> AI Transcript
        </h3>
        <div className="text-[9px] font-mono bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded border border-emerald-500/20">
          Speaker Detection: ON
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar relative">
        {transcriptData.map((chunk) => {
          const isActive = currentTime >= chunk.startTime && currentTime <= chunk.endTime;

          return (
            <div
              key={chunk.id}
              ref={isActive ? activeChunkRef : null}
              onClick={() => onSeek(chunk.startTime)}
              className={`p-3 rounded-xl cursor-pointer transition-all duration-300 border ${
                isActive
                  ? "bg-gray-800/80 border-gray-600 shadow-md transform scale-[1.02]"
                  : "bg-gray-900/40 border-transparent hover:bg-gray-800/60 hover:border-gray-700"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${getSpeakerColor(chunk.speaker)}`}>
                  Speaker {chunk.speaker}
                </span>
                <span className={`text-xs font-mono ${isActive ? "text-emerald-400 font-bold" : "text-gray-500"}`}>
                  {chunk.timeString}
                </span>
              </div>
              
              <p className={`text-sm leading-relaxed font-medium mb-1 transition-colors ${isActive ? "text-white" : "text-gray-300"}`}>
                {chunk.text}
              </p>
              
              {chunk.translatedText && (
                <p className={`text-xs leading-relaxed italic ${isActive ? "text-emerald-300/90" : "text-gray-500"}`}>
                  {chunk.translatedText}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}