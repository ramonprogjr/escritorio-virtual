/** Iniciais de um nome/cargo (ex.: "Diretor de Marketing" → "DM"). Helper puro. */
export function getInitials(cargo: string): string {
  const skip = new Set(["de", "do", "da", "dos", "das", "e", "IA", "ao"]);
  const words = cargo.split(" ").filter(w => w.length > 1 && !skip.has(w));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return cargo.slice(0, 2).toUpperCase();
}
