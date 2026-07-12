const localtunnel = require('localtunnel');

(async () => {
  try {
    const tunnel = await localtunnel({ 
      port: 3056, 
      subdomain: 'warm-cows-learn' 
    });

    console.log('Tunnel is open on:', tunnel.url);

    tunnel.on('close', () => {
      console.log('Tunnel closed');
    });

    tunnel.on('error', (err) => {
      console.error('Tunnel error:', err);
    });

    // Keep process alive
    setInterval(() => {}, 1000);
  } catch (err) {
    console.error('Error starting tunnel:', err);
  }
})();
