"""Export features: summary, study notes, chat history → Markdown or PDF.

PDF export uses DejaVuSans TTF for Unicode support (non-Latin text,
smart quotes, mathematical symbols, etc.).
"""

from datetime import datetime, timezone
from pathlib import Path
from loguru import logger

try:
    from fpdf import FPDF
    FPDF_AVAILABLE = True
except ImportError:
    FPDF_AVAILABLE = False
    logger.warning("fpdf2 not installed. Run: pip install fpdf2")


# Path to bundled DejaVuSans font
_DEJAVU_PATH = Path(__file__).parent.parent / "fonts" / "DejaVuSans.ttf"


def _to_markdown_summary(filename: str, summary: dict) -> str:
    lines = [f"# Summary: {filename}\n",
             f"## Executive Summary\n{summary.get('executive_summary','')}\n",
             "## Key Topics\n" + "\n".join(f"- {t}" for t in summary.get("key_topics", [])),
             "\n## Key Takeaways\n" + "\n".join(f"{i+1}. {t}" for i, t in enumerate(summary.get("key_takeaways", []))),
             "\n## Important Entities\n" + "\n".join(f"- {e}" for e in summary.get("important_entities", []))]
    return "\n".join(lines)


def _to_markdown_study_notes(filename: str, notes: dict) -> str:
    lines = [f"# Study Notes: {filename}\n",
             f"## Summary\n{notes.get('summary','')}\n",
             "## Key Concepts\n"]
    for c in notes.get("key_concepts", []):
        lines.append(f"**{c.get('concept','')}**: {c.get('explanation','')}")
    lines.append("\n## Flashcards\n")
    for i, f in enumerate(notes.get("flashcards", []), 1):
        lines.append(f"**Q{i}:** {f.get('front','')}\n**A:** {f.get('back','')}\n")
    lines.append("## Viva Questions\n")
    for i, v in enumerate(notes.get("viva_questions", []), 1):
        lines.append(f"**Q{i}:** {v.get('question','')}\n**A:** {v.get('answer','')}\n")
    lines.append("## MCQs\n")
    for i, m in enumerate(notes.get("mcqs", []), 1):
        lines.append(f"**Q{i}:** {m.get('question','')}")
        for opt in m.get("options", []):
            marker = "✓" if opt.startswith(m.get("correct", "")) else " "
            lines.append(f"  {marker} {opt}")
        lines.append("")
    return "\n".join(lines)


def _to_markdown_history(conversations: list[dict]) -> str:
    lines = [f"# Chat History\nExported: {datetime.now(timezone.utc).isoformat()}\n"]
    for c in conversations:
        title = c.get("title")
        if title:
            lines.append(f"## {title}\n")
        messages = c.get("messages") or []
        if messages:
            # Real schema: an ordered list of user/assistant messages. Every
            # exchange is exported in chronological order, not just the
            # conversation's first question/answer.
            pending_question: str | None = None
            for msg in messages:
                role = msg.get("role")
                content = (msg.get("content") or "").strip()
                if role == "user":
                    pending_question = content
                    continue
                if role != "assistant":
                    continue
                if pending_question is not None:
                    lines.append(f"**Q:** {pending_question}\n")
                    pending_question = None
                lines.append(f"**A:** {content}\n")
                for ctx in msg.get("context") or []:
                    lines.append(
                        f"> Source: {ctx.get('source','')} | Confidence: {ctx.get('confidence_percent','')}%"
                    )
                lines.append("")
            if pending_question is not None:
                lines.append(f"**Q:** {pending_question}\n")
        else:
            # Legacy schema: a single Q&A frozen on the conversation record.
            lines.append(f"**Q:** {c.get('question','')}\n**A:** {c.get('answer','')}\n")
            for ctx in c.get("context") or []:
                lines.append(f"> Source: {ctx.get('source','')} | Confidence: {ctx.get('confidence_percent','')}%")
            lines.append("")
    return "\n".join(lines)


def export_markdown(export_type: str, data: dict) -> str:
    """Return markdown string for the given export type.
    export_type: 'summary' | 'study_notes' | 'history'
    """
    if export_type == "summary":
        return _to_markdown_summary(data.get("filename", ""), data.get("summary", {}))
    elif export_type == "study_notes":
        return _to_markdown_study_notes(data.get("filename", ""), data)
    elif export_type == "history":
        return _to_markdown_history(data.get("conversations", []))
    raise ValueError(f"Unknown export type: {export_type}")


def _init_pdf() -> "FPDF":
    """Create an FPDF instance with Unicode support (DejaVuSans if available)."""
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)

    if _DEJAVU_PATH.exists():
        pdf.add_font("DejaVu", "", str(_DEJAVU_PATH), uni=True)
        pdf.add_font("DejaVu", "B", str(_DEJAVU_PATH), uni=True)  # fpdf2 uses style via add_font
        pdf.set_font("DejaVu", size=11)
    else:
        logger.warning("DejaVuSans.ttf not found at %s — PDF export may not render non-Latin text correctly", _DEJAVU_PATH)
        pdf.set_font("Helvetica", size=11)

    return pdf


def export_pdf(export_type: str, data: dict) -> bytes:
    """Return PDF bytes for the given export type."""
    if not FPDF_AVAILABLE:
        raise RuntimeError("fpdf2 not installed. Run: pip install fpdf2")

    md = export_markdown(export_type, data)
    pdf = _init_pdf()
    pdf.add_page()

    for line in md.split("\n"):
        clean = line.replace("**", "").replace("✓", "[correct]").replace("##", "").replace("#", "").strip()
        if line.startswith("# "):
            pdf.set_font(pdf.font_family, "B", 16)
            pdf.cell(0, 10, clean, ln=True)
            pdf.set_font(pdf.font_family, size=11)
        elif line.startswith("## "):
            pdf.set_font(pdf.font_family, "B", 13)
            pdf.cell(0, 8, clean, ln=True)
            pdf.set_font(pdf.font_family, size=11)
        elif line.startswith("---"):
            pdf.ln(2)
            pdf.set_draw_color(200, 200, 200)
            pdf.line(10, pdf.get_y(), 200, pdf.get_y())
            pdf.ln(2)
        else:
            pdf.multi_cell(0, 7, clean)

    return bytes(pdf.output())