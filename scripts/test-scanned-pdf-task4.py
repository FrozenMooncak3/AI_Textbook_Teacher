import importlib.util
import json
import os
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


REPO_ROOT = Path(__file__).resolve().parents[1]
OCR_SERVER_PATH = REPO_ROOT / "scripts" / "ocr_server.py"


def load_ocr_server_module(ocr_provider=None):
    fake_paddleocr = types.ModuleType("paddleocr")

    class FakePaddleOCR:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs

        def ocr(self, *_args, **_kwargs):
            return []

    fake_paddleocr.PaddleOCR = FakePaddleOCR
    sys.modules["paddleocr"] = fake_paddleocr

    fake_pymupdf4llm = types.ModuleType("pymupdf4llm")
    fake_pymupdf4llm.to_markdown = lambda *_args, **_kwargs: ""
    sys.modules["pymupdf4llm"] = fake_pymupdf4llm

    module_name = f"ocr_server_test_module_task4_{ocr_provider or 'default'}"
    spec = importlib.util.spec_from_file_location(module_name, OCR_SERVER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Failed to load ocr_server.py")

    module = importlib.util.module_from_spec(spec)
    env_update = {}
    if ocr_provider is not None:
        env_update["OCR_PROVIDER"] = ocr_provider

    with patch.dict(os.environ, env_update, clear=False):
        if ocr_provider is None:
            previous = os.environ.pop("OCR_PROVIDER", None)
            try:
                spec.loader.exec_module(module)
            finally:
                if previous is not None:
                    os.environ["OCR_PROVIDER"] = previous
        else:
            spec.loader.exec_module(module)

    return module


class ScriptedCursor:
    def __init__(self, fetchone_values=None, fetchall_values=None):
        self.fetchone_values = list(fetchone_values or [])
        self.fetchall_values = list(fetchall_values or [])
        self.executed = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, sql, params):
        self.executed.append((sql, params))

    def fetchone(self):
        if self.fetchone_values:
            return self.fetchone_values.pop(0)
        return None

    def fetchall(self):
        if self.fetchall_values:
            return self.fetchall_values.pop(0)
        return []


class ScriptedConnection:
    def __init__(self, cursor):
        self.cursor_instance = cursor
        self.commit_count = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def cursor(self):
        return self.cursor_instance

    def commit(self):
        self.commit_count += 1

    def rollback(self):
        pass


class FakeDoc:
    def __init__(self, pages):
        self._pages = pages
        self.closed = False

    def __getitem__(self, index):
        return self._pages[index]

    def close(self):
        self.closed = True


class ProviderTests(unittest.TestCase):
    def test_default_ocr_provider_is_paddle_and_routes_to_paddle(self):
        ocr_server = load_ocr_server_module()

        with patch.object(ocr_server, "paddle_ocr", return_value="paddle-text") as paddle_mock:
            with patch.object(ocr_server, "google_ocr", return_value="google-text") as google_mock:
                result = ocr_server.ocr_page_image("image")

        self.assertEqual(ocr_server.OCR_PROVIDER, "paddle")
        self.assertEqual(result, "paddle-text")
        paddle_mock.assert_called_once_with("image")
        google_mock.assert_not_called()

    def test_ocr_page_image_routes_to_google_when_provider_is_google(self):
        ocr_server = load_ocr_server_module("google")

        with patch.object(ocr_server, "paddle_ocr", return_value="paddle-text") as paddle_mock:
            with patch.object(ocr_server, "google_ocr", return_value="google-text") as google_mock:
                result = ocr_server.ocr_page_image("image")

        self.assertEqual(ocr_server.OCR_PROVIDER, "google")
        self.assertEqual(result, "google-text")
        google_mock.assert_called_once_with("image")
        paddle_mock.assert_not_called()

    def test_paddle_ocr_uses_engine_output(self):
        ocr_server = load_ocr_server_module()

        with patch.object(ocr_server.np, "array", return_value="image-array") as array_mock:
            with patch.object(ocr_server.ocr_engine, "ocr", return_value="ocr-result") as ocr_mock:
                with patch.object(ocr_server, "extract_lines", return_value=(["line 1", "line 2"], 0.9)):
                    result = ocr_server.paddle_ocr("image")

        self.assertEqual(result, "line 1\nline 2")
        array_mock.assert_called_once_with("image")
        ocr_mock.assert_called_once_with("image-array", cls=True)

    def test_google_ocr_falls_back_to_paddle(self):
        ocr_server = load_ocr_server_module("google")

        with patch.object(ocr_server, "paddle_ocr", return_value="fallback-text") as paddle_mock:
            result = ocr_server.google_ocr(object())

        self.assertEqual(result, "fallback-text")
        paddle_mock.assert_called_once()


