"""Build a dependency-free, ready-to-load GitHub release ZIP."""
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parent
version = json.loads((root / "manifest.json").read_text())["version"]
output = root / "dist" / f"stabilo-{version}.zip"
output.parent.mkdir(exist_ok=True)
with ZipFile(output, "w", ZIP_DEFLATED) as archive:
    for name in ["manifest.json", "popup.html", "popup.css", "popup.js", "content.js", "README.md", "package.py"]:
        archive.write(root / name, name)
print(output)
