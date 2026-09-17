export function Total({ amount = 0 }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "0.75rem" }}>
      <strong>Total</strong>
      <strong>${amount}</strong>
    </div>
  );
}
