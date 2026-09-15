import { Component } from "react";
import { diagnose } from "./diagnose.js";

/**
 * A component rendered outside its app will often throw — a missing provider,
 * a required prop, a hook called with no context. The boundary's job is to say
 * which of those it was, because the raw stack rarely does.
 *
 * This runs inside the iframe, so its classes are namespaced noraf- and styled by
 * frame.css rather than the shell's stylesheet.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const message = String(error.message ?? error);
    const hint = diagnose(message);

    return (
      <div className="noraf-error">
        <div className="noraf-error-head">{this.props.name} Failed to Render</div>
        <pre className="noraf-error-msg">{message}</pre>
        {hint ? <div className="noraf-error-hint">{hint}</div> : null}
      </div>
    );
  }
}
