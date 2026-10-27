import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-slate-50">
          <div className="flex flex-col items-center w-full max-w-2xl p-8 bg-white rounded-xl shadow-lg border border-slate-200">
            <AlertTriangle
              size={48}
              className="text-rose-600 mb-4 flex-shrink-0"
            />

            <h2 className="text-xl font-bold text-slate-900 mb-4">An unexpected error occurred.</h2>

            <div className="p-4 w-full rounded-lg bg-slate-100 overflow-auto mb-6 border border-slate-200">
              <pre className="text-xs text-slate-800 whitespace-break-spaces">
                {this.state.error?.stack}
              </pre>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-700 text-white font-medium hover:bg-blue-800 cursor-pointer shadow-sm transition"
            >
              <RotateCcw size={16} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
