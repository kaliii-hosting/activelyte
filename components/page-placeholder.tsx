import React from "react";

// Minimal on-brand placeholder for routes that don't have content yet.
export function PagePlaceholder({
  title,
  subtitle = "coming soon",
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <section
      style={{
        // fill the viewport (minus the global header above and the space
        // reserved for the bottom nav), framed like the artboard pages —
        // the top edge (and its corner cut) comes from the global header
        minHeight:
          "calc(100dvh - var(--bottom-nav-h, 160px) - env(safe-area-inset-bottom) - 180px)",
        border: "1.5px solid #4A4A4A",
        borderTop: "none",
        borderBottom: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        textAlign: "center",
        padding: "2rem 1rem",
      }}
    >
      <h1
        style={{
          fontFamily: "'Rajdhani', system-ui, sans-serif",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          fontSize: "clamp(2rem, 7vw, 3.5rem)",
          color: "#fa8004",
          margin: 0,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontFamily: "'Rajdhani', system-ui, sans-serif",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.35em",
          fontSize: "0.9rem",
          color: "#7c7c7c",
          margin: 0,
        }}
      >
        {subtitle}
      </p>
    </section>
  );
}
