import os
import shutil
import numpy as np
import librosa
import soundfile as sf
import noisereduce as nr
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

app = FastAPI(title="Pro AI Audio Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "workspace/uploads"
PROCESSED_DIR = "workspace/processed"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

@app.post("/api/process")
async def process_audio(
    file: UploadFile = File(...),
    applyTrim: str = Form("false"),
    applyNoise: str = Form("false"),
    applyStudio: str = Form("false")
):
    try:
        input_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(input_path, "wb+") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 1. تحميل الصوت بدقة الاستوديو (Sample Rate = 44100Hz)
        y, sr = librosa.load(input_path, sr=44100)

        # 2. 🔇 العزل الاحترافي (AI Noise Reduction)
        if applyNoise == "true":
            # استخدام النمط غير الثابت (Non-stationary) ليكون ذكياً كـ Adobe Podcast
            # وتقليل القوة لـ 0.75 لكي لا يبدو الصوت كأنه تحت الماء
            y = nr.reduce_noise(y=y, sr=sr, stationary=False, prop_decrease=0.75, n_std_thresh_stationary=1.5)

        # 3. ✨ تلميع الاستوديو (Studio EQ & Normalization)
        if applyStudio == "true":
            # فلتر Pre-emphasis (لإعطاء حدة ونقاء لصوت المتحدث)
            y = librosa.effects.preemphasis(y, coef=0.95)
            # رفع مستوى الصوت للمعيار الإذاعي دون تشويه
            y = librosa.util.normalize(y)

        # 4. ✂️ قص الصمت السينمائي (Smooth Silence Trimming)
        if applyTrim == "true":
            # كشف الفترات التي لا يوجد بها كلام (بمعدل 30 ديسيبل تحت الحد الأقصى)
            non_mute_intervals = librosa.effects.split(y, top_db=30, frame_length=2048, hop_length=512)
            
            chunks = []
            # إضافة هامش صغير جداً (Padding) لكي لا نبتُر تنفس المتحدث
            padding = int(0.1 * sr) 
            
            for interval in non_mute_intervals:
                start = max(0, interval[0] - padding)
                end = min(len(y), interval[1] + padding)
                chunks.append(y[start:end])
            
            if chunks:
                # دمج المقاطع الصحيحة فقط
                y = np.concatenate(chunks)

        # 5. حفظ الملف بـ 24-bit WAV (أعلى جودة ممكنة)
        output_filename = f"AI_Mastered_{file.filename.rsplit('.', 1)[0]}.wav"
        output_path = os.path.join(PROCESSED_DIR, output_filename)
        
        sf.write(output_path, y, sr, subtype='PCM_24')

        return FileResponse(output_path, media_type="audio/wav", filename=output_filename)

    except Exception as e:
        return {"error": str(e)}