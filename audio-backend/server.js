import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// تحميل متغيرات البيئة (السرية)
dotenv.config();

// تهيئة تطبيق إكسبريس
const app = express();

// إعدادات الحماية والاتصال (CORS) والسماح باستقبال بيانات JSON
app.use(cors());
app.use(express.json());

// تحديد رقم المنفذ (Port)
const PORT = process.env.PORT || 5000;

// ==========================================
// الروابط (Routes)
// ==========================================

// 1. رابط فحص حالة السيرفر (Health Check)
app.get('/', (req, res) => {
    res.status(200).json({ 
        status: "Online", 
        message: "Audio Master API Server is running! 🚀" 
    });
});

// ==========================================
// تشغيل السيرفر
// ==========================================
app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`🚀 Server is running on port: ${PORT}`);
    console.log(`🔗 Local URL: http://localhost:${PORT}`);
    console.log(`=================================`);
});