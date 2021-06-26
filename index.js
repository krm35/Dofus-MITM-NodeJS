const net = require('net'),
    child_process = require("child_process"),
    username = require('os').userInfo().username,
    hook = require('./hook'),
    logs = require('./logs'),
    server = new net.Server().listen(process.argv[2] || 8000),
    dofusRetro = true;

if (!dofusRetro) {
    logs("Be careful, some packets from Dofus 2.0 servers contain multiple messages so the packetId is always for " +
        "the first one. Plus, some packets are split into multiple chunks so in this case the packetId is false." +
        "You can use the payloadReader if you want")
}

const dofusProcess = child_process.spawn(
    dofusRetro ?
        "C:\\Users\\" + username + "\\AppData\\Local\\Ankama\\zaap\\retro\\resources\\app\\retroclient\\Dofus.exe"
        :
        "C:\\Users\\" + username + "\\AppData\\Local\\Ankama\\zaap\\dofus\\Dofus.exe"
);

// noinspection ES6MissingAwait
hook(dofusProcess.pid);

dofusProcess.stdout.on('data', () => {
});

dofusProcess.stderr.on('data', () => {
});

dofusProcess.on('exit', () => {
});

server.on('connection', function (socket) {

    let host, port;

    socket.on('data', function (data) {
        try {
            const s = data.toString();
            if (s.startsWith('CONNECT')) {
                logs("from client", s);
                const split = s.split(' ')[1].split(':');
                host = split[0];
                port = split[1];
                connectClient(socket, host, port);
            } else {
                if (socket['clientSocket']['connected']) {
                    socket['clientSocket'].write(data);
                } else {
                    socket['clientSocket']['queue'].push(data);
                }
                dofusRetro ?
                    logs("from client", s.slice(0, -2))
                    :
                    logs("from client", data.readUInt16BE(0) >> 2, data.toString('hex'));
            }
        } catch (e) {
            logs(e);
        }
    });

    socket.on('end', function () {
        logs("close socket", host + ':' + port);
        try {
            socket['clientSocket'].destroy();
        } catch (e) {

        }
    });

    socket.on('error', function (err) {

    });
});

const domain = '.ankama-games.com';
const gameServers = ["agride", "brumen", "furye", "ilyzaelle", "jahash", "julith", "merkator", "meriana", "nidas", "pandore", "ush", "ombre"];
for (let i in gameServers) gameServers[i] += domain;

function connectClient(socket, host, port) {

    socket['clientSocket'] = new net.Socket();
    socket['clientSocket']['queue'] = [];

    socket['clientSocket'].connect({host, port});

    socket['clientSocket'].on('connect', function () {
        socket['clientSocket']['connected'] = true;
        socket['clientSocket']['queue'].forEach(packet => socket['clientSocket'].write(packet));
    });

    socket['clientSocket'].on('data', function (data) {
        try {
            const s = data.toString();
            if (!dofusRetro && s.includes('.ankama-games.com')) {
                for (let i in gameServers) {
                    if (s.includes(gameServers[i])) {
                        socket.write(data);
                        socket.destroy();
                        break;
                    }
                }
            } else {
                socket.write(data);
            }
            dofusRetro ?
                logs("from", host + ':' + port, data.toString())
                :
                logs("from", host + ':' + port, 'packetId', data.readUInt16BE(0) >> 2, data.toString('hex'));
        } catch (e) {

        }
    });

    socket['clientSocket'].on('close', function () {
        logs("close clientSocket", host + ':' + port);
        try {
            socket.destroy();
        } catch (e) {

        }
    });

    socket['clientSocket'].on('error', function (err) {

    });
}


