import { useState } from "react";

export default function AuthScreen({ onLoginSuccess }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // تحديد مسار الباك إند بناءً على حالة المستخدم (دخول أم تسجيل جديد)
    const endpoint = isLoginMode ? "/api/auth/login" : "/api/auth/signup";

    try {
      const res = await fetch(`http://localhost:5000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      // حفظ التذكرة (Token) وبيانات المستخدم في الذاكرة المحلية للمتصفح
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      
      // إخبار التطبيق الرئيسي بنجاح الدخول
      onLoginSuccess(data.user);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#020202] text-gray-200 flex items-center justify-center p-6 selection:bg-emerald-500/30 font-sans relative overflow-hidden">
      
      {/* إضاءات خلفية ضبابية (Ambient Glow) */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-[#0a0a0a]/80 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
            🔐
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            {isLoginMode ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="text-gray-500 text-sm">
            {isLoginMode 
              ? "Access your AI Audio & Dubbing workspace." 
              : "Get 3 free daily credits to transform your audio."}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-center animate-fade-in">
            <p className="text-red-400 text-xs font-mono flex items-center justify-center gap-2">
              <span>⚠️</span> {error}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLoginMode && (
            <div>
              <label className="block text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Full Name</label>
              <input 
                type="text" 
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="John Doe"
                className="w-full bg-[#050505] border border-gray-800 focus:border-emerald-500/50 rounded-xl p-3.5 text-sm text-gray-200 outline-none transition-colors"
                required={!isLoginMode}
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Email Address</label>
            <input 
              type="email" 
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="name@company.com"
              className="w-full bg-[#050505] border border-gray-800 focus:border-emerald-500/50 rounded-xl p-3.5 text-sm text-gray-200 outline-none transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Password</label>
            <input 
              type="password" 
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full bg-[#050505] border border-gray-800 focus:border-emerald-500/50 rounded-xl p-3.5 text-sm text-gray-200 outline-none transition-colors"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full mt-6 py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <><span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span> Processing...</>
            ) : (
              isLoginMode ? "Sign In →" : "Claim 3 Free Credits →"
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-800/50 text-center">
          <p className="text-gray-500 text-sm">
            {isLoginMode ? "Don't have an account?" : "Already have an account?"}{" "}
            <button 
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setError(null);
              }}
              className="text-emerald-400 font-bold hover:underline transition-all"
            >
              {isLoginMode ? "Sign Up" : "Log In"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}