import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";

const generateReverbImpulse = (ctx) => {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * 2.5; 
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);
  for (let i = 0; i < length; i++) {
    const decay = Math.pow(1 - i / length, 3);
    left[i] = (Math.random() * 2 - 1) * decay;
    right[i] = (Math.random() * 2 - 1) * decay;
  }
  return impulse;
};

export default function StudioWaveform({ 
  file, 
  onClear, 
  onTimeUpdate, 
  onPlayStateChange, 
  onDurationChange, 
  seekToTime, 
  isEnhanced, 
  pitch = 1, 
  reverbAmount = 0,
  onApplyManualCuts,
  suggestedSilences = [] 
}) {
  const waveformRef = useRef(null);
  const wsRef = useRef(null);
  const wsRegionsRef = useRef(null);
  const audioCtxRef = useRef(null);
  
  const sourceNodeRef = useRef(null);
  const effectChainRef = useRef(null);
  const reverbNodeRef = useRef(null);
  const dryGainRef = useRef(null);
  const wetGainRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // 1. تأسيس الموجة مرة واحدة فقط (يمنع انهيار AbortError واختفاء الشاشة)
  useEffect(() => {
    if (!waveformRef.current) return;

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#374151', 
      progressColor: '#10b981', 
      cursorColor: '#ffffff',
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      height: 120,
      normalize: true,
    });

    const wsRegions = ws.registerPlugin(RegionsPlugin.create());
    wsRegions.enableDragSelection({ color: 'rgba(239, 68, 68, 0.3)' });

    wsRef.current = ws;
    wsRegionsRef.current = wsRegions;

    ws.on('ready', () => {
      setDuration(ws.getDuration());
      onDurationChange(ws.getDuration());
      setupWebAudio(ws.getMediaElement()); 
    });

    ws.on('audioprocess', (time) => {
      setCurrentTime(time);
      onTimeUpdate(time);
    });

    ws.on('play', () => { setIsPlaying(true); onPlayStateChange(true); });
    ws.on('pause', () => { setIsPlaying(false); onPlayStateChange(false); });
    ws.on('finish', () => { setIsPlaying(false); onPlayStateChange(false); });

    wsRegions.on('region-clicked', (region, e) => {
      e.stopPropagation();
      region.remove();
    });

    return () => {
      try { ws.destroy(); } catch(e) { /* تجاهل خطأ التدمير الآمن */ }
      if (audioCtxRef.current) {
         audioCtxRef.current.close();
         audioCtxRef.current = null;
      }
    };
  }, []); // [] مصفوفة فارغة تعني: لا تدمر الشاشة أبداً!

  // 2. تحديث الملف الصوتي بسلاسة بدون إعادة بناء الشاشة
  useEffect(() => {
    if (file && wsRef.current) {
      const url = URL.createObjectURL(file);
      wsRef.current.load(url);
      if (wsRegionsRef.current) wsRegionsRef.current.clearRegions();
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  // 3. رسم المربعات الحمراء (اقتراحات الذكاء الاصطناعي)
  useEffect(() => {
    if (!wsRegionsRef.current || suggestedSilences.length === 0) return;
    wsRegionsRef.current.clearRegions();
    suggestedSilences.forEach(silence => {
      if (silence.end > silence.start) {
         wsRegionsRef.current.addRegion({
           start: silence.start,
           end: silence.end,
           color: 'rgba(239, 68, 68, 0.3)',
           drag: true,
           resize: true
         });
      }
    });
  }, [suggestedSilences]);

  // 4. بناء هندسة الاستوديو 
  const setupWebAudio = (mediaElement) => {
    if (audioCtxRef.current) return; 

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    
    const source = ctx.createMediaElementSource(mediaElement);
    sourceNodeRef.current = source;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.ratio.value = 12;
    const eq = ctx.createBiquadFilter();
    eq.type = "highshelf";
    eq.frequency.value = 3000;
    eq.gain.value = 6;
    const gain = ctx.createGain();
    gain.gain.value = 1.5;

    compressor.connect(eq);
    eq.connect(gain);
    effectChainRef.current = { in: compressor, out: gain };

    const convolver = ctx.createConvolver();
    convolver.buffer = generateReverbImpulse(ctx);
    reverbNodeRef.current = convolver;

    const dryGain = ctx.createGain(); 
    const wetGain = ctx.createGain(); 

    // +++ إصلاح الخلل الخطير: ضبط الصدى على الصفر عند التحميل +++
    const wetRatio = reverbAmount / 100;
    wetGain.gain.value = wetRatio * 1.5;
    dryGain.gain.value = 1 - (wetRatio * 0.3);

    dryGainRef.current = dryGain;
    wetGainRef.current = wetGain;

    wetGain.connect(ctx.destination);
    dryGain.connect(ctx.destination);

    applyRouting();
  };

  const applyRouting = () => {
    if (!audioCtxRef.current || !sourceNodeRef.current) return;
    const ctx = audioCtxRef.current;
    const source = sourceNodeRef.current;
    const { in: fxIn, out: fxOut } = effectChainRef.current;
    const convolver = reverbNodeRef.current;
    const dryGain = dryGainRef.current;
    const wetGain = wetGainRef.current;

    source.disconnect();
    fxOut.disconnect();
    convolver.disconnect();

    const activeSource = isEnhanced ? fxOut : source;
    if (isEnhanced) source.connect(fxIn);

    activeSource.connect(dryGain);
    activeSource.connect(convolver);
    convolver.connect(wetGain);

    if (ctx.state === 'suspended') ctx.resume();
  };

  useEffect(() => { applyRouting(); }, [isEnhanced]);

  useEffect(() => {
    if (wsRef.current) wsRef.current.setPlaybackRate(pitch);
    if (wetGainRef.current && dryGainRef.current) {
      const wetRatio = reverbAmount / 100;
      wetGainRef.current.gain.value = wetRatio * 1.5; 
      dryGainRef.current.gain.value = 1 - (wetRatio * 0.3); 
    }
  }, [pitch, reverbAmount]);

  useEffect(() => {
    if (seekToTime !== null && wsRef.current) wsRef.current.setTime(seekToTime);
  }, [seekToTime]);

  const togglePlay = () => {
    if (wsRef.current) wsRef.current.playPause();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
  };

  const handleApplyManualCuts = () => {
    if (!wsRegionsRef.current) return;
    const cutRegions = wsRegionsRef.current.getRegions().map(r => ({ start: r.start, end: r.end }));
    
    if (cutRegions.length === 0) return alert("⚠️ Please highlight at least one red region on the waveform to cut!");
    cutRegions.sort((a, b) => a.start - b.start);

    let keptRegions = [];
    let currentStart = 0;
    for (let cut of cutRegions) {
        if (cut.start > currentStart) keptRegions.push({ start: currentStart, end: cut.start });
        currentStart = Math.max(currentStart, cut.end);
    }
    if (currentStart < duration) keptRegions.push({ start: currentStart, end: duration });

    if (onApplyManualCuts) onApplyManualCuts(keptRegions);
  };

  const formatTime = (secs) => {
    if (isNaN(secs)) return "00:00";
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="w-full max-w-4xl bg-[#080808] border border-gray-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden transition-all duration-500">
      {(isEnhanced || reverbAmount > 0 || pitch !== 1) && (
         <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none animate-pulse"></div>
      )}
      
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3 relative z-10">
           <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${(isEnhanced || pitch !== 1) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-400'}`}>🎙️</div>
           <div>
             <h3 className="text-gray-200 font-bold text-sm max-w-[200px] truncate">{file?.name || "Audio Track"}</h3>
             <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-gray-500 mt-1">
               {isEnhanced && <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">✨ Enhanced</span>}
               {reverbAmount > 0 && <span className="text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">🏛️ Reverb {reverbAmount}%</span>}
               {pitch !== 1 && <span className="text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">🎭 Pitch {pitch}x</span>}
             </div>
           </div>
        </div>

        <div className="flex items-center gap-3 z-10">
            <div className="text-[9px] text-red-400/70 text-right leading-tight mr-2 hidden sm:block">Drag on waveform to select silence.<br/>Click a red box to delete it.</div>
            <button onClick={handleApplyManualCuts} className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-400 text-xs font-bold rounded-lg transition-colors shadow-lg">✂️ Apply Manual Cuts</button>
            <button onClick={onClear} className="text-gray-500 hover:text-red-400 transition-colors text-2xl ml-2">×</button>
        </div>
      </div>

      <div className="w-full bg-[#040404] rounded-xl mb-6 relative z-10 border border-gray-900/50 p-2">
         <div ref={waveformRef} className="w-full h-[120px]"></div>
      </div>

      <div className="flex items-center gap-4 relative z-10">
        <button onClick={togglePlay} className={`w-14 h-14 shrink-0 rounded-full flex items-center justify-center text-xl transition-all duration-300 hover:scale-105 active:scale-95 ${(isEnhanced || pitch !== 1 || reverbAmount > 0) ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-black shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-white text-black'}`}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <div className="flex-1 flex flex-col justify-center">
            <div className="flex justify-between text-xs font-mono font-bold mt-2">
                <span className="text-emerald-400">{formatTime(currentTime)}</span>
                <span className="text-gray-500">{formatTime(duration)}</span>
            </div>
        </div>
      </div>
    </div>
  );
}