window.global = window;

// import { StrictMode } from 'react'
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./main.css";

createRoot(document.getElementById("root")).render(
  <HashRouter>
    <App />
  </HashRouter>
);
