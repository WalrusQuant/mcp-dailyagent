export default function OAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--bg-base)" }}
    >
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
