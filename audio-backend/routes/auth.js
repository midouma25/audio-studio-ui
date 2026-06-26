// routes/auth.js
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protect } from '../middleware/authMiddleware.js';
const router = express.Router();

// ==========================================
// 1. إنشاء حساب جديد (Sign Up)
// ==========================================
router.post('/signup', async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        // 1. التحقق من أن المستخدم لم ينسَ أي حقل
        if (!name || !email || !password) {
            return res.status(400).json({ error: "Please provide all required fields." });
        }

        // 2. التحقق مما إذا كان الإيميل مسجلاً مسبقاً
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "Email is already registered." });
        }

        // 3. تشفير كلمة المرور (Hashing)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 4. حفظ المستخدم الجديد في قاعدة البيانات (سيحصل تلقائياً على 3 محاولات مجانية)
        const newUser = new User({
            name,
            email,
            password: hashedPassword
        });
        const savedUser = await newUser.save();

        // 5. إصدار التذكرة الرقمية (Token)
        const token = jwt.sign({ userId: savedUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        console.log(`✅ [Auth] New user registered: ${email}`);
        res.status(201).json({
            message: "User created successfully",
            token,
            user: { id: savedUser._id, name: savedUser.name, email: savedUser.email, credits: savedUser.credits }
        });

    } catch (error) {
        next(error);
    }
});

// ==========================================
// 2. تسجيل الدخول (Log In)
// ==========================================
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Please provide email and password." });
        }

        // 1. البحث عن المستخدم في قاعدة البيانات
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        // 2. مقارنة كلمة المرور المدخلة بكلمة المرور المشفرة في القاعدة
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        // 3. إصدار التذكرة الرقمية (Token)
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        console.log(`✅ [Auth] User logged in: ${email}`);
        res.status(200).json({
            message: "Logged in successfully",
            token,
            user: { id: user._id, name: user.name, email: user.email, credits: user.credits }
        });

    } catch (error) {
        next(error);
    }
});
// ==========================================
// 3. المزامنة الصامتة (Fetch Latest Profile)
// ==========================================
router.get('/me', protect, async (req, res, next) => {
    try {
        // حارس البوابة (protect) قام بالفعل بجلب المستخدم من قاعدة البيانات ووضعه في req.user
        res.status(200).json({
            user: { 
                id: req.user._id, 
                name: req.user.name, 
                email: req.user.email, 
                credits: req.user.credits,
                isPremium: req.user.isPremium
            }
        });
    } catch (error) {
        next(error);
    }
});
export default router;