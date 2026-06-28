# run_demucs.py
import sys
import torchaudio
import soundfile as sf
import torch
import numpy as np

# =========================================================
# 🏴‍☠️ الهندسة العكسية القاضية (The Ultimate Hijack)
# =========================================================

def custom_load(filepath, *args, **kwargs):
    # قراءة الملف بمكتبة soundfile المستقرة جداً على ويندوز
    data, sr = sf.read(str(filepath), dtype='float32')
    
    if data.ndim == 1:
        data = data.reshape(1, -1)
    else:
        data = np.copy(data.T)
        
    return torch.from_numpy(data), sr

# +++ تم إصلاح اسم المتغير هنا ليصبح sample_rate كما يطلبه PyTorch +++
def custom_save(filepath, src, sample_rate=44100, *args, **kwargs):
    data = src.cpu().numpy()
    if data.ndim == 2:
        data = np.copy(data.T)
        
    # حفظ الملف بنجاح!
    sf.write(str(filepath), data, samplerate=sample_rate)

# تدمير دوال torchaudio الأصلية وحقن دوالنا الخارقة مكانها
torchaudio.load = custom_load
torchaudio.save = custom_save

from demucs.separate import main

if __name__ == "__main__":
    sys.argv[0] = "demucs"
    main()