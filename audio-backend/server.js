import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';

// تحميل المتغيرات السرية
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// إعداد Multer لاستلام الملف الصوتي وحفظه مؤقتاً في الذاكرة (Buffer)
const upload = multer({ storage: multer.memoryStorage() });

const PORT = process.env.PORT || 5000;
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

// دالة مساعدة لتنسيق الوقت
const formatShortTime = (timeInSeconds) => {
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// ==========================================
// 1. مسار فحص حالة السيرفر
// ==========================================
app.get('/', (req, res) => {
    res.status(200).json({ status: "Online", message: "Audio Master API Server is running! 🚀" });
});

// ==========================================
// 2. المحرك الرئيسي (مسار التفريغ والترجمة)
// ==========================================
// هذا المسار يستقبل ملفاً اسمه 'audio_file' وبيانات نصية (اللغة)
app.post('/api/transcribe', upload.single('audio_file'), async (req, res) => {
    try {
        console.log("📥 [Server] Received new audio file...");

        // التحقق من وجود الملف والمفتاح
        if (!req.file) throw new Error("No audio file uploaded.");
        if (!ASSEMBLYAI_API_KEY) throw new Error("AssemblyAI API Key is missing in server .env file.");

        // استخراج خيارات المستخدم من الطلب
        const audioLanguage = req.body.language || "auto";
        const translateTo = req.body.translate_to || "none";

        console.log("🚀 [Server 1/4] Uploading to AssemblyAI...");
        const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
            method: "POST",
            headers: { 
                "authorization": ASSEMBLYAI_API_KEY,
                "Content-Type": "application/octet-stream"
            },
            body: req.file.buffer // نرسل الملف من ذاكرة السيرفر مباشرة
        });
        const uploadData = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(uploadData.error);

        console.log("🧠 [Server 2/4] Requesting Transcription...");
        const transcriptResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
            method: "POST",
            headers: {
                "authorization": ASSEMBLYAI_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                audio_url: uploadData.upload_url,
                language_detection: audioLanguage === "auto",
                language_code: audioLanguage !== "auto" ? audioLanguage : undefined,
            }),
        });
        const transcriptDataReq = await transcriptResponse.json();
        if (!transcriptResponse.ok) throw new Error(transcriptDataReq.error);

        console.log("⏳ [Server 3/4] Polling for results...");
        let status = "queued";
        let finalResult = null;
        while (status === "queued" || status === "processing") {
            await new Promise(resolve => setTimeout(resolve, 3000));
            const pollingResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptDataReq.id}`, {
                headers: { "authorization": ASSEMBLYAI_API_KEY }
            });
            finalResult = await pollingResponse.json();
            status = finalResult.status;
            if (status === "error") throw new Error(finalResult.error);
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

            // محرك الترجمة
            if (translateTo !== "none") {
                const detectedLang = finalResult.language_code || "ja";
                for (let i = 0; i < groupedChunks.length; i++) {
                    try {
                        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(groupedChunks[i].text)}&langpair=${detectedLang}|${translateTo}`);
                        const data = await res.json();
                        if (data?.responseData?.translatedText) {
                            groupedChunks[i].translatedText = data.responseData.translatedText;
                        }
                    } catch (e) {
                        console.error("Translation Error", e);
                    }
                    await new Promise(r => setTimeout(r, 400));
                }
            }
        }

        console.log("✅ [Server] Processing complete! Sending data to Client.");
        // إرسال النتيجة النهائية كـ JSON إلى متصفح المستخدم (React)
        res.status(200).json({ chunks: groupedChunks });

    } catch (error) {
        console.error("❌ [Server Error]:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// تشغيل السيرفر
// ==========================================
app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`🚀 API Server running on port: ${PORT}`);
    console.log(`=================================`);
});