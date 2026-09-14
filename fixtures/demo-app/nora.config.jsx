/**
 * Optional. Sits in the project root and is loaded through Vite, so JSX,
 * aliases, and CSS imports all work inside it.
 */
export default {
  // Which folder to open on boot.
  defaultDir: "src/components",

  // Everything the previewed component needs around it: providers, a router,
  // a theme. Without this, anything that reads context renders as an error.
  wrapper: ({ children }) => (
    <div data-demo-wrapper style={{ padding: "1.5rem", borderRadius: 16 }}>
      {children}
    </div>
  ),

  // Patterns are relative to the folder being previewed.
  exclude: ["**/*.test.*", "**/legacy/**"],
};
