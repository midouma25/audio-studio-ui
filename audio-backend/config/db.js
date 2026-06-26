// config/db.js
import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        // محاولة الاتصال بقاعدة البيانات باستخدام الرابط من ملف .env
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`📦 [Database] MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ [Database Error] MongoDB Connection Failed: ${error.message}`);
        // إيقاف السيرفر فوراً إذا فشل الاتصال بقاعدة البيانات (لأن السيرفر لا فائدة منه بدون بيانات)
        process.exit(1); 
    }
};

export default connectDB;