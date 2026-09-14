// Exists to prove the error boundary produces something useful rather than a
// blank canvas. Reads a prop that is never passed.
export function BrokenOnPurpose({ user }) {
  return <div>Signed in as {user.profile.name}</div>;
}
