import os
import json
from datetime import datetime
from sqlalchemy.orm import Session

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, KeepTogether
)
from reportlab.platypus.flowables import Flowable

# ── Uncomment these when integrating into your FastAPI project ───────────────
# from models.models import Report, Patient, Analysis
# from schema.schemas import ReportCreate


# ════════════════════════════════════════════════════════════════════════════
#  DESIGN TOKENS
# ════════════════════════════════════════════════════════════════════════════

C_HEADER_BG = colors.HexColor('#0D2137')   # very dark navy
C_PRIMARY   = colors.HexColor('#1B4F72')   # deep navy
C_ACCENT    = colors.HexColor('#2E86AB')   # sky blue
C_SUCCESS   = colors.HexColor('#1E8449')   # green
C_WARNING   = colors.HexColor('#D68910')   # amber
C_DANGER    = colors.HexColor('#CB4335')   # red
C_LIGHT_BG  = colors.HexColor('#F2F6FA')   # panel bg
C_BORDER    = colors.HexColor('#D5E8F0')
C_TEXT      = colors.HexColor('#1A1A2E')
C_MUTED     = colors.HexColor('#6C757D')
C_WHITE     = colors.white
C_STRIPE    = colors.HexColor('#F7FBFF')

PAGE_W, PAGE_H = A4
CONTENT_W = PAGE_W - 40 * mm   # usable content width


def _risk_color(probability: float):
    if probability >= 70:
        return C_DANGER
    elif probability >= 40:
        return C_WARNING
    return C_SUCCESS


def _confidence_label(level: str):
    """Returns (display_label, color) for a confidence level string."""
    mapping = {
        'High':            ('HIGH CONFIDENCE',     C_SUCCESS),
        'Moderate':        ('MODERATE CONFIDENCE', C_WARNING),
        'Low':             ('LOW CONFIDENCE',       C_DANGER),
        'Analysis Failed': ('ANALYSIS FAILED',      C_MUTED),
    }
    return mapping.get(level, (level.upper(), C_MUTED))


# ════════════════════════════════════════════════════════════════════════════
#  CUSTOM FLOWABLES
# ════════════════════════════════════════════════════════════════════════════

class SectionHeader(Flowable):
    """Left-accented section title bar."""
    def __init__(self, text, width=CONTENT_W, color=None):
        super().__init__()
        self.text = text
        self.width = width
        self.color = color or C_PRIMARY

    def draw(self):
        c = self.canv
        # Thick left accent
        c.setFillColor(self.color)
        c.rect(0, 2, 4, 18, fill=1, stroke=0)
        # Light underline
        c.setFillColor(colors.HexColor('#E8EFF6'))
        c.rect(6, 2, self.width - 6, 18, fill=1, stroke=0)
        # Text
        c.setFillColor(self.color)
        c.setFont('Helvetica-Bold', 11)
        c.drawString(14, 6, self.text.upper())

    def wrap(self, *args):
        return (self.width, 26)


class HorizontalBar(Flowable):
    """Animated-style progress bar for probability/confidence scores."""
    def __init__(self, value: float, width=CONTENT_W, height=16,
                 bar_color=None, show_label=True):
        super().__init__()
        self.value = max(0.0, min(100.0, float(value)))
        self.track_w = width - 55
        self.width = width
        self.height = height
        self.bar_color = bar_color or _risk_color(value)
        self.show_label = show_label

    def draw(self):
        c = self.canv
        r = self.height / 2

        # Track
        c.setFillColor(colors.HexColor('#E8EEF4'))
        c.roundRect(0, 0, self.track_w, self.height, r, fill=1, stroke=0)

        # Fill
        fill_w = (self.value / 100) * self.track_w
        if fill_w > 0:
            c.setFillColor(self.bar_color)
            c.roundRect(0, 0, max(fill_w, r * 2), self.height, r, fill=1, stroke=0)
            # White shine strip at top
            c.setFillColor(colors.HexColor('#FFFFFF40'))
            c.rect(r, self.height * 0.6, max(fill_w - r * 2, 0), self.height * 0.25,
                   fill=1, stroke=0)

        if self.show_label:
            c.setFillColor(C_TEXT)
            c.setFont('Helvetica-Bold', 9)
            c.drawString(self.track_w + 8, 4, f"{self.value:.1f}%")

    def wrap(self, *args):
        return (self.width, self.height + 4)


