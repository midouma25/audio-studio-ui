// routes/audio.js
import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv'; 
import Transcript from '../models/Transcript.js';
// +++ 1. استيراد حارس البوابة الأمنية
import { protect } from '../middleware/authMiddleware.js';

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
    console.log("🛡️ [Router Middleware] Validating request data...");
    
    // فحص المفتاح
    if (!ASSEMBLYAI_API_KEY) {
        return next(new Error("Server Configuration Error: Missing API Key"));
    }
    
    // فحص الملف
    if (!req.file) {
        const error = new Error("Bad Request: No audio file provided");
        error.statusCode = 400;
        return next(error);
    }
    
    console.log("✅ [Router Middleware] Validation passed.");
    next(); 
};

// +++ 2. إضافة protect كحارس أول قبل رفع الملف +++
router.post('/transcribe', protect, upload.single('audio_file'), validateAIRequest, async (req, res, next) => {
    try {
        // +++ 3. فحص رصيد المستخدم قبل البدء بأي عملية مكلفة +++
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
                speaker_labels: true, // +++ هذا هو السطر السحري لتفعيل التفرقة بين الأصوات +++
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
                
                // +++ متى نقوم بقص الجملة؟ إذا كان هناك سكوت، أو طالت الجملة، أو "تغير المتحدث" +++
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
                        speaker: currentChunk[0].speaker || "A" // +++ حفظ حرف المتحدث (A, B, C...) +++
                    });
                    currentChunk = [];
                }
            }

            // ... (بقية كود الترجمة translateTo كما هو بدون تغيير)

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
        
        // إنشاء سجل جديد في قاعدة البيانات
        const newTranscript = new Transcript({
            fileName: req.file.originalname,
            audioLanguage: audioLanguage,
            translateTo: translateTo,
            chunks: groupedChunks
        });

        // حفظ السجل فعلياً
        const savedData = await newTranscript.save();
        console.log(`✅ [Database] Saved successfully with ID: ${savedData._id}`);

        // +++ 4. خصم 1 رصيد من حساب المستخدم وتحديث قاعدة البيانات +++
        req.user.credits -= 1;
        await req.user.save();
        console.log(`🪙 [Credits] Deducted 1 credit from ${req.user.email}. Remaining: ${req.user.credits}`);

        console.log("✅ [Server] Processing complete! Sending data to Client.");
        
        // أضفنا ID قاعدة البيانات والرصيد المتبقي للرد
        res.status(200).json({ 
            transcriptId: savedData._id,
            chunks: groupedChunks,
            remainingCredits: req.user.credits // +++ 5. إرسال الرصيد الجديد للواجهة الأمامية
        });

    } catch (error) {
        next(error); 
    }
});

// ==========================================
// 📂 مسار جلب قائمة كل الملفات السابقة (للوحة التحكم)
// ==========================================
router.get('/transcripts', async (req, res, next) => {
    try {
        console.log("📜 [Server] Fetching all transcript history...");
        
        // جلب البيانات من Mongoose
        const history = await Transcript.find()
            .select('-chunks') 
            .sort({ createdAt: -1 });

        console.log(`✅ [Database] Found ${history.length} saved transcripts.`);
        res.status(200).json({ history });
    } catch (error) {
        next(error); 
    }
});


router.get('/transcript/:id', async (req, res, next) => {
    try {
        const transcriptId = req.params.id;
        console.log(`🔍 [Server] Fetching transcript with ID: ${transcriptId}`);
        const transcript = await Transcript.findById(transcriptId);
        if (!transcript) {
            return res.status(404).json({ error: "Transcript not found" });
        }
        res.status(200).json({ chunks: transcript.chunks });
    } catch (error) {
        next(error); 
    }
});
// routes/audio.js

// ==========================================
// ✂️ ميزة القص الذكي للفراغات (Smart Silence Trimmer)
// ==========================================
router.post('/trim-silence/:id', protect, async (req, res, next) => {
    try {
        const transcriptId = req.params.id;
        const { mode } = req.body;
        console.log(`✂️ [AI Tool] Trimming silence (Mode: ${mode}) for ID: ${transcriptId}`);

        const transcript = await Transcript.findById(transcriptId);
        if (!transcript) return res.status(404).json({ error: "Project not found" });

        let originalChunks = transcript.chunks;
        if (originalChunks.length <= 1) {
            return res.status(200).json({ chunks: originalChunks, timeSaved: 0, keptRegions: [], message: "Audio too short." });
        }

        let trimmedChunks = [];
        let timeOffset = 0; 
        
        // +++ تحديث الشراسة: عتبات أقل وقص أدق +++
        // الخيار الصارم: يقص أي فراغ أكبر من 0.15 ثانية (بدلاً من 0.3)
        // الخيار الطبيعي: يقص أي فراغ أكبر من 0.8 ثانية (بدلاً من 1.2)
        const maxAllowedSilence = mode === "ai_speech" ? 0.15 : 0.8; 
        
        // حواف الأمان: 0.05 ثانية فقط للخيار الصارم لكي لا يترك هواءً زائداً
        const padding = mode === "ai_speech" ? 0.05 : 0.2;

        let keptRegions = [];
        let currentKeepStart = 0;

        trimmedChunks.push({ ...originalChunks[0].toObject(), id: 0 });

        for (let i = 1; i < originalChunks.length; i++) {
            const prevChunk = originalChunks[i - 1];
            const currentChunk = originalChunks[i];
            const silenceDuration = currentChunk.startTime - prevChunk.endTime;

            if (silenceDuration > maxAllowedSilence) {
                // حفظ المنطقة مع حافة أمان صغيرة جداً
                keptRegions.push({ start: currentKeepStart, end: prevChunk.endTime + padding });
                currentKeepStart = currentChunk.startTime - padding;
                
                // حساب الوقت المقطوع الحقيقي (بعد خصم حواف الأمان من الطرفين)
                const amountToTrim = silenceDuration - (padding * 2);
                timeOffset += amountToTrim; 
            }

            const newStartTime = currentChunk.startTime - timeOffset;
            const newEndTime = currentChunk.endTime - timeOffset;

            const mins = Math.floor(newStartTime / 60);
            const secs = Math.floor(newStartTime % 60);
            const newTimeString = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

            trimmedChunks.push({
                id: trimmedChunks.length,
                startTime: newStartTime,
                endTime: newEndTime,
                text: currentChunk.text,
                translatedText: currentChunk.translatedText,
                timeString: newTimeString,
                speaker: currentChunk.speaker
            });
        }

        keptRegions.push({ start: currentKeepStart, end: 999999 });

        // إضافة آخر منطقة صالحة حتى نهاية الملف الصوتي
        keptRegions.push({ start: currentKeepStart, end: 999999 });

        transcript.chunks = trimmedChunks;
        await transcript.save();

        console.log(`✅ [AI Tool] Silence trimmed! Offset removed: ${timeOffset.toFixed(2)}s`);
        res.status(200).json({ 
            chunks: trimmedChunks, 
            timeSaved: timeOffset,
            keptRegions: keptRegions // +++ إرسال الخريطة للفرونت إند +++
        });

    } catch (error) {
        next(error);
    }
});
export default router;