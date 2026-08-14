import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "/" — o rewrite do Vercel em tkone.com.br já remove o prefixo
// "/producao/" antes de repassar a requisição pra este deploy, então os
// assets aqui precisam ser resolvidos a partir da raiz, não de "/producao/".
export default defineConfig({
  plugins: [react()],
  base: "/",
});
