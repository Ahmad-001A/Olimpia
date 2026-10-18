import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <Link href="/" className="brand footer-brand"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 6.7C9.5 4.8 6.4 4.5 3.5 5.7v12c3.2-1.1 6.1-.6 8.5 1.5m0-12.5c2.5-1.9 5.6-2.2 8.5-1v12c-3.2-1.1-6.1-.6-8.5 1.5m0-12.5v12.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span><span className="brand-word">olympia<span>.</span></span></Link>
        <p>Место, где любопытство превращается в знания.</p>
        <div className="footer-links"><Link href="/assessments">Задания</Link><Link href="/leaderboard">Рейтинг</Link><Link href="/teacher-application">Стать учителем</Link></div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Olympia</span><span>Образовательная платформа для школьников</span></div>
    </footer>
  );
}
