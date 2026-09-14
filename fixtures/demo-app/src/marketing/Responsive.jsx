import { useEffect, useState } from "react";

/**
 * The viewport canary.
 *
 * This reports its breakpoint two ways: through CSS `@media` rules, and through
 * `window.innerWidth` read at render. Both only change if the component sits in
 * a real viewport. Inside a CSS-width div they would both report the browser
 * window and every preset would look identical — which is why the previewer
 * uses an iframe.
 */
const css = `
.rsp { font-family: ui-sans-serif, system-ui, sans-serif; text-align: center; }
.rsp-band { padding: 1.25rem 1.5rem; border-radius: 12px; border: 1px solid #d8dce1; background: #fff; }
.rsp-name::after { content: "base"; }
.rsp-grid { display: grid; gap: 8px; margin-top: 1rem; grid-template-columns: 1fr; }
.rsp-cell { background: #e2eef3; color: #14607f; border-radius: 6px; padding: 0.6rem; font-size: 12px; font-family: ui-monospace, monospace; }

@media (min-width: 640px) {
  .rsp-name::after { content: "sm — 640+"; }
  .rsp-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1024px) {
  .rsp-name::after { content: "lg — 1024+"; }
  .rsp-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (min-width: 1400px) {
  .rsp-name::after { content: "xl — 1400+"; }
  .rsp-grid { grid-template-columns: repeat(4, 1fr); }
}
`;

export function Responsive() {
  // Subscribing matters: a component that reads innerWidth once at render keeps
  // the width it mounted with, in this previewer and in a real browser alike.
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="rsp">
      <style>{css}</style>
      <div className="rsp-band">
        <div
          style={{
            fontSize: 11,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "#5c6672",
          }}
        >
          breakpoint
        </div>
        <div
          className="rsp-name"
          style={{
            fontSize: 26,
            fontWeight: 600,
            color: "#14171c",
            margin: "0.3rem 0 0.1rem",
            fontFamily: "ui-monospace, monospace",
          }}
        />
        <div style={{ fontSize: 12, color: "#5c6672", fontFamily: "ui-monospace, monospace" }}>
          window.innerWidth = <span data-testid="inner-width">{width}</span>
        </div>
        <div className="rsp-grid">
          <div className="rsp-cell">one</div>
          <div className="rsp-cell">two</div>
          <div className="rsp-cell">three</div>
          <div className="rsp-cell">four</div>
        </div>
      </div>
    </div>
  );
}
