export default function OfficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preload" href="/sprites/office-bg.webp" as="image" type="image/webp" />
      {children}
    </>
  );
}
