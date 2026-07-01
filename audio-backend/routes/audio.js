import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv'; 
import Transcript from '../models/Transcript.js';
import { protect } from '../middleware/authMiddleware.js';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'child_process'; 
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config(); 
ffmpeg.setFfmpegPath(ffmpegPath);

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

const localJobs = new Map();

const formatShortTime = (timeInSeconds) => {
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const validateAIRequest = (req, res, next) => {
    if (!ASSEMBLYAI_API_KEY) return next(new Error("Server Configuration Error: Missing API Key"));
    if (!req.file) return next(new Error("Bad Request: No audio file provided"));
    next(); 
};

// ================= مسارات الذكاء الاصطناعي والميزات السابقة =================
router.post('/transcribe', protect, upload.single('audio_file'), validateAIRequest, async (req, res, next) => {
    try {
        if (req.user.credits <= 0 && !req.user.isPremium) return res.status(402).json({ error: "Payment Required" });
        const audioLanguage = req.body.language || "auto";
        const translateTo = req.body.translate_to || "none";

        const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
            method: "POST", headers: { "authorization": ASSEMBLYAI_API_KEY, "Content-Type": "application/octet-stream" }, body: req.file.buffer 
        });
        const uploadData = await uploadResponse.json();
        
        const transcriptResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
            method: "POST", headers: { "authorization": ASSEMBLYAI_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ audio_url: uploadData.upload_url, language_detection: audioLanguage === "auto", language_code: audioLanguage !== "auto" ? audioLanguage : undefined, speaker_labels: true }),
        });        
        const transcriptId = (await transcriptResponse.json()).id;

        let status = "queued", finalResult = null;
        while (status === "queued" || status === "processing") {
            await new Promise(resolve => setTimeout(resolve, 3000));
            const pollingResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, { headers: { "authorization": ASSEMBLYAI_API_KEY } });
            finalResult = await pollingResponse.json();
            status = finalResult.status;
        }

        let groupedChunks = [];
        if (finalResult && finalResult.words && finalResult.words.length > 0) {
            let currentChunk = [];
            for (let i = 0; i < finalResult.words.length; i++) {
                currentChunk.push(finalResult.words[i]);
                const nextWord = finalResult.words[i+1];
                const isPause = nextWord && (nextWord.start - finalResult.words[i].end > 400);
                const isSpeakerChanged = nextWord && (nextWord.speaker !== finalResult.words[i].speaker);
                if (isPause || isSpeakerChanged || currentChunk.length >= 12 || i === finalResult.words.length - 1) {
                    groupedChunks.push({
                        id: groupedChunks.length, startTime: currentChunk[0].start / 1000, endTime: currentChunk[currentChunk.length - 1].end / 1000,
                        text: currentChunk.map(w => w.text).join(audioLanguage === 'ja' ? "" : " "), timeString: formatShortTime(currentChunk[0].start / 1000), speaker: currentChunk[0].speaker || "A" 
                    });
                    currentChunk = [];
                }
            }
            if (translateTo !== "none") {
                const detectedLang = finalResult.language_code || "ja";
                for (let i = 0; i < groupedChunks.length; i++) {
                    const resTranslate = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(groupedChunks[i].text)}&langpair=${detectedLang}|${translateTo}`);
                    const data = await resTranslate.json();
                    if (data?.responseData?.translatedText) groupedChunks[i].translatedText = data.responseData.translatedText;
                    await new Promise(r => setTimeout(r, 400));
                }
            }
        }
        const newTranscript = new Transcript({ fileName: req.file.originalname, audioLanguage, translateTo, chunks: groupedChunks });
        const savedData = await newTranscript.save();
        req.user.credits -= 1; await req.user.save();
        res.status(200).json({ transcriptId: savedData._id, chunks: groupedChunks, remainingCredits: req.user.credits });
    } catch (error) { next(error); }
});

router.get('/transcripts', async (req, res, next) => {
    try { res.status(200).json({ history: await Transcript.find().select('-chunks').sort({ createdAt: -1 }) }); } catch (error) { next(error); }
});
router.get('/transcript/:id', async (req, res, next) => {
    try { res.status(200).json({ chunks: (await Transcript.findById(req.params.id)).chunks }); } catch (error) { next(error); }
});

router.post('/trim-silence/:id', protect, async (req, res, next) => {
    try {
        const transcript = await Transcript.findById(req.params.id);
        if (!transcript) return res.status(404).json({ error: "Project not found" });
        const { mode } = req.body;
        let originalChunks = transcript.chunks;
        if (originalChunks.length === 0) return res.status(200).json({ chunks: [], timeSaved: 0, keptRegions: [] });

        const maxAllowedSilence = mode === "ai_speech" ? 0.25 : 0.8; 
        const padding = mode === "ai_speech" ? 0.15 : 0.3;
        let rawRegions = originalChunks.map(c => ({ start: Math.max(0, c.startTime - padding), end: c.endTime + padding }));
        let keptRegions = [];
        if (rawRegions.length > 0) {
            let current = rawRegions[0];
            for (let i = 1; i < rawRegions.length; i++) {
                const gap = originalChunks[i].startTime - originalChunks[i-1].endTime;
                if (gap <= maxAllowedSilence) current.end = Math.max(current.end, rawRegions[i].end);
                else { keptRegions.push({...current}); current = rawRegions[i]; }
            }
            keptRegions.push({...current});
        }
        const getNewTime = (oldTime) => {
            let newTime = 0;
            for (let region of keptRegions) {
                if (oldTime < region.start) break;
                if (oldTime >= region.start && oldTime <= region.end) { newTime += (oldTime - region.start); break; }
                if (oldTime > region.end) newTime += (region.end - region.start);
            }
            return newTime;
        };
        let trimmedChunks = [];
        for (let i = 0; i < originalChunks.length; i++) {
            const currentChunk = originalChunks[i];
            const newStartTime = getNewTime(currentChunk.startTime);
            const newEndTime = getNewTime(currentChunk.endTime);
            const mins = Math.floor(newStartTime / 60);
            const secs = Math.floor(newStartTime % 60);
            trimmedChunks.push({ ...currentChunk.toObject(), startTime: newStartTime, endTime: newEndTime, timeString: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}` });
        }
        transcript.chunks = trimmedChunks; await transcript.save();
        let timeSaved = keptRegions[0].start; 
        for (let i = 1; i < keptRegions.length; i++) timeSaved += (keptRegions[i].start - keptRegions[i - 1].end);
        res.status(200).json({ chunks: trimmedChunks, timeSaved: timeSaved, keptRegions: keptRegions });
    } catch (error) { next(error); }
});

