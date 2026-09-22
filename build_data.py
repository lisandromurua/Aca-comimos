#!/usr/bin/env python3
"""
Convierte data/lugares-completo.csv en ../data.js (window.PLACES = [...]) para la web.

Correr esto cada vez que se edita el CSV (nuevo lugar, cambio de puntaje, etc.):

    python3 tools/build_data.py

Lugares cerrados: las filas con cerrado="1" se excluyen del data.js (no aparecen en
la web) pero quedan en el CSV como registro histórico. Se cuentan por consola.

Coordenadas: si la fila tiene algo cargado en la columna "ubicacion" (formato
"lat, lon", tal cual lo copia Google Maps desde el botón derecho del mapa), se usa
ese valor exacto. Si no, se ubica el lugar en el centro aproximado de su
barrio/localidad (coordenadas a mano en COORDS más abajo), con un pequeño jitter
determinístico (según el id) para que varios lugares del mismo barrio no queden
apilados en el mismo punto exacto del mapa. Si agregás un lugar en un
barrio/localidad que todavía no está en COORDS y no tiene "ubicacion" cargada, el
script avisa por consola y lo deja en el centro de Córdoba Capital como fallback.
"""
import csv
import json
import hashlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
CSV_PATH = HERE.parent / "data" / "lugares-completo.csv"
OUT_PATH = HERE.parent / "data.js"

# Centros aproximados (lat, lon) por barrio (Córdoba Capital) o por localidad
# (cuando no hay barrio, p.ej. otras ciudades/pueblos). Solo se usan como
# fallback cuando el lugar no tiene coordenadas exactas cargadas en "ubicacion".
COORDS = {
    # Barrios de Córdoba Capital
    ("Centro", "Córdoba Capital"): (-31.4201, -64.1888),
    ("Nueva Córdoba", "Córdoba Capital"): (-31.4297, -64.1839),
    ("Güemes", "Córdoba Capital"): (-31.4258, -64.1815),
    ("Alta Córdoba", "Córdoba Capital"): (-31.3897, -64.1789),
    ("Alberdi", "Córdoba Capital"): (-31.4133, -64.2035),
    ("Gral Paz", "Córdoba Capital"): (-31.3975, -64.1791),
    ("General Paz", "Córdoba Capital"): (-31.3975, -64.1791),
    ("Jardín", "Córdoba Capital"): (-31.3839, -64.1975),
    ("Parque Sarmiento", "Córdoba Capital"): (-31.4258, -64.1789),
    ("Zona norte", "Córdoba Capital"): (-31.3650, -64.1950),
    ("Rogelio Martinez", "Córdoba Capital"): (-31.3550, -64.2350),
    ("Tejas", "Córdoba Capital"): (-31.3520, -64.2450),
    ("Manantiales", "Córdoba Capital"): (-31.3800, -64.2700),
    ("Nuevocentro Shopping", "Córdoba Capital"): (-31.4310, -64.1848),
    ("Núñez", "Ciudad de Buenos Aires"): (-34.5453, -58.4633),
    # Localidades sin barrio (pueblos / otras ciudades)
    ("", "Ciudad de Buenos Aires"): (-34.6037, -58.3816),
    ("", "Colonia Caroya"): (-31.1667, -64.0833),
    ("", "El Cuadrado"): (-31.0500, -64.4900),
    ("", "La Cumbre"): (-30.9833, -64.5167),
    ("", "Salsipuedes"): (-31.1333, -64.3167),
    ("", "Santa Rosa de Calamuchita"): (-32.0667, -64.5333),
    ("", "Villa Allende"): (-31.2953, -64.2953),
    ("", "Villa Carlos Paz"): (-31.4241, -64.4978),
}

FALLBACK = (-31.4201, -64.1888)  # centro de Córdoba Capital


def jitter(seed_str, scale=0.004):
    """Desplazamiento pseudo-random pero determinístico (mismo id -> mismo jitter)."""
    h = hashlib.md5(seed_str.encode("utf-8")).hexdigest()
    a = (int(h[0:8], 16) / 0xFFFFFFFF) - 0.5
    b = (int(h[8:16], 16) / 0xFFFFFFFF) - 0.5
    return a * scale, b * scale


def to_num(v):
    if v is None or v == "":
        return None
    return float(v)


def parse_ubicacion(v):
    """Parsea 'lat, lon' (formato de Google Maps al copiar coordenadas). None si no hay o es inválido."""
    if not v:
        return None
    parts = [p.strip() for p in v.replace(";", ",").split(",")]
    if len(parts) != 2:
        return None
    try:
        return float(parts[0]), float(parts[1])
    except ValueError:
        return None


def main():
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    places = []
    missing_coords = set()
    n_cerrados = 0
    n_exact_coords = 0

    for row in rows:
        if row.get("cerrado"):
            n_cerrados += 1
            continue  # los cerrados no llegan a la web, solo quedan en el CSV

        exact = parse_ubicacion(row.get("ubicacion", ""))
        if exact:
            lat, lon = round(exact[0], 6), round(exact[1], 6)
            n_exact_coords += 1
        else:
            key = (row["barrio"], row["localidad"])
            base = COORDS.get(key)
            if base is None:
                missing_coords.add(key)
                base = FALLBACK
            dlat, dlon = jitter(row["id"])
            lat = round(base[0] + dlat, 6)
            lon = round(base[1] + dlon, 6)

        places.append({
            "id": int(row["id"]),
            "nombre": row["nombre"],
            "provincia": row["provincia"],
            "localidad": row["localidad"],
            "barrio": row["barrio"] or None,
            "categoria": row.get("categoria") or None,
            "momento": row["momento_dia"],
            "precio": row["precio"],
            "comida": to_num(row["comida"]),
            "lugar": to_num(row["lugar"]),
            "atencion": to_num(row["atencion"]),
            "nota": to_num(row["nota_final"]),
            "resena": row["resena"],
            "visitas": row["visitas"],
            "distincion": row["distincion"] or None,
            "recomendado": bool(row.get("recomendado")),
            "lat": lat,
            "lon": lon,
        })

    if missing_coords:
        print("ATENCION: sin coordenadas cargadas para estos barrio/localidad (se usó el centro de Córdoba Capital como fallback):")
        for k in missing_coords:
            print("  ", k)
        print("Agregalos a mano en el diccionario COORDS de este script, o cargá 'ubicacion' en el CSV.")

    places.sort(key=lambda p: p["id"])

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write("// Datos de Comimos Acá — generado desde data/lugares-completo.csv\n")
        f.write("// Los lugares marcados como cerrados en el CSV se excluyen de este archivo.\n")
        f.write("// Coordenadas: exactas cuando la fila tiene 'ubicacion' cargada; si no, aproximadas a nivel de barrio/localidad.\n")
        f.write("// No editar a mano: correr tools/build_data.py despues de tocar el CSV.\n")
        f.write("window.PLACES = ")
        f.write(json.dumps(places, ensure_ascii=False, indent=2))
        f.write(";\n")

    print(f"Escritos {len(places)} lugares en {OUT_PATH} ({n_cerrados} cerrados excluidos, {n_exact_coords} con coordenadas exactas)")


if __name__ == "__main__":
    main()