class MetricCard(Flowable):
    """A single KPI card with value, label, and colored top border."""
    def __init__(self, label, value, color, width=52 * mm, height=38):
        super().__init__()
        self.label = label
        self.value = value
        self.color = color
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        # Card background
        c.setFillColor(C_LIGHT_BG)
        c.roundRect(0, 0, self.width, self.height, 4, fill=1, stroke=0)
        # Top accent line
        c.setFillColor(self.color)
        c.rect(0, self.height - 4, self.width, 4, fill=1, stroke=0)
        # Value
        c.setFillColor(self.color)
        c.setFont('Helvetica-Bold', 13)
        val_w = c.stringWidth(str(self.value), 'Helvetica-Bold', 13)
        c.drawString((self.width - val_w) / 2, self.height - 22, str(self.value))
        # Label
        c.setFillColor(C_MUTED)
        c.setFont('Helvetica', 7)
        lbl_w = c.stringWidth(self.label, 'Helvetica', 7)
        c.drawString((self.width - lbl_w) / 2, 6, self.label)

    def wrap(self, *args):
        return (self.width, self.height + 4)


# ════════════════════════════════════════════════════════════════════════════
#  PAGE TEMPLATE (header + footer on every page)
# ════════════════════════════════════════════════════════════════════════════

def _make_page_template(canvas_obj, doc):
    canvas_obj.saveState()

    # ── Top header strip ─────────────────────────────────────────────────────
    canvas_obj.setFillColor(C_HEADER_BG)
    canvas_obj.rect(0, PAGE_H - 48, PAGE_W, 48, fill=1, stroke=0)

    # Accent bar below header
    canvas_obj.setFillColor(C_ACCENT)
    canvas_obj.rect(0, PAGE_H - 50, PAGE_W, 3, fill=1, stroke=0)

    # Logo area: colored pill
    canvas_obj.setFillColor(C_ACCENT)
    canvas_obj.roundRect(18, PAGE_H - 37, 72, 20, 10, fill=1, stroke=0)
    canvas_obj.setFillColor(C_WHITE)
    canvas_obj.setFont('Helvetica-Bold', 10)
    canvas_obj.drawString(25, PAGE_H - 30, 'PathAI Pro')

    # Subtitle
    canvas_obj.setFillColor(colors.HexColor('#8BBFD8'))
    canvas_obj.setFont('Helvetica', 8)
    canvas_obj.drawString(98, PAGE_H - 28, 'Digital Pathology Analysis System')

    # Right side — case info
    canvas_obj.setFillColor(C_WHITE)
    canvas_obj.setFont('Helvetica-Bold', 8)
    canvas_obj.drawRightString(PAGE_W - 18, PAGE_H - 26,
                               f'Case: {getattr(doc, "case_id", "N/A")}')
    canvas_obj.setFillColor(colors.HexColor('#E87070'))
    canvas_obj.setFont('Helvetica-Bold', 7)
    canvas_obj.drawRightString(PAGE_W - 18, PAGE_H - 38,
                               'CONFIDENTIAL — CLINICAL USE ONLY')

    # ── Bottom footer ─────────────────────────────────────────────────────────
    canvas_obj.setStrokeColor(C_BORDER)
    canvas_obj.setLineWidth(0.5)
    canvas_obj.line(18, 32, PAGE_W - 18, 32)

    canvas_obj.setFillColor(C_MUTED)
    canvas_obj.setFont('Helvetica', 7)
    canvas_obj.drawString(18, 20,
        f'Generated: {datetime.now().strftime("%Y-%m-%d %H:%M")}  |  PathAI Pro v1.0')
    canvas_obj.drawCentredString(PAGE_W / 2, 20,
        'This report is for clinical decision support only. Verify with a qualified pathologist.')
    canvas_obj.drawRightString(PAGE_W - 18, 20, f'Page {doc.page}')

    canvas_obj.restoreState()


