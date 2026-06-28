import sys
import librosa
import soundfile as sf
import noisereduce as nr
import numpy as np

def process_de_ess(input_path, output_path, start_time, end_time):
    try:
        # 1. تحميل الملف الصوتي بدقته الأصلية
        y, sr = librosa.load(input_path, sr=None)

        # 2. تحويل الثواني إلى عينات (Samples) دقيقة
        start_sample = int(float(start_time) * sr)
        end_sample = int(float(end_time) * sr)

        # 3. استخراج "البصمة" (صوت حرف السين المزعج الذي حدده المستخدم في المربع الأصفر)
        noise_print = y[start_sample:end_sample]

        # 4. السحر: تطبيق خوارزمية Spectral Gating لحذف هذه البصمة من الملف بالكامل!
        # prop_decrease=0.85 تعني أننا سنمسح 85% من قوة هذا الحرف المزعج لكي لا نشوه الصوت الطبيعي
        reduced_audio = nr.reduce_noise(y=y, y_noise=noise_print, sr=sr, prop_decrease=0.85, n_fft=2048)

        # 5. حفظ الملف الجديد المعالج
        sf.write(output_path, reduced_audio, sr)
        print("SUCCESS")
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 5:
        print("ERROR: Missing arguments")
        sys.exit(1)
        
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    start_t = sys.argv[3]
    end_t = sys.argv[4]
    
    process_de_ess(input_file, output_file, start_t, end_t)