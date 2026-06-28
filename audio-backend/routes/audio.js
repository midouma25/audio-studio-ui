import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv'; 
import Transcript from '../models/Transcript.js';
import { protect } from '../middleware/authMiddleware.js';

// استدعاء محرك FFmpeg
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

// +++ السطر الذي كان مفقوداً (لجعل Node.js قادراً على تشغيل Python) +++
import { spawn } from 'child_process'; 

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// تعريف مسار FFmpeg الداخلي
ffmpeg.setFfmpegPath(ffmpegPath);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config(); 
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

const formatShortTime = (timeInSeconds) => {
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const validateAIRequest = (req, res, next) => {
    if (!ASSEMBLYAI_API_KEY) {
        return next(new Error("Server Configuration Error: Missing API Key"));
    }
    if (!req.file) {
        const error = new Error("Bad Request: No audio file provided");
        error.statusCode = 400;
        return next(error);
    }
    next(); 
};

// ==========================================
// 🚀 مسار الذكاء الاصطناعي (AssemblyAI)
// ==========================================
router.post('/transcribe', protect, upload.single('audio_file'), validateAIRequest, async (req, res, next) => {
    try {
        if (req.user.credits <= 0 && !req.user.isPremium) {
            return res.status(402).json({ error: "Payment Required: You have 0 credits left for today!" });
        }

        const audioLanguage = req.body.language || "auto";
        const translateTo = req.body.translate_to || "none";

        console.log("🚀 [Server 1/4] Uploading to AssemblyAI...");
        const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
            method: "POST",
            headers: { 
                "authorization": ASSEMBLYAI_API_KEY,
                "Content-Type": "application/octet-stream"
            },
            body: req.file.buffer 
        });
        
        if (!uploadResponse.ok) {
            const uploadError = await uploadResponse.json();
            throw new Error(`AssemblyAI Upload Failed: ${uploadError.error || uploadResponse.statusText}`);
        }
        const uploadData = await uploadResponse.json();
        const uploadUrl = uploadData.upload_url;
        
        console.log("🧠 [Server 2/4] Requesting Transcription...");
        const transcriptResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
            method: "POST",
            headers: {
                "authorization": ASSEMBLYAI_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                audio_url: uploadUrl,
                language_detection: audioLanguage === "auto",
                language_code: audioLanguage !== "auto" ? audioLanguage : undefined,
                speaker_labels: true,
            }),
        });        
        
        if (!transcriptResponse.ok) {
            const transcriptError = await transcriptResponse.json();
            throw new Error(`AssemblyAI Transcription Request Failed: ${transcriptError.error || transcriptResponse.statusText}`);
        }
        const transcriptDataReq = await transcriptResponse.json();
        const transcriptId = transcriptDataReq.id;

        console.log("⏳ [Server 3/4] Polling for results...");
        let status = "queued";
        let finalResult = null;
        while (status === "queued" || status === "processing") {
            await new Promise(resolve => setTimeout(resolve, 3000));
            const pollingResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
                headers: { "authorization": ASSEMBLYAI_API_KEY }
            });
            finalResult = await pollingResponse.json();
            status = finalResult.status;
            if (status === "error") throw new Error(`AssemblyAI Processing Error: ${finalResult.error}`);
        }

        console.log("🛠️ [Server 4/4] Structuring and Translating...");
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
                        id: groupedChunks.length,
                        startTime: currentChunk[0].start / 1000,
                        endTime: currentChunk[currentChunk.length - 1].end / 1000,
                        text: currentChunk.map(w => w.text).join(audioLanguage === 'ja' ? "" : " "),
                        translatedText: null,
                        timeString: formatShortTime(currentChunk[0].start / 1000),
                        speaker: currentChunk[0].speaker || "A" 
                    });
                    currentChunk = [];
                }
            }

            if (translateTo !== "none") {
                const detectedLang = finalResult.language_code || "ja";
                for (let i = 0; i < groupedChunks.length; i++) {
                    const resTranslate = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(groupedChunks[i].text)}&langpair=${detectedLang}|${translateTo}`);
                    const data = await resTranslate.json();
                    if (data?.responseData?.translatedText) {
                        groupedChunks[i].translatedText = data.responseData.translatedText;
                    }
                    await new Promise(r => setTimeout(r, 400));
                }
            }
        }

        console.log("💾 [Server] Saving transcript to Database...");
        const newTranscript = new Transcript({
            fileName: req.file.originalname,
            audioLanguage: audioLanguage,
            translateTo: translateTo,
            chunks: groupedChunks
        });

        const savedData = await newTranscript.save();
        console.log(`✅ [Database] Saved successfully with ID: ${savedData._id}`);

        req.user.credits -= 1;
        await req.user.save();
        
        res.status(200).json({ 
            transcriptId: savedData._id,
            chunks: groupedChunks,
            remainingCredits: req.user.credits 
        });

    } catch (error) {
        next(error); 
    }
});

// ==========================================
// 📂 مسار جلب قائمة الملفات
// ==========================================
router.get('/transcripts', async (req, res, next) => {
    try {
        const history = await Transcript.find().select('-chunks').sort({ createdAt: -1 });
        res.status(200).json({ history });
    } catch (error) {
        next(error); 
    }
});

router.get('/transcript/:id', async (req, res, next) => {
    try {
        const transcript = await Transcript.findById(req.params.id);
        if (!transcript) return res.status(404).json({ error: "Transcript not found" });
        res.status(200).json({ chunks: transcript.chunks });
    } catch (error) {
        next(error); 
    }
});

// ==========================================
// ✂️ مسار القص الذكي 
// ==========================================
router.post('/trim-silence/:id', protect, async (req, res, next) => {
    try {
        const transcript = await Transcript.findById(req.params.id);
        if (!transcript) return res.status(404).json({ error: "Project not found" });

        const { mode } = req.body;
        let originalChunks = transcript.chunks;
        if (originalChunks.length === 0) {
            return res.status(200).json({ chunks: [], timeSaved: 0, keptRegions: [] });
        }

        const maxAllowedSilence = mode === "ai_speech" ? 0.25 : 0.8; 
        const padding = mode === "ai_speech" ? 0.15 : 0.3;

        let rawRegions = originalChunks.map(c => ({
            start: Math.max(0, c.startTime - padding),
            end: c.endTime + padding
        }));

        let keptRegions = [];
        if (rawRegions.length > 0) {
            let current = rawRegions[0];
            for (let i = 1; i < rawRegions.length; i++) {
                const gap = originalChunks[i].startTime - originalChunks[i-1].endTime;
                if (gap <= maxAllowedSilence) {
                    current.end = Math.max(current.end, rawRegions[i].end);
                } else {
                    keptRegions.push({...current});
                    current = rawRegions[i];
                }
            }
            keptRegions.push({...current});
        }

        const getNewTime = (oldTime) => {
            let newTime = 0;
            for (let region of keptRegions) {
                if (oldTime < region.start) break;
                if (oldTime >= region.start && oldTime <= region.end) {
                    newTime += (oldTime - region.start);
                    break;
                }
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
            
            trimmedChunks.push({
                ...currentChunk.toObject(),
                startTime: newStartTime,
                endTime: newEndTime,
                timeString: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
            });
        }

        transcript.chunks = trimmedChunks;
        await transcript.save();

        let timeSaved = keptRegions[0].start; 
        for (let i = 1; i < keptRegions.length; i++) {
            timeSaved += (keptRegions[i].start - keptRegions[i - 1].end);
        }

        res.status(200).json({ chunks: trimmedChunks, timeSaved: timeSaved, keptRegions: keptRegions });
    } catch (error) {
        next(error);
    }
});

// ==========================================
// 🎯 محرك الـ De-Esser الاحترافي (FFmpeg Studio Engine)
// ==========================================
router.post('/extract-fingerprint', protect, upload.single('audio_file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Missing audio file" });
    }

    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir);
    }

    const inputFileName = `Input_${Date.now()}.wav`;
    const inputFile = path.join(uploadsDir, inputFileName);
    const outputFile = path.join(uploadsDir, `Studio_DeEssed_${Date.now()}.wav`);
    
    fs.writeFileSync(inputFile, req.file.buffer);
    console.log(`🎛️ [Studio Engine] Running Professional De-Esser via FFmpeg...`);
    
    ffmpeg(inputFile)
        .audioFilters([
            'deesser=i=0.01:m=0.05:f=0.8:s=o', // الفلتر النقي لإزالة السين
            'equalizer=f=3000:width_type=h:width=200:g=2', // تلميع الصوت
            'highpass=f=80' // إزالة الهمهمة (Rumble)
        ])
        .save(outputFile)
        .on('end', () => {
            console.log("✅ [Studio Engine] Audio Mastered Successfully! Sending to client...");
            res.download(outputFile, 'Studio_DeEssed.wav', () => {
                try {
                    if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
                    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
                } catch (err) {
                    console.error("Cleanup error:", err);
                }
            });
        })
        .on('error', (err) => {
            console.error(`❌ [Studio Engine] FFmpeg Error: ${err.message}`);
            if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
            res.status(500).json({ error: "Audio processing failed." });
        });
});

// ==========================================
// 🪓 السلاح النووي: مسار عزل الصوت عن الموسيقى (Fast Production Mode)
// ==========================================
router.post('/split-vocals', protect, upload.single('audio_file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Missing audio file" });

    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

    const inputFileName = `Input_${Date.now()}.wav`;
    const inputFile = path.join(uploadsDir, inputFileName);
    fs.writeFileSync(inputFile, req.file.buffer);

    const outputDir = path.join(uploadsDir, `Demucs_${Date.now()}`);

    console.log(`🤖 [AI Engine] Running Fast Demucs Model...`);

    // +++ 1. استخدمنا htdemucs السريع جداً بدلاً من mdx_extra الثقيل +++
    const pythonProcess = spawn('python', [
        'run_demucs.py',
        '-n', 'htdemucs', // أسرع بـ 3 أضعاف ويخفف الضغط عن الرامات
        '--two-stems=vocals', 
        inputFile,
        '-o', outputDir
    ]);

    pythonProcess.stdout.on('data', (data) => console.log(`[Demucs AI]: ${data.toString().trim()}`));
    pythonProcess.stderr.on('data', (data) => console.error(`[Demucs Log]: ${data.toString().trim()}`));

    pythonProcess.on('close', (code) => {
        // لاحظ أن المجلد أصبح اسمه htdemucs بدلاً من mdx_extra
        const modelOutDir = path.join(outputDir, 'htdemucs', inputFileName.replace('.wav', ''));
        const vocalsFile = path.join(modelOutDir, 'vocals.wav');

        if (code === 0 && fs.existsSync(vocalsFile)) {
            console.log("✅ [AI Engine] Vocals Isolated! Streaming to client smoothly...");
            
            // +++ 2. الحل السحري: إرسال الملف بنظام Stream لمنع توقف السيرفر نهائياً +++
            res.download(vocalsFile, 'Isolated_Vocals.wav', (err) => {
                // +++ 3. التنظيف يتم بذكاء *بعد* أن ينتهي تحميل الملف للمتصفح +++
                try {
                    if (fs.existsSync(inputFile)) fs.rmSync(inputFile, { force: true });
                    if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true, force: true });
                } catch (e) { console.error("Cleanup Error:", e); }
            });

        } else {
            console.error("❌ [AI Engine] Demucs failed to isolate audio.");
            try { fs.rmSync(inputFile, { force: true }); } catch (e) {}
            res.status(500).json({ error: "AI Vocal Splitting failed." });
        }
    });
});

export default router;