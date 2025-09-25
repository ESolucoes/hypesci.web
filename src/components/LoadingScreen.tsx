type Props = {
  visible: boolean;
  message?: string;
  sub?: string;
};

export default function LoadingScreen({ visible, message, sub }: Props) {
  if (!visible) return null;

  return (
    <div
      role="alert"
      aria-busy="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: "rgba(10,10,10,0.92)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        textAlign: "center",
        backdropFilter: "blur(2px)",
      }}
    >
      <div>
        <div
          aria-hidden
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 16px",
            borderRadius: "50%",
            border: "6px solid rgba(255,255,255,0.25)",
            borderTopColor: "#fff",
            animation: "hs-spin 1s linear infinite",
          }}
        />
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          {message || "Carregando…"}
        </h2>
        {sub && (
          <p style={{ marginTop: 8, opacity: 0.8, fontSize: 14 }}>
            {sub}
          </p>
        )}
        <style>{`@keyframes hs-spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  );
}
