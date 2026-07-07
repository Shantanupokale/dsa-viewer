import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Bind IPv4 loopback so both http://localhost:5173 and http://127.0.0.1:5173 work
  // (default "localhost" can resolve to IPv6 ::1 only and refuse 127.0.0.1).
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