class HelperTests(unittest.TestCase):
    def test_replace_page_placeholder_updates_one_page(self):
        ocr_server = load_ocr_server_module()
        cursor = ScriptedCursor(fetchone_values=[("--- PAGE 1 ---\n[OCR_PENDING]\n--- PAGE 2 ---\n[OCR_PENDING]",)])
        connection = ScriptedConnection(cursor)
        captured = {}

        def capture_write(_connection, sql, params):
            captured["sql"] = sql
            captured["params"] = params

        with patch.object(ocr_server, "run_write", side_effect=capture_write):
            ocr_server.replace_page_placeholder(55, 2, "done text", connection)

        self.assertEqual(
            cursor.executed,
            [("SELECT raw_text FROM books WHERE id = %s", (55,))],
        )
        self.assertEqual(captured["sql"], "UPDATE books SET raw_text = %s WHERE id = %s")
        self.assertEqual(
            captured["params"],
            ("--- PAGE 1 ---\n[OCR_PENDING]\n--- PAGE 2 ---\ndone text", 55),
        )

    def test_check_module_ocr_completion_marks_module_done_when_last_scanned_page_finishes(self):
        ocr_server = load_ocr_server_module()
        cursor = ScriptedCursor(
            fetchall_values=[[(10, 1, 4), (20, 5, 6)]],
            fetchone_values=[
                (
                    json.dumps(
                        [
                            {"page": 1, "type": "text"},
                            {"page": 2, "type": "scanned"},
                            {"page": 4, "type": "mixed"},
                            {"page": 5, "type": "text"},
                            {"page": 6, "type": "scanned"},
                        ]
                    ),
                )
            ],
        )
        connection = ScriptedConnection(cursor)
        writes = []

        def capture_write(_connection, sql, params):
            writes.append((sql, params))

        with patch.object(ocr_server, "run_write", side_effect=capture_write):
            ocr_server.check_module_ocr_completion(9, 4, connection)

        self.assertEqual(
            cursor.executed,
            [
                (
                    "SELECT id, page_start, page_end FROM modules WHERE book_id = %s AND ocr_status = 'processing'",
                    (9,),
                ),
                ("SELECT page_classifications FROM books WHERE id = %s", (9,)),
            ],
        )
        self.assertEqual(
            writes,
            [("UPDATE modules SET ocr_status = 'done' WHERE id = %s", (10,))],
        )
        self.assertEqual(connection.commit_count, 1)


