import React, { useRef, useState } from 'react';

export default function ImageUpload({ value, onChange }) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (event) => {
    handleUpload(event.target.files?.[0]);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const isDefault = !value || value.includes('data:image/svg+xml') && value.includes('Product');

  return (
    <div 
      className={`rounded-xl border ${isDragging ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-white'} p-4 transition-colors`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-4">
        <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center">
          {isDefault ? (
            <div className="flex flex-col items-center text-slate-300">
              <svg className="w-8 h-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-[9px] font-bold tracking-wider uppercase">No Image</span>
            </div>
          ) : (
            <img src={value} alt="Preview" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="flex flex-col items-start gap-2">
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload image
          </button>
          <input 
            ref={fileInputRef} 
            type="file" 
            accept="image/png, image/jpeg" 
            className="hidden" 
            onChange={handleFileChange} 
          />
          <p className="text-[11px] text-slate-400 font-medium leading-tight max-w-[200px]">
            Drag and drop packaging photo or tap to browse file.
          </p>
        </div>
      </div>
    </div>
  );
}
