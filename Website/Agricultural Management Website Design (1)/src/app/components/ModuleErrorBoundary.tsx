import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Shown in the fallback message, e.g. "Dashboard" or "Profit & Sales Ledger". */
  moduleLabel?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render-time errors thrown by whichever module panel is currently mounted (a bad chart
 * value, an unexpected Firebase document shape, etc.) so one broken section can't take down the
 * whole app shell -- sidebar, topbar and navigation stay usable, and the admin can just switch to
 * another tab. Without this, any uncaught error anywhere in a module's render tree would blank
 * the entire page to white with no way to recover except a manual refresh.
 */
export class ModuleErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ModuleErrorBoundary] ${this.props.moduleLabel ?? 'Module'} crashed:`, error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    // Recover automatically if the admin navigates away and back to a different module.
    if (this.state.hasError && prevProps.moduleLabel !== this.props.moduleLabel) {
      this.setState({ hasError: false });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-card/95 border border-destructive/30 rounded-xl p-8 shadow-sm flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="font-bold font-heading text-foreground">
            {this.props.moduleLabel ? `${this.props.moduleLabel} hit a snag` : 'This section hit a snag'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Something on this page failed to render. Your data is safe -- switching to another tab and back,
            or retrying below, usually fixes it.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2d5016] hover:bg-[#234010] text-white text-sm font-bold px-4 py-2.5 transition-all active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
