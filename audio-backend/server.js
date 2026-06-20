// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// استيراد راوتر الصوتيات المعياري الجديد
import audioRouter from './routes/audio.js';

// تحميل متغيرات البيئة السرية
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// ==========================================
// 🛠️ البرمجيات الوسيطة العامة (Global Middlewares)
// ==========================================
const requestLogger = (req, res, next) => {
    console.log(`\n[${new Date().toLocaleTimeString()}] 🌐 ${req.method} Request at: ${req.url}`);
    next(); 
};
app.use(requestLogger);

// ==========================================
// 🔗 ربط واستدعاء الموديلات والمسارات (Routes Mounting)
// ==========================================
// نخبر إكسبريس أن أي طلب يبدأ بـ /api يجب توجيهه فوراً لملف audioRouter
app.use('/api', audioRouter);

app.get('/', (req, res) => {
    res.status(200).json({ status: "Online", message: "Audio Master API Server is running! 🚀" });
});

// ==========================================
// 🚨 محطة الطوارئ المركزية العالمية (Global Error Handler)
// ==========================================
app.use((err, req, res, next) => {
    console.error(`\n💥 [Global Error Handler] Caught an error!`);
    console.error(`📝 Message: ${err.message}`);
    
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        error: "Internal Server Error",
        message: err.message
    });
});

// ==========================================
app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`🚀 API Server running on port: ${PORT}`);
    console.log(`=================================`);
});