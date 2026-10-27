import { Component, type ErrorInfo, type ReactNode } from "react";

/** Keeps Monitor → Simulate from bubbling into the TanStack root error page. */
export class SimulateSafeBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; message: string }
> {
  override state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Simulation panel failed to render.",
    };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.warn("[aegis] SimulateSafeBoundary caught", error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="ws-stack" role="alert">
          <p className="ws-note">Simulation UI recovered from a rendering error. The canonical network remains available.</p>
          <p className="ws-note">{this.state.message}</p>
          <button type="button" className="ws-action" onClick={() => this.setState({ hasError: false, message: "" })}>
            Retry Simulate panel
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
