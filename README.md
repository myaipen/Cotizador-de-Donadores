# Cotizador de Bancos · Fertilidad Integral

Calculadora web para que el equipo comercial cotice óvulos de donante (OCP Fresco, OCP Congelado, Ovodonors) y semen de donante (LAFER, Genevity), compare opciones y copie el mensaje para el paciente.

Es un sitio estático (HTML + CSS + JS, sin dependencias) listo para **GitHub Pages**.

## Estructura

```
├── index.html                  # Página principal
├── assets/
│   ├── styles.css              # Estilos (modo claro y oscuro)
│   └── app.js                  # Lógica del cotizador
├── data/
│   └── bancos.js               # Precios (GENERADO desde el Excel, no editar a mano)
├── scripts/
│   └── actualizar_datos.py     # Convierte el Excel en data/bancos.js
├── .nojekyll
└── .gitignore                  # Bloquea subir archivos .xlsx
```

## Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub (ej. `cotizador-bancos-fi`).
2. Sube el contenido de esta carpeta:
   ```bash
   git init
   git add .
   git commit -m "Cotizador de bancos FI"
   git branch -M main
   git remote add origin https://github.com/<usuario>/cotizador-bancos-fi.git
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save**.
4. En 1–2 minutos queda en `https://<usuario>.github.io/cotizador-bancos-fi/`.

## Actualizar precios

Cuando cambie el Directorio de Bancos:

```bash
pip install openpyxl
python scripts/actualizar_datos.py ~/Descargas/Directorio_Bancos_FI_v4.xlsx
git add data/bancos.js
git commit -m "Precios actualizados DD.MM.AAAA"
git push
```

El script lee las 5 secciones del Excel por su título (`OCP — FRESCO`, `OCP — CONGELADO`, `LAFER`, `GENEVITY`, `OVODONORS`). Se pueden agregar o quitar donantes y categorías sin tocar código. Si se cambia el nombre de una sección o el orden de columnas, el script marca error.

## ⚠️ Confidencialidad: costos y margen

GitHub Pages publica el sitio **en abierto**: cualquiera con la URL puede ver el contenido, incluido `data/bancos.js`. Aunque el repositorio sea privado, el sitio de Pages sigue siendo público salvo en GitHub Enterprise Cloud.

Por eso:

- **Por defecto el script NO incluye costos de proveedor.** La casilla "Vista interna (costo y margen)" se oculta sola.
- El `.gitignore` impide subir el Excel fuente.
- `index.html` incluye `noindex` para que Google no lo indexe. Esto **no** es una protección de acceso.

Si se necesita la vista de margen para Revenue o Dirección, genera una versión interna **solo para uso local** (abre `index.html` directo en el navegador, sin subirla):

```bash
python scripts/actualizar_datos.py Directorio.xlsx --incluir-costos
```

Para un sitio con acceso restringido y costos, usa GitHub Enterprise (Pages privado), Cloudflare Pages + Access o Netlify con contraseña.

## Lógica de cálculo

| Concepto | Fórmula |
|---|---|
| Total con IVA | `Σ(precio c/IVA × cantidad) × (1 − descuento)` |
| Sin IVA | `Total ÷ 1.16` |
| Precio por óvulo | `Total óvulos con descuento ÷ # óvulos` |
| Costo Ovodonors por óvulo | `Costo lote ÷ óvulos maduros` |
| Margen (versión interna) | `(Óvulos ÷ 1.16 − Costo) ÷ (Óvulos ÷ 1.16)` · alerta < 25% |
| Traslado LAFER | `+$15,000` una vez por envío (Nacional y Extranjero) |

Precios referenciales. Confirmar disponibilidad y precio con Ana o @Rey antes de cotizar. El pago se realiza antes de apartar con el proveedor.
