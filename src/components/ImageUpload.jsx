export default function ImageUpload({ value, onChange }) {
  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-panel">
      <label className="block text-sm font-medium text-slate-700">Product Image</label>
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
          <img src={value} alt="Preview" className="h-full w-full object-cover" />
        </div>
        <label className="cursor-pointer rounded-2xl border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
          Upload image
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </label>
      </div>
    </div>
  );
}