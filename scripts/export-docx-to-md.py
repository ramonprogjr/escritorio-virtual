"""One-off: export docs/01_documento_mestre.docx -> .md (UTF-8)."""
from __future__ import annotations

import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCX = ROOT / "docs" / "01_documento_mestre.docx"
OUT = ROOT / "docs" / "01_documento_mestre.md"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def para_text(p: ET.Element) -> str:
    parts: list[str] = []
    for t in p.findall(".//w:t", NS):
        if t.text:
            parts.append(t.text)
        if t.tail:
            parts.append(t.tail)
    return "".join(parts).strip()


def main() -> None:
    if not DOCX.is_file():
        raise SystemExit(f"Missing {DOCX}")

    with zipfile.ZipFile(DOCX) as z:
        xml = z.read("word/document.xml")
    root = ET.fromstring(xml)

    lines: list[str] = []
    for p in root.findall(".//w:p", NS):
        t = para_text(p)
        if t:
            lines.append(t)

    body = "\n\n".join(lines)
    header = (
        "# Documento mestre (Obra10+)\n\n"
        "> Exportação automática de `01_documento_mestre.docx` para leitura no repositório. "
        "Para o layout original, abra o arquivo Word.\n\n"
        "---\n\n"
    )
    OUT.write_text(header + body, encoding="utf-8")
    print(f"Wrote {OUT} ({len(header) + len(body)} chars)")


if __name__ == "__main__":
    main()
