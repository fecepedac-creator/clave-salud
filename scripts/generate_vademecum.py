import os
import json
import urllib.request
import csv
import re
import unicodedata
from datetime import date

CSV_URL = os.environ.get(
    "VADEMECUM_CSV_URL",
    "https://datos.gob.cl/uploads/recursos/Productos_farmaceuticos_vigentes_venta_directa.csv",
)
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "..", "constants", "vademecum_isp.json")
REPORT_FILE = os.path.join(os.path.dirname(__file__), "..", "constants", "vademecum_isp_report.json")
GENERATED_AT = date.today().isoformat()
CONTROLLED_PRINCIPLES = {"clonazepam", "alprazolam", "diazepam", "tramadol"}

# Verified list of active principles for keyword matching
KNOWN_PRINCIPLES = [
    "paracetamol", "ibuprofeno", "losartan", "metformina", "valsartan", 
    "atorvastatina", "bisoprolol", "amoxicilina", "cefadroxilo", "cefixima", 
    "clonazepam", "alprazolam", "diazepam", "tramadol", "ketoprofeno", 
    "diclofenaco", "naproxeno", "ketorolaco", "meloxicam", "sildenafil", 
    "nitroglicerina", "isosorbida", "dapagliflozina", "empagliflozina", 
    "linagliptina", "sitagliptina", "vildagliptina", "semaglutida", 
    "liraglutida", "salbutamol", "fluticasona", "budesonida", "loratadina", 
    "desloratadina", "cetirizina", "clorfenamina", "prednisona", "betametasona", 
    "enalapril", "captopril", "cloxacilina", "nitrofurantoina", "omeprazol", 
    "esomeprazol", "domperidona", "pargeverina", "cloruro de sodio", 
    "acido acetilsalicilico", "acido clavulanico", "vildagliptina", 
    "glibenclamida", "codeina", "amlodipino", "hidroclorotiazida"
]

# Map common brand names to active principles for Chile
BRAND_TO_PRINCIPLE = {
    "gesidol": "paracetamol",
    "tafirol": "paracetamol",
    "panadol": "paracetamol",
    "kitadol": "paracetamol",
    "apronax": "naproxeno",
    "actron": "ibuprofeno",
    "pyredol": "paracetamol",
    "viadil": "pargeverina",
    "perenteryl": "saccharomyces boulardii",
    "suero fisiologico": "cloruro de sodio",
    "solucion fisiologica": "cloruro de sodio",
    "aspirina": "acido acetilsalicilico",
    "glafornil": "metformina",
    "valax": "valsartan",
    "simperten": "valsartan",
    "ravotril": "clonazepam",
    "acepran": "clonazepam",
    "adax": "alprazolam",
    "tranquinal": "alprazolam",
    "eurocor": "bisoprolol",
    "concor": "bisoprolol",
    "openvas": "olmesartan",
    "olmetec": "olmesartan",
    "clavinex": "amoxicilina + acido clavulanico",
    "amoval": "amoxicilina",
    "biodroxil": "cefadroxilo",
    "cefirax": "cefixima",
    "denvar": "cefixima",
    "jardiance": "empagliflozina",
    "trayenta": "linagliptina",
    "galvus": "vildagliptina",
    "januvia": "sitagliptina",
    "janumet": "sitagliptina + metformina",
    "victoza": "liraglutida",
    "saxenda": "liraglutida",
    "ozempic": "semaglutida",
    "rybelsus": "semaglutida"
}

