"""Formato corporativo de Industrias Iberia para los archivos que genera el asistente.

Excel (openpyxl), Word (python-docx) y PowerPoint (python-pptx). Cada función es
tolerante: si una librería o la letra DM Sans no están, cae a lo que haya.
"""
import os
from datetime import date, datetime

ROJO = 'D4332C'
CARBON = '2B2A28'
GRIS = '706A67'
FONDO = 'F6F7F9'
BORDE = 'E4E6EA'
LETRA = 'DM Sans'
LETRA_RESPALDO = 'Arial'
AQUI = os.path.dirname(os.path.abspath(__file__))
LOGO = os.path.join(AQUI, 'iberia.png')

MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']


def fecha_larga(d=None):
    d = d or date.today()
    return f'{d.day} de {MESES[d.month - 1]} de {d.year}'


def letra():
    try:
        import matplotlib.font_manager as fm
        if any(LETRA.lower() in f.name.lower() for f in fm.fontManager.ttflist):
            return LETRA
    except Exception:
        pass
    return LETRA_RESPALDO


# ── Excel ──────────────────────────────────────────────────────────────────────
def aplicar_excel(wb, hojas=None):
    """Encabezado rojo con letra blanca, primera fila congelada, anchos, filas alternas y formatos."""
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter

    f = letra()
    rojo = PatternFill('solid', fgColor=ROJO)
    alterno = PatternFill('solid', fgColor=FONDO)
    fino = Side(style='thin', color=BORDE)
    for ws in wb.worksheets:
        if hojas and ws.title not in hojas:
            continue
        if ws.max_row < 1 or ws.max_column < 1:
            continue
        for c in ws[1]:
            c.font = Font(name=f, bold=True, color='FFFFFF', size=11)
            c.fill = rojo
            c.alignment = Alignment(vertical='center', wrap_text=True)
        ws.freeze_panes = 'A2'
        ws.row_dimensions[1].height = 24
        # Lectura por filas: sirve también con miles de filas.
        anchos = {}
        for i, fila in enumerate(ws.iter_rows(min_row=2, max_row=ws.max_row), start=2):
            for c in fila:
                c.font = Font(name=f, size=10, color=CARBON)
                c.border = Border(bottom=fino)
                if i % 2 == 0:
                    c.fill = alterno
                if isinstance(c.value, (int, float)) and not isinstance(c.value, bool):
                    c.number_format = '#,##0.00' if isinstance(c.value, float) else '#,##0'
                elif isinstance(c.value, (datetime, date)):
                    c.number_format = 'DD/MM/YYYY'
                largo = len(str(c.value)) if c.value is not None else 0
                anchos[c.column] = max(anchos.get(c.column, 0), min(largo, 60))
        for c in ws[1]:
            anchos[c.column] = max(anchos.get(c.column, 0), len(str(c.value or '')))
        for col, ancho in anchos.items():
            ws.column_dimensions[get_column_letter(col)].width = max(10, ancho + 2)
        ws.sheet_view.showGridLines = False
    return wb


# ── Word ───────────────────────────────────────────────────────────────────────
def documento_word(titulo, subtitulo=None):
    """Documento con logo, título, fecha, estilos de Iberia y pie con la página."""
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Cm, Pt, RGBColor

    f = letra()
    doc = Document()
    for s in doc.sections:
        s.top_margin = s.bottom_margin = Cm(2.2)
        s.left_margin = s.right_margin = Cm(2.4)
    base = doc.styles['Normal']
    base.font.name = f
    base.font.size = Pt(10.5)
    base.font.color.rgb = RGBColor.from_string(CARBON)
    for nombre, tam in (('Heading 1', 16), ('Heading 2', 13), ('Heading 3', 11.5)):
        st = doc.styles[nombre]
        st.font.name = f
        st.font.size = Pt(tam)
        st.font.bold = True
        st.font.color.rgb = RGBColor.from_string(CARBON)
    if os.path.exists(LOGO):
        doc.add_picture(LOGO, height=Cm(1.0))
    t = doc.add_paragraph()
    r = t.add_run(titulo)
    r.bold = True
    r.font.size = Pt(20)
    r.font.color.rgb = RGBColor.from_string(CARBON)
    if subtitulo:
        s = doc.add_paragraph().add_run(subtitulo)
        s.font.size = Pt(12)
        s.font.color.rgb = RGBColor.from_string(GRIS)
    fecha = doc.add_paragraph().add_run(fecha_larga())
    fecha.font.size = Pt(9.5)
    fecha.font.color.rgb = RGBColor.from_string(GRIS)
    # Línea roja bajo el encabezado.
    p = doc.add_paragraph()
    borde = OxmlElement('w:pBdr')
    inferior = OxmlElement('w:bottom')
    for k, v in (('w:val', 'single'), ('w:sz', '12'), ('w:space', '1'), ('w:color', ROJO)):
        inferior.set(qn(k), v)
    borde.append(inferior)
    p._p.get_or_add_pPr().append(borde)
    # Pie: «Industrias Iberia · Uso interno · página N».
    pie = doc.sections[0].footer.paragraphs[0]
    pie.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    rp = pie.add_run('Industrias Iberia · Uso interno · página ')
    rp.font.size = Pt(8.5)
    rp.font.color.rgb = RGBColor.from_string(GRIS)
    campo = OxmlElement('w:fldSimple')
    campo.set(qn('w:instr'), 'PAGE')
    pie._p.append(campo)
    return doc


