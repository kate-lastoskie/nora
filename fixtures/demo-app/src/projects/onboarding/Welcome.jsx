import { Step } from "./components/Step.jsx";

export function Welcome() {
  return (
    <ol style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", paddingLeft: "1.25rem" }}>
      <Step title="Pick a folder" done />
      <Step title="Choose a component" />
    </ol>
  );
}
