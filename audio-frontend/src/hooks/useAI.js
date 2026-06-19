import { useState, useEffect } from 'react';
import { pipeline, env } from '@xenova/transformers';

// نحن في متصفح، لذا نمنع المكتبة من البحث عن النماذج في ملفات النظام المحلية
env.allowLocalModels = false;

export function useAI() {
  // حالة التطبيق: هل النموذج جاهز؟
  const [isReady, setIsReady] = useState(false);
  // حالة التطبيق: الأداة التي ستقوم بالتفريغ
  const [transcriber, setTranscriber] = useState(null);

  useEffect(() => {
    // دالة غير متزامنة لتحميل النموذج
    async function loadModel() {
      console.log("[System] Initializing AI Engine...");
      
      // جلب نموذج Whisper المصغر الخاص بـ OpenAI
      const aiPipeline = await pipeline(
        'automatic-speech-recognition', 
        'Xenova/whisper-tiny.en'
      );
      
      setTranscriber(() => aiPipeline);
      setIsReady(true);
      
      console.log("[System] AI Engine is Ready & Loaded into Browser!");
    }

    loadModel();
  }, []); // القوسان الفارغان يعنيان: نفذ هذا الكود مرة واحدة فقط عند فتح الصفحة

  return { isReady, transcriber };
}