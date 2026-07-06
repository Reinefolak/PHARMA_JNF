import os
import glob

frontend_dir = "/home/folak-mi/PHARMA_JNF/frontend"
html_files = glob.glob(os.path.join(frontend_dir, "*.html"))

for filepath in html_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    content = content.replace('href="pharmacie.html"', 'href="pharmacies.html"')
    content = content.replace('href="pharmacie_livreur.html"', 'href="pharmacies_livreur.html"')
    content = content.replace('href="pharmacie_patient.html"', 'href="pharmacies_patient.html"')
    content = content.replace('href="pharmacie_proprietaire.html"', 'href="pharmacies_proprietaire.html"')

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed links in {os.path.basename(filepath)}")
