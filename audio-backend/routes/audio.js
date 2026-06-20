// routes/audio.js
import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv'; // +++ 1. استيراد المكتبة هنا

dotenv.config(); // +++ 2. تشغيلها فوراً قبل قراءة المفتاح

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// +++ الآن سيتمكن من رؤية المفتاح بنجاح! +++
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

router.post('/transcribe', upload.single('audio_file'), validateAIRequest, async (req, res, next) => {
    try {
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
                const isPause = finalResult.words[i+1] && (finalResult.words[i+1].start - finalResult.words[i].end > 400);
                if (isPause || currentChunk.length >= 10 || i === finalResult.words.length - 1) {
                    groupedChunks.push({
                        id: groupedChunks.length,
                        startTime: currentChunk[0].start / 1000,
                        endTime: currentChunk[currentChunk.length - 1].end / 1000,
                        text: currentChunk.map(w => w.text).join(audioLanguage === 'ja' ? "" : " "),
                        translatedText: null,
                        timeString: formatShortTime(currentChunk[0].start / 1000)
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

        console.log("✅ [Server] Processing complete! Sending data to Client.");
        res.status(200).json({ chunks: groupedChunks });

    } catch (error) {
        next(error); 
    }
});

export default router;