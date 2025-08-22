import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#5562ea" },
    secondary: { main: "#13c2c2" },
    error: { main: "#ff4d4f" },
    warning: { main: "#faad14" },
    info: { main: "#1677ff" },
    success: { main: "#52c41a" },
    background: { default: "#f7f9fc" },
  },
  shape: { borderRadius: 12 },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>
);
