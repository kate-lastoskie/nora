import { Component } from "react";

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

/** Turn the common failure modes into something actionable. */
function diagnose(message) {
  if (/invalid hook call/i.test(message)) {
    return "Two copies of React are loaded. Check that react and react-dom resolve to one instance — this is what resolve.dedupe is for.";
  }
  if (/cannot read propert(y|ies) of (undefined|null)/i.test(message)) {
    return "Often a missing prop, or a context this component expects. Add a wrapper in nora.config to supply your providers, or give it props once the controls panel exists.";
  }
  if (/useContext|context/i.test(message)) {
    return "This component reads a React context that isn't present. Wrap it via the wrapper option in nora.config.";
  }
  if (/useNavigate|useLocation|useRouter|router/i.test(message)) {
    return "This component needs a router. Put your router provider in the wrapper option in nora.config.";
  }
  if (/is not a function/i.test(message)) {
    return "A prop this component calls wasn't passed. Until the controls panel lands, a wrapper that supplies defaults is the workaround.";
  }
  return null;
}