# ════════════════════════════════════════════════════════════════════════════
#  STYLES
# ════════════════════════════════════════════════════════════════════════════

def _get_styles():
    base = getSampleStyleSheet()
    return {
        'Normal': ParagraphStyle('RNormal', parent=base['Normal'],
                                  fontSize=9, textColor=C_TEXT, leading=14),
        'Center': ParagraphStyle('RCenter', parent=base['Normal'],
                                  fontSize=9, alignment=TA_CENTER, textColor=C_TEXT),
        'Small': ParagraphStyle('RSmall', parent=base['Normal'],
                                 fontSize=8, textColor=C_TEXT, leading=12),
        'Muted': ParagraphStyle('RMuted', parent=base['Normal'],
                                 fontSize=8, textColor=C_MUTED, leading=13),
        'Disclaimer': ParagraphStyle('RDisclaimer', parent=base['Normal'],
                                      fontSize=7, textColor=C_MUTED, leading=11),
        'TableHeader': ParagraphStyle('RTableHeader', parent=base['Normal'],
                                       fontSize=9, textColor=C_WHITE,
                                       alignment=TA_CENTER),
        'TableCell': ParagraphStyle('RTableCell', parent=base['Normal'],
                                     fontSize=8, textColor=C_TEXT,
                                     alignment=TA_CENTER, leading=12),
        'Explanation': ParagraphStyle('RExplanation', parent=base['Normal'],
                                       fontSize=9, textColor=C_TEXT, leading=15),
        'RecTitle': ParagraphStyle('RRecTitle', parent=base['Normal'],
                                    fontSize=9, textColor=C_WHITE,
                                    alignment=TA_CENTER),
    }


# ════════════════════════════════════════════════════════════════════════════
#  SECTION BUILDERS
# ════════════════════════════════════════════════════════════════════════════

def _section_patient(patient_dict, styles):
    """Patient information section."""
    items = []
    items.append(Spacer(1, 8))
    items.append(SectionHeader('Patient Information'))
    items.append(Spacer(1, 8))

    p = patient_dict
    data = [
        [Paragraph('<b>Case ID</b>', styles['Small']),
         Paragraph(str(p.get('case_id', '—')), styles['Normal']),
         Paragraph('<b>Patient Name</b>', styles['Small']),
         Paragraph(str(p.get('name', '—')), styles['Normal'])],
        [Paragraph('<b>Age</b>', styles['Small']),
         Paragraph(str(p.get('age', '—')), styles['Normal']),
         Paragraph('<b>Gender</b>', styles['Small']),
         Paragraph(str(p.get('gender', '—')).title(), styles['Normal'])],
        [Paragraph('<b>Report Date</b>', styles['Small']),
         Paragraph(datetime.now().strftime('%Y-%m-%d'), styles['Normal']),
         Paragraph('<b>Report Time</b>', styles['Small']),
         Paragraph(datetime.now().strftime('%H:%M'), styles['Normal'])],
    ]
    t = Table(data, colWidths=[38 * mm, 55 * mm, 38 * mm, 54 * mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), C_LIGHT_BG),
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#D6E4F0')),
        ('BACKGROUND', (2, 0), (2, -1), colors.HexColor('#D6E4F0')),
        ('FONTSIZE',   (0, 0), (-1, -1), 9),
        ('VALIGN',     (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING',    (0, 0), (-1, -1), 7),
        ('BOX',        (0, 0), (-1, -1), 1, C_BORDER),
        ('INNERGRID',  (0, 0), (-1, -1), 0.5, C_BORDER),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [C_LIGHT_BG, colors.white, C_LIGHT_BG]),
    ]))
    items.append(t)
    items.append(Spacer(1, 16))
    return items


