// 1. نستقبل الدالة من الأب
export default function Sidebar({ onToolSelect, isProcessing }) {
  const aiTools = [
    { id: "transcribe", name: "AI Transcribe", icon: "📝", desc: "Speech-to-text engine" }, // الأداة الجديدة
    { id: "studio", name: "Studio Sound", icon: "✨", desc: "Enhance voice & EQ" },
    { id: "silence", name: "Trim Silence", icon: "✂️", desc: "Remove dead air" },
    { id: "noise", name: "Noise Reduction", icon: "🔇", desc: "Isolate background hum" },
  ];

  return (
    <aside className="w-64 bg-[#111111] border-r border-gray-800 p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-3 mb-8">
          <span className="text-2xl">🎙️</span>
          <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent tracking-wider">
            AI AUDIO
          </h1>
        </div>

        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest px-2">
            AI Power Tools
          </p>
          
<div className="space-y-2">
            {aiTools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => onToolSelect(tool.name)}
                // 2. نقوم بتعطيل الزر برمجياً إذا كان التطبيق مشغولاً
                disabled={isProcessing}
                // 3. نغير التصميم ديناميكياً: إذا مشغول نجعله باهتاً، وإلا نتركه مضيئاً
                className={`w-full text-left p-3 rounded-xl border transition-all duration-200 flex items-start gap-3 ${
                  isProcessing 
                    ? "bg-[#111] border-gray-800/30 opacity-50 cursor-not-allowed" 
                    : "bg-[#161616] border-gray-800/60 hover:border-emerald-500/50 hover:bg-[#1a1a1a] group"
                }`}
              >
                <span className={`text-xl p-1 bg-gray-900 rounded-lg border border-gray-800 transition-colors ${!isProcessing && "group-hover:border-emerald-500/30"}`}>
                  {tool.icon}
                </span>
                <div>
                  <h4 className={`text-sm font-medium transition-colors ${isProcessing ? "text-gray-500" : "text-gray-300 group-hover:text-emerald-400"}`}>
                    {tool.name}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {tool.desc}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-800 pt-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400">
          MC
        </div>
        <div>
          <h5 className="text-xs font-medium text-gray-400">M. Cherif</h5>
          <p className="text-[10px] text-gray-600">Developer Mode</p>
        </div>
      </div>
    </aside>
  );
}