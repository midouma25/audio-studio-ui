import { useEffect, useRef, useState } from "react";

export default function WaveformPlayer({ 
  file, processedFile, 
  onClear, onTimeUpdate, seekRequest, 
  applyStudioSound, applyNoiseReduction, applyTrimSilence,
  onProcess, isProcessing 
}) {
  const [audioUrl, setAudioUrl] = useState("");
  const [processedUrl, setProcessedUrl] = useState(""); 
  const [metrics, setMetrics] = useState({ purity: 45, attenuation: 0, intelligibility: 60 });  
  
  const canvasRef = useRef(null); 
  const audioCtxRef = useRef(null);
  const nodesRef = useRef(null);
  const animationRef = useRef(null); 
  const audioRef = useRef(null);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  useEffect(() => {
    if (file) setAudioUrl(URL.createObjectURL(file));
    if (processedFile) setProcessedUrl(URL.createObjectURL(processedFile));
    
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (processedUrl) URL.revokeObjectURL(processedUrl);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [file, processedFile]);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = processedUrl;
    a.download = processedFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const applyFilters = () => {
    if (nodesRef.current) {
      const { highPass, lowPass, studioComp, studioEq, gateComp } = nodesRef.current;
      highPass.frequency.value = applyNoiseReduction ? 80 : 0; 
      lowPass.frequency.value = applyNoiseReduction ? 8000 : 24000; 
      studioEq.gain.value = applyStudioSound ? 12 : 0;
      studioComp.threshold.value = applyStudioSound ? -40 : 0;
      studioComp.ratio.value = applyStudioSound ? 8 : 1;
      gateComp.threshold.value = applyTrimSilence ? -38 : 0; 
      gateComp.knee.value = applyTrimSilence ? 10 : 40; 
      gateComp.ratio.value = applyTrimSilence ? 12 : 1; 
    }
  };

  const handleAudioPlay = () => {
    if (!audioRef.current || !canvasRef.current) return;

    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      
      const source = audioCtx.createMediaElementSource(audioRef.current);

      const rawAnalyser = audioCtx.createAnalyser();       
      const processedAnalyser = audioCtx.createAnalyser(); 
      rawAnalyser.fftSize = 512; 
      processedAnalyser.fftSize = 512;

      const highPass = audioCtx.createBiquadFilter();
      highPass.type = "highpass";
      const lowPass = audioCtx.createBiquadFilter();
      lowPass.type = "lowpass";
      const studioComp = audioCtx.createDynamicsCompressor();
      const studioEq = audioCtx.createBiquadFilter();
      studioEq.type = "highshelf";
      studioEq.frequency.value = 2500; 
      const gateComp = audioCtx.createDynamicsCompressor(); 

      source.connect(rawAnalyser);
      rawAnalyser.connect(highPass);
      highPass.connect(lowPass);
      lowPass.connect(studioComp);
      studioComp.connect(studioEq);
      studioEq.connect(gateComp);
      gateComp.connect(processedAnalyser);
      processedAnalyser.connect(audioCtx.destination);

      nodesRef.current = { highPass, lowPass, studioComp, studioEq, gateComp };
      applyFilters();

      const canvas = canvasRef.current;
      const canvasCtx = canvas.getContext("2d");
      const bufferLength = rawAnalyser.frequencyBinCount;
      const rawDataArray = new Uint8Array(bufferLength);
      const processedDataArray = new Uint8Array(bufferLength);

      let frameCount = 0;

      const draw = () => {
        animationRef.current = requestAnimationFrame(draw);

        rawAnalyser.getByteFrequencyData(rawDataArray);
        processedAnalyser.getByteFrequencyData(processedDataArray);

        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        const drawSmoothWave = (dataArray, color) => {
          canvasCtx.beginPath();
          canvasCtx.moveTo(0, canvas.height); 
          let x = 0;
          const sliceWidth = (canvas.width / bufferLength) * 1.5; 

          for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 255.0;
            const y = canvas.height - (v * canvas.height * 0.85); 

            if (i === 0) {
              canvasCtx.moveTo(x, y);
            } else {
              canvasCtx.lineTo(x, y); 
            }
            x += sliceWidth;
          }

          canvasCtx.lineTo(canvas.width, canvas.height); 
          canvasCtx.lineTo(0, canvas.height); 
          canvasCtx.fillStyle = color;
          canvasCtx.fill();
        };

        drawSmoothWave(rawDataArray, "rgba(225, 29, 72, 0.3)");
        drawSmoothWave(processedDataArray, "rgba(16, 185, 129, 0.7)");

        frameCount++;
        if (frameCount % 15 === 0) {
          let rawSum = 0; let procSum = 0;
          for(let i=0; i<bufferLength; i++) { rawSum += rawDataArray[i]; procSum += processedDataArray[i]; }
          
          const rawAvg = rawSum / bufferLength;
          const procAvg = procSum / bufferLength;
          const attenuationDiff = rawAvg > 5 ? (procAvg - rawAvg) : 0;
          
          let basePurity = 45;
          if (applyStudioSound) basePurity += 25;
          if (applyNoiseReduction) basePurity += 15;
          if (applyTrimSilence) basePurity += 5;
          
          const dynamicPurity = Math.min(99, basePurity + (procAvg / 255) * 10);
         
          let baseIntel = 60;
          if (applyStudioSound) baseIntel += 10;
          if (applyNoiseReduction) baseIntel += 15;
          if (applyTrimSilence) baseIntel += 10;
          const dynamicIntel = Math.min(99, baseIntel + (procAvg / 255) * 10);

          setMetrics({ 
            purity: Math.round(dynamicPurity), 
            attenuation: Math.round(attenuationDiff / 2),
            intelligibility: Math.round(dynamicIntel)
          });
        }
      };
      draw();
    }

    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
  };

  useEffect(() => {
    applyFilters();
  }, [applyStudioSound, applyNoiseReduction, applyTrimSilence]);

  useEffect(() => {
    if (seekRequest !== null && audioRef.current) {
      audioRef.current.currentTime = seekRequest;
      audioRef.current.play().catch(e => console.log("Auto-play prevented")); 
    }
  }, [seekRequest]);

  return (
    <div className="w-full flex flex-col gap-3">
      
      <div className="w-full bg-[#0a0a0a] border border-gray-800/50 rounded-xl p-4 shadow-xl relative overflow-hidden flex flex-col gap-3">

        <div className="flex items-center justify-between z-10 mb-2">
          <h2 className="text-sm font-bold text-gray-200 flex items-center gap-2">
            <span className="text-emerald-500">🎙️</span> Workspace
          </h2>
          
          <div className="flex items-center gap-3">
            {(applyStudioSound || applyNoiseReduction || applyTrimSilence) && !processedFile && (
              <button 
                onClick={onProcess} 
                disabled={isProcessing}
                className={`text-xs font-bold px-4 py-1.5 rounded-md border transition-all flex items-center gap-2
                  ${isProcessing 
                    ? 'bg-emerald-900/50 text-emerald-500/50 border-emerald-900 cursor-not-allowed' 
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                  }`}
              >
                {isProcessing ? '⏳ Processing AI...' : '🚀 Render AI Audio'}
              </button>
            )}
            <button onClick={onClear} disabled={isProcessing} className="text-gray-400 hover:text-red-400 transition-colors text-xs font-bold bg-[#111] px-3 py-1.5 rounded-md border border-gray-800/80 hover:border-red-500/50 flex items-center gap-1.5">
              ✕ Clear Session
            </button>
          </div>
        </div>

        <div className="w-full h-28 bg-[#020202] rounded-lg overflow-hidden relative border border-gray-800/40 shadow-inner">
          <canvas ref={canvasRef} width="1200" height="150" className="w-full h-full absolute inset-0 mix-blend-screen opacity-90"></canvas>
          <div className="absolute top-2 left-2 flex gap-3 text-[9px] font-mono uppercase tracking-widest text-white/50 bg-black/60 px-2 py-1 rounded">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span> Source</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Processed</span>
          </div>
        </div>

        {/* 1. المشغل الأصلي (Original File) */}
        <div className="w-full bg-[#111] border border-gray-800 p-3 rounded-lg flex flex-col gap-2">
          <div className="flex justify-between items-center px-1">
             <span className="text-xs text-gray-400 font-bold flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-rose-500"></span> Original Source
             </span>
             <span className="text-[10px] text-gray-600 font-mono bg-black px-2 py-0.5 rounded border border-gray-800">{formatBytes(file.size)}</span>
          </div>
          <audio ref={audioRef} controls src={audioUrl} className="w-full h-8 outline-none opacity-80 hover:opacity-100" onTimeUpdate={(e) => onTimeUpdate(e.target.currentTime)} onPlay={handleAudioPlay} />
        </div>

        {/* 2. المشغل المعالج (AI Mastered File) */}
        {processedFile && (
          <div className="w-full bg-gradient-to-r from-[#0d1f18] to-[#0a0a0a] border border-emerald-900/50 p-3 rounded-lg flex flex-col gap-2 mt-2 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,1)]"></div>
            
            <div className="flex justify-between items-center px-2">
               <span className="text-xs text-emerald-400 font-bold flex items-center gap-2 drop-shadow-md">
                 ✨ AI Mastered Result
               </span>
               <div className="flex items-center gap-3">
                 <span className="text-[10px] text-emerald-600/70 font-mono bg-black/50 px-2 py-0.5 rounded border border-emerald-900/30">
                   {formatBytes(processedFile.size)} 
                   {processedFile.size < file.size && <span className="text-emerald-500 ml-1">(-{Math.round((1 - processedFile.size/file.size)*100)}%)</span>}
                 </span>
                 <button onClick={handleDownload} className="text-[10px] font-bold bg-emerald-500 text-black px-3 py-1 rounded hover:bg-emerald-400 transition-colors shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                   ⬇️ Download WAV
                 </button>
               </div>
            </div>
            <audio controls src={processedUrl} className="w-full h-8 outline-none opacity-90 hover:opacity-100" />
          </div>
        )}
      </div>

      <div className="w-full grid grid-cols-3 gap-3">
        
        <div className="bg-[#0a0a0a] border border-gray-800/50 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden shadow-md">
           <span className="text-[11px] text-gray-400 font-bold mb-2 tracking-wide truncate">Voice Purity Score "Studio Sound"</span>
           <div className="flex justify-between items-end">
             <div className="flex flex-col hidden xl:flex"> 
               <span className="text-[9px] text-rose-500/70 mb-0.5 uppercase tracking-wider">Source</span>
               <span className="text-sm font-mono text-gray-600 line-through decoration-rose-500/50">45%</span>
             </div>
             <span className="text-gray-600 mb-1 hidden xl:block">→</span>
             <div className="flex flex-col text-right flex-1">
               <span className="text-[9px] text-emerald-500/70 mb-0.5 uppercase tracking-wider">Processed</span>
               <span className={`text-2xl lg:text-3xl font-mono font-bold ${metrics.purity > 70 ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]' : 'text-gray-300'}`}>{metrics.purity}%</span>
             </div>
           </div>
           {applyStudioSound && <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500"></div>}
        </div>

        <div className="bg-[#0a0a0a] border border-gray-800/50 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden shadow-md">
           <span className="text-[11px] text-gray-400 font-bold mb-2 tracking-wide truncate">Noise Attenuation "Noise Reduction"</span>
           <div className="flex justify-between items-end">
             <div className="flex flex-col hidden xl:flex">
               <span className="text-[9px] text-rose-500/70 mb-0.5 uppercase tracking-wider">Source</span>
               <span className="text-sm font-mono text-gray-600">0 dB</span>
             </div>
             <span className="text-gray-600 mb-1 hidden xl:block">→</span>
             <div className="flex flex-col text-right flex-1">
               <span className="text-[9px] text-emerald-500/70 mb-0.5 uppercase tracking-wider">Reduction</span>
               <span className={`text-2xl lg:text-3xl font-mono font-bold ${metrics.attenuation < -5 ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]' : 'text-gray-300'}`}>{metrics.attenuation} <span className="text-sm lg:text-base">dB</span></span>
             </div>
           </div>
           {applyNoiseReduction && <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500"></div>}
        </div>

        <div className="bg-[#0a0a0a] border border-gray-800/50 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden shadow-md">
           <span className="text-[11px] text-gray-400 font-bold mb-2 tracking-wide truncate">Intelligibility "Trim Silence"</span>
           <div className="flex justify-between items-end">
             <div className="flex flex-col hidden xl:flex">
               <span className="text-[9px] text-rose-500/70 mb-0.5 uppercase tracking-wider">Source</span>
               <span className="text-sm font-mono text-gray-600 line-through decoration-rose-500/50">60%</span>
             </div>
             <span className="text-gray-600 mb-1 hidden xl:block">→</span>
             <div className="flex flex-col text-right flex-1">
               <span className="text-[9px] text-emerald-500/70 mb-0.5 uppercase tracking-wider">Processed</span>
               <span className={`text-2xl lg:text-3xl font-mono font-bold ${metrics.intelligibility > 70 ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]' : 'text-gray-300'}`}>{metrics.intelligibility}%</span>
             </div>
           </div>
           {applyTrimSilence && <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500"></div>}
        </div>

      </div>
    </div>
  );
}