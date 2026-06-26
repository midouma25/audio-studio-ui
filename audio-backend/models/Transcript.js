// models/Transcript.js
import mongoose from 'mongoose';

// 1. المخطط الفرعي (لكل جملة مفردة في التايم لاين)
const chunkSchema = new mongoose.Schema({
    id: Number,
    startTime: Number,
    endTime: Number,
    text: String,
    translatedText: String,
    timeString: String,
    speaker: String     
}, { _id: false }); // منع إنشاء ID فرعي لكل جملة لتوفير مساحة التخزين

// 2. المخطط الرئيسي (للملف الصوتي بالكامل)
const transcriptSchema = new mongoose.Schema({
    fileName: { 
        type: String, 
        required: true 
    },
    audioLanguage: { 
        type: String, 
        default: 'auto' 
    },
    translateTo: { 
        type: String, 
        default: 'none' 
    },
    chunks: [chunkSchema] // نربط المخطط الفرعي هنا كمصفوفة
}, { 
    timestamps: true // سحر Mongoose: يضيف تلقائياً وقت إنشاء الملف ووقت آخر تعديل
});

// إنشاء النموذج وتصديره
const Transcript = mongoose.model('Transcript', transcriptSchema);

export default Transcript;