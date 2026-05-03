# PixelEngine2D Multiplayer

Engine **PixelEngine2D v6.2.7** + servidor WebSocket próprio para multiplayer em tempo real.

## Conteúdo

- `engine/PixelEngine2D_v6_2_7.html` — engine completa (abra no navegador).
- `server/` — servidor WebSocket Node.js compatível com `Engine.Net` da engine.

## Rodando o servidor

Requer **Node.js 18+**.

```bash
cd server
npm install
npm start
```

O servidor escuta em `ws://localhost:8080` por padrão. Para outra porta:

```bash
PORT=3000 npm start
```

Health check: `http://localhost:8080/health`

## Conectando o jogo ao servidor

Dentro de um projeto na engine, no editor de **Eventos** use a ação:

> **REDE — MULTIPLAYER → 🌐 Conectar ao servidor** → `ws://localhost:8080`

Ou via código (console / script):

```js
network.connect("ws://localhost:8080");
network.join("sala1", "Mario");

network.on("playerJoin", p => console.log("entrou:", p.name));
network.on("move", (data, from) => console.log(from.name, data));

// enviar evento custom
network.send("move", { x: hero.x, y: hero.y });

// estado compartilhado (placar, fase…) — novos jogadores recebem ao entrar
network.setState({ score: 10, level: 2 });
network.on("state", (data, from) => { /* … */ });
```

## Hospedando online

Qualquer host Node funciona (Render, Railway, Fly, VPS, Replit…). Basta expor a porta
do `process.env.PORT` e usar `wss://seu-host` (TLS) no `network.connect(...)` em
páginas servidas via HTTPS.

Exemplo Dockerfile mínimo:

```Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/ .
ENV PORT=8080
EXPOSE 8080
CMD ["node","server.js"]
```

## Protocolo (resumo)

Cliente → servidor:

- `{type:"join", room, name}`
- `{type:"msg", event, data}`
- `{type:"setState", data}`
- `{type:"pong"}`

Servidor → cliente:

- `{type:"welcome", id, room, players[], state}`
- `{type:"playerJoin", player:{id,name}}`
- `{type:"playerLeave", playerId}`
- `{type:"msg", event, data, from, fromName}`
- `{type:"state", data, from, fromName}`
- `{type:"ping"}`

## Testado

Servidor verificado com 3 clientes simulados:
- handshake `welcome` com lista de jogadores ✅
- broadcast de `playerJoin`/`playerLeave` ✅
- relay de eventos `msg` (sem eco para o emissor) ✅
- `setState` persistido e entregue ao novo jogador via `welcome.state` ✅
- keepalive ping/pong ✅
