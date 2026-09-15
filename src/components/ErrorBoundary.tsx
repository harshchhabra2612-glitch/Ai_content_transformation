import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./ui";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ERA FRONTEND RUNTIME ERROR]:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.hash = "#/dashboard";
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="app-canvas flex min-h-screen flex-col items-center justify-center p-6 text-center">
          <div className="max-w-xl rounded-2xl border border-red-200 bg-white p-8 shadow-xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <h1 className="mt-4 text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
              ERA encountered a frontend error.
            </h1>
            <p className="mt-2 text-xs text-mute">
              A runtime component exception occurred while rendering the workspace UI.
            </p>

            {this.state.error && (
              <div className="mt-4 rounded-xl border border-red-100 bg-red-50/70 p-4 text-left font-mono text-[11.5px] text-red-900 overflow-x-auto">
                <p className="font-bold">{this.state.error.toString()}</p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="mt-2 max-h-40 overflow-y-auto text-[10.5px] text-red-700 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="mt-6 flex items-center justify-center gap-3">
              <Button variant="primary" onClick={this.handleReset} icon={<RefreshCw className="h-4 w-4" />}>
                Reload Application
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
