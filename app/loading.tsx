export default function Loading() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ background: "#0d1117" }}>
      <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6 shadow-2xl"
        style={{ background: "#003b26" }}>
        <span className="text-5xl font-black" style={{ color: "#c9a24a" }}>O+</span>
      </div>
      <h1 className="text-white text-2xl font-black mb-1">OBRA10+</h1>
      <p className="text-sm mb-8" style={{ color: "#8b949e" }}>Escritório Virtual</p>
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full animate-bounce"
            style={{ background: "#c9a24a", animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}
