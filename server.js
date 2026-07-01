import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Handle URL normalization
  let filePath = req.url === '/' 
    ? path.join(__dirname, 'index.html') 
    : path.join(__dirname, req.url.split('?')[0]);

  const extname = path.extname(filePath);
  let contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // Page not found
        fs.readFile(path.join(__dirname, 'index.html'), (err, htmlContent) => {
          if (err) {
            res.writeHead(500);
            res.end('Sorry, check with the site admin for error: ' + err.code + ' ..\n');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(htmlContent, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
      }
    } else {
      // Add CORS headers for testing
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*' 
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  
  // Run initial scrape immediately on startup
  console.log('[Startup Scraper] Running initial scrape...');
  exec('node scrape.js', { cwd: __dirname }, (error, stdout, stderr) => {
    if (error) {
      console.error(`[Startup Scraper] Error: ${error.message}`);
      return;
    }
    console.log('[Startup Scraper] Initial scrape completed successfully.');
  });
  
  // Background auto-scraper every 2 minutes (120,000 ms)
  setInterval(() => {
    console.log('[Background Scraper] Starting auto-scrape...');
    exec('node scrape.js', { cwd: __dirname }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[Background Scraper] Error: ${error.message}`);
        return;
      }
      console.log('[Background Scraper] Auto-scrape completed and smp_data.json updated.');
    });
  }, 120000);
});