def tabla_word(tabla):
    """Encabezado rojo con letra blanca, filas alternas y bordes finos."""
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Pt, RGBColor

    def sombrear(celda, color):
        tcPr = celda._tc.get_or_add_tcPr()
        shd = OxmlElement('w:shd')
        shd.set(qn('w:val'), 'clear')
        shd.set(qn('w:color'), 'auto')
        shd.set(qn('w:fill'), color)
        tcPr.append(shd)

    tabla.style = 'Table Grid'
    for i, fila in enumerate(tabla.rows):
        for celda in fila.cells:
            for par in celda.paragraphs:
                for run in par.runs:
                    run.font.size = Pt(9.5)
                    if i == 0:
                        run.font.bold = True
                        run.font.color.rgb = RGBColor(255, 255, 255)
            if i == 0:
                sombrear(celda, ROJO)
            elif i % 2 == 0:
                sombrear(celda, FONDO)
    return tabla


# ── PowerPoint ─────────────────────────────────────────────────────────────────
def presentacion(titulo, subtitulo=None):
    """Presentación 16:9 con la portada de Iberia."""
    from pptx import Presentation
    from pptx.dml.color import RGBColor
    from pptx.util import Cm, Pt

    prs = Presentation()
    prs.slide_width, prs.slide_height = Cm(33.867), Cm(19.05)
    lam = prs.slides.add_slide(prs.slide_layouts[6])
    if os.path.exists(LOGO):
        lam.shapes.add_picture(LOGO, Cm(2), Cm(2), height=Cm(1.6))
    barra = lam.shapes.add_shape(1, Cm(2), Cm(8.2), Cm(2.2), Cm(0.25))
    barra.fill.solid()
    barra.fill.fore_color.rgb = RGBColor.from_string(ROJO)
    barra.line.fill.background()
    caja = lam.shapes.add_textbox(Cm(2), Cm(8.8), Cm(28), Cm(3))
    p = caja.text_frame.paragraphs[0]
    p.text = titulo
    p.font.size, p.font.bold, p.font.name = Pt(36), True, letra()
    p.font.color.rgb = RGBColor.from_string(CARBON)
    if subtitulo:
        q = caja.text_frame.add_paragraph()
        q.text = subtitulo
        q.font.size, q.font.name = Pt(18), letra()
        q.font.color.rgb = RGBColor.from_string(GRIS)
    pie = lam.shapes.add_textbox(Cm(2), Cm(17), Cm(20), Cm(1)).text_frame.paragraphs[0]
    pie.text = f'Industrias Iberia · {fecha_larga()}'
    pie.font.size, pie.font.name = Pt(11), letra()
    pie.font.color.rgb = RGBColor.from_string(GRIS)
    return prs


def lamina(prs, titulo):
    """Lámina en blanco con el título y la línea roja; devuelve la lámina para seguir agregando."""
    from pptx.dml.color import RGBColor
    from pptx.util import Cm, Pt

    lam = prs.slides.add_slide(prs.slide_layouts[6])
    caja = lam.shapes.add_textbox(Cm(1.6), Cm(1.0), Cm(30), Cm(2))
    p = caja.text_frame.paragraphs[0]
    p.text = titulo
    p.font.size, p.font.bold, p.font.name = Pt(26), True, letra()
    p.font.color.rgb = RGBColor.from_string(CARBON)
    linea = lam.shapes.add_shape(1, Cm(1.6), Cm(3.0), Cm(1.8), Cm(0.18))
    linea.fill.solid()
    linea.fill.fore_color.rgb = RGBColor.from_string(ROJO)
    linea.line.fill.background()
    if os.path.exists(LOGO):
        lam.shapes.add_picture(LOGO, Cm(29.2), Cm(17.6), height=Cm(0.8))
    return lam