def _section_analysis_summary(analysis_dict, styles):
    """KPI cards + probability bars."""
    items = []
    items.append(SectionHeader('Analysis Results'))
    items.append(Spacer(1, 10))

    prob = float(analysis_dict.get('lesion_probability', 0))
    conf = float(analysis_dict.get('overall_confidence', 0))
    conf_label, conf_color = _confidence_label(
        analysis_dict.get('confidence_level', 'Analysis Failed'))

    # ── 3-up metric cards ─────────────────────────────────────────────────────
    card_prob = MetricCard('LESION PROBABILITY', f'{prob:.1f}%',
                           _risk_color(prob), width=52 * mm)
    card_conf = MetricCard('OVERALL CONFIDENCE', f'{conf:.1f}%',
                           C_ACCENT, width=52 * mm)
    card_lvl  = MetricCard('CONFIDENCE LEVEL',
                           conf_label.replace(' CONFIDENCE', '').replace(' ', '\n'),
                           conf_color, width=66 * mm)

    card_row = Table([[card_prob, card_conf, card_lvl]],
                     colWidths=[56 * mm, 56 * mm, 70 * mm])
    card_row.setStyle(TableStyle([
        ('ALIGN',  (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 4),
    ]))
    items.append(card_row)
    items.append(Spacer(1, 14))

    # ── Probability bars ─────────────────────────────────────────────────────
    bar_section = [
        [Paragraph('<b>Lesion Probability</b>', styles['Small']),
         HorizontalBar(prob, bar_color=_risk_color(prob))],
        [Spacer(1, 4), Spacer(1, 4)],
        [Paragraph('<b>Overall Confidence</b>', styles['Small']),
         HorizontalBar(conf, bar_color=C_ACCENT)],
    ]
    bar_table = Table(bar_section, colWidths=[44 * mm, CONTENT_W - 44 * mm])
    bar_table.setStyle(TableStyle([
        ('VALIGN',  (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 2),
    ]))
    items.append(bar_table)
    items.append(Spacer(1, 16))
    return items


def _section_regional(regions, styles):
    """Per-region confidence table with color-coded risk."""
    items = []
    items.append(SectionHeader('Regional Analysis'))
    items.append(Spacer(1, 8))

    if not regions:
        items.append(Paragraph(
            'No regional data is available. The analysis may not have completed '
            'successfully, or no tissue regions were detected in the slide.',
            styles['Muted']))
        items.append(Spacer(1, 12))
        return items

    header_row = [
        Paragraph('<b>#</b>',           styles['TableHeader']),
        Paragraph('<b>Region</b>',      styles['TableHeader']),
        Paragraph('<b>Confidence</b>',  styles['TableHeader']),
        Paragraph('<b>Score</b>',       styles['TableHeader']),
        Paragraph('<b>Risk Level</b>',  styles['TableHeader']),
    ]
    rows = [header_row]
    for i, r in enumerate(regions, 1):
        c_val = float(r.get('confidence', 0))
        s_val = float(r.get('score', 0))
        risk  = 'High' if c_val >= 70 else ('Moderate' if c_val >= 40 else 'Low')
        rc    = _risk_color(c_val)
        hex_c = rc.hexval()[2:]
        rows.append([
            Paragraph(str(i),              styles['TableCell']),
            Paragraph(r.get('name', f'Region {i}'), styles['TableCell']),
            Paragraph(f'{c_val:.1f}%',     styles['TableCell']),
            Paragraph(f'{s_val:.4f}',      styles['TableCell']),
            Paragraph(f'<font color="#{hex_c}"><b>{risk}</b></font>',
                      styles['TableCell']),
        ])

    t = Table(rows, colWidths=[12 * mm, 68 * mm, 32 * mm, 28 * mm, 25 * mm])
    t.setStyle(TableStyle([
        ('BACKGROUND',     (0, 0), (-1, 0), C_PRIMARY),
        ('TEXTCOLOR',      (0, 0), (-1, 0), C_WHITE),
        ('ALIGN',          (0, 0), (-1, -1), 'CENTER'),
        ('ALIGN',          (1, 1), (1, -1), 'LEFT'),
        ('FONTNAME',       (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE',       (0, 0), (-1, -1), 9),
        ('TOPPADDING',     (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING',  (0, 0), (-1, -1), 7),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, C_STRIPE]),
        ('BOX',            (0, 0), (-1, -1), 1, C_BORDER),
        ('GRID',           (0, 0), (-1, -1), 0.3, C_BORDER),
    ]))
    items.append(t)
    items.append(Spacer(1, 16))
    return items


def _section_heatmap(analysis_data, styles):
    """Embed heatmap PNG if available."""
    items = []
    heatmap_path = (analysis_data.get('heatmap_path')
                    or analysis_data.get('heatmap_image'))
    if not heatmap_path or not os.path.exists(str(heatmap_path)):
        return items

    items.append(SectionHeader('Confidence Heatmap'))
    items.append(Spacer(1, 8))
    items.append(Paragraph(
        'Spatial distribution of tumor detection confidence across tissue regions. '
        'Warmer colors (red/orange) indicate higher lesion probability.',
        styles['Muted']))
    items.append(Spacer(1, 8))
    try:
        img = Image(str(heatmap_path), width=CONTENT_W, height=75 * mm)
        img.hAlign = 'CENTER'
        items.append(img)
    except Exception:
        items.append(Paragraph('Heatmap image could not be rendered.', styles['Muted']))
    items.append(Spacer(1, 16))
    return items


def _section_tile_distribution(tile_scores, styles):
    """Mini histogram of tile probability distribution."""
    items = []
    if not tile_scores:
        return items

    items.append(SectionHeader('Tile Probability Distribution'))
    items.append(Spacer(1, 8))

    # Build 10 buckets 0-9%, 10-19%, ... 90-100%
    bins = [0] * 10
    for s in tile_scores:
        idx = min(int(float(s) * 10), 9)
        bins[idx] += 1
    total = max(sum(bins), 1)
    max_bin = max(bins) or 1

    labels = [f'{i*10}-{(i+1)*10}%' for i in range(10)]
    col_w = 16 * mm

    count_row, bar_row, label_row = [], [], []
    for i, (cnt, lbl) in enumerate(zip(bins, labels)):
        pct    = cnt / total * 100
        bar_h  = max(2, int((cnt / max_bin) * 40))
        rc     = _risk_color(i * 10)
        hex_c  = rc.hexval()[2:]

        count_row.append(Paragraph(
            f'<font size="7"><b>{cnt}</b></font>', styles['Center']))

        # Represent bar height via font-size scaling (visual trick in ReportLab)
        bar_char = '|' * max(1, bar_h // 4)
        bar_row.append(Paragraph(
            f'<font size="{max(6, bar_h // 2)}" color="#{hex_c}"><b>|</b></font>',
            styles['Center']))

        label_row.append(Paragraph(
            f'<font size="6">{lbl}</font>', styles['Center']))

    t = Table(
        [count_row, bar_row, label_row],
        colWidths=[col_w] * 10,
    )
    t.setStyle(TableStyle([
        ('ALIGN',      (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN',     (1, 0), (-1, 1), 'BOTTOM'),
        ('PADDING',    (0, 0), (-1, -1), 2),
        ('BOX',        (0, 0), (-1, -1), 0.5, C_BORDER),
        ('BACKGROUND', (0, 0), (-1, -1), C_LIGHT_BG),
        ('LINEBELOW',  (0, 1), (-1, 1), 0.5, C_BORDER),
    ]))
    items.append(t)
    items.append(Spacer(1, 5))

    high_prob = sum(1 for s in tile_scores if float(s) >= 0.7)
    items.append(Paragraph(
        f'Total tiles analyzed: <b>{len(tile_scores)}</b>  ·  '
        f'High-probability tiles (&gt;70%): '
        f'<font color="#{C_DANGER.hexval()[2:]}"><b>{high_prob}</b></font>  ·  '
        f'High-probability rate: <b>{high_prob / total * 100:.1f}%</b>',
        styles['Muted']))
    items.append(Spacer(1, 16))
    return items


def _section_ai_explanation(ai_explanation, styles):
    """Groq LLaMA explanation in a styled callout box."""
    items = []
    if not ai_explanation:
        return items

    items.append(SectionHeader('AI Clinical Explanation', color=C_ACCENT))
    items.append(Spacer(1, 8))

    box = Table(
        [[Paragraph(ai_explanation, styles['Explanation'])]],
        colWidths=[CONTENT_W])
    box.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, -1), colors.HexColor('#EBF5FB')),
        ('BOX',           (0, 0), (-1, -1), 1.5, C_ACCENT),
        ('LEFTPADDING',   (0, 0), (-1, -1), 14),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 12),
        ('TOPPADDING',    (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    items.append(box)
    items.append(Spacer(1, 5))
    items.append(Paragraph(
        '<i>Explanation generated by Groq LLaMA. This is AI-assisted decision support — '
        'not a substitute for expert pathological review.</i>',
        styles['Disclaimer']))
    items.append(Spacer(1, 16))
    return items


def _section_recommendations(analysis_dict, styles):
    """Context-aware clinical recommendations based on risk level."""
    items = []
    prob       = float(analysis_dict.get('lesion_probability', 0))
    conf_level = analysis_dict.get('confidence_level', 'Analysis Failed')

    if conf_level == 'Analysis Failed':
        title = 'ANALYSIS FAILED — Manual Intervention Required'
        recs  = [
            'Analysis did not complete. Manual slide review is required.',
            'Verify slide quality, stain integrity, and image format compatibility.',
            'Re-submit the slide for analysis after resolving technical issues.',
            'Contact PathAI Pro support if the problem persists.',
        ]
        rc = C_MUTED
    elif prob >= 70:
        title = 'HIGH PRIORITY — Immediate Review Required'
        recs  = [
            'Immediate expert pathologist review is strongly recommended.',
            'Consider urgent biopsy or further tissue sampling for confirmation.',
            'Correlate with clinical symptoms, imaging, and patient history.',
            'Initiate clinical escalation protocol and document all findings.',
        ]
        rc = C_DANGER
    elif prob >= 40:
        title = 'MODERATE PRIORITY — Review Recommended'
        recs  = [
            'Pathologist review is recommended within standard clinical timeframes.',
            'Additional diagnostic workup may be warranted based on clinical context.',
            'Cross-reference with prior imaging studies if available.',
            'Consider follow-up analysis with higher-resolution slide scan.',
        ]
        rc = C_WARNING
    else:
        title = 'LOW PRIORITY — Routine Review'
        recs  = [
            'Routine pathologist review as per standard protocol.',
            'Results suggest low lesion probability; confirm with clinical correlation.',
            'Continue regular monitoring schedule as clinically appropriate.',
            'Archive report for longitudinal comparison in future analyses.',
        ]
        rc = C_SUCCESS

    items.append(SectionHeader('Clinical Recommendations', color=rc))
    items.append(Spacer(1, 8))

    # Priority badge
    badge = Table(
        [[Paragraph(f'<b>{title}</b>', styles['RecTitle'])]],
        colWidths=[CONTENT_W])
    badge.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), rc),
        ('PADDING',    (0, 0), (-1, -1), 9),
    ]))
    items.append(badge)
    items.append(Spacer(1, 8))

    hex_c = rc.hexval()[2:]
    for i, rec in enumerate(recs, 1):
        row = Table(
            [[Paragraph(f'<font color="#{hex_c}"><b>{i}</b></font>',
                        styles['Center']),
              Paragraph(rec, styles['Normal'])]],
            colWidths=[10 * mm, CONTENT_W - 10 * mm])
        row.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (-1, -1), colors.white),
            ('BOX',           (0, 0), (-1, -1), 0.5, C_BORDER),
            ('LEFTPADDING',   (0, 0), (-1, -1), 6),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 6),
            ('TOPPADDING',    (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
        ]))
        items.append(row)
        items.append(Spacer(1, 3))

    items.append(Spacer(1, 12))
    return items


