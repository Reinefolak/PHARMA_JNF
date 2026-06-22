import os
import re
import glob

# Files to update
files = [
    "client.html",
    "commande_livreur.html",
    "com_patient.html",
    "confirm.html",
    "contact.html",
    "contact_livreur.html",
    "contact_patient.html",
    "contact_proprietaire.html",
    "historique.html",
    "know.html",
    "know_livreur.html",
    "know_patient.html",
    "know_proprietaire.html",
    "pharmacies_livreur.html",
    "pharmacies_patient.html",
    "pharmacies_proprietaire.html",
    "services.html",
    "services_livreur.html",
    "services_patient.html",
    "services_proprietaire.html",
    "suivi.html",
    "suivi_livreur.html",
    "tournee.html"
]

frontend_dir = "/home/folak-mi/PHARMA_JNF/frontend"

TAILWIND_CONFIG = """<script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80',
              500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d',
            }
          }
        }
      }
    }
  </script>"""

CSS_GLASS = """<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; transition: background-color 0.3s, color 0.3s; }
    
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
    .dark ::-webkit-scrollbar-thumb { background: #475569; }

    .glass { background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255, 255, 255, 0.3); }
    .dark .glass { background: rgba(30, 41, 59, 0.8); border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
"""

DARK_MODE_SCRIPT = """
    // Dark Mode Theme init
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const htmlClass = document.documentElement.classList;
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      htmlClass.add('dark'); if(themeIcon) themeIcon.setAttribute('data-feather', 'sun');
    }
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        htmlClass.toggle('dark');
        const isDark = htmlClass.contains('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        if(themeIcon) themeIcon.setAttribute('data-feather', isDark ? 'sun' : 'moon');
        feather.replace();
      });
    }
    feather.replace();
  </script>
</body>"""

THEME_TOGGLE_BTN = """<button id="themeToggle" class="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition text-slate-600 dark:text-slate-300 focus:outline-none ml-4 mr-2">
            <i data-feather="moon" id="themeIcon" class="h-5 w-5"></i>
          </button>"""

def process_file(filepath):
    if not os.path.exists(filepath):
        print(f"Skipping {filepath}, does not exist")
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update Tailwind config
    content = re.sub(r'<script src="https://cdn\.tailwindcss\.com"></script>', TAILWIND_CONFIG, content)
    
    # 2. Update Font and CSS
    content = re.sub(r'<style>.*?body\s*\{.*?\}', CSS_GLASS, content, flags=re.DOTALL)
    
    # 3. Update Body Tag
    content = re.sub(r'<body class="bg-gray-50 text-gray-800">', '<body class="bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-200">', content)
    
    # 4. Update Nav to Glass
    content = re.sub(r'<nav class="bg-white shadow-sm relative z-10">', '<nav class="sticky top-0 z-40 glass">', content)
    content = re.sub(r'<nav class="bg-white shadow-sm">', '<nav class="sticky top-0 z-40 glass">', content)

    # 5. Insert Theme Toggle before Login/Logout or at the end of nav links
    # Find the closing div of the nav links section, usually containing the login/logout button
    # It looks something like: <div class="flex items-center space-x-6">
    if 'themeToggle' not in content:
        # Just insert it before the login/logout link
        content = re.sub(r'(<a href="login\.html")', THEME_TOGGLE_BTN + r'\n          \1', content)
    
    # 6. Update Primary Gradients
    content = content.replace('bg-gradient-to-br from-blue-600 to-green-500', 'bg-gradient-to-br from-brand-600 to-green-500 dark:from-brand-800 dark:to-green-900')
    
    # 7. Update generic text colors
    content = content.replace('text-gray-900', 'text-slate-900 dark:text-white')
    content = content.replace('text-gray-800', 'text-slate-800 dark:text-slate-200')
    content = content.replace('text-gray-600', 'text-slate-600 dark:text-slate-300')
    content = content.replace('text-gray-500', 'text-slate-500 dark:text-slate-400')
    content = content.replace('text-blue-600', 'text-brand-600 dark:text-brand-400')
    content = content.replace('bg-blue-600 hover:bg-blue-700', 'bg-brand-600 hover:bg-brand-700')
    content = content.replace('bg-blue-600', 'bg-brand-600')
    content = content.replace('text-blue-100', 'text-brand-100 dark:text-brand-200')
    
    # 8. Update Cards
    content = content.replace('bg-white shadow rounded-lg', 'bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 rounded-2xl')
    content = content.replace('bg-white rounded-2xl shadow-lg', 'bg-white dark:bg-slate-800 shadow-xl border border-slate-100 dark:border-slate-700 rounded-2xl')
    content = content.replace('bg-white p-8 rounded-xl shadow-md', 'bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700')
    
    # Tables
    content = content.replace('bg-gray-50', 'bg-slate-50 dark:bg-slate-900/50')
    content = content.replace('divide-gray-200', 'divide-slate-200 dark:divide-slate-700')
    content = content.replace('border-gray-200', 'border-slate-200 dark:border-slate-700')
    content = content.replace('border-gray-300', 'border-slate-300 dark:border-slate-600')
    
    # 9. Insert Dark Mode Script at the bottom
    # We replace the last feather.replace(); \n </script>\n</body> with our script
    if 'localStorage.getItem(\'theme\')' not in content:
        content = re.sub(r'feather\.replace\(\);\s*</script>\s*</body>', DARK_MODE_SCRIPT, content)

    # 10. Copy existing customized pharmacies content into pharmacies_* files
    # Actually, we don't need to do this here. 

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f"Updated {filepath}")

for file in files:
    process_file(os.path.join(frontend_dir, file))
