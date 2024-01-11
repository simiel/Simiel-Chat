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

const server = http.createServer(async (request, response) => {
  let filePath = false;
  if (request.url === '/') {
    filePath = 'public/index.html';
  } else {
    filePath = `public${request.url}`;
  }
  const absPath = `./${filePath}`;
  await serveStatic(response, cache, absPath);
});

server.listen(3000, function () {
  console.log('Server listening on port 3000.');
});

import { createServer } from 'http';
import { Server } from 'socket.io';
import { createReadStream } from 'fs';

let io;
let guestNumber = 1;
const nickNames = {};
const namesUsed = [];
const currentRoom = {};

const listen = (server) => {
  io = new Server(server);
  io.sockets.on('connection', (socket) => {
    console.log('connection');
    console.log('socket.id', socket.id);
    guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed);
    joinRoom(socket, 'Lobby');

    handleMessageBroadcasting(socket, nickNames);
    handleNameChangeAttempts(socket, nickNames, namesUsed);
    handleRoomJoining(socket);

    socket.on('rooms', () => {
      socket.emit('rooms', io.sockets.adapter.rooms);
    });

    handleClientDisconnection(socket, nickNames, namesUsed);
  });
};

function assignGuestName(socket, guestNumber, nickNames, namesUsed) {
  var name = 'Guest' + guestNumber;
  nickNames[socket.id] = name;
  socket.emit('nameResult', {
    success: true,
    name: name,
  });
  namesUsed.push(name);
  return guestNumber + 1;
}

function joinRoom(socket, room) {
  socket.join(room);
  currentRoom[socket.id] = room;
  socket.emit('joinResult', { room: room });
  socket.broadcast.to(room).emit('message', {
    text: nickNames[socket.id] + ' has joined ' + room + '.',
  });
  var usersInRoom = io.sockets.in(room).connected;
  if (usersInRoom && Object.keys(usersInRoom).length > 1) {
    var usersInRoomSummary = 'Users currently in ' + room + ': ';
    for (var userSocketId in usersInRoom) {
      if (userSocketId != socket.id) {
        usersInRoomSummary += nickNames[userSocketId] + ', ';
      }
    }
    usersInRoomSummary = usersInRoomSummary.slice(0, -2); // Remove the trailing comma and space
    usersInRoomSummary += '.';
    socket.emit('message', { text: usersInRoomSummary });
  }
}

function handleNameChangeAttempts(socket, nickNames, namesUsed) {
  socket.on('nameAttempt', function (name) {
    if (name.indexOf('Guest') == 0) {
      socket.emit('nameResult', {
        success: false,
        message: 'Names cannot begin with "Guest".',
      });
    } else {
      if (namesUsed.indexOf(name) == -1) {
        var previousName = nickNames[socket.id];
        var previousNameIndex = namesUsed.indexOf(previousName);
        namesUsed.push(name);
        nickNames[socket.id] = name;
        delete namesUsed[previousNameIndex];
        socket.emit('nameResult', {
          success: true,
          name: name,
        });
        socket.broadcast.to(currentRoom[socket.id]).emit('message', {
          text: previousName + ' is now known as ' + name + '.',
        });
      } else {
        socket.emit('nameResult', {
          success: false,
          message: 'That name is already in use.',
        });
      }
    }
  });
}

function handleMessageBroadcasting(socket) {
  socket.on('message', function (message) {
    socket.broadcast
      .to(message.room)
      .emit('message', { text: nickNames[socket.id] + ': ' + message.text });
  });
}

function handleRoomJoining(socket) {
  socket.on('join', function (room) {
    socket.leave(currentRoom[socket.id]);
    joinRoom(socket, room.newRoom);
  });
}

function handleClientDisconnection(socket) {
  socket.on('disconnect', function () {
    var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
    delete namesUsed[nameIndex];
    delete nickNames[socket.id];
  });
}

listen(server);
console.log('socket started');
