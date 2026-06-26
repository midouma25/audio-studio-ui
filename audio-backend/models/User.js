// models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    // 1. البيانات الأساسية
    name: { 
        type: String, 
        required: true,
        trim: true 
    },
    email: { 
        type: String, 
        required: true, 
        unique: true, // يمنع تسجيل أكثر من حساب بنفس الإيميل
        lowercase: true 
    },
    password: { 
        type: String, 
        required: true 
    },

    // 2. نظام الأرباح والأرصدة (Monetization & Credits)
    credits: { 
        type: Number, 
        default: 3 // كل مستخدم جديد يحصل على 3 محاولات مجانية فوراً
    },
    lastCreditReset: { 
        type: Date, 
        default: Date.now // يسجل متى كانت آخر مرة حصل فيها على رصيده اليومي
    },
    isPremium: {
        type: Boolean,
        default: false // هل هو مستخدم دافع للاشتراك الشهري؟
    }
}, { 
    timestamps: true 
});

const User = mongoose.model('User', userSchema);
export default User;