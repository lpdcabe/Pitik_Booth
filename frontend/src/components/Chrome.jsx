import { Link, NavLink } from "react-router-dom";
import { Camera, ArrowUpRight, Heart } from "lucide-react";
export function Navbar() {
  return (
    <header className="navbar">
      <Link className="brand" to="/">
        <span className="brand-icon">
          <Camera size={22} />
        </span>
        Pitik Booth<span className="brand-dot">®</span>
      </Link>
      <nav aria-label="Main navigation">
        <NavLink to="/layouts">Layouts</NavLink>
        <a href="/#how-it-works">How it works</a>
        <NavLink to="/gallery">My gallery</NavLink>
      </nav>
      <Link className="button small" to="/setup">
        Let’s make memories <ArrowUpRight size={16} />
      </Link>
    </header>
  );
}
export function Footer() {
  return (
    <footer>
      <Link className="brand" to="/">
        <Camera size={20} /> Pitik Booth
      </Link>
      <span>Made for the moments in between.</span>
      <span>
        Made with a little <Heart size={13} />
      </span>
    </footer>
  );
}
export function Steps({ current = 1 }) {
  return (
    <div className="steps">
      {[
        "Choose a layout",
        "Make it yours",
        "Strike a pose",
        "Keep the memory",
      ].map((s, i) => (
        <div key={s} className={current >= i + 1 ? "active" : ""}>
          <span>{i + 1}</span>
          <p>{s}</p>
          {i < 3 && <i />}
        </div>
      ))}
    </div>
  );
}
