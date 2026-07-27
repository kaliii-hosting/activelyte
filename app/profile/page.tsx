export default function ProfilePage() {
  // Intentionally blank for now — the global top header (in the root layout)
  // still renders above. Keeps the full-screen framed container so it lines up
  // with the header's side borders, matching every other page.
  return (
    <section
      aria-label="Profile"
      style={{
        minHeight:
          "calc(100dvh - var(--bottom-nav-h, 160px) - env(safe-area-inset-bottom) - 180px)",
        border: "1.5px solid #4A4A4A",
        borderTop: "none",
        borderBottom: "none",
      }}
    />
  );
}
