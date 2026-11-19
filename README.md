# LOTI-CUENTAS

Aplicación web para **sacar las cuentas de una lotización** desde el celular: lista de separaciones, gastos, monto recaudado y reparto entre socios. Todo se recalcula al instante al editar cualquier campo.

🌐 **Sitio:** https://valmig872-code.github.io/loti-cuentas/

> 🔒 **Privacidad:** tus datos se guardan solo en este dispositivo (en el navegador); haz respaldo en JSON. Nada de lo que escribes se sube a este repositorio ni a ningún servidor.

## Qué hace

Replica la hoja de cálculo de cuentas de lotización:

| Bloque | Cálculo |
| --- | --- |
| Lista de separaciones | **Total adelantos** = suma de todos los adelantos |
| Gastos (monto fijo o por personal) | Costo por personal = precio unitario × N° de personas · **Total gastos** = suma de costos |
| Resultado | **Monto total recaudado** = Total adelantos − Total gastos |
| | **Monto para cada socio** = Recaudado ÷ cantidad de socios |
| Distribución de ganancias | **Descuento** = Yape que ya recibió el socio · **Monto final** = Monto para cada socio − Descuento |

- Monto final negativo → en rojo, **"debe devolver"**. Positivo → **"se le debe pagar"**.
- Interruptor opcional **"Registrar quién recibió el Yape"**: agrega la columna *Recibido por (socio)* y calcula solo el Yape de cada socio (se puede sobrescribir a mano; ↺ vuelve al automático).
- **Separaciones por boletero**: escribes una vez el nombre del boletero o personal y debajo anotas sus separaciones. Cada boletero muestra su subtotal en Yape, en efectivo y total; al final sale el total general. El total de adelantos sigue siendo la suma de todo.
- Hasta 3 números de celular por separación.
- Filas sin límite: agrega o elimina separaciones, gastos y socios.
- Varias lotizaciones con nombre: abrir, duplicar, renombrar y borrar.

## Instalar como app (celular o computadora)

LOTI-CUENTAS es una app instalable (PWA): queda con su ícono, se abre a pantalla completa y **funciona sin internet** (incluidos PDF y Excel).

- **Android (Chrome):** abre el sitio → toca **Instalar** en el aviso, o menú ⋮ → **Instalar app**.
- **iPhone / iPad (Safari):** botón **Compartir** (□↑) → **Agregar a pantalla de inicio**.
- **Computadora (Chrome o Edge):** ícono de instalar en la barra de direcciones, o el botón **📲 Instalar como app** en "Exportar y respaldo". Queda en el menú Inicio / escritorio.

La app instalada usa los mismos datos que el sitio en ese navegador. Cuando se publica una mejora, la app la descarga sola en segundo plano y la muestra la próxima vez que la abras.

## Cómo se usa

1. Abre el sitio en el celular (puedes "Agregar a pantalla de inicio" desde el menú del navegador).
2. Elige la lotización en el selector de arriba o crea una con **+ Nueva**.
3. Escribe en las celdas amarillas (editables). Las celdas azules se calculan solas.
4. Abajo, en **Exportar y respaldo**:
   - **Copiar resumen para WhatsApp**: copia el texto listo para pegar.
   - **Exportar a Excel (.xlsx)**: genera la hoja con el mismo formato y fórmulas del formato original.
   - **Imprimir / guardar PDF**: genera un documento formal en blanco y negro (título con el lugar, resultados resaltados); elige "Guardar como PDF".
   - **Importar Excel antiguo**: carga un archivo con la estructura del formato de cuentas (se procesa solo en tu navegador).

## Respaldo (importante)

Los datos viven en el almacenamiento del navegador de **ese** dispositivo. Si borras los datos del navegador, cambias de teléfono o usas otro navegador, no estarán ahí.

- **Descargar respaldo (JSON)**: guarda un archivo con *todas* tus lotizaciones. Guárdalo en tu Drive, correo o WhatsApp personal.
- **Importar respaldo (JSON)**: en otro dispositivo (o después de borrar datos), carga ese archivo para recuperar todo. Si una lotización ya existe, se reemplaza por la del respaldo.

## Cómo actualizar el sitio

El sitio se publica con GitHub Pages desde la rama `main` (carpeta raíz). Cualquier cambio que subas a `main` se publica solo en 1–2 minutos:

```powershell
git add .
git commit -m "Describe el cambio"
git push
```

Estructura:

```
index.html        página
css/styles.css    estilos (móvil primero + impresión)
js/calc.js        fórmulas (equivalentes a las del Excel)
js/excel.js       exportar / importar .xlsx (ExcelJS 4.4.0 desde jsDelivr)
js/app.js         interfaz, guardado local, respaldo y resumen
sw.js             modo sin conexión (service worker)
manifest.webmanifest + icons/   datos e íconos de la app instalable
```

Si cambias la lista de archivos de la app, agrégalos también a `ARCHIVOS` en `sw.js`.

No hay paso de compilación: es HTML, CSS y JavaScript puro. Para probar en tu PC: `python -m http.server 8000` dentro de la carpeta y abre http://localhost:8000.

**Nunca subas archivos Excel con datos reales** al repositorio (es público). El `.gitignore` ya bloquea `*.xlsx` y los respaldos JSON.
