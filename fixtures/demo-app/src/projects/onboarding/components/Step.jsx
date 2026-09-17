export function Step({ title = "Step", done = false }) {
  return <li style={{ opacity: done ? 0.5 : 1 }}>{title}</li>;
}
