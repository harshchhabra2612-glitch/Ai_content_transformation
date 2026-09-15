import os
import sys
import unittest
import json
from fastapi.testclient import TestClient

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE_DIR, "backend"))

from backend.main import app

client = TestClient(app)

def get_auth_headers(token="test-token-analyst"):
    return {"Authorization": f"Bearer {token}"}

class TestUploadAndKeypoints(unittest.TestCase):
    def test_document_upload_status_and_context_isolation(self):
        headers = get_auth_headers()

        # 1. Upload Document A
        doc_a_content = b"%PDF-1.4 Document A: Comprehensive Policy Guidelines for Renewable Energy and Solar Power Projects."
        res_a = client.post("/api/upload", files={"file": ("Document_A.pdf", doc_a_content, "application/pdf")}, headers=headers)
        self.assertEqual(res_a.status_code, 200, res_a.text)
        data_a = res_a.json()
        doc_id_a = data_a["document_id"]
        self.assertEqual(data_a["status"], "ready")
        self.assertEqual(data_a["stage"], "ready")

        # Verify status endpoint for Document A
        res_status_a = client.get(f"/api/documents/{doc_id_a}/status", headers=headers)
        self.assertEqual(res_status_a.status_code, 200)
        self.assertEqual(res_status_a.json()["document_id"], doc_id_a)
        self.assertEqual(res_status_a.json()["status"], "ready")

        # 2. Upload Document B
        doc_b_content = b"%PDF-1.4 Document B: Annual Financial Expenditure and Agricultural Budget Allocation for Fiscal Year 2026."
        res_b = client.post("/api/upload", files={"file": ("Document_B.pdf", doc_b_content, "application/pdf")}, headers=headers)
        self.assertEqual(res_b.status_code, 200, res_b.text)
        data_b = res_b.json()
        doc_id_b = data_b["document_id"]
        self.assertNotEqual(doc_id_a, doc_id_b)

        # Verify status endpoint for Document B
        res_status_b = client.get(f"/api/documents/{doc_id_b}/status", headers=headers)
        self.assertEqual(res_status_b.status_code, 200)
        self.assertEqual(res_status_b.json()["document_id"], doc_id_b)

    def test_context_retrieval_failure_error_message(self):
        headers = get_auth_headers()

        payload = {
            "transformation": "presentation",
            "document_id": "non-existent-doc-id-9999"
        }
        res = client.post("/api/chat", json=payload, headers=headers)
        self.assertEqual(res.status_code, 400)
        detail = res.json().get("detail", "")
        self.assertIn("Unable to generate presentation because relevant content could not be retrieved", detail)

if __name__ == "__main__":
    unittest.main()
