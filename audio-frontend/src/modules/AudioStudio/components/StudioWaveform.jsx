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
  file, onClear, onTimeUpdate, onPlayStateChange, onDurationChange, seekToTime, 
  isEnhanced, speed = 1, pitch = 0, isDeEsser = false, reverbAmount = 0,
  onApplyManualCuts, suggestedSilences = [], isProcessing = false, processLog = "", onReady 
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
  
  // عُقد De-Esser الاحترافية (Multiband Compressor)
  const deEsserLowRef = useRef(null);
  const deEsserHighRef = useRef(null);
  const deEsserCompRef = useRef(null);
  const deEsserMergeRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const onReadyRef = useRef(onReady);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);

  useEffect(() => {
    if (!waveformRef.current) return;

    const ws = WaveSurfer.create({
      container: waveformRef.current, waveColor: '#374151', progressColor: '#10b981', 
      cursorColor: '#ffffff', barWidth: 2, barGap: 2, barRadius: 2, height: 120, normalize: true,
    });
    const wsRegions = ws.registerPlugin(RegionsPlugin.create());
    wsRegions.enableDragSelection({ color: 'rgba(239, 68, 68, 0.3)' });

    wsRef.current = ws; wsRegionsRef.current = wsRegions;

    ws.on('ready', () => {
      setDuration(ws.getDuration()); onDurationChange(ws.getDuration());
      setupWebAudio(ws.getMediaElement()); 
      if (onReadyRef.current) onReadyRef.current(); 
    });

    ws.on('audioprocess', (time) => { setCurrentTime(time); onTimeUpdate(time); });
    ws.on('play', () => { setIsPlaying(true); onPlayStateChange(true); });
    ws.on('pause', () => { setIsPlaying(false); onPlayStateChange(false); });
    ws.on('finish', () => { setIsPlaying(false); onPlayStateChange(false); });
    wsRegions.on('region-clicked', (region, e) => { e.stopPropagation(); region.remove(); });

    return () => {
      try { ws.destroy(); } catch(e) { }
      if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (file && wsRef.current) {
      const url = URL.createObjectURL(file);
      wsRef.current.load(url);
      if (wsRegionsRef.current) wsRegionsRef.current.clearRegions();
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  useEffect(() => {
    if (!wsRegionsRef.current || suggestedSilences.length === 0) return;
    wsRegionsRef.current.clearRegions();
    suggestedSilences.forEach(silence => {
      if (silence.end > silence.start) {
         wsRegionsRef.current.addRegion({
           start: silence.start, end: silence.end, color: 'rgba(239, 68, 68, 0.3)', drag: true, resize: true
         });
      }
    });
  }, [suggestedSilences]);

  const setupWebAudio = (mediaElement) => {
    if (audioCtxRef.current) return; 
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    
    const source = ctx.createMediaElementSource(mediaElement);
    sourceNodeRef.current = source;

    // ==========================================
    // 🎛️ De-Esser حقيقي (ضاغط ديناميكي متعدد الموجات)
    // ==========================================
    const dLow = ctx.createBiquadFilter(); dLow.type = "lowpass"; dLow.frequency.value = 5500;
    const dHigh = ctx.createBiquadFilter(); dHigh.type = "highpass"; dHigh.frequency.value = 5500;
    
    const dComp = ctx.createDynamicsCompressor();
    dComp.threshold.value = -35; dComp.knee.value = 5; dComp.ratio.value = 20; 
    dComp.attack.value = 0.002; dComp.release.value = 0.05;
    
    const dMerge = ctx.createGain();

    deEsserLowRef.current = dLow; deEsserHighRef.current = dHigh;
    deEsserCompRef.current = dComp; deEsserMergeRef.current = dMerge;
    // ==========================================

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24; compressor.ratio.value = 12;
    const eq = ctx.createBiquadFilter();
    eq.type = "highshelf"; eq.frequency.value = 3000; eq.gain.value = 6;
    const gain = ctx.createGain(); gain.gain.value = 1.5;

    compressor.connect(eq); eq.connect(gain);
    effectChainRef.current = { in: compressor, out: gain };

    const convolver = ctx.createConvolver();
    convolver.buffer = generateReverbImpulse(ctx);
    reverbNodeRef.current = convolver;

    const dryGain = ctx.createGain(); const wetGain = ctx.createGain(); 
    const wetRatio = reverbAmount / 100;
    wetGain.gain.value = wetRatio * 1.5; dryGain.gain.value = 1 - (wetRatio * 0.3);

    dryGainRef.current = dryGain; wetGainRef.current = wetGain;
    wetGain.connect(ctx.destination); dryGain.connect(ctx.destination);

    applyRouting();
  };

  const applyRouting = () => {
    if (!audioCtxRef.current || !sourceNodeRef.current) return;
    const ctx = audioCtxRef.current;
    
    // قطع الاتصالات بأمان لتجنب الشاشة السوداء!
    try { sourceNodeRef.current.disconnect(); } catch(e){}
    try { deEsserLowRef.current.disconnect(); } catch(e){}
    try { deEsserHighRef.current.disconnect(); } catch(e){}
    try { deEsserCompRef.current.disconnect(); } catch(e){}
    try { deEsserMergeRef.current.disconnect(); } catch(e){}
    try { if(effectChainRef.current?.out) effectChainRef.current.out.disconnect(); } catch(e){}
    try { reverbNodeRef.current.disconnect(); } catch(e){}

    let currentNode = sourceNodeRef.current;

    // تشغيل الـ De-Esser الاحترافي
    if (isDeEsser) {
        currentNode.connect(deEsserLowRef.current);
        currentNode.connect(deEsserHighRef.current);
        
        deEsserLowRef.current.connect(deEsserMergeRef.current);
        
        deEsserHighRef.current.connect(deEsserCompRef.current);
        deEsserCompRef.current.connect(deEsserMergeRef.current);
        
        currentNode = deEsserMergeRef.current;
    }

    if (isEnhanced) {
        currentNode.connect(effectChainRef.current.in);
        currentNode = effectChainRef.current.out;
    }

    currentNode.connect(dryGainRef.current);
    currentNode.connect(reverbNodeRef.current);
    reverbNodeRef.current.connect(wetGainRef.current);

    if (ctx.state === 'suspended') ctx.resume();
  };

  useEffect(() => { applyRouting(); }, [isEnhanced, isDeEsser]);

  // +++ السحر هنا: التحكم بالـ Pitch الكلاسيكي (تخشين/ترقيق) بشكل منفصل عن السرعة +++
  useEffect(() => {
    if (wsRef.current) {
      const mediaEl = wsRef.current.getMediaElement();
      // تحويل الدرجات (-12 إلى 12) إلى نسبة رياضية دقيقة
      const pitchMultiplier = Math.pow(2, pitch / 12);
      
      if (mediaEl) {
        // إذا كان pitch يساوي 0 (طبيعي)، المتصفح يحافظ على النبرة أثناء تغيير السرعة العادية.
        // وإلا، المتصفح يسمح للسرعة بتغيير النبرة (تأثير السنجاب والوحش)!
        mediaEl.preservesPitch = (pitch === 0);
        mediaEl.webkitPreservesPitch = (pitch === 0); 
      }
      
      wsRef.current.setPlaybackRate(speed * pitchMultiplier);
    }

    if (wetGainRef.current && dryGainRef.current) {
      const wetRatio = reverbAmount / 100;
      wetGainRef.current.gain.value = wetRatio * 1.5; 
      dryGainRef.current.gain.value = 1 - (wetRatio * 0.3); 
    }
  }, [speed, pitch, reverbAmount]);

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
      
      {isProcessing && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center rounded-3xl transition-opacity duration-300">
            <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_20px_rgba(16,185,129,0.5)]"></div>
            <h2 className="text-emerald-400 font-bold text-xl tracking-widest animate-pulse">{processLog || "⚙️ PROCESSING..."}</h2>
            <div className="mt-4 flex gap-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: "0.1s"}}></span>
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: "0.2s"}}></span>
            </div>
        </div>
      )}

      {(isEnhanced || reverbAmount > 0 || speed !== 1 || pitch !== 0 || isDeEsser) && (
         <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none animate-pulse"></div>
      )}
      
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3 relative z-10">
           <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${(isEnhanced || speed !== 1 || pitch !== 0) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-400'}`}>🎙️</div>
           <div>
             <h3 className="text-gray-200 font-bold text-sm max-w-[200px] truncate">{file?.name || "Audio Track"}</h3>
             <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-gray-500 mt-1">
               {isEnhanced && <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">✨ Enhanced</span>}
               {isDeEsser && <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">🤫 De-Esser</span>}
               {pitch !== 0 && <span className="text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">🎭 Pitch {pitch > 0 ? `+${pitch}` : pitch} st</span>}
               {speed !== 1 && <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">⏱️ Speed {speed}x</span>}
             </div>
           </div>
        </div>

        <div className="flex items-center gap-3 z-10">
            <div className="text-[9px] text-red-400/70 text-right leading-tight mr-2 hidden sm:block">Drag on waveform to select silence.<br/>Click a red box to delete it.</div>
            <button onClick={handleApplyManualCuts} className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-400 text-xs font-bold rounded-lg transition-colors shadow-lg">✂️ Execute Cuts</button>
            <button onClick={onClear} className="text-gray-500 hover:text-red-400 transition-colors text-2xl ml-2">×</button>
        </div>
      </div>

      <div className="w-full bg-[#040404] rounded-xl mb-6 relative z-10 border border-gray-900/50 p-2">
         <div ref={waveformRef} className="w-full h-[120px]"></div>
      </div>

      <div className="flex items-center gap-4 relative z-10">
        <button onClick={togglePlay} className={`w-14 h-14 shrink-0 rounded-full flex items-center justify-center text-xl transition-all duration-300 hover:scale-105 active:scale-95 ${(isEnhanced || speed !== 1 || reverbAmount > 0) ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-black shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-white text-black'}`}>
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