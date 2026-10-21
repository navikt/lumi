import { Component, type ErrorInfo, type ReactNode } from "react";

interface SlideErrorBoundaryProps {
  slideId: string;
  children: ReactNode;
}

interface SlideErrorBoundaryState {
  error: Error | null;
}

/** Keeps a failing slide from taking the rest of the deck down. */
export class SlideErrorBoundary extends Component<
  SlideErrorBoundaryProps,
  SlideErrorBoundaryState
> {
  state: SlideErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): SlideErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(
      `Lysbildet «${this.props.slideId}» feilet`,
      error,
      info.componentStack,
    );
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="deck-slide-error" role="alert">
        <p className="deck-slide-error__title">Lysbildet kunne ikke vises</p>
        <p>
          Id: <code>{this.props.slideId}</code>
        </p>
        <pre className="deck-slide-error__message">{error.message}</pre>
      </div>
    );
  }
}
