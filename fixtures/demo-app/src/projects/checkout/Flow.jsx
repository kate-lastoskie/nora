import { tokens } from "@ui/tokens.js";
import { CartLine } from "./components/CartLine.jsx";
import { Total } from "./components/Total.jsx";

/**
 * The design this folder is about. Its parts live one level down, so a scan of
 * this folder alone has to follow those imports to know Flow is the design and
 * Aside, which sorts first, is not.
 */
export function Flow() {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", width: 360 }}>
      <h2 style={{ margin: "0 0 0.75rem", color: tokens.ink }}>Your cart</h2>
      <CartLine name="Linen shirt" price={68} />
      <CartLine name="Canvas tote" price={24} />
      <Total amount={92} />
    </div>
  );
}
