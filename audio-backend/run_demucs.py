import sys
import os
import torch
import torchaudio
import soundfile as sf
from demucs.pretrained import get_model
from demucs.apply import apply_model

def process_chunked(input_path, output_dir, shifts_val, overlap_val):
    if not torch.cuda.is_available():
        print("[FATAL ERROR] CUDA NOT FOUND!")
        sys.stdout.flush()
        sys.exit(1)

    device = torch.device("cuda")
    print(f"[AI] Model Loading to {torch.cuda.get_device_name(0)}...")
    
    # تحميل המوديل المحسن
    model = get_model('htdemucs_ft').to(device)
    
    wav, sr = torchaudio.load(input_path)
    wav = torchaudio.functional.resample(wav, sr, model.samplerate)
    
    if wav.shape[0] == 1: wav = wav.repeat(2, 1)
    wav = wav.to(device)

    print(f"[AI] Processing chunks (Shifts: {shifts_val}, Overlap: {overlap_val})...")
    sys.stdout.flush()
    
    out = apply_model(
        model, 
        wav[None], 
        device=device, 
        shifts=shifts_val, 
        split=True, 
        overlap=overlap_val, 
        segment=2, 
        progress=False
    )[0]

    print("[AI] Saving HD Vocals and Instrumentals...")
    sys.stdout.flush()
    
    vocals = out[3].cpu().numpy()
    background = (out[0] + out[1] + out[2]).cpu().numpy()

    base_name = os.path.splitext(os.path.basename(input_path))[0]
    out_folder = os.path.join(output_dir, 'htdemucs_ft', base_name)
    os.makedirs(out_folder, exist_ok=True)
    
    vocals_path = os.path.join(out_folder, 'vocals.wav')
    background_path = os.path.join(out_folder, 'background.wav')
    
    sf.write(vocals_path, vocals.T, model.samplerate, subtype='PCM_16')
    sf.write(background_path, background.T, model.samplerate, subtype='PCM_16')
    
    del model, wav, out
    torch.cuda.empty_cache()
    
    print("[SIGNAL_SUCCESS]")
    sys.stdout.flush()
    sys.exit(0)

if __name__ == "__main__":
    try:
        input_file = sys.argv[4]
        output_folder = sys.argv[6]
        shifts_arg = int(sys.argv[7]) if len(sys.argv) > 7 else 1
        overlap_arg = float(sys.argv[8]) if len(sys.argv) > 8 else 0.1
        
        process_chunked(input_file, output_folder, shifts_arg, overlap_arg)
    except Exception as e:
        print(f"[SIGNAL_ERROR] {str(e)}")
        sys.stdout.flush()
        sys.exit(1)