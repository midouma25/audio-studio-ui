// نجلب المفتاح السري من الخزنة
const API_KEY = import.meta.env.VITE_ASSEMBLY_API_KEY;
const BASE_URL = "https://api.assemblyai.com/v2";

export async function processAudioWithAI(file, logCallback) {
  try {
    // ==========================================
    // الخطوة 1: رفع الملف الصوتي
    // ==========================================
    logCallback("> [API] Uploading audio to secure cloud...");
    
    const uploadResponse = await fetch(`${BASE_URL}/upload`, {
      method: "POST",
      headers: { authorization: API_KEY },
      body: file,
    });
    
    const uploadData = await uploadResponse.json();
    const audioUrl = uploadData.upload_url;
    logCallback("> [API] Upload complete. Initiating AI engine...");

    // ==========================================
    // الخطوة 2: طلب التفريغ الصوتي
    // ==========================================
    const transcriptResponse = await fetch(`${BASE_URL}/transcript`, {
      method: "POST",
      headers: {
        authorization: API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ audio_url: audioUrl }),
    });

    const transcriptData = await transcriptResponse.json();
    const transcriptId = transcriptData.id;
    logCallback(`> [System] AI processing started (ID: ${transcriptId})...`);

    // ==========================================
    // الخطوة 3: الانتظار حتى تنتهي المعالجة (Polling)
    // ==========================================
    while (true) {
      const pollingResponse = await fetch(`${BASE_URL}/transcript/${transcriptId}`, {
        headers: { authorization: API_KEY },
      });
      const pollingData = await pollingResponse.json();

      if (pollingData.status === "completed") {
        logCallback("> [Success] AI processing complete! ✨");
        return pollingData.words; // نُعيد مصفوفة الكلمات وتوقيتاتها الحقيقية
      } else if (pollingData.status === "error") {
        throw new Error("AI Processing failed");
      } else {
        // إذا كان لا يزال يعمل، ننتظر 3 ثوانٍ ثم نسأل مرة أخرى
        logCallback(`> [System] Status: ${pollingData.status}...`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  } catch (error) {
    logCallback(`> [Error] ${error.message}`);
    return null;
  }
}