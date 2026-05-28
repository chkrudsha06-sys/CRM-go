export default function Loading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{
            borderColor: "var(--accent)",
            borderTopColor: "transparent",
          }}
        />
        <p
          className="text-[12px] font-bold"
          style={{ color: "var(--text-subtle)" }}
        >
          화면을 준비하고 있습니다
        </p>
      </div>
    </div>
  );
}
