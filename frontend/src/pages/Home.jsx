import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Camera,
  Sparkles,
  Download,
  ShieldCheck,
  Heart,
  MoveUpRight,
  Check,
} from "lucide-react";
import { layouts } from "../utils/layouts";
import { useBooth } from "../context/PhotoboothContext";
export default function Home() {
  const { setLayout } = useBooth();
  return (
    <>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow pill">
              <span className="live-dot" /> YOUR BROWSER. YOUR PERSONAL
              PHOTOBOOTH.
            </span>
            <h1>
              Little moments.
              <br />
              Big <em>memories.</em>
              <span className="sketch-spark">✳</span>
            </h1>
            <p>
              Come as you are. Strike a pose. Turn your everyday
              <br className="desktop" /> moments into something worth keeping.
            </p>
            <Link to="/setup" className="button hero-cta">
              Start photobooth <ArrowUpRight size={20} />
            </Link>
            <div className="hero-promises">
              <span>
                <Check size={14} /> Free to create
              </span>
              <span>
                <Check size={14} /> No sign-up
              </span>
              <span>
                <Check size={14} /> Just you & your camera
              </span>
            </div>
            <div className="love-note">
              <span className="tiny-faces">
                <i>☺</i>
                <i>☺</i>
                <i>☺</i>
              </span>
              <div>
                <span className="stars">★★★★★</span>
                <p>A little joy, one photo at a time.</p>
              </div>
            </div>
          </div>
          <div
            className="hero-art"
            aria-label="Decorative examples of photobooth memories"
          >
            <div className="orbit" />
            <span className="art-star">✧</span>
            <div className="sample-strip strip-one">
              <div className="sample-photo scene-one">
                <span>☀</span>
                <b>
                  good
                  <br />
                  company.
                </b>
              </div>
              <div className="sample-photo scene-two">
                <span>✿</span>
                <b>
                  stay
                  <br />a little.
                </b>
              </div>
              <div className="sample-photo scene-three">
                <span>☺</span>
                <b>you & me.</b>
              </div>
              <p>the good old days ♡</p>
              <small>09.13.2026</small>
            </div>
            <div className="sample-strip strip-two">
              <div className="sample-photo scene-four">
                <span>✿</span>
                <b>
                  small
                  <br />
                  joys.
                </b>
              </div>
              <div className="sample-photo scene-five">
                <span>☀</span>
                <b>
                  golden
                  <br />
                  hour.
                </b>
              </div>
              <div className="sample-photo scene-six">
                <span>♡</span>
                <b>
                  keep
                  <br />
                  this feeling.
                </b>
              </div>
              <p>Pitik Booth</p>
              <small>MADE TO BE KEPT</small>
            </div>
            <span className="tape tape-one" />
            <span className="tape tape-two" />
            <span className="hand-note">
              a little moment,
              <br />a lasting memory. <MoveUpRight size={32} />
            </span>
            <span className="art-heart">♡</span>
            <div className="floating-tag">
              <Camera size={16} />
              <span>Real moments. Perfectly imperfect.</span>
            </div>
          </div>
        </section>
        <div className="feature-ribbon">
          <span>
            <Camera size={19} /> Your camera, your studio
          </span>
          <i>✧</i>
          <span>
            <Sparkles size={19} /> A frame for every feeling
          </span>
          <i>✧</i>
          <span>
            <Download size={19} /> Ready to save & share
          </span>
          <i>✧</i>
          <span>
            <ShieldCheck size={19} /> No account needed
          </span>
        </div>
        <section className="home-layouts section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">FIND YOUR KIND OF FRAME</span>
              <h2>One moment. So many possibilities.</h2>
              <p>
                Classic strips, playful Polaroids, and everything in between.
              </p>
            </div>
            <Link to="/layouts" className="text-link">
              Explore all layouts <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="featured-grid">
            {[
              layouts[0],
              layouts.find((l) => l.name === "2x2 Grid"),
              layouts.find((l) => l.name === "Single Polaroid"),
              layouts.find((l) => l.name === "Classic Film Strip"),
            ].map((layout, i) => (
              <Link
                className="featured-card"
                to="/setup"
                onClick={() => setLayout(layout)}
                key={layout.id}
              >
                <div className={`featured-art art-${i}`}>
                  <img
                    src={layout.thumbnail}
                    alt={`${layout.name} layout preview`}
                  />
                  {i === 0 && <span className="tag">THE CLASSIC</span>}
                  {i === 2 && <span className="mini-star">✧</span>}
                </div>
                <div>
                  <h3>
                    {
                      [
                        "The classic strip",
                        "Better together",
                        "A little nostalgia",
                        "Roll the memories",
                      ][i]
                    }
                  </h3>
                  <ArrowUpRight size={18} />
                </div>
                <p>
                  {layout.name} <span>·</span> {layout.photoCount}{" "}
                  {layout.photoCount === 1 ? "photo" : "photos"}
                </p>
              </Link>
            ))}
          </div>
        </section>
        <section id="how-it-works" className="how section">
          <span className="eyebrow">LESS SETUP. MORE SMILING.</span>
          <h2>Good memories are this simple.</h2>
          <div className="how-grid">
            {[
              [
                Sparkles,
                "01",
                "Make it your own",
                "Pick a layout, find your frame, and add a little personality.",
              ],
              [
                Camera,
                "02",
                "Find your good side",
                "Let the countdown do its thing. You just bring the smiles.",
              ],
              [
                Heart,
                "03",
                "Keep it. Share it. Love it.",
                "Download your photos or save a link to send to your favorite people.",
              ],
            ].map(([Icon, n, title, desc]) => (
              <article key={n}>
                <span className="how-icon">
                  <Icon size={24} />
                  <small>{n}</small>
                </span>
                <h3>{title}</h3>
                <p>{desc}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="bottom-cta">
          <span>✧</span>
          <h2>
            Your next favorite memory
            <br />
            is a click away.
          </h2>
          <Link className="button" to="/setup">
            Let’s make a little moment <ArrowUpRight size={18} />
          </Link>
          <p>No downloads. No sign-ups. Just smiles.</p>
        </section>
      </main>
    </>
  );
}
