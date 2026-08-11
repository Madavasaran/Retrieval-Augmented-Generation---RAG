import os
from io import BytesIO

from pypdf import PdfReader
from pypdf.errors import PdfReadError


def validate_pdf_upload(filename: str | None, file_bytes: bytes) -> str:
    """
    Validate an uploaded PDF and return a safe basename filename.

    Raises ValueError when the upload is invalid.
    """
    if not filename or not filename.strip():
        raise ValueError("Filename is required")

    safe_filename = os.path.basename(filename.strip())
    if not safe_filename:
        raise ValueError("Filename is required")

    if not safe_filename.lower().endswith(".pdf"):
        raise ValueError("Only PDF files are supported")

    if not file_bytes:
        raise ValueError("Uploaded file is empty")

    if not file_bytes.startswith(b"%PDF"):
        raise ValueError("File is not a valid PDF")

    try:
        reader = PdfReader(BytesIO(file_bytes), strict=False)
        if len(reader.pages) == 0:
            raise ValueError("PDF contains no pages")
    except PdfReadError as exc:
        raise ValueError("File is not a valid PDF") from exc

    return safe_filename
