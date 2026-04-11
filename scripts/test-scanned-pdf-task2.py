import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


REPO_ROOT = Path(__file__).resolve().parents[1]
OCR_SERVER_PATH = REPO_ROOT / "scripts" / "ocr_server.py"


def load_ocr_server_module():
    fake_paddleocr = types.ModuleType("paddleocr")

    class FakePaddleOCR:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs

        def ocr(self, *_args, **_kwargs):
            return []

    fake_paddleocr.PaddleOCR = FakePaddleOCR
    sys.modules["paddleocr"] = fake_paddleocr

    spec = importlib.util.spec_from_file_location("ocr_server_test_module", OCR_SERVER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Failed to load ocr_server.py")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FakeRect:
    def __init__(self, width, height):
        self.width = width
        self.height = height


class FakePage:
    def __init__(self, text, image_rects_by_xref=None, width=100, height=100):
        self._text = text
        self._image_rects_by_xref = image_rects_by_xref or {}
        self.rect = FakeRect(width, height)

    def get_text(self):
        return self._text

    def get_images(self):
        return [(xref,) for xref in self._image_rects_by_xref]

    def get_image_rects(self, xref):
        return self._image_rects_by_xref.get(xref, [])


class FakeDoc:
    def __init__(self, pages):
        self._pages = pages
        self.closed = False

    def __len__(self):
        return len(self._pages)

    def __getitem__(self, index):
        return self._pages[index]

    def close(self):
        self.closed = True


class FakeConnection:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class ClassifyPageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ocr_server = load_ocr_server_module()

    def test_classify_page_function_exists(self):
        self.assertTrue(
            hasattr(self.ocr_server, "classify_page"),
            "ocr_server.py should define classify_page(page)",
        )

    def test_classify_page_returns_text_for_text_heavy_page(self):
        self.assertEqual(
            self.ocr_server.classify_page(FakePage("A" * 80)),
            "text",
        )

    def test_classify_page_returns_scanned_for_image_heavy_page(self):
        page = FakePage(
            "tiny",
            image_rects_by_xref={1: [FakeRect(80, 100)]},
        )
        self.assertEqual(self.ocr_server.classify_page(page), "scanned")

    def test_classify_page_returns_mixed_for_middle_case(self):
        page = FakePage(
            "B" * 40,
            image_rects_by_xref={1: [FakeRect(55, 100)]},
        )
        self.assertEqual(self.ocr_server.classify_page(page), "mixed")


class ClassifyPdfRouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ocr_server = load_ocr_server_module()
        cls.client = cls.ocr_server.app.test_client()

    def test_classify_pdf_route_persists_page_counts_and_types(self):
        pages = [
            FakePage("A" * 80),
            FakePage("tiny", image_rects_by_xref={1: [FakeRect(80, 100)]}),
            FakePage("B" * 40, image_rects_by_xref={1: [FakeRect(55, 100)]}),
        ]
        fake_doc = FakeDoc(pages)
        fake_connection = FakeConnection()
        captured = {}

        def capture_write(connection, sql, params):
            captured["connection"] = connection
            captured["sql"] = sql
            captured["params"] = params

        with patch.object(self.ocr_server.os.environ, "get", side_effect=lambda key, default=None: "postgres://example" if key == "DATABASE_URL" else default):
            with patch.object(self.ocr_server.fitz, "open", return_value=fake_doc):
                with patch.object(self.ocr_server.psycopg2, "connect", return_value=fake_connection) as connect_mock:
                    with patch.object(self.ocr_server, "run_write", side_effect=capture_write):
                        response = self.client.post(
                            "/classify-pdf",
                            json={"pdf_path": "/tmp/book.pdf", "book_id": 123},
                        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(fake_doc.closed, "PDF document should be closed after classification")
        self.assertEqual(connect_mock.call_args.args[0], "postgres://example")

        payload = response.get_json()
        self.assertEqual(
            payload,
            {
                "pages": [
                    {"page": 1, "type": "text"},
                    {"page": 2, "type": "scanned"},
                    {"page": 3, "type": "mixed"},
                ],
                "text_count": 1,
                "scanned_count": 2,
            },
        )

        self.assertIn("UPDATE books", captured["sql"])
        serialized_pages, text_count, scanned_count, book_id = captured["params"]
        self.assertEqual(json.loads(serialized_pages), payload["pages"])
        self.assertEqual(text_count, 1)
        self.assertEqual(scanned_count, 2)
        self.assertEqual(book_id, 123)


if __name__ == "__main__":
    unittest.main()
