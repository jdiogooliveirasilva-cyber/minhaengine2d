// PixelEngine2D Multiplayer Server
// Compatível com Engine.Net (v6.2.7) — protocolo WebSocket JSON.
//
// Uso:
//   npm install
//   npm start                  # porta padrão 8080
//   PORT=3000 npm start        # porta customizada
//
// No jogo:
//   network.connect("ws://localhost:8080")
//   network.join("sala1", "Mario")

const http = require("http");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 8080;

// rooms: { [roomName]: { players: Map<id, {ws, id, name}>, state: any } }
const rooms = new Map();

function getRoom(name) {
  let r = rooms.get(name);
  if (!r) { r = { players: new Map(), state: null }; rooms.set(name, r); }
  return r;
}

function broadcast(room, msg, exceptId = null) {
  const data = JSON.stringify(msg);
  for (const p of room.players.values()) {
    if (p.id === exceptId) continue;
    if (p.ws.readyState === 1) p.ws.send(data);
  }
}

function leaveRoom(client) {
  if (!client.room) return;
  const room = rooms.get(client.room);
  if (!room) return;
  room.players.delete(client.id);
  broadcast(room, { type: "playerLeave", playerId: client.id });
  if (room.players.size === 0) rooms.delete(client.room);
  client.room = null;
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("PixelEngine2D Multiplayer Server\nWebSocket endpoint: ws://<host>:" + PORT);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  const client = { ws, id: crypto.randomUUID(), name: "Player", room: null };

  // ping de keepalive
  const pingInterval = setInterval(() => {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: "ping" }));
  }, 25000);

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === "join") {
      leaveRoom(client);
      client.name = String(msg.name || "Player").slice(0, 32);
      const roomName = String(msg.room || "lobby").slice(0, 64);
      const room = getRoom(roomName);
      client.room = roomName;
      const playersList = [...room.players.values()].map(p => ({ id: p.id, name: p.name }));
      room.players.set(client.id, client);
      // welcome ao novo
      ws.send(JSON.stringify({
        type: "welcome",
        id: client.id,
        room: roomName,
        players: playersList,
        state: room.state,
      }));
      // notifica outros
      broadcast(room, { type: "playerJoin", player: { id: client.id, name: client.name } }, client.id);

    } else if (msg.type === "msg") {
      if (!client.room) return;
      const room = rooms.get(client.room); if (!room) return;
      broadcast(room, {
        type: "msg", event: msg.event, data: msg.data,
        from: client.id, fromName: client.name,
      }, client.id);

    } else if (msg.type === "setState") {
      if (!client.room) return;
      const room = rooms.get(client.room); if (!room) return;
      room.state = msg.data;
      broadcast(room, {
        type: "state", data: room.state,
        from: client.id, fromName: client.name,
      }, client.id);

    } else if (msg.type === "pong") {
      // ok
    }
  });

  ws.on("close", () => {
    clearInterval(pingInterval);
    leaveRoom(client);
  });

  ws.on("error", () => {});
});

server.listen(PORT, () => {
  console.log(`[PixelEngine2D MP] WebSocket server on :${PORT}`);
});
