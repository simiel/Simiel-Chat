import http from 'http';
import fs from 'fs/promises'; // Using fs.promises for async file operations
import path from 'path';
import mime from 'mime';

const cache = {};

function send404(response) {
  response.writeHead(404, { 'Content-Type': 'text/plain' });
  response.write('Error 404: resource not found.');
  response.end();
}

async function sendFile(response, filePath, fileContents) {
  response.writeHead(200, {
    'content-type': mime.getType(path.basename(filePath)),
  });
  response.end(fileContents);
}

async function serveStatic(response, cache, absPath) {
  if (cache[absPath]) {
    await sendFile(response, absPath, cache[absPath]);
  } else {
    try {
      const data = await fs.readFile(absPath);
      cache[absPath] = data;
      await sendFile(response, absPath, data);
    } catch (err) {
      await send404(response);
    }
  }
}

var server = http.createServer(function (request, response) {
  var filePath = false;
  if (request.url == '/') {
    filePath = 'public/index.html';
  } else {
    filePath = 'public' + request.url;
  }
  var absPath = './' + filePath;
  serveStatic(response, cache, absPath);
});

server.listen(3000, function () {
  console.log('Server listening on port 3000.');
});
