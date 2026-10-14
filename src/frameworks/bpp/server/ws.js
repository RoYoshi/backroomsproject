/* server/ws.js - the WebSocket framing of server.js.
 *
 * Stage 3H0: moved out of server.js without a change, so the frame format lives in one small file:
 *   frame(str)               one unfragmented, unmasked text frame from the server: a 7-bit or 16-bit length.  A payload of 65,536 bytes or
 *                            more gives null, and server.js's send() then sends nothing (as before).
 *   reader(sock, onMessage)  the socket's 'data' handler.  It keeps the socket's own buffer, waits for whole frames, unmasks them, answers a
 *                            ping with a pong, ends the socket on a close frame, destroys it on a 64-bit length, and gives every text frame
 *                            under 1,400 bytes, parsed as JSON, to onMessage.  Bad JSON and errors thrown by onMessage are ignored, as before.
 * The upgrade itself stays in server.js: which requests are accepted, and the 101 response.
 * No state outside the buffer each reader owns; no timer; nothing else is required.  Never served: the server's allowlist does not reach
 * this folder. */
function frame(str) {
  const b = Buffer.from(str), n = b.length;
  const h = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : null;
  return h ? Buffer.concat([h, b]) : null;
}
function reader(sock, onMessage) {
  let buf = Buffer.alloc(0);
  return d => {
    buf = Buffer.concat([buf, d]);
    while (buf.length >= 2) {
      const op = buf[0] & 15; let len = buf[1] & 127, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; } else if (len === 127) return sock.destroy();
      if (buf.length < off + 4 + len) return;
      const mask = buf.slice(off, off + 4), pl = Buffer.from(buf.slice(off + 4, off + 4 + len));
      for (let i = 0; i < len; i++) pl[i] ^= mask[i & 3];
      buf = buf.slice(off + 4 + len);
      if (op === 8) return sock.end();
      if (op === 9) { sock.write(Buffer.from([0x8a, 0])); continue; }       // ping -> pong
      if (op === 1 && len < 1400) { try { onMessage(JSON.parse(pl)); } catch (e) { /* ignore bad input */ } }
    }
  };
}
module.exports = { frame, reader };
