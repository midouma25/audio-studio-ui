// middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
    let token;

    // التأكد من أن المتصفح أرسل التذكرة في الهيدر (Authorization Header)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // استخراج التذكرة فقط بدون كلمة Bearer
            token = req.headers.authorization.split(' ')[1];

            // فك التشفير وقراءة محتوى التذكرة (userId)
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // جلب بيانات المستخدم بالكامل من MongoDB ولصقها في الطلب (req.user)
            req.user = await User.findById(decoded.userId).select('-password');
            
            if (!req.user) {
                return res.status(401).json({ error: "User no longer exists." });
            }

            return next(); // التذكرة سليمة! مرر الطلب للخطوة القادمة
        } catch (error) {
            return res.status(401).json({ error: "Not authorized, token failed." });
        }
    }

    if (!token) {
        return res.status(401).json({ error: "Not authorized, no token provided." });
    }
};