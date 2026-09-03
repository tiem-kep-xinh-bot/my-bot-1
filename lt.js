const localtunnel = require('localtunnel');
const fs = require('fs');
(async () => {
  const tunnel = await localtunnel({ port: 3000 });
  console.log("LOCALTUNNEL_URL=" + tunnel.url);
  fs.writeFileSync('tunnel_url.txt', tunnel.url);
  tunnel.on('close', () => {
    // tunnels are closed
  });
})();
