import os
import sys
import unittest
from fastapi.testclient import TestClient

# Add backend directory to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE_DIR, "backend"))

from backend.main import app
from backend.security.config import ENFORCE_MFA
import backend.security.config as security_config

client = TestClient(app)


class TestSecuritySuite(unittest.TestCase):

    def setUp(self):
        # Enable MFA enforcement during tests for Part 3 & 18 verification
        security_config.ENFORCE_MFA = True

    def test_01_unauthenticated_user_access(self):
        """1. Unauthenticated user -> protected API -> Expected 401"""
        res = client.get("/api/user/profile")
        self.assertEqual(res.status_code, 401)
        self.assertIn("Unauthorized", res.json().get("detail", ""))

    def test_02_viewer_upload_access(self):
        """2. Viewer -> upload -> Expected 403"""
        headers = {"Authorization": "Bearer test-token-viewer"}
        files = {"file": ("test.pdf", b"Dummy PDF content", "application/pdf")}
        res = client.post("/api/upload", headers=headers, files=files)
        self.assertEqual(res.status_code, 403)
        self.assertIn("Forbidden", res.json().get("detail", ""))

    def test_03_analyst_transform_access(self):
        """3. Analyst -> transform -> Expected success (200)"""
        headers = {"Authorization": "Bearer test-token-analyst"}
        payload = {"transformation": "summarize", "question": "Test summary request"}
        res = client.post("/api/chat", headers=headers, json=payload)
        self.assertEqual(res.status_code, 200)
        self.assertIn("transformation", res.json())

    def test_04_viewer_transform_access(self):
        """4. Viewer -> transform -> Expected 403"""
        headers = {"Authorization": "Bearer test-token-viewer"}
        payload = {"transformation": "summarize", "question": "Test summary request"}
        res = client.post("/api/chat", headers=headers, json=payload)
        self.assertEqual(res.status_code, 403)
        self.assertIn("Forbidden", res.json().get("detail", ""))

    def test_05_user_a_access_user_b_document(self):
        """5. User A -> User B document -> Expected 403"""
        # Step A: User B uploads a document
        headers_b = {"Authorization": "Bearer test-user-b"}
        files_b = {"file": ("user_b_private.pdf", b"Secret Document of User B", "application/pdf")}
        upload_res = client.post("/api/upload", headers=headers_b, files=files_b)
        self.assertEqual(upload_res.status_code, 200)
        doc_id = upload_res.json()["document_id"]

        # Step B: User A attempts to read User B's document
        headers_a = {"Authorization": "Bearer test-user-a"}
        access_res = client.get(f"/api/documents/{doc_id}", headers=headers_a)
        self.assertEqual(access_res.status_code, 403)
        self.assertIn("Forbidden", access_res.json().get("detail", ""))

    def test_06_non_admin_access_admin_endpoint(self):
        """6. User (Officer/Analyst) -> admin endpoint -> Expected 403"""
        headers = {"Authorization": "Bearer test-token-officer"}
        res = client.get("/api/admin/users", headers=headers)
        self.assertEqual(res.status_code, 403)

    def test_07_invalid_file_type_upload(self):
        """7. Invalid file type (.exe) -> Expected 400"""
        headers = {"Authorization": "Bearer test-token-officer"}
        files = {"file": ("malware.exe", b"binary content", "application/x-msdownload")}
        res = client.post("/api/upload", headers=headers, files=files)
        self.assertEqual(res.status_code, 400)
        self.assertIn("extension", res.json().get("detail", "").lower())

    def test_08_oversized_file_upload(self):
        """8. Oversized file -> Expected 413"""
        headers = {"Authorization": "Bearer test-token-officer"}
        # Create a file payload > 15MB
        large_bytes = b"0" * (16 * 1024 * 1024)
        files = {"file": ("large.pdf", large_bytes, "application/pdf")}
        res = client.post("/api/upload", headers=headers, files=files)
        self.assertEqual(res.status_code, 413)

    def test_09_path_traversal_filename(self):
        """9. Path traversal filename -> Expected rejected/safely sanitized"""
        headers = {"Authorization": "Bearer test-token-officer"}
        files = {"file": ("../../secret_system_file.pdf", b"Valid PDF content", "application/pdf")}
        res = client.post("/api/upload", headers=headers, files=files)
        self.assertEqual(res.status_code, 200)
        filename = res.json()["filename"]
        self.assertNotIn("..", filename)
        self.assertNotIn("/", filename)
        self.assertEqual(filename, "secret_system_file.pdf")

    def test_10_unauthorized_access_attempt_audit_log(self):
        """10. Unauthorized access attempt -> Expected audit log created"""
        # User A attempts to access non-existent or un-owned document
        headers = {"Authorization": "Bearer test-user-a"}
        _ = client.get("/api/documents/non-existent-doc-id", headers=headers)

        # Inspect audit logs via Admin
        headers_admin = {"Authorization": "Bearer test-token-admin"}
        audit_res = client.get("/api/admin/audit-logs", headers=headers_admin)
        self.assertEqual(audit_res.status_code, 200)
        logs = audit_res.json()["audit_logs"]
        self.assertTrue(len(logs) > 0)
        # Check if audit event is recorded
        unauthorized_events = [l for l in logs if l.get("action") == "UNAUTHORIZED_ACCESS_ATTEMPT"]
        self.assertTrue(len(unauthorized_events) > 0)

    def test_11_admin_role_change(self):
        """11. Admin role change -> Expected only authorized admin can change roles"""
        # Non-admin attempt
        headers_officer = {"Authorization": "Bearer test-token-officer"}
        res = client.patch("/api/admin/users/uid-analyst/role", headers=headers_officer, json={"role": "ADMIN"})
        self.assertEqual(res.status_code, 403)

        # Admin attempt
        headers_admin = {"Authorization": "Bearer test-token-admin"}
        res = client.patch("/api/admin/users/uid-analyst/role", headers=headers_admin, json={"role": "OFFICER"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["user"]["role"], "OFFICER")

    def test_12_mfa_required_operation_without_mfa(self):
        """12. MFA-required operation without MFA -> Expected denied (403 MFA_REQUIRED)"""
        # User B (Officer role) has 'share' permission, but share_document requires MFA verification
        headers_b = {"Authorization": "Bearer test-user-b"}
        files_b = {"file": ("mfa_doc.pdf", b"Content", "application/pdf")}
        upload_res = client.post("/api/upload", headers=headers_b, files=files_b)
        doc_id = upload_res.json()["document_id"]

        # User B tries to share document without verified MFA
        share_res = client.post(f"/api/documents/{doc_id}/share", headers=headers_b, json={"target_user_id": "uid-analyst"})
        self.assertEqual(share_res.status_code, 403)
        self.assertIn("MFA_REQUIRED", share_res.json().get("detail", ""))


if __name__ == "__main__":
    unittest.main()
