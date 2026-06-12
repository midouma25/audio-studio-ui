import { useState } from "react";

// نستقبل الدالة onFileDrop من الأب
export default function Dropzone({ onFileDrop }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    
    if (file) {
      // بدلاً من طباعة الاسم في الـ Console فقط، نرسله للأب!
      console.log("File received successfully:", file.name);
      onFileDrop(file); 
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full h-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl transition-all duration-300 cursor-pointer ${
        isDragging
          ? "border-emerald-500 bg-emerald-500/10 scale-[1.02]"
          : "border-gray-700 bg-[#0f0f0f] hover:border-gray-500 hover:bg-[#151515]"
      }`}
    >
      <div className={`text-5xl mb-4 transition-transform duration-300 ${isDragging ? "animate-bounce" : ""}`}>
        📥
      </div>
      <h3 className={`text-xl font-bold mb-2 ${isDragging ? "text-emerald-400" : "text-gray-300"}`}>
        {isDragging ? "Drop the audio file here!" : "Drag & Drop your file here"}
      </h3>
      <p className="text-gray-500 text-sm">Or click to browse files (MP3, WAV, M4A)</p>
    </div>
  );
}