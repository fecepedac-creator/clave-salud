import html
import json
import os
import re
import unicodedata
import urllib.parse
import urllib.request
from datetime import date
from html.parser import HTMLParser

BASE_URL = "https://registrosanitario.ispch.gob.cl/"
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "..", "constants", "vademecum_isp.json")
REPORT_FILE = os.path.join(os.path.dirname(__file__), "..", "constants", "vademecum_isp_report.json")
GENERATED_AT = date.today().isoformat()

CONDITIONS = [
    "Directa",
    "Receta Simple",
    "Receta Retenida",
    "Receta Retenida con Control de Existencia",
    "Receta Cheque",
]

CONTROLLED_CONDITIONS = {
    "receta cheque",
    "receta retenida",
    "receta retenida con control de existencia",
}

CONTROLLED_PRINCIPLES = {
    "alprazolam",
    "clonazepam",
    "diazepam",
    "lorazepam",
    "midazolam",
    "tramadol",
    "metilfenidato",
    "morfina",
    "oxicodona",
    "fentanilo",
    "buprenorfina",
    "ketamina",
    "zolpidem",
    "zopiclona",
    "fenobarbital",
    "codeina",
    "codeína",
}

LOCAL_PRESETS = [
    {"activePrinciple": "Metformina", "brandName": "Genérico", "presentation": "Metformina 500 mg comprimidos", "strength": "500 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Metformina", "brandName": "Genérico", "presentation": "Metformina 750 mg LP comprimidos", "strength": "750 mg LP", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Metformina", "brandName": "Genérico", "presentation": "Metformina 850 mg comprimidos", "strength": "850 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Metformina", "brandName": "Genérico", "presentation": "Metformina 1000 mg LP comprimidos", "strength": "1000 mg LP", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Dapagliflozina", "brandName": "Forxiga", "presentation": "Forxiga (Dapagliflozina) 10 mg comprimidos", "strength": "10 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Metformina + Dapagliflozina", "brandName": "Xigduo XR", "presentation": "Xigduo XR (Metformina + Dapagliflozina) 1000/5 mg comprimidos", "strength": "1000/5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Metformina + Dapagliflozina", "brandName": "Xigduo XR", "presentation": "Xigduo XR (Metformina + Dapagliflozina) 1000/10 mg comprimidos", "strength": "1000/10 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Losartán", "brandName": "Genérico", "presentation": "Losartán 50 mg comprimidos", "strength": "50 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Losartán", "brandName": "Genérico", "presentation": "Losartán 100 mg comprimidos", "strength": "100 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Valsartán", "brandName": "Genérico", "presentation": "Valsartán 80 mg comprimidos", "strength": "80 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Valsartán", "brandName": "Genérico", "presentation": "Valsartán 160 mg comprimidos", "strength": "160 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": False},
    {"activePrinciple": "Clonazepam", "brandName": "Genérico", "presentation": "Clonazepam 0.5 mg comprimidos", "strength": "0.5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": True},
    {"activePrinciple": "Clonazepam", "brandName": "Genérico", "presentation": "Clonazepam 2 mg comprimidos", "strength": "2 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": True},
    {"activePrinciple": "Alprazolam", "brandName": "Genérico", "presentation": "Alprazolam 0.5 mg comprimidos", "strength": "0.5 mg", "form": "comprimido", "route": "Oral", "prescriptionRequired": True, "controlled": True},
    {"activePrinciple": "Tramadol", "brandName": "Genérico", "presentation": "Tramadol 50 mg cápsulas", "strength": "50 mg", "form": "cápsula", "route": "Oral", "prescriptionRequired": True, "controlled": True},
]

try:
    from generate_vademecum import LOCAL_PRESETS as LEGACY_LOCAL_PRESETS

    LOCAL_PRESETS = LEGACY_LOCAL_PRESETS
except Exception:
    pass


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []
        self.current_row = None
        self.current_cell = None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.current_row = []
        elif tag in ("td", "th") and self.current_row is not None:
            self.current_cell = []

    def handle_data(self, data):
        if self.current_cell is not None:
            self.current_cell.append(data)

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.current_row is not None and self.current_cell is not None:
            value = " ".join("".join(self.current_cell).split())
            self.current_row.append(html.unescape(value))
            self.current_cell = None
        elif tag == "tr" and self.current_row is not None:
            if any(cell.strip() for cell in self.current_row):
                self.rows.append(self.current_row)
            self.current_row = None


def clean_str(value):
    value = str(value or "").lower().strip()
    value = unicodedata.normalize("NFD", value)
    return "".join(ch for ch in value if unicodedata.category(ch) != "Mn")


def title_preserving_acronyms(value):
    value = " ".join(str(value or "").split())
    if not value:
        return ""
    small_words = {"de", "del", "la", "las", "el", "los", "y", "con", "para"}
    words = []
    for raw in value.split(" "):
        if raw.upper() in {"XR", "LP", "SL", "IM", "IV", "SC", "UI", "MG", "ML"}:
            words.append(raw.upper())
        elif raw.lower() in small_words:
            words.append(raw.lower())
        else:
            words.append(raw[:1].upper() + raw[1:].lower())
    return " ".join(words)


def hidden_value(page, name):
    match = re.search(rf'name="{re.escape(name)}"[^>]*value="([^"]*)"', page)
    return match.group(1) if match else ""


def post_form(form):
    data = urllib.parse.urlencode(form).encode()
    request = urllib.request.Request(
        BASE_URL,
        data=data,
        headers={
            "User-Agent": "Mozilla/5.0 ClaveSaludVademecumImporter/1.0",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


def base_form(page):
    return {
        "__EVENTTARGET": "",
        "__EVENTARGUMENT": "",
        "__LASTFOCUS": "",
        "__VIEWSTATE": hidden_value(page, "__VIEWSTATE"),
        "__VIEWSTATEGENERATOR": hidden_value(page, "__VIEWSTATEGENERATOR"),
        "__VIEWSTATEENCRYPTED": "",
        "__EVENTVALIDATION": hidden_value(page, "__EVENTVALIDATION"),
    }


def fetch_condition_export(condition):
    with urllib.request.urlopen(BASE_URL, timeout=60) as response:
        page = response.read().decode("utf-8", "replace")

    postback = base_form(page)
    postback.update({
        "__EVENTTARGET": "ctl00$ContentPlaceHolder1$chkTipoBusqueda$5",
        "ctl00$ContentPlaceHolder1$chkTipoBusqueda$5": "on",
        "ctl00$ContentPlaceHolder1$ddlEstado": "Sí",
    })
    page = post_form(postback).decode("utf-8", "replace")

    search = base_form(page)
    search.update({
        "ctl00$ContentPlaceHolder1$chkTipoBusqueda$5": "on",
        "ctl00$ContentPlaceHolder1$ddlCondicion": condition,
        "ctl00$ContentPlaceHolder1$ddlEstado": "Sí",
        "ctl00$ContentPlaceHolder1$btnBuscar": "Buscar",
    })
    page = post_form(search).decode("utf-8", "replace")

    export = base_form(page)
    export.update({
        "ctl00$ContentPlaceHolder1$chkTipoBusqueda$5": "on",
        "ctl00$ContentPlaceHolder1$ddlCondicion": condition,
        "ctl00$ContentPlaceHolder1$ddlEstado": "Sí",
        "ctl00$ContentPlaceHolder1$ImgBntExcel.x": "18",
        "ctl00$ContentPlaceHolder1$ImgBntExcel.y": "10",
    })
    return post_form(export)


def parse_export(export_bytes):
    # The export endpoint sends HTML-as-Excel encoded as Windows-1252.
    text = export_bytes.decode("cp1252", "replace")
    parser = TableParser()
    parser.feed(text)
    records = []
    for row in parser.rows[1:]:
        if len(row) < 7:
            continue
        registro, nombre, fecha, empresa, principio, control_legal = row[1:7]
        if not registro or not nombre:
            continue
        records.append({
            "registryId": registro,
            "name": nombre,
            "registeredAt": fecha,
            "laboratory": empresa,
            "activePrinciple": principio,
            "legalControl": control_legal,
        })
    return records


def extract_strength(name):
    match = re.search(
        r"\b\d+(?:[,.]\d+)?(?:/\d+(?:[,.]\d+)?)?\s*(?:mg|g|mcg|µg|ug|ml|mL|UI|U|%)"
        r"(?:/\d+(?:[,.]\d+)?\s*(?:mg|g|mcg|µg|ug|ml|mL|UI|U|%))?\b",
        name,
        re.IGNORECASE,
    )
    return match.group(0).replace(",", ".") if match else "N/A"


def extract_form_and_route(name):
    clean_name = clean_str(name)
    form = "comprimido"
    route = "Oral"

    form_patterns = [
        ("comprimido", ["comprimido", "comp.", "tableta", "gragea"]),
        ("cápsula", ["capsula", "caps.", "cápsula"]),
        ("gotas", ["gotas"]),
        ("jarabe", ["jarabe"]),
        ("suspensión oral", ["suspension oral", "suspensión oral"]),
        ("solución oral", ["solucion oral", "solución oral", "colutorio"]),
        ("solución inyectable", ["inyectable", "ampolla", "vial", "jeringa"]),
        ("crema", ["crema"]),
        ("ungüento", ["unguento", "ungüento"]),
        ("gel", ["gel"]),
        ("pomada", ["pomada"]),
        ("supositorio", ["supositorio"]),
        ("polvo", ["polvo"]),
        ("parche", ["parche"]),
        ("aerosol", ["aerosol", "inhalador", "puff"]),
        ("colirio", ["oftalmica", "oftálmica", "colirio"]),
        ("solución ótica", ["otica", "ótica"]),
    ]
    for candidate, patterns in form_patterns:
        if any(pattern in clean_name for pattern in patterns):
            form = candidate
            break

    if form in {"crema", "ungüento", "pomada", "gel", "parche"}:
        route = "Tópica"
    elif form == "aerosol":
        route = "Inhalatoria"
    elif form == "solución inyectable":
        route = "Inyectable"
    elif form == "supositorio":
        route = "Rectal"
    elif form == "colirio":
        route = "Oftálmica"
    elif form == "solución ótica":
        route = "Ótica"

    return form, route


def infer_brand(name, principle):
    clean_name = clean_str(name)
    clean_principle = clean_str(principle)
    if clean_principle and clean_name.startswith(clean_principle):
        return "Genérico"
    return title_preserving_acronyms(str(name).split()[0])


def normalize_record(raw, condition):
    name = raw["name"]
    active_principle = title_preserving_acronyms(raw["activePrinciple"]) or "No informado"
    form, route = extract_form_and_route(name)
    condition_clean = clean_str(condition)
    principle_clean = clean_str(active_principle)
    legal_clean = clean_str(raw.get("legalControl", ""))
    controlled = (
        condition_clean in CONTROLLED_CONDITIONS
        or any(token in principle_clean for token in CONTROLLED_PRINCIPLES)
        or bool(legal_clean)
    )
    return {
        "id": f"ISP-{raw['registryId']}",
        "activePrinciple": active_principle,
        "brandName": infer_brand(name, active_principle),
        "presentation": title_preserving_acronyms(name),
        "strength": extract_strength(name),
        "form": form,
        "route": route,
        "prescriptionRequired": condition_clean != "directa",
        "controlled": controlled,
        "source": "ISP Registro Sanitario",
        "lastUpdated": GENERATED_AT,
        "registryId": raw["registryId"],
        "laboratory": title_preserving_acronyms(raw["laboratory"]),
        "sourceUrl": BASE_URL,
        "condition": condition,
        "legalControl": raw.get("legalControl", ""),
    }


def main():
    all_items = []
    source_counts = {}
    for condition in CONDITIONS:
        print(f"Descargando Registro Sanitario ISP: {condition}")
        export_bytes = fetch_condition_export(condition)
        raw_records = parse_export(export_bytes)
        source_counts[condition] = len(raw_records)
        print(f"  {len(raw_records)} registros")
        all_items.extend(normalize_record(record, condition) for record in raw_records)

    local_items = []
    for idx, preset in enumerate(LOCAL_PRESETS, start=1):
        item = dict(preset)
        item.update({
            "id": f"LOC-{idx:04d}",
            "source": "local",
            "lastUpdated": GENERATED_AT,
        })
        local_items.append(item)

    merged = []
    seen = set()
    for item in local_items + all_items:
        key = (clean_str(item.get("registryId") or ""), clean_str(item["presentation"]))
        if key in seen:
            continue
        seen.add(key)
        merged.append(item)

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)

    report = {
        "sourceUrl": BASE_URL,
        "generatedAt": GENERATED_AT,
        "strategy": "Registro Sanitario ISP exportado por condición de venta + presets locales curados",
        "licenseNote": "Fuente oficial ISP consultada públicamente; validar términos institucionales antes de uso comercial masivo.",
        "conditions": source_counts,
        "localRows": len(local_items),
        "finalRows": len(merged),
        "activePrinciples": len({clean_str(item["activePrinciple"]) for item in merged if item.get("activePrinciple")}),
        "controlledRows": sum(1 for item in merged if item.get("controlled")),
        "prescriptionRequiredRows": sum(1 for item in merged if item.get("prescriptionRequired")),
    }
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
