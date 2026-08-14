# Controle de Produção — deploy em tkone.com.br/producao

Este é um projeto Vite + React independente, pronto pra ser publicado como um
subdiretório do seu domínio já existente, no mesmo esquema que você usou
para `tkone.com.br/fideles`.

## 1. Testar localmente (opcional)

```bash
npm install
npm run dev
```

## 2. Subir pro GitHub

```bash
git init
git add .
git commit -m "Controle de produção"
git branch -M main
git remote add origin https://github.com/th3krusty/producao-app.git
git push -u origin main
```

## 3. Criar um projeto novo no Vercel

1. No painel do Vercel, "Add New" → "Project" → importe o repositório `producao-app`.
2. Framework preset: **Vite**.
3. Build command: `npm run build` (padrão).
4. Output directory: `dist` (padrão).
5. Deploy. Você vai receber uma URL tipo `https://producao-app-xxxx.vercel.app`.

Guarde essa URL — é o `destination` do rewrite no passo 4.

## 4. Apontar tkone.com.br/producao para esse deploy

No projeto Vercel que já serve `tkone.com.br` (o mesmo onde você configurou o
rewrite do `/fideles`), edite o `vercel.json` da raiz e adicione uma nova
regra de rewrite:

```json
{
  "rewrites": [
    { "source": "/fideles/:path*", "destination": "https://SEU-DEPLOY-FIDELES.vercel.app/:path*" },
    { "source": "/producao/:path*", "destination": "https://producao-app-xxxx.vercel.app/:path*" },
    { "source": "/producao", "destination": "https://producao-app-xxxx.vercel.app/producao/" }
  ]
}
```

Troque `producao-app-xxxx.vercel.app` pela URL real do passo 3. Depois faça
commit + push desse `vercel.json` no repositório principal do `tkone.com.br`
pra disparar um novo deploy.

Isso mantém o comportamento que já funcionou pro Fideles: o domínio principal
faz proxy transparente pro sub-deploy, sem precisar configurar DNS ou
subdomínio separado.

## 5. Conferir

Depois do deploy propagar (1-2 min), acesse:

```
https://tkone.com.br/producao
```

Se a página carregar em branco ou os assets (JS/CSS) não carregarem, o
problema quase sempre é o `base` do `vite.config.js` — ele já está setado
como `/producao/` neste projeto, que é o que faz os caminhos dos arquivos
baterem certo com a rota do rewrite.

## Sobre os dados

O app usa `localStorage` do navegador — cada pessoa que acessar
`tkone.com.br/producao` terá seus próprios dados, isolados por navegador/dispositivo.
Não existe um banco de dados compartilhado nem login de verdade ainda (ver
observação sobre login no chat).