router.post('/extract-fingerprint', protect, upload.single('audio_file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Missing audio file" });
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
    const inputFileName = `Input_${Date.now()}.wav`; const inputFile = path.join(uploadsDir, inputFileName); const outputFile = path.join(uploadsDir, `Studio_DeEssed_${Date.now()}.wav`);
    fs.writeFileSync(inputFile, req.file.buffer);
    ffmpeg(inputFile).audioFilters(['deesser=i=0.01:m=0.05:f=0.8:s=o', 'equalizer=f=3000:width_type=h:width=200:g=2', 'highpass=f=80']).save(outputFile)
        .on('end', () => { res.download(outputFile, 'Studio_DeEssed.wav', () => { try { if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile); if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile); } catch (err) {} }); })
        .on('error', (err) => { if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile); res.status(500).json({ error: "Audio processing failed." }); });
});

// ==========================================
// 🪓 1. مسار بدء المعالجة للعزل الآمن
// ==========================================
router.post('/split-vocals/start', protect, upload.single('audio_file'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Missing audio file" });

        // استقبال إعدادات الجودة من المستخدم
        const quality = req.body.quality || 'fast'; 
        const shifts = quality === 'studio' ? '3' : '1';
        const overlap = quality === 'studio' ? '0.25' : '0.1';

        const jobId = `job_${Date.now()}`;
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

        const jobPublicDir = path.join(uploadsDir, `Public_${jobId}`);
        if (!fs.existsSync(jobPublicDir)) fs.mkdirSync(jobPublicDir);

        const inputFile = path.join(uploadsDir, `Input_${jobId}.wav`);
        fs.writeFileSync(inputFile, req.file.buffer);

        localJobs.set(jobId, { status: 'processing' });
        console.log(`🤖 [AI Engine] Job ${jobId} started in ${quality.toUpperCase()} mode...`);

        const pythonScriptPath = path.join(__dirname, '..', 'run_demucs.py');

        const pythonProcess = spawn('python', [
            pythonScriptPath,
            '-n', 'htdemucs_ft',
            '--two-stems=vocals', 
            inputFile,
            '-o', jobPublicDir,
            shifts,  
            overlap  
        ]);

        let isSuccess = false;

        pythonProcess.stdout.on('data', (data) => {
            const msg = data.toString();
            console.log(`[Python Engine]: ${msg.trim()}`);
            if (msg.includes('[SIGNAL_SUCCESS]')) isSuccess = true;
        });

        pythonProcess.on('close', (code) => {
            const baseName = `Input_${jobId}`;
            const vocalsFile = path.join(jobPublicDir, 'htdemucs_ft', baseName, 'vocals.wav');
            const backgroundFile = path.join(jobPublicDir, 'htdemucs_ft', baseName, 'background.wav');

            if (isSuccess && fs.existsSync(vocalsFile) && fs.existsSync(backgroundFile)) {
                console.log(`✅ [AI Engine] Job ${jobId} Multi-Stems Ready!`);
                localJobs.set(jobId, { 
                    status: 'succeeded', 
                    vocalsFile: vocalsFile,
                    backgroundFile: backgroundFile,
                    inputFile: inputFile,
                    jobPublicDir: jobPublicDir
                });
            } else {
                console.error(`❌ [AI Engine] Job ${jobId} failed.`);
                localJobs.set(jobId, { status: 'failed', error: "AI Processing Failed" });
                try { fs.rmSync(inputFile, { force: true }); } catch(e){}
            }
        });

        res.status(200).json({ message: "Job initialized", jobId: jobId, status: "processing" });
    } catch (error) { next(error); }
});

