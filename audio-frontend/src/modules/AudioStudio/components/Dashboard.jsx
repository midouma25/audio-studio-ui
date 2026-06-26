import { useState, useEffect } from "react";

export default function Dashboard({ onNewProject, onOpenProject, onBack }) {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/transcripts");
        if (!response.ok) throw new Error("Failed to connect to the server");
        const data = await response.json();
        setHistory(data.history);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  return (
    <div className="min-h-screen w-full bg-[#030303] text-gray-200 p-8 font-sans">
      
      <div className="max-w-6xl mx-auto flex items-center justify-between mb-12 border-b border-gray-900/60 pb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="text-gray-400 hover:text-white transition-all text-sm font-medium flex items-center gap-1 bg-gray-900/40 hover:bg-gray-800/60 px-3 py-1.5 rounded-lg border border-gray-800/50"
          >
            ← Main Menu
          </button>
          <div className="w-px h-6 bg-gray-800"></div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center">
              <span className="text-emerald-400 text-xl">🎛️</span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-wide uppercase">Audio Projects</h1>
              <p className="text-xs text-gray-500 font-mono tracking-widest mt-1">YOUR WORKSPACE HISTORY</p>
            </div>
          </div>
        </div>

        <button 
          onClick={onNewProject}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:scale-105 active:scale-95"
        >
          <span>+</span> New Project
        </button>
      </div>

      <div className="max-w-6xl mx-auto">
        <h2 className="text-sm font-bold text-gray-400 mb-6 flex items-center gap-2">
          <span className="text-purple-500">📁</span> RECENT PROJECTS
        </h2>

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-[#0a0a0a] border border-gray-900 rounded-xl animate-pulse"></div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-xl text-center">
            <p className="text-red-400 font-mono text-sm">❌ Server Offline or Error: {error}</p>
            <p className="text-gray-500 text-xs mt-2">Make sure your Node.js backend is running on port 5000.</p>
          </div>
        )}

        {!isLoading && !error && history.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-gray-800 rounded-2xl bg-[#080808]">
            <span className="text-4xl mb-4 opacity-50">🗂️</span>
            <p className="text-gray-400 font-medium">No projects found.</p>
            <p className="text-gray-600 text-xs mt-2">Click "New Project" to start your first audio processing.</p>
          </div>
        )}

        {!isLoading && !error && history.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {history.map((project) => (
              <div 
                key={project._id} 
                onClick={() => onOpenProject(project._id)}
                className="bg-[#0a0a0a] border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-emerald-500/50 hover:bg-[#0d0d0d] transition-all group hover:shadow-[0_0_20px_rgba(16,185,129,0.05)] flex flex-col relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-emerald-500/10 transition-colors"></div>
                
                <div className="flex items-start justify-between mb-4 z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-900 rounded flex items-center justify-center text-xs">
                      🎵
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-200 text-sm truncate w-40" title={project.fileName}>
                        {project.fileName}
                      </h3>
                      <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                        {formatDate(project.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-auto z-10">
                  <span className="px-2 py-1 bg-gray-900 border border-gray-800 text-gray-400 text-[10px] rounded font-mono uppercase">
                    Lang: {project.audioLanguage}
                  </span>
                  {project.translateTo !== 'none' && (
                    <span className="px-2 py-1 bg-purple-900/30 border border-purple-500/30 text-purple-400 text-[10px] rounded font-mono uppercase">
                      TR: {project.translateTo}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}