import Link from "next/link";

export default function FornecedorHomePage() {
  return (
    <div className="px-4 py-10 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-[#c9a24a] mb-2">Área do fornecedor</h1>
      <p className="text-sm text-[#8b949e] mb-8">
        Base para cadastro, cotações e workflow até aprovação na Central (Fase 3 do documento mestre).
      </p>
      <Link
        href="/fornecedor/cotacao"
        className="inline-block px-4 py-2 rounded-lg bg-[#003b26] text-white text-sm font-medium"
      >
        Fluxo de cotação (protótipo)
      </Link>
    </div>
  );
}
