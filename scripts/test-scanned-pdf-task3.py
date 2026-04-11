import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


REPO_ROOT = Path(__file__).resolve().parents[1]
OCR_SERVER_PATH = REPO_ROOT / "scripts" / "ocr_server.py"


def load_ocr_server_module(has_pymupdf4llm):
    fake_paddleocr = types.ModuleType("paddleocr")

    class FakePaddleOCR:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs

        def ocr(self, *_args, **_kwargs):
            return []

    fake_paddleocr.PaddleOCR = FakePaddleOCR
    sys.modules["paddleocr"] = fake_paddleocr

    if has_pymupdf4llm:
        fake_pymupdf4llm = types.ModuleType("pymupdf4llm")
        fake_pymupdf4llm.to_markdown = lambda *_args, **_kwargs: ""
        sys.modules["pymupdf4llm"] = fake_pymupdf4llm
    else:
        sys.modules.pop("pymupdf4llm", None)

    module_name = f"ocr_server_test_module_task3_{'with' if has_pymupdf4llm else 'without'}_llm"
    spec = importlib.util.spec_from_file_location(module_name, OCR_SERVER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Failed to load ocr_server.py")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FakePage:
    def __init__(self, text):
        self._text = text

    def get_text(self):
        return self._text


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


class FakeCursor:
    def __init__(self, fetched_row):
        self._fetched_row = fetched_row
        self.executed = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, sql, params):
        self.executed.append((sql, params))

    def fetchone(self):
        return self._fetched_row


class FakeReadConnection:
    def __init__(self, fetched_row):
        self.cursor_instance = FakeCursor(fetched_row)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def cursor(self):
        return self.cursor_instance


class FakeWriteConnection:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class ExtractTextRouteTests(unittest.TestCase):
    def test_extract_text_route_uses_pymupdf4llm_for_text_pages_and_placeholders_for_non_text_pages(self):
        ocr_server = load_ocr_server_module(has_pymupdf4llm=True)
        client = ocr_server.app.test_client()
        classifications = json.dumps(
            [
                {"page": 1, "type": "text"},
                {"page": 2, "type": "mixed"},
                {"page": 3, "type": "text"},
            ]
        )
        read_connection = FakeReadConnection((classifications,))
        write_connection = FakeWriteConnection()
        fake_doc = FakeDoc([FakePage("ignored 1"), FakePage("ignored 2"), FakePage("ignored 3")])
        captured = {}
        markdown_calls = []

        def capture_write(connection, sql, params):
            captured["connection"] = connection
            captured["sql"] = sql
            captured["params"] = params

        def fake_to_markdown(pdf_path, pages):
            markdown_calls.append((pdf_path, pages))
            return f"# Page {pages[0] + 1}"

        with patch.object(
            ocr_server.os.environ,
            "get",
            side_effect=lambda key, default=None: "postgres://example" if key == "DATABASE_URL" else default,
        ):
            with patch.object(ocr_server.fitz, "open", return_value=fake_doc):
                with patch.object(ocr_server.psycopg2, "connect", side_effect=[read_connection, write_connection]) as connect_mock:
                    with patch.object(ocr_server, "run_write", side_effect=capture_write):
                        with patch.object(ocr_server.pymupdf4llm, "to_markdown", side_effect=fake_to_markdown):
                            response = client.post(
                                "/extract-text",
                                json={"pdf_path": "/tmp/book.pdf", "book_id": 321},
                            )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(ocr_server.HAS_PYMUPDF4LLM)
        self.assertTrue(fake_doc.closed, "PDF document should be closed after extraction")
        self.assertEqual(connect_mock.call_count, 2)
        self.assertEqual(markdown_calls, [("/tmp/book.pdf", [0]), ("/tmp/book.pdf", [2])])
        self.assertEqual(
            read_connection.cursor_instance.executed,
            [("SELECT page_classifications FROM books WHERE id = %s", (321,))],
        )

        payload = response.get_json()
        expected_text = "\n".join(
            [
                "--- PAGE 1 ---\n# Page 1",
                "--- PAGE 2 ---\n[OCR_PENDING]",
                "--- PAGE 3 ---\n# Page 3",
            ]
        )
        self.assertEqual(payload, {"text": expected_text, "page_count": 2})
        self.assertEqual(captured["connection"], write_connection)
        self.assertEqual(captured["sql"], "UPDATE books SET raw_text = %s WHERE id = %s")
        self.assertEqual(captured["params"], (expected_text, 321))

    def test_extract_text_route_falls_back_to_page_text_when_pymupdf4llm_is_unavailable(self):
        ocr_server = load_ocr_server_module(has_pymupdf4llm=False)
        client = ocr_server.app.test_client()
        classifications = json.dumps([{"page": 1, "type": "text"}, {"page": 2, "type": "scanned"}])
        read_connection = FakeReadConnection((classifications,))
        write_connection = FakeWriteConnection()
        fake_doc = FakeDoc([FakePage("Plain page 1"), FakePage("Should be pending")])
        captured = {}

        def capture_write(connection, sql, params):
            captured["connection"] = connection
            captured["sql"] = sql
            captured["params"] = params

        with patch.object(
            ocr_server.os.environ,
            "get",
            side_effect=lambda key, default=None: "postgres://example" if key == "DATABASE_URL" else default,
        ):
            with patch.object(ocr_server.fitz, "open", return_value=fake_doc):
                with patch.object(ocr_server.psycopg2, "connect", side_effect=[read_connection, write_connection]):
                    with patch.object(ocr_server, "run_write", side_effect=capture_write):
                        response = client.post(
                            "/extract-text",
                            json={"pdf_path": "/tmp/book.pdf", "book_id": 654},
                        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(ocr_server.HAS_PYMUPDF4LLM)
        payload = response.get_json()
        expected_text = "\n".join(
            [
                "--- PAGE 1 ---\nPlain page 1",
                "--- PAGE 2 ---\n[OCR_PENDING]",
            ]
        )
        self.assertEqual(payload, {"text": expected_text, "page_count": 1})
        self.assertEqual(captured["params"], (expected_text, 654))

    def test_extract_text_route_requires_classification_to_exist_first(self):
        ocr_server = load_ocr_server_module(has_pymupdf4llm=True)
        client = ocr_server.app.test_client()
        read_connection = FakeReadConnection((None,))

        with patch.object(
            ocr_server.os.environ,
            "get",
            side_effect=lambda key, default=None: "postgres://example" if key == "DATABASE_URL" else default,
        ):
            with patch.object(ocr_server.psycopg2, "connect", return_value=read_connection):
                response = client.post(
                    "/extract-text",
                    json={"pdf_path": "/tmp/book.pdf", "book_id": 111},
                )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "Run /classify-pdf first"})


if __name__ == "__main__":
    unittest.main()