# ════════════════════════════════════════════════════════════════════════════
#  MAIN SERVICE CLASS
# ════════════════════════════════════════════════════════════════════════════

class ReportService:
    """Drop-in replacement for the original ReportService."""

    @staticmethod
    def generate_pdf_report(db: Session, report_data) -> str:  # type: ignore[valid-type]
        from models.models import Patient, Analysis          # noqa: F401 — local import

        patient  = db.query(Patient).filter(Patient.id == report_data.patient_id).first()
        analysis = db.query(Analysis).filter(Analysis.id == report_data.analysis_id).first()
        if not patient or not analysis:
            raise ValueError('Patient or analysis not found')

        analysis_data = (json.loads(analysis.analysis_data)
                         if isinstance(analysis.analysis_data, str)
                         else (analysis.analysis_data or {}))

        return ReportService._build_pdf(
            case_id=patient.case_id,
            patient_dict={
                'case_id': patient.case_id,
                'name':    patient.name,
                'age':     patient.age,
                'gender':  patient.gender,
            },
            analysis_dict={
                'lesion_probability': analysis.lesion_probability,
                'overall_confidence': analysis.overall_confidence,
                'confidence_level':   analysis.confidence_level,
            },
            analysis_data=analysis_data,
            ai_explanation=analysis.ai_explanation,
        )

    @staticmethod
    def _build_pdf(case_id, patient_dict, analysis_dict,
                   analysis_data, ai_explanation=None,
                   output_dir='reports') -> str:
        os.makedirs(output_dir, exist_ok=True)
        filename = f"report_{case_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        path = os.path.join(output_dir, filename)

        doc = SimpleDocTemplate(
            path, pagesize=A4,
            topMargin=58, bottomMargin=42,
            leftMargin=20 * mm, rightMargin=20 * mm,
        )
        doc.case_id = case_id

        styles = _get_styles()
        story  = []

        story += _section_patient(patient_dict, styles)
        story += _section_analysis_summary(analysis_dict, styles)
        story += _section_regional(analysis_data.get('regions', []), styles)
        story += _section_heatmap(analysis_data, styles)
        story += _section_tile_distribution(
            analysis_data.get('tile_scores') or analysis_data.get('tile_probabilities', []),
            styles)
        story += _section_ai_explanation(ai_explanation, styles)
        story += _section_recommendations(analysis_dict, styles)

        doc.build(story,
                  onFirstPage=_make_page_template,
                  onLaterPages=_make_page_template)
        return path

    @staticmethod
    def create_report(db: Session, report_data) -> object:  # type: ignore[valid-type]
        from models.models import Report                     # noqa: F401 — local import

        report_path = ReportService.generate_pdf_report(db, report_data)
        db_report = Report(
            case_id=report_data.case_id,
            patient_id=report_data.patient_id,
            analysis_id=report_data.analysis_id,
            report_path=report_path,
        )
        db.add(db_report)
        db.commit()
        db.refresh(db_report)
        return db_report

    @staticmethod
    def get_report(db: Session, report_id: int):
        from models.models import Report                     # noqa: F401 — local import
        return db.query(Report).filter(Report.id == report_id).first()

    @staticmethod
    def get_reports_by_patient(db: Session, patient_id: int):
        from models.models import Report                     # noqa: F401 — local import
        return db.query(Report).filter(Report.patient_id == patient_id).all()