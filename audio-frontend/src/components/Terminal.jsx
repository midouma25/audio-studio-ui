// نستقبل logs من الأب
export default function Terminal({ logs }) {
  return (
    <div className="h-full w-full bg-black border-2 border-dashed border-emerald-900/50 rounded-lg p-4 font-mono text-xs text-emerald-500 overflow-y-auto shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
      
      <div className="border-b border-emerald-900/30 pb-2 mb-2 flex justify-between">
        <span className="text-emerald-700">Action Logs</span>
        <span className="text-emerald-700">v1.0.0</span>
      </div>

      <ul className="space-y-1">
        {/* نقوم بطباعة السجلات الحقيقية القادمة من الأب */}
        {logs.map((log, index) => (
          <li key={index} className="opacity-90 hover:opacity-100 transition-opacity">
            {log}
          </li>
        ))}
        <li className="animate-pulse">_</li>
      </ul>

    </div>
  );
}