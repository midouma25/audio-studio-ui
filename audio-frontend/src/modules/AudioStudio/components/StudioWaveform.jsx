import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

export default function StudioWaveform({ file, onClear, onTimeUpdate, onPlayStateChange, onDurationChange, seekToTime }) {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // 1. محرك بناء الموجة (يجب أن يكون داخل useEffect ليتم بعد بناء الشاشة)
  useEffect(() => {
    if (!file || !containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#047857',
      progressColor: '#34d399',
      cursorColor: '#ffffff',
      barWidth: 2,
      barRadius: 2,
      cursorWidth: 2,
      height: 120,
      normalize: true,
      backend: 'WebAudio',
    });

    const objectUrl = URL.createObjectURL(file);
    ws.load(objectUrl);

    ws.on('ready', () => {
      wavesurferRef.current = ws;
      if (onDurationChange) onDurationChange(ws.getDuration());
    });

    ws.on('timeupdate', (currentTime) => {
      if (onTimeUpdate) onTimeUpdate(currentTime);
    });

    ws.on('play', () => {
      setIsPlaying(true);
      if (onPlayStateChange) onPlayStateChange(true);
    });

    ws.on('pause', () => {
      setIsPlaying(false);
      if (onPlayStateChange) onPlayStateChange(false);
    });

    ws.on('finish', () => {
      setIsPlaying(false);
      if (onPlayStateChange) onPlayStateChange(false);
    });

    return () => {
      ws.destroy();
      URL.revokeObjectURL(objectUrl);
    };
  }, [file, onDurationChange, onPlayStateChange, onTimeUpdate]);

  // 2. محرك القفز الزمني (يتفاعل فقط عندما تضغط على النص الجانبي)
  useEffect(() => {
    if (wavesurferRef.current && seekToTime !== null && seekToTime !== undefined) {
      wavesurferRef.current.setTime(seekToTime);
    }
  }, [seekToTime]);

  const togglePlay = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  return (
    <div className="w-full max-w-4xl bg-[#0a0a0a]/80 backdrop-blur-xl border border-gray-800 rounded-2xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-emerald-400 font-bold text-lg">{file.name}</h3>
          <p className="text-gray-500 text-xs font-mono">Neural Processing Ready • {Math.round(file.size / 1024)} KB</p>
        </div>
        <button 
          onClick={onClear} 
          className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-lg transition-colors border border-red-500/20"
        >
          ✕ Remove Track
        </button>
      </div>

      <div 
        ref={containerRef} 
        className="w-full bg-[#030303] rounded-xl border border-gray-900 overflow-hidden mb-6 cursor-crosshair"
      ></div>

      <div className="flex justify-center">
        <button
          onClick={togglePlay}
          className="w-14 h-14 flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-black rounded-full shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all transform hover:scale-105 active:scale-95"
        >
          {isPlaying ? (
            <span className="text-2xl font-black tracking-tighter">||</span>
          ) : (
            <span className="text-2xl ml-1">▶</span>
          )}
        </button>
      </div>
    </div>
  );
}