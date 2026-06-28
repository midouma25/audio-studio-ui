import sys
import soundfile as sf
import noisereduce as nr
import numpy as np

def process_spectral_print(input_path, output_path, start_time, end_time):
    try:
        # 1. قراءة الملف النقي القادم من المتصفح
        y, sr = sf.read(input_path)

        # 2. تحويل الثواني إلى عينات رقمية دقيقة
        start_sample = int(float(start_time) * sr)
        end_sample = int(float(end_time) * sr)

        # التعامل مع الملفات سواء كانت مونو أو ستيريو
        if len(y.shape) > 1:
            y_mono = np.mean(y, axis=1) # تحويل لنسخة مونو لأخذ البصمة
            noise_print = y_mono[start_sample:end_sample]
        else:
            noise_print = y[start_sample:end_sample]

        # 3. محرك الاستوديو (Spectral Gating)
        # prop_decrease=0.75 : تقوم بمسح 75% من حدة الحرف المزعج لكي لا يبدو الصوت كالروبوت
        # stationary=False : لأن حرف السين متغير وليس ضجيجاً ثابتاً كالمكيف
        reduced_audio = nr.reduce_noise(
            y=y, 
            sr=sr, 
            y_noise=noise_print, 
            prop_decrease=0.75, 
            stationary=False,
            n_std_thresh_stationary=1.5
        )

        # 4. حفظ التحفة الفنية
        sf.write(output_path, reduced_audio, sr)
        print("SUCCESS")
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    # استقبال الأوامر من Node.js
    if len(sys.argv) < 5:
        print("ERROR: Missing arguments")
        sys.exit(1)
        
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    start_t = sys.argv[3]
    end_t = sys.argv[4]
    
    process_spectral_print(input_file, output_file, start_t, end_t)