const frida = require('frida');
const logs = require('./logs');

const source = `
var connect_p = Module.getExportByName(null, 'connect');
var send_p = Module.getExportByName(null, 'send');
// ssize_t send(int sockfd, const void * buf, size_t len, int flags);
var socket_send = new NativeFunction(send_p, 'int', ['int', 'pointer', 'int', 'int']);
var recv_p = Module.getExportByName(null, 'recv');
// ssize_t recv(int sockfd, void *buf, size_t len, int flags);
var socket_recv = new NativeFunction(recv_p, 'int', ['int', 'pointer', 'int', 'int']);
Interceptor.attach(connect_p, {
    onEnter: function (args) {
        // int connect(int sockfd, const struct sockaddr *addr,
        //             socklen_t addrlen);
        this.sockfd = args[0];
        var sockaddr_p = args[1];
        this.port = 256 * sockaddr_p.add(2).readU8() + sockaddr_p.add(3).readU8();
        this.addr = "";
        for (var i = 0; i < 4; i++) {
            this.addr += sockaddr_p.add(4 + i).readU8(4);
            if (i < 3) this.addr += '.';
        }
        var newport = ${process.argv[2] || 8000};
        sockaddr_p.add(2).writeByteArray([Math.floor(newport / 256), newport % 256]);
        sockaddr_p.add(4).writeByteArray([127, 0, 0, 1]);
        //send(this.addr+":"+this.port);
    },
    onLeave: function (retval) {
        var connect_request = "CONNECT " + this.addr + ":" + this.port + " HTTP/1.0\\n\\n";
        var buf_send = Memory.allocUtf8String(connect_request);
        socket_send(this.sockfd.toInt32(), buf_send, connect_request.length, 0);
    }
})
`;

let script = null;

module.exports = async function (pid) {
    process.on('SIGTERM', stop);
    process.on('SIGINT', stop);

    const session = await frida.attach(pid);
    session.detached.connect(onDetached);

    script = await session.createScript(source);
    script.message.connect(message => {
        logs('[*] Message:', message);
    });
    await script.load();
    logs('[*] Script loaded');

};

function stop() {
    if (script !== null) {
        script.unload();
        script = null;
        process.exit(0);
    }
}

function onDetached(reason) {
    logs(`[*] onDetached(reason=${reason})`);
    process.exit(0);
}
