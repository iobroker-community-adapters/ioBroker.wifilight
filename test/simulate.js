// this is mostly the simulation of LD382A device
const net = require('node:net');
const {
    MiLightW,
    LW12,
    LD382A,
    LD686,
    LD382,
    UFO,
    MiLight,
    MiLightRGB,
} = require('../lib/devices');

const devices = {
    LW12,
    LD382A,
    LD686,
    LD382,
    UFO,
    MiLightW,
    MiLight,
    MiLightRGB,
};

// function string2Buffer(str) {
//     const arr = str.split(' ');
//     const buffer = Buffer.alloc(arr.length);
//     for (let i = 0; i < arr.length; i++) {
//         buffer[i] = parseInt(arr[i], 16);
//     }
//     return buffer;
// }

function findCommand(device, receivedData) {
    return Object.keys(device).find(key => {
        // compare to arrays
        const cmd = device[key];
        if (!Array.isArray(cmd)) {
            return false;
        }
        if (cmd.length !== receivedData.length - 1) {
            return false;
        }
        for (let i = 0; i < cmd.length; i++) {
            if (cmd[i] !== receivedData[i]) {
                // may be it is a mask
                if (i === 1) {
                    if (cmd[i] < 0) {
                        return true;
                    }
                }

                return false;
            }
        }
        return true;
    });
}

const state = {
    on: true,
    r: 20,
    g: 30,
    b: 40,
    w: 50,
    progNo: 1,
    speed: 5,
    progOn: false,
};
const sockets = {};
let nextSocketId = 0;

// Create a TCP server
const server = net.Server();
server.on('connection', socket => {
    const socketId = nextSocketId++;
    console.log('Client connected with id', socketId);
    sockets[nextSocketId] = socket;

    socket.on('close', () => {
        delete sockets[nextSocketId];
        console.log('Client disconnected');
    });

    socket.on('data', data => {
        console.log(`Client data: ${data.map(byte => byte.toString(16)).join(' ')}`);
        // find command
        let cmd;
        Object.keys(devices).find(device => {
            cmd = findCommand(devices[device], data);
            if (cmd) {
                console.log(`Found command for ${device}: "${cmd}"`);
                return true;
            }
        });
        if (cmd) {
            if (cmd === 'statusRequest') {
                setTimeout(() => {
                    // {"on":true,"progNo":97,"progOn":false,"preogSpeed":10,"red":255,"green":255,"blue":255,"white":0}
                    const status = [
                        0x81,
                        0x33,
                        state.on ? 0x23 : 0,
                        state.progNo,
                        state.progOn ? 33 : 0,
                        state.speed,
                        state.r,
                        state.g,
                        state.b,
                        state.w,
                        0x06,
                        0x00,
                        0x00,
                        0x46
                    ];
                    console.log(JSON.stringify(state));
                    socket.write(Buffer.from(status));
                }, 50);
            } else if (cmd === 'rgbw') {
                state.r = data[1];
                state.g = data[2];
                state.b = data[3];
                state.w = data[4];
            } else if (cmd === 'rgb') {
                state.r = data[1];
                state.g = data[2];
                state.b = data[3];
            } else if (cmd === 'on') {
                state.on = true;
            } else if (cmd === 'off') {
                state.on = false;
            } else if (cmd === 'progNo') {
                state.speed = data[2];
                state.progNo = data[1];
            } else if (cmd === 'progOn') {
                state.progOn = true;
            } else if (cmd === 'progOff') {
                state.progOn = false;
            }
        }
    });
});

async function startServer(defaultState) {
    return new Promise(resolve => {
        if (defaultState) {
            Object.assign(state, defaultState);
        }
        server.listen(5577, '127.0.0.1', () => {
            console.log(`Server started on port 5577: ${JSON.stringify(state)}`);
            resolve();
        });
    });
}

async function stopServer() {
    return new Promise(resolve => {
        if (server) {
            server?.close(() => {
                console.log('Server closed');
                resolve();
            });
            // Destroy all open sockets
            for (const socketId in sockets) {
                console.log('socket', socketId, 'destroyed');
                sockets[socketId].destroy();
            }
        } else {
            resolve();
        }
    });
}

if (module.parent) {
    module.exports = {
        startServer,
        stopServer,
    };
} else {
    // or start the instance directly
    startServer()
        .catch(e => console.error(`Cannot start server: ${e}`));
}

