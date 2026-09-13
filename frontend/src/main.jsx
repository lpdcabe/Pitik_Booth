import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { PhotoboothProvider } from "./context/PhotoboothContext";
import App from "./App";
import "./styles.css";
import "./remote.css";
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <PhotoboothProvider>
        <App />
      </PhotoboothProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