# Structured local presets of prescription-only drugs in Chile
LOCAL_PRESETS = [
    # Metformina
    {"activePrinciple": "Metformina", "brandName": "Genérico", "presentation": "Metformina 500 mg comprimidos", "strength": "500 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Metformina", "brandName": "Genérico", "presentation": "Metformina 750 mg LP comprimidos", "strength": "750 mg LP", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Metformina", "brandName": "Genérico", "presentation": "Metformina 850 mg comprimidos", "strength": "850 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Metformina", "brandName": "Genérico", "presentation": "Metformina 1000 mg LP comprimidos", "strength": "1000 mg LP", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Metformina + Dapagliflozina", "brandName": "Xigduo XR", "presentation": "Xigduo XR (Metformina + Dapagliflozina) 1000/5 mg comprimidos", "strength": "1000/5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Metformina + Dapagliflozina", "brandName": "Xigduo XR", "presentation": "Xigduo XR (Metformina + Dapagliflozina) 1000/10 mg comprimidos", "strength": "1000/10 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Metformina + Vildagliptina", "brandName": "Galvus Met", "presentation": "Galvus Met (Metformina + Vildagliptina) 850/50 mg comprimidos", "strength": "850/50 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Metformina + Vildagliptina", "brandName": "Galvus Met", "presentation": "Galvus Met (Metformina + Vildagliptina) 1000/50 mg comprimidos", "strength": "1000/50 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Metformina", "brandName": "Glafornil", "presentation": "Glafornil (Metformina) 850 mg comprimidos", "strength": "850 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Metformina", "brandName": "Glafornil XR", "presentation": "Glafornil XR (Metformina LP) 500 mg comprimidos", "strength": "500 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Metformina", "brandName": "Glafornil XR", "presentation": "Glafornil XR (Metformina LP) 750 mg comprimidos", "strength": "750 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Metformina", "brandName": "Glafornil XR", "presentation": "Glafornil XR (Metformina LP) 1000 mg comprimidos", "strength": "1000 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    
    # Valsartán
    {"activePrinciple": "Valsartán", "brandName": "Genérico", "presentation": "Valsartán 80 mg comprimidos", "strength": "80 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Valsartán", "brandName": "Genérico", "presentation": "Valsartán 160 mg comprimidos", "strength": "160 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Valsartán", "brandName": "Genérico", "presentation": "Valsartán 320 mg comprimidos", "strength": "320 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Valsartán + Amlodipino", "brandName": "Genérico", "presentation": "Valsartán + Amlodipino 80/5 mg comprimidos", "strength": "80/5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Valsartán + Amlodipino", "brandName": "Genérico", "presentation": "Valsartán + Amlodipino 160/5 mg comprimidos", "strength": "160/5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Valsartán + Amlodipino", "brandName": "Genérico", "presentation": "Valsartán + Amlodipino 160/10 mg comprimidos", "strength": "160/10 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Valsartán + Hidroclorotiazida", "brandName": "Genérico", "presentation": "Valsartán + Hidroclorotiazida 80/12.5 mg comprimidos", "strength": "80/12.5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Valsartán + Hidroclorotiazida", "brandName": "Genérico", "presentation": "Valsartán + Hidroclorotiazida 160/12.5 mg comprimidos", "strength": "160/12.5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Valsartán + Hidroclorotiazida", "brandName": "Genérico", "presentation": "Valsartán + Hidroclorotiazida 160/25 mg comprimidos", "strength": "160/25 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Valsartán + Amlodipino + Hidroclorotiazida", "brandName": "Genérico", "presentation": "Valsartán + Amlodipino + Hidroclorotiazida 160/5/12.5 mg comprimidos", "strength": "160/5/12.5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Valsartán + Amlodipino + Hidroclorotiazida", "brandName": "Genérico", "presentation": "Valsartán + Amlodipino + Hidroclorotiazida 160/10/12.5 mg comprimidos", "strength": "160/10/12.5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Valsartán", "brandName": "Valax", "presentation": "Valax (Valsartán) 80 mg comprimidos", "strength": "80 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Valsartán", "brandName": "Valax", "presentation": "Valax (Valsartán) 160 mg comprimidos", "strength": "160 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Valsartán + Hidroclorotiazida", "brandName": "Valax D", "presentation": "Valax D (Valsartán + Hidroclorotiazida) 160/12.5 mg comprimidos", "strength": "160/12.5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Valsartán + Amlodipino", "brandName": "Valax AM", "presentation": "Valax AM (Valsartán + Amlodipino) 160/5 mg comprimidos", "strength": "160/5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Valsartán", "brandName": "Simperten", "presentation": "Simperten (Valsartán) 160 mg comprimidos", "strength": "160 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Valsartán + Hidroclorotiazida", "brandName": "Simperten D", "presentation": "Simperten D (Valsartán + Hidroclorotiazida) 160/12.5 mg comprimidos", "strength": "160/12.5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Valsartán + Amlodipino", "brandName": "Simperten AM", "presentation": "Simperten AM (Valsartán + Amlodipino) 160/5 mg comprimidos", "strength": "160/5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    
    # Dapagliflozina
    {"activePrinciple": "Dapagliflozina", "brandName": "Genérico", "presentation": "Dapagliflozina 5 mg comprimidos", "strength": "5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Dapagliflozina", "brandName": "Genérico", "presentation": "Dapagliflozina 10 mg comprimidos", "strength": "10 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Dapagliflozina", "brandName": "Forxiga", "presentation": "Forxiga (Dapagliflozina) 5 mg comprimidos", "strength": "5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Dapagliflozina", "brandName": "Forxiga", "presentation": "Forxiga (Dapagliflozina) 10 mg comprimidos", "strength": "10 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    
    # Empagliflozina
    {"activePrinciple": "Empagliflozina", "brandName": "Genérico", "presentation": "Empagliflozina 10 mg comprimidos", "strength": "10 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Empagliflozina", "brandName": "Genérico", "presentation": "Empagliflozina 25 mg comprimidos", "strength": "25 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Empagliflozina", "brandName": "Jardiance", "presentation": "Jardiance (Empagliflozina) 10 mg comprimidos", "strength": "10 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Empagliflozina", "brandName": "Jardiance", "presentation": "Jardiance (Empagliflozina) 25 mg comprimidos", "strength": "25 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Empagliflozina + Metformina", "brandName": "Jardiance Duo", "presentation": "Jardiance Duo (Empagliflozina + Metformina) 5/850 mg comprimidos", "strength": "5/850 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Empagliflozina + Metformina", "brandName": "Jardiance Duo", "presentation": "Jardiance Duo (Empagliflozina + Metformina) 5/1000 mg comprimidos", "strength": "5/1000 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Empagliflozina + Metformina", "brandName": "Jardiance Duo", "presentation": "Jardiance Duo (Empagliflozina + Metformina) 12.5/850 mg comprimidos", "strength": "12.5/850 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Empagliflozina + Metformina", "brandName": "Jardiance Duo", "presentation": "Jardiance Duo (Empagliflozina + Metformina) 12.5/1000 mg comprimidos", "strength": "12.5/1000 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Empagliflozina + Linagliptina", "brandName": "Glyxambi", "presentation": "Glyxambi (Empagliflozina + Linagliptina) 10/5 mg comprimidos", "strength": "10/5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Empagliflozina + Linagliptina", "brandName": "Glyxambi", "presentation": "Glyxambi (Empagliflozina + Linagliptina) 25/5 mg comprimidos", "strength": "25/5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    
    # Linagliptina
    {"activePrinciple": "Linagliptina", "brandName": "Trayenta", "presentation": "Trayenta (Linagliptina) 5 mg comprimidos", "strength": "5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Linagliptina + Metformina", "brandName": "Trayenta Duo", "presentation": "Trayenta Duo (Linagliptina + Metformina) 2.5/850 mg comprimidos", "strength": "2.5/850 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Linagliptina + Metformina", "brandName": "Trayenta Duo", "presentation": "Trayenta Duo (Linagliptina + Metformina) 2.5/1000 mg comprimidos", "strength": "2.5/1000 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    
    # Sitagliptina
    {"activePrinciple": "Sitagliptina", "brandName": "Januvia", "presentation": "Januvia (Sitagliptina) 100 mg comprimidos", "strength": "100 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Sitagliptina + Metformina", "brandName": "Janumet", "presentation": "Janumet (Sitagliptina + Metformina) 50/850 mg comprimidos", "strength": "50/850 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Sitagliptina + Metformina", "brandName": "Janumet", "presentation": "Janumet (Sitagliptina + Metformina) 50/1000 mg comprimidos", "strength": "50/1000 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Sitagliptina + Metformina", "brandName": "Janumet XR", "presentation": "Janumet XR (Sitagliptina + Metformina LP) 50/1000 mg comprimidos", "strength": "50/1000 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Sitagliptina + Metformina", "brandName": "Janumet XR", "presentation": "Janumet XR (Sitagliptina + Metformina LP) 100/1000 mg comprimidos", "strength": "100/1000 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},

    # Vildagliptina
    {"activePrinciple": "Vildagliptina", "brandName": "Galvus", "presentation": "Galvus (Vildagliptina) 50 mg comprimidos", "strength": "50 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Vildagliptina + Metformina", "brandName": "Galvus Met", "presentation": "Galvus Met (Vildagliptina + Metformina) 50/850 mg comprimidos", "strength": "50/850 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Vildagliptina + Metformina", "brandName": "Galvus Met", "presentation": "Galvus Met (Vildagliptina + Metformina) 50/1000 mg comprimidos", "strength": "50/1000 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},

    # Semaglutida
    {"activePrinciple": "Semaglutida", "brandName": "Ozempic", "presentation": "Ozempic (Semaglutida) 0.25 mg solución inyectable", "strength": "0.25 mg", "form": "solución inyectable", "route": "Inyectable", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Semaglutida", "brandName": "Ozempic", "presentation": "Ozempic (Semaglutida) 0.5 mg solución inyectable", "strength": "0.5 mg", "form": "solución inyectable", "route": "Inyectable", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Semaglutida", "brandName": "Ozempic", "presentation": "Ozempic (Semaglutida) 1 mg solución inyectable", "strength": "1 mg", "form": "solución inyectable", "route": "Inyectable", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Semaglutida", "brandName": "Rybelsus", "presentation": "Rybelsus (Semaglutida) 3 mg comprimidos", "strength": "3 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Semaglutida", "brandName": "Rybelsus", "presentation": "Rybelsus (Semaglutida) 7 mg comprimidos", "strength": "7 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Semaglutida", "brandName": "Rybelsus", "presentation": "Rybelsus (Semaglutida) 14 mg comprimidos", "strength": "14 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    
    # Liraglutida
    {"activePrinciple": "Liraglutida", "brandName": "Victoza", "presentation": "Victoza (Liraglutida) 6 mg/ml solución inyectable", "strength": "6 mg/ml", "form": "solución inyectable", "route": "Inyectable", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Liraglutida", "brandName": "Saxenda", "presentation": "Saxenda (Liraglutida) 6 mg/ml solución inyectable", "strength": "6 mg/ml", "form": "solución inyectable", "route": "Inyectable", "prescriptionRequired": True, "controlled": False},

    # Losartán
    {"activePrinciple": "Losartán", "brandName": "Genérico", "presentation": "Losartán 50 mg comprimidos", "strength": "50 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Losartán", "brandName": "Genérico", "presentation": "Losartán 100 mg comprimidos", "strength": "100 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Losartán + Hidroclorotiazida", "brandName": "Genérico", "presentation": "Losartán + Hidroclorotiazida 50/12.5 mg comprimidos", "strength": "50/12.5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Losartán + Hidroclorotiazida", "brandName": "Genérico", "presentation": "Losartán + Hidroclorotiazida 100/25 mg comprimidos", "strength": "100/25 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Losartán", "brandName": "Solosartan", "presentation": "Solosartan (Losartán) 50 mg comprimidos", "strength": "50 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Losartán + Hidroclorotiazida", "brandName": "Solosartan H", "presentation": "Solosartan H (Losartán + Hidroclorotiazida) 50/12.5 mg comprimidos", "strength": "50/12.5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},

    # Clonazepam (Controlled)
    {"activePrinciple": "Clonazepam", "brandName": "Genérico", "presentation": "Clonazepam 0.5 mg comprimidos", "strength": "0.5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": True},
    {"activePrinciple": "Clonazepam", "brandName": "Genérico", "presentation": "Clonazepam 2 mg comprimidos", "strength": "2 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": True},
    {"activePrinciple": "Clonazepam", "brandName": "Ravotril", "presentation": "Ravotril (Clonazepam) 0.5 mg comprimidos", "strength": "0.5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": True},
    {"activePrinciple": "Clonazepam", "brandName": "Ravotril", "presentation": "Ravotril (Clonazepam) 2 mg comprimidos", "strength": "2 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": True},
    {"activePrinciple": "Clonazepam", "brandName": "Acepran", "presentation": "Acepran (Clonazepam) 0.5 mg comprimidos", "strength": "0.5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": True},
    {"activePrinciple": "Clonazepam", "brandName": "Acepran", "presentation": "Acepran (Clonazepam) 2 mg comprimidos", "strength": "2 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": True},

    # Alprazolam (Controlled)
    {"activePrinciple": "Alprazolam", "brandName": "Genérico", "presentation": "Alprazolam 0.25 mg comprimidos", "strength": "0.25 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": True},
    {"activePrinciple": "Alprazolam", "brandName": "Genérico", "presentation": "Alprazolam 0.5 mg comprimidos", "strength": "0.5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": True},
    {"activePrinciple": "Alprazolam", "brandName": "Genérico", "presentation": "Alprazolam 1 mg comprimidos", "strength": "1 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": True},
    {"activePrinciple": "Alprazolam", "brandName": "Genérico", "presentation": "Alprazolam 2 mg comprimidos", "strength": "2 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": True},
    {"activePrinciple": "Alprazolam", "brandName": "Adax", "presentation": "Adax (Alprazolam) 0.5 mg comprimidos", "strength": "0.5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": True},
    {"activePrinciple": "Alprazolam", "brandName": "Adax", "presentation": "Adax (Alprazolam) 1 mg comprimidos", "strength": "1 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": True},
    {"activePrinciple": "Alprazolam", "brandName": "Tranquinal", "presentation": "Tranquinal (Alprazolam) 0.5 mg comprimidos", "strength": "0.5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": True},

    # Diazepam (Controlled)
    {"activePrinciple": "Diazepam", "brandName": "Genérico", "presentation": "Diazepam 5 mg comprimidos", "strength": "5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": True},
    {"activePrinciple": "Diazepam", "brandName": "Genérico", "presentation": "Diazepam 10 mg comprimidos", "strength": "10 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": True},

    # Tramadol (Controlled)
    {"activePrinciple": "Tramadol", "brandName": "Genérico", "presentation": "Tramadol 50 mg cápsulas", "strength": "50 mg", "form": "cápsula", "route": "Oral", "prescriptionRequired": True, "controlled": True},
    {"activePrinciple": "Tramadol", "brandName": "Genérico", "presentation": "Tramadol 100 mg/ml gotas orales", "strength": "100 mg/ml", "form": "gotas", "route": "Oral", "prescriptionRequired": True, "controlled": True},
    {"activePrinciple": "Paracetamol + Tramadol", "brandName": "Genérico", "presentation": "Paracetamol + Tramadol 325/37.5 mg comprimidos", "strength": "325/37.5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": True},

    # Cefadroxilo
    {"activePrinciple": "Cefadroxilo", "brandName": "Genérico", "presentation": "Cefadroxilo 500 mg cápsulas", "strength": "500 mg", "form": "cápsula", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Cefadroxilo", "brandName": "Genérico", "presentation": "Cefadroxilo 1 g comprimidos", "strength": "1 g", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Cefadroxilo", "brandName": "Biodroxil", "presentation": "Biodroxil (Cefadroxilo) 500 mg cápsulas", "strength": "500 mg", "form": "cápsula", "route": "Oral", "prescriptionRequired": True, "controlled": False},

    # Cefixima / Cefirax
    {"activePrinciple": "Cefixima", "brandName": "Genérico", "presentation": "Cefixima 400 mg comprimidos", "strength": "400 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Cefixima", "brandName": "Cefirax", "presentation": "Cefirax (Cefixima) 400 mg comprimidos", "strength": "400 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Cefixima", "brandName": "Cefirax", "presentation": "Cefirax (Cefixima) suspensión oral 100 mg/5ml", "strength": "100 mg/5ml", "form": "suspensión oral", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Cefixima", "brandName": "Denvar", "presentation": "Denvar (Cefixima) 400 mg comprimidos", "strength": "400 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Cefixima", "brandName": "Denvar", "presentation": "Denvar (Cefixima) suspensión oral 100 mg/5ml", "strength": "100 mg/5ml", "form": "suspensión oral", "route": "Oral", "prescriptionRequired": True, "controlled": False}
]

def clean_str(s):
    # Normalize string, lowercase, strip, remove accents.
    s = str(s or "").lower().strip()
    s = unicodedata.normalize("NFD", s)
    return "".join(ch for ch in s if unicodedata.category(ch) != "Mn")

def extract_strength(name):
    # Regex to find strength (e.g. 500 mg, 0.1%, 100 mg/5ml)
    match = re.search(r'\b\d+(?:/\d+)?(?:\.\d+)?\s*(?:mg|g|mcg|ml|%|ui|ug)(?:/\d+\s*(?:mg|g|mcg|ml|%|ui|ug))?\b', name, re.IGNORECASE)
    if match:
        return match.group(0)
    return "N/A"

def extract_form_and_route(name):
    clean_name = clean_str(name)
    
    # Detect Form
    form = "comprimido"  # default
    if "comprimido" in clean_name or "comp" in clean_name or "tableta" in clean_name:
        form = "comprimido"
    elif "capsula" in clean_name or "caps" in clean_name:
        form = "cápsula"
    elif "gotas" in clean_name:
        form = "gotas"
    elif "jarabe" in clean_name:
        form = "jarabe"
    elif "suspension" in clean_name:
        form = "suspensión oral"
    elif "solucion" in clean_name:
        if "inyect" in clean_name:
            form = "solución inyectable"
        elif "oral" in clean_name or "colut" in clean_name:
            form = "solución oral"
        else:
            form = "solución"
    elif "crema" in clean_name:
        form = "crema"
    elif "unguento" in clean_name:
        form = "ungüento"
    elif "gel" in clean_name:
        form = "gel"
    elif "pomada" in clean_name:
        form = "pomada"
    elif "ampolla" in clean_name or "inyect" in clean_name:
        form = "solución inyectable"
    elif "supositorio" in clean_name:
        form = "supositorio"
    elif "polvo" in clean_name:
        form = "polvo"
    elif "parche" in clean_name:
        form = "parche"
    elif "aerosol" in clean_name or "inhal" in clean_name or "puff" in clean_name:
        form = "aerosol"
        
    # Detect Route
    route = "Oral"
    form_clean = clean_str(form)
    if form_clean in ["crema", "ungüento", "pomada", "gel", "parche"]:
        route = "Tópica"
    elif form_clean in ["aerosol", "inhalador"]:
        route = "Inhalatoria"
    elif form_clean in ["solución inyectable", "ampolla"]:
        route = "Inyectable"
    elif form_clean == "supositorio":
        route = "Rectal"
    elif "oftal" in clean_name or "colirio" in clean_name:
        route = "Oftálmica"
    elif "otic" in clean_name:
        route = "Ótica"
    
    return form, route

def extract_brand_and_principle(name):
    clean_name = clean_str(name)
    
    # 1. Match against known principles
    matched_principle = "Desconocido"
    for p in KNOWN_PRINCIPLES:
        if p in clean_name:
            # Format nicely
            matched_principle = p.title()
            # Special case for compound names
            if p == "acido acetilsalicilico":
                matched_principle = "Ácido Acetilsalicílico"
            elif p == "acido clavulanico":
                matched_principle = "Ácido Clavulánico"
            elif p == "cloruro de sodio":
                matched_principle = "Cloruro de Sodio"
            break
            
    # 2. Match against brand dictionary
    matched_brand = "Genérico"
    for brand, principle in BRAND_TO_PRINCIPLE.items():
        if clean_name.startswith(brand):
            matched_brand = brand.title()
            if matched_principle == "Desconocido":
                matched_principle = principle.title()
            break
            
    # 3. If brand is still Genérico but name doesn't start with principle, extract first word
    if matched_brand == "Genérico" and matched_principle != "Desconocido":
        princ_clean = clean_str(matched_principle)
        if not clean_name.startswith(princ_clean):
            words = name.split()
            if words:
                matched_brand = words[0].title()
                
    return matched_brand, matched_principle

def download_and_parse():
    print(f"Intentando descargar vademécum desde: {CSV_URL} ...")
    try:
        req = urllib.request.Request(
            CSV_URL, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req, timeout=15) as response:
            raw_data = response.read()
            
        print("Descarga exitosa. Detectando codificación...")
        
        # Read content using correct decoding to preserve accents
        content = ""
        for enc in ['utf-8-sig', 'utf-8', 'latin-1', 'iso-8859-1']:
            try:
                content = raw_data.decode(enc)
                print(f"Codificación exitosa detectada: {enc}")
                break
            except UnicodeError:
                continue
        if not content:
            content = raw_data.decode('utf-8', errors='replace')
            print("Advertencia: No se pudo verificar codificación. Usando utf-8 con reemplazos.")
            
        reader = csv.reader(content.splitlines(), delimiter=';')
        headers = next(reader)
        
        # Report counters
        total_rows = 0
        valid_rows = 0
        discarded_rows = 0
        anomalies = []
        
        parsed_items = []
        
        # Parse rows
        for row in reader:
            if len(row) < 2:
                continue
            total_rows += 1
            
            reg_num = row[0].strip()
            prod_name = row[1].strip()
            holder = row[2].strip() if len(row) > 2 else ""
            
            if not prod_name or prod_name.lower() == "nombre producto":
                discarded_rows += 1
                continue
                
            brand, principle = extract_brand_and_principle(prod_name)
            
            # Discard products that cannot be mapped to a known principle
            if principle == "Desconocido":
                discarded_rows += 1
                if len(anomalies) < 5:
                    anomalies.append(prod_name)
                continue
                
            valid_rows += 1
            
            strength = extract_strength(prod_name)
            form, route = extract_form_and_route(prod_name)
            
            # Create VademecumItem representation
            item = {
                "id": reg_num,
                "activePrinciple": principle,
                "brandName": brand,
                "presentation": f"{prod_name.title()} ({holder.title()})",
                "strength": strength,
                "form": form,
                "route": route,
                "prescriptionRequired": False, # OTC/Venta directa
                "controlled": clean_str(principle) in CONTROLLED_PRINCIPLES,
                "source": "ISP",
                "lastUpdated": GENERATED_AT,
                "registryId": reg_num,
                "laboratory": holder,
                "sourceUrl": CSV_URL
            }
            
            parsed_items.append(item)
            
        print("\n=== REPORTE DE CALIDAD DE DATOS (GENERACIÓN ISP) ===")
        print(f"  Filas Totales Leídas: {total_rows}")
        print(f"  Filas Válidas Mapeadas: {valid_rows}")
        print(f"  Filas Descartadas (Sin principio activo conocido): {discarded_rows}")
        print("  Ejemplos de Anomalías Descartadas:")
        for idx, an in enumerate(anomalies):
            print(f"    - {idx+1}. {an}")
        print("===================================================\n")
        
        return {
            "items": parsed_items,
            "report": {
                "sourceUrl": CSV_URL,
                "generatedAt": GENERATED_AT,
                "totalRows": total_rows,
                "validRows": valid_rows,
                "discardedRows": discarded_rows,
                "anomalies": anomalies,
            },
        }
        
    except Exception as e:
        print(f"Error al descargar o procesar el CSV: {e}")
        print("Cargando únicamente base de datos local pre-estructurada...")
        return {
            "items": [],
            "report": {
                "sourceUrl": CSV_URL,
                "generatedAt": GENERATED_AT,
                "totalRows": 0,
                "validRows": 0,
                "discardedRows": 0,
                "anomalies": [str(e)],
                "fallbackOnly": True,
            },
        }

def main():
    parsed = download_and_parse()
    isp_items = parsed["items"]
    report = parsed["report"]
    
    # Structure local presets
    local_items = []
    preset_counter = 1
    for p in LOCAL_PRESETS:
        item = {
            "id": f"LOC-{preset_counter:04d}",
            "activePrinciple": p["activePrinciple"],
            "brandName": p["brandName"],
            "presentation": p["presentation"],
            "strength": p["strength"],
            "form": p["form"],
            "route": p["route"],
            "prescriptionRequired": p["prescriptionRequired"],
            "controlled": p["controlled"],
            "source": "local",
            "lastUpdated": GENERATED_AT
        }
        local_items.append(item)
        preset_counter += 1
        
    # Merge both sources
    final_list = []
    presentations_seen = set()
    
    # Add local items first (high priority presets)
    for item in local_items:
        clean_pres = clean_str(item["presentation"])
        if clean_pres not in presentations_seen:
            final_list.append(item)
            presentations_seen.add(clean_pres)
            
    # Add ISP items
    for item in isp_items:
        clean_pres = clean_str(item["presentation"])
        if clean_pres not in presentations_seen:
            # Check if this active principle is controlled (e.g. if it matches clonazepam)
            princ_clean = clean_str(item["activePrinciple"])
            if princ_clean in CONTROLLED_PRINCIPLES:
                item["controlled"] = True
                item["prescriptionRequired"] = True
                
            final_list.append(item)
            presentations_seen.add(clean_pres)
            
    # Ensure output directory exists
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(final_list, f, ensure_ascii=False, indent=2)

    report.update({
        "localRows": len(local_items),
        "finalRows": len(final_list),
        "controlledRows": sum(1 for item in final_list if item.get("controlled")),
        "prescriptionRequiredRows": sum(1 for item in final_list if item.get("prescriptionRequired")),
    })
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
        
    print(f"Vademécum generado exitosamente en: {OUTPUT_FILE}")
    print(f"Cantidad total de ítems estructurados: {len(final_list)}")
    print(f"Reporte de generación: {REPORT_FILE}")

if __name__ == "__main__":
    main()
