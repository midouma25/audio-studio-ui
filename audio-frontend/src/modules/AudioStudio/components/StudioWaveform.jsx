import { useEffect, useRef, useState } from "react";

// دالة مساعدة لتوليد (Impulse Response) لعمل تأثير الصدى
const generateReverbImpulse = (ctx) => {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * 2.5; // مدة الصدى 2.5 ثانية
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);
  for (let i = 0; i < length; i++) {
    // تضاؤل تدريجي لتكوين صوت القاعة
    const decay = Math.pow(1 - i / length, 3);
    left[i] = (Math.random() * 2 - 1) * decay;
    right[i] = (Math.random() * 2 - 1) * decay;
  }
  return impulse;
};

// +++ استقبلنا pitch و reverbAmount في الخصائص +++
export default function StudioWaveform({ file, onClear, onTimeUpdate, onPlayStateChange, onDurationChange, seekToTime, isEnhanced, pitch = 1, reverbAmount = 0 }) {
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  
  // عُقد الصوت (Audio Nodes)
  const sourceRef = useRef(null);
  const effectChainRef = useRef(null);
  const reverbNodeRef = useRef(null);
  const dryGainRef = useRef(null);
  const wetGainRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // 1. تحميل الملف الصوتي
  useEffect(() => {
    if (!file || !audioRef.current) return;
    const objectUrl = URL.createObjectURL(file);
    audioRef.current.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  // 2. بناء هندسة الاستوديو (Audio Context Routing)
  useEffect(() => {
    if (!audioRef.current) return;

    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      
      const source = ctx.createMediaElementSource(audioRef.current);
      sourceRef.current = source;

      // أ) بناء سلسلة فلاتر التحسين (Auto-Mastering)
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

      // ب) بناء محرك الصدى (Reverb/Convolver)
      const convolver = ctx.createConvolver();
      convolver.buffer = generateReverbImpulse(ctx);
      reverbNodeRef.current = convolver;

      const dryGain = ctx.createGain(); // الصوت النقي
      const wetGain = ctx.createGain(); // صوت الصدى فقط
      dryGainRef.current = dryGain;
      wetGainRef.current = wetGain;

      // التوصيل النهائي
      wetGain.connect(ctx.destination);
      dryGain.connect(ctx.destination);
    }

    const ctx = audioCtxRef.current;
    const source = sourceRef.current;
    const { in: fxIn, out: fxOut } = effectChainRef.current;
    const convolver = reverbNodeRef.current;
    const dryGain = dryGainRef.current;
    const wetGain = wetGainRef.current;

    // إعادة ضبط التوصيلات (Reset Routing)
    source.disconnect();
    fxOut.disconnect();
    convolver.disconnect();

    // اختيار المسار (هل التحسين مفعل أم لا؟)
    const activeSource = isEnhanced ? fxOut : source;
    if (isEnhanced) {
      source.connect(fxIn);
    }

    // توصيل مسار الصدى والمسار الجاف
    activeSource.connect(dryGain);
    activeSource.connect(convolver);
    convolver.connect(wetGain);

    if (ctx.state === 'suspended') ctx.resume();

  }, [isEnhanced, file]);

  // 3. التحديث اللحظي للصدى وتخشين/ترقيق الصوت
  useEffect(() => {
    // تحديث سرعة ونبرة الصوت (السر العظيم في المتصفحات الحديثة)
    if (audioRef.current) {
      audioRef.current.preservesPitch = false; // إلغاء الحفاظ على النبرة الطبيعية
      audioRef.current.playbackRate = pitch; // تغيير السرعة والنبرة معاً (وحش / سنجاب)
    }

    // تحديث كمية الصدى
    if (wetGainRef.current && dryGainRef.current) {
      const wetRatio = reverbAmount / 100;
      wetGainRef.current.gain.value = wetRatio * 1.5; // تعزيز صوت الصدى
      dryGainRef.current.gain.value = 1 - (wetRatio * 0.3); // خفض الصوت الأصلي قليلاً عند زيادة الصدى
    }
  }, [pitch, reverbAmount]);

  // ... (بقية دوال التشغيل togglePlay و handleTimeUpdate تبقى كما هي تماماً من الكود السابق)
  
  // -- (نفس دوال التحديث المساعدة) --
  useEffect(() => {
    if (seekToTime !== null && audioRef.current) audioRef.current.currentTime = seekToTime;
  }, [seekToTime]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause(); else audioRef.current.play();
      setIsPlaying(!isPlaying);
      onPlayStateChange(!isPlaying);
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      onTimeUpdate(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      onDurationChange(audioRef.current.duration);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="w-full max-w-3xl bg-[#080808] border border-gray-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden transition-all duration-500">
      
      {(isEnhanced || reverbAmount > 0 || pitch !== 1) && (
         <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none animate-pulse"></div>
      )}
      
      <audio 
        ref={audioRef} 
        onTimeUpdate={handleTimeUpdate} 
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => { setIsPlaying(false); onPlayStateChange(false); }}
      />
      
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3 relative z-10">
           <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${(isEnhanced || pitch !== 1) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-400'}`}>
             🎙️
           </div>
           <div>
             <h3 className="text-gray-200 font-bold text-sm max-w-[200px] truncate">{file?.name || "Audio Track"}</h3>
             <div className="flex items-center gap-2 text-[10px] font-mono text-gray-500 mt-1">
               {isEnhanced && <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">✨ Enhanced</span>}
               {reverbAmount > 0 && <span className="text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">🏛️ Reverb {reverbAmount}%</span>}
               {pitch !== 1 && <span className="text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">🎭 Pitch {pitch}x</span>}
               {(!isEnhanced && reverbAmount === 0 && pitch === 1) && <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-400">Raw Audio</span>}
             </div>
           </div>
        </div>
        <button onClick={onClear} className="text-gray-500 hover:text-red-400 transition-colors text-2xl relative z-10">×</button>
      </div>

      {/* التايملاين الموجي */}
      <div className="h-24 w-full bg-[#040404] rounded-xl mb-6 flex items-center justify-center gap-1.5 overflow-hidden px-4 relative z-10 border border-gray-900/50">
         {Array.from({ length: 50 }).map((_, i) => (
            <div 
              key={i} 
              className={`w-1.5 rounded-full transition-all duration-150 ${(isEnhanced || reverbAmount > 0 || pitch !== 1) ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-gray-600'}`}
              style={{ height: isPlaying ? `${Math.max(10, Math.random() * 90)}%` : '10%', opacity: isPlaying ? 1 : 0.3 }}
            ></div>
         ))}
      </div>

      <div className="flex items-center gap-4 relative z-10">
        <button onClick={togglePlay} className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all duration-300 hover:scale-105 active:scale-95 ${(isEnhanced || pitch !== 1 || reverbAmount > 0) ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-black shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-white text-black'}`}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        
        <div className="flex-1">
          <input 
            type="range" min={0} max={duration || 100} value={currentTime}
            onChange={(e) => { if (audioRef.current) audioRef.current.currentTime = Number(e.target.value); }}
            className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer overflow-hidden"
            style={{ background: `linear-gradient(to right, ${(isEnhanced || pitch !== 1) ? '#10b981' : '#fff'} ${(currentTime / duration) * 100}%, #1f2937 ${(currentTime / duration) * 100}%)` }}
          />
          <div className="flex justify-between text-[10px] font-mono text-gray-500 mt-2">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}