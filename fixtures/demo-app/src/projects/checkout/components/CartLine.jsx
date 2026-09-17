import { tokens } from "@ui/tokens.js";

export function CartLine({ name = "Item", price = 0 }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "0.5rem 0",
        borderBottom: `1px solid ${tokens.line}`,
      }}
    >
      <span>{name}</span>
      <span>${price}</span>
    </div>
  );
}
