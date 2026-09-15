import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, FileUp } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Button, Card, EmptyState } from "../components/ui";
import WorkspaceStepper from "../components/WorkspaceStepper";

/**
 * Workspace hub — routes users into the correct step of the flow:
 * no files → prompt to upload; files → Choose Work.
 */
export default function Workspace() {
  const { sessionFiles, selectedTransformation, generated } = useApp();
  const navigate = useNavigate();
  const readyFiles = sessionFiles.filter((f) => f.status === "ready");

  if (readyFiles.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[26px]">Workspace</h1>
          <p className="mt-1 text-[14px] text-mute">Upload a document to begin a transformation workflow.</p>
        </div>
        <WorkspaceStepper current="upload" />
        <Card>
          <EmptyState
            icon={<FileUp className="h-6 w-6" />}
            title="No documents uploaded yet"
            description="Upload a government document to start transforming your content."
            action={
              <Button variant="primary" onClick={() => navigate("/dashboard")}>
                + Add files <ArrowRight className="h-4 w-4" />
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  // Resume where the user left off
  if (generated && selectedTransformation) return <Navigate to="/workspace/preview" replace />;
  if (selectedTransformation) return <Navigate to="/workspace/configure" replace />;
  return <Navigate to="/workspace/configure" replace />;
}

