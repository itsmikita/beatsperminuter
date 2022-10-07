import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import viteSvgr from "vite-plugin-svgr";

// https://vitejs.dev/config/
export default defineConfig( {
  plugins: [ 
    basicSsl(), 
    react(),
    viteSvgr()
  ],
  server: {
    host: true, // Expose to Network
    open: true // Open in Chrome/Safari
  }
} );
