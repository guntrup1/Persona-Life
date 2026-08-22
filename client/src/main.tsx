import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initErrorReporting } from "@/lib/error-report";

initErrorReporting();

createRoot(document.getElementById("root")!).render(<App />);
