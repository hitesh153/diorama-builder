"use client";

/**
 * The shared app bar — one bar across home, wizard, live view, and
 * dashboard so the product feels like one surface. Center and right
 * zones are slots (wizard puts its stepper in the center; the live view
 * puts the view switcher on the right).
 */
export function TopBar({
  center,
  actions,
}: {
  center?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header
      style={{
        height: 48,
        flexShrink: 0,
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        padding: "0 16px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        position: "relative",
        zIndex: "var(--z-sticky)",
      }}
    >
      <a
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          textDecoration: "none",
          color: "var(--ink)",
          justifySelf: "start",
        }}
      >
        <span aria-hidden style={{ color: "var(--accent)", fontSize: 14, lineHeight: 1 }}>◆</span>
        <span style={{ fontSize: 13, fontWeight: 650, letterSpacing: "0.01em" }}>Diorama</span>
      </a>
      <div>{center}</div>
      <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 8 }}>{actions}</div>
    </header>
  );
}
