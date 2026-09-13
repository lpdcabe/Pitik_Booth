import { useEffect } from "react";
import { Routes, Route, useLocation, Link } from "react-router-dom";
import { Navbar, Footer } from "./components/Chrome";
import Home from "./pages/Home";
import Setup from "./pages/Setup";
import Photobooth from "./pages/Photobooth";
import EditPhotos from "./pages/EditPhotos";
import Result from "./pages/Result";
import Gallery from "./pages/Gallery";
import SharedPhoto from "./pages/SharedPhoto";
import BoothTogether from './pages/BoothTogether';
import CreateRoom from './pages/CreateRoom';
import JoinRoom from './pages/JoinRoom';
import Room from './pages/Room';
export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Navbar />
      <div id="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/setup" element={<Setup key="setup" />} />
          <Route path="/layouts" element={<Setup key="layouts" library />} />
          <Route path="/photobooth" element={<Photobooth />} />
          <Route path="/edit" element={<EditPhotos />} />
          <Route path="/result" element={<Result />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/photo/:id" element={<SharedPhoto />} />
          <Route path="/together" element={<BoothTogether />} />
          <Route path="/together/create" element={<CreateRoom />} />
          <Route path="/together/join" element={<JoinRoom />} />
          <Route path="/room/:roomCode" element={<Room />} />
          <Route
            path="*"
            element={
              <main className="empty-state">
                <h1>A little lost?</h1>
                <Link className="button" to="/">
                  Back home
                </Link>
              </main>
            }
          />
        </Routes>
      </div>
      <Footer />
    </>
  );
}