router.get('/split-vocals/status/:jobId', protect, (req, res) => {
    const job = localJobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.status(200).json({ status: job.status, error: job.error });
});

// ==========================================
// 📥 3. مسار التحميل المزدوج السريع (مع فلاتر التلميع وحفظ MP3 آمن لمنع الشاشة السوداء)
// ==========================================
router.get('/split-vocals/download/:jobId/:type', protect, (req, res) => {
    const job = localJobs.get(req.params.jobId);
    if (!job || job.status !== 'succeeded') return res.status(404).json({ error: "Not ready" });

    const { type } = req.params;
    const targetFile = type === 'background' ? job.backgroundFile : job.vocalsFile;
    const outputName = type === 'background' ? `Music_${req.params.jobId}.mp3` : `Vocals_${req.params.jobId}.mp3`;
    const finalMp3Path = path.join(job.jobPublicDir, outputName);

    try {
        console.log(`🚀 [Server] Converting ${type} to perfect MP3 and applying filters...`);
        
        const ffmpegCommand = ffmpeg(targetFile)
            .audioCodec('libmp3lame')
            .audioBitrate('320k') // سرعة ثابتة (CBR) لمنع ظهور مدة غير معروفة (NaN) في المتصفح!
            .format('mp3');

        // تطبيق الفلاتر الخرافية
        if (type === 'vocals') {
            ffmpegCommand.audioFilters([
                'highpass=f=100', 
                'equalizer=f=3000:width_type=h:width=200:g=4', 
                'acompressor=threshold=-15dB:ratio=3:attack=5:release=50'
            ]);
        } else if (type === 'background') {
            ffmpegCommand.audioFilters([
                'equalizer=f=100:width_type=h:width=50:g=3', 
                'equalizer=f=2500:width_type=h:width=500:g=-3', 
                'equalizer=f=10000:width_type=h:width=200:g=5' 
            ]);
        }

        // السحر هنا: نحفظه على القرص أولاً لكي يكتب FFmpeg طول الملف بشكل سليم، ثم نرسله
        ffmpegCommand
            .save(finalMp3Path)
            .on('error', (err) => {
                console.error(`❌ ffmpeg error on ${type}:`, err.message);
                if (!res.headersSent) res.status(500).json({ error: 'Conversion failed' });
            })
            .on('end', () => {
                console.log(`✅ [Server] MP3 ready! Sending ${type} to React safely...`);
                res.download(finalMp3Path, outputName, (err) => {
                    if (type === 'background') {
                        setTimeout(() => {
                            try {
                                if (fs.existsSync(job.inputFile)) fs.rmSync(job.inputFile, { force: true });
                                if (fs.existsSync(job.jobPublicDir)) fs.rmSync(job.jobPublicDir, { recursive: true, force: true });
                                localJobs.delete(req.params.jobId);
                            } catch(e){}
                        }, 10000); 
                    }
                });
            });

    } catch (error) {
        if (!res.headersSent) res.status(500).json({ error: "File streaming error" });
    }
});
// ==========================================
// ✂️ مسار القص الاحترافي (مستقر وآمن 100%)
// ==========================================
router.post('/trim-audio', protect, upload.single('audio_file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Missing audio file" });
    if (!req.body.keptRegions) return res.status(400).json({ error: "Missing regions data" });

    let keptRegions;
    try {
        keptRegions = JSON.parse(req.body.keptRegions);
    } catch (e) {
        return res.status(400).json({ error: "Invalid regions formatting" });
    }

    if (!keptRegions || keptRegions.length === 0) {
        return res.status(400).json({ error: "No regions to keep" });
    }

    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

    const jobId = `trim_${Date.now()}`;
    const inputFile = path.join(uploadsDir, `${jobId}_input.wav`);
    const outputFile = path.join(uploadsDir, `${jobId}_output.mp3`);

    fs.writeFileSync(inputFile, req.file.buffer);

    console.log(`✂️ [Trimmer] Processing ${keptRegions.length} regions securely...`);

    let filterComplex = "";
    let inputs = "";
    
    // بناء فلتر القص بطريقة نظيفة بدون فلاتر تلاعب زمني معقدة
    keptRegions.forEach((region, index) => {
        // نستخدم atrim للقص، ونعيد ضبط الـ PTS لكل مقطع لكي لا يحدث تشوه
        filterComplex += `[0:a]atrim=start=${region.start}:end=${region.end},asetpts=PTS-STARTPTS[a${index}];`;
        inputs += `[a${index}]`;
    });

    // دمج المقاطع (Concat) بطريقة متسلسلة صحيحة
    filterComplex += `${inputs}concat=n=${keptRegions.length}:v=0:a=1[out]`;

    ffmpeg(inputFile)
        .complexFilter(filterComplex, ['out'])
        .audioCodec('libmp3lame')
        .audioBitrate('320k') // جودة الاستوديو
        .save(outputFile)
        .on('error', (err) => {
            console.error(`❌ [Trimmer] FFmpeg Error:`, err.message);
            if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
            if (!res.headersSent) res.status(500).json({ error: 'Audio trimming failed' });
        })
        .on('end', () => {
            console.log(`✅ [Trimmer] Audio trimmed cleanly! Sending to React...`);
            res.download(outputFile, 'Trimmed_Audio.mp3', (err) => {
                setTimeout(() => {
                    try {
                        if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
                        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
                    } catch (e) {}
                }, 5000);
            });
        });
});
export default router;