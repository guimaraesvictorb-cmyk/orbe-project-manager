export function Footer() {
  return (
    <footer className="border-t border-[#262626] px-6 py-4">
      <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left */}
        <div className="flex items-center gap-3">
          <span
            className="text-sm font-bold leading-none select-none"
            style={{ fontFamily: "Arial, sans-serif", letterSpacing: "-2px" }}
            aria-label="Orbe"
          >
            <span className="text-white">M</span>
            <span style={{ color: "#1FCE4A" }}>5</span>
          </span>
          <span className="text-[10px] tracking-widest uppercase text-[#A3A3A3]">
            Marketing ·{" "}
            <span style={{ color: "#1FCE4A" }}>Operating System v1.0</span>
            {" "}· Documento Estratégico Interno
          </span>
        </div>

        {/* Right */}
        <p className="text-[10px] tracking-widest uppercase text-[#A3A3A3]">
          Metodologia Orbe ·{" "}
          <span style={{ color: "#1FCE4A" }}>Não Distribuir</span>
        </p>
      </div>
    </footer>
  );
}
