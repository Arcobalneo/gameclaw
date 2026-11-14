import json
from pathlib import Path

def emit(name: str, exact: dict, patterns: dict, terms: dict | None = None) -> None:
    def py_str(s: str) -> str:
        return json.dumps(s, ensure_ascii=False)
    lines = ["EXACT = {"]
    for k, v in exact.items():
        lines.append(f"    {py_str(k)}: {py_str(v)},")
    lines.append("}")
    lines.append("PATTERNS = {")
    for k, v in patterns.items():
        lines.append(f"    {py_str(k)}: {py_str(v)},")
    lines.append("}")
    lines.append("TERMS = {")
    for k, v in (terms or {}).items():
        lines.append(f"    {py_str(k)}: {py_str(v)},")
    lines.append("}")
    dest = Path(__file__).parent / f"{name}.py"
    dest.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("wrote", dest.name, "exact", len(exact), "patterns", len(patterns))