class ProcessPdfOcrTests(unittest.TestCase):
    def test_process_pdf_ocr_falls_back_to_legacy_when_classifications_missing(self):
        ocr_server = load_ocr_server_module()
        cursor = ScriptedCursor(fetchone_values=[None])
        connection = ScriptedConnection(cursor)
        logs = []

        def capture_log(_connection, level, action, details):
            logs.append((level, action, details))

        with patch.object(ocr_server.psycopg2, "connect", return_value=connection):
            with patch.object(ocr_server, "log_to_db", side_effect=capture_log):
                with patch.object(ocr_server, "extract_text_from_pdf", return_value="legacy text") as extract_mock:
                    with patch.object(ocr_server, "write_ocr_result") as write_mock:
                        ocr_server.process_pdf_ocr("/tmp/book.pdf", 123, "postgres://example")

        extract_mock.assert_called_once_with("/tmp/book.pdf", connection, 123)
        write_mock.assert_called_once_with(connection, 123, "legacy text")
        self.assertIn(("info", "OCR finished (legacy)", "bookId=123"), logs)

    def test_process_pdf_ocr_skips_when_all_pages_are_text(self):
        ocr_server = load_ocr_server_module()
        cursor = ScriptedCursor(
            fetchone_values=[(json.dumps([{"page": 1, "type": "text"}, {"page": 2, "type": "text"}]),)]
        )
        connection = ScriptedConnection(cursor)
        logs = []

        def capture_log(_connection, level, action, details):
            logs.append((level, action, details))

        with patch.object(ocr_server.psycopg2, "connect", return_value=connection):
            with patch.object(ocr_server, "log_to_db", side_effect=capture_log):
                with patch.object(ocr_server, "set_parse_status") as set_status_mock:
                    with patch.object(ocr_server.fitz, "open") as open_mock:
                        ocr_server.process_pdf_ocr("/tmp/book.pdf", 456, "postgres://example")

        set_status_mock.assert_called_once_with(connection, 456, "done")
        open_mock.assert_not_called()
        self.assertIn(("info", "OCR skipped (all text)", "bookId=456"), logs)

    def test_process_pdf_ocr_only_processes_scanned_and_mixed_pages(self):
        ocr_server = load_ocr_server_module()
        classifications = json.dumps(
            [
                {"page": 1, "type": "text"},
                {"page": 2, "type": "scanned"},
                {"page": 3, "type": "mixed"},
            ]
        )
        cursor = ScriptedCursor(fetchone_values=[(classifications,)])
        connection = ScriptedConnection(cursor)
        doc = FakeDoc(["page-1", "page-2", "page-3"])
        writes = []
        logs = []

        def capture_write(_connection, sql, params):
            writes.append((sql, params))

        def capture_log(_connection, level, action, details):
            logs.append((level, action, details))

        with patch.object(ocr_server.psycopg2, "connect", return_value=connection):
            with patch.object(ocr_server, "run_write", side_effect=capture_write):
                with patch.object(ocr_server, "log_to_db", side_effect=capture_log):
                    with patch.object(ocr_server.fitz, "open", return_value=doc):
                        with patch.object(ocr_server, "render_pdf_page", side_effect=["img-2", "img-3"]) as render_mock:
                            with patch.object(ocr_server, "ocr_page_image", side_effect=["ocr-2", "ocr-3"]) as ocr_mock:
                                with patch.object(ocr_server, "replace_page_placeholder") as replace_mock:
                                    with patch.object(ocr_server, "update_ocr_progress") as progress_mock:
                                        with patch.object(ocr_server, "check_module_ocr_completion") as module_mock:
                                            with patch.object(ocr_server, "set_parse_status") as set_status_mock:
                                                ocr_server.process_pdf_ocr("/tmp/book.pdf", 789, "postgres://example")

        self.assertTrue(doc.closed, "PDF document should be closed after OCR")
        self.assertEqual(
            writes,
            [
                (
                    "UPDATE books SET ocr_total_pages = %s, parse_status = 'processing' WHERE id = %s",
                    (2, 789),
                )
            ],
        )
        self.assertEqual(render_mock.call_args_list[0].args[0], "page-2")
        self.assertEqual(render_mock.call_args_list[1].args[0], "page-3")
        self.assertEqual(ocr_mock.call_args_list[0].args[0], "img-2")
        self.assertEqual(ocr_mock.call_args_list[1].args[0], "img-3")
        replace_mock.assert_any_call(789, 2, "ocr-2", connection)
        replace_mock.assert_any_call(789, 3, "ocr-3", connection)
        progress_mock.assert_any_call(connection, 789, 1, 2)
        progress_mock.assert_any_call(connection, 789, 2, 2)
        module_mock.assert_any_call(789, 2, connection)
        module_mock.assert_any_call(789, 3, connection)
        set_status_mock.assert_called_once_with(connection, 789, "done")
        self.assertIn(("info", "OCR finished", "bookId=789, scanned=2"), logs)


if __name__ == "__main__":
    unittest.main()
