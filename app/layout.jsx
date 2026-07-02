import "../styles.css";

export const metadata = {
  title: "Emo-gotchi MVP",
  description: "A Next.js MVP for turning negative emotions into a companion monster."
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
