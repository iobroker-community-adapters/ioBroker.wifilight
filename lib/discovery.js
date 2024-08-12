const dgram = require('node:dgram');
const os = require('node:os');
const Netmask = require('netmask').Netmask;

const BROADCAST_PORT = 48899;

exports.scanForDevices = function (checkCb, cb) {
    const BC_ID = 'HF-A11ASSISTHREAD'; //V6 API
    const msg = new Buffer(BC_ID);
    const broadcasts = [];
    const ifaces = os.networkInterfaces();

    for (const name in ifaces) {
        ifaces[name].forEach((iface) => {
            if ('IPv4' !== iface.family || iface.internal) {
                return;
            }
            const netmask = new Netmask(iface.address, iface.netmask);
            broadcasts.push(netmask.broadcast);
        });
    }
    const result = [];
    const client = dgram.createSocket('udp4');
    client.bind(BROADCAST_PORT);
    client.on('listening', () => client.setBroadcast(true));
    client.on('message', (message, rinfo) => {
        const s = message.toString();
        if (rinfo.port !== BROADCAST_PORT || s === BC_ID || s.indexOf('+ERR') === 0) {
            return;
        }
        if (result.include(s)) {
            return;
        }
        result.push(s);
    });

    const interval = setInterval(() => {
        broadcasts.forEach(ip => client.send(msg, 0, msg.length, BROADCAST_PORT, ip));
    }, 300);

    setTimeout(() => {
        clearInterval(interval);
        client.close();

        for (let i=0; i<result.length; i++) {
            const ar = result[i].split(',');
            result[i] = {
                name: ar[2],
                mac: ar[1],
                ip: ar[0],
                // type: '',
                // port: 5577,
                // pollIntervall: 30
            };
            if (checkCb && !checkCb(result[i])) {
                result.splice(i--, 1);
                // continue;
            }
            // switch(result [i].name) {
            //    case 'HF-LPB100-ZJ200':
            //        result[i].type = 'LD382A';
            //        break;
            //    case 'HF-A11-ZJ002':
            //        result[i].type = 'LW12';
            //        break;
            // }
            // console.log('found: ' + JSON.stringify(result[i]));
        }
        if (cb) {
            cb(result);
        }
    }, 2500);
};

exports.scanForMiLightDevices = function scanForMiLightDevices (checkCb, cb) {
    const port = 48899;
    const ip = '255.255.255.255';
    const result = [];

    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    //const socket = dgram.createSocket('udp4');
    socket.on('error', (/* err */) => {});
    socket.on('listening', error => {
        if (error) {
            return cb && cb(error);
        }
        socket.setBroadcast(true);
    });
    socket.on('message', (msg /* , rinfo */) => {
        // console.log(rinfo.address);
        msg = msg.toString();
        if (result.includes(msg)) {
            return;
        }
        result.push(msg);
    });

    // send search command
    const pkt = Buffer.from('Link_Wi-Fi');
    socket.send(pkt, 0, pkt.length, port, ip, (/* err, data */) => {});

    setTimeout(() => {
        socket.close();
        for (let i = 0; i < result.length; i++) {
            const ar = result[i].split(',');
            result[i] = {
                name: 'Mi-Light',
                mac: ar[1],
                ip: ar[0],
                // type: 'MiLight'
            };
            if (checkCb && !checkCb(result[i])) {
                result.splice(i--, 1);
            }
        }
        if (cb) {
            cb(result);
        }
    }, 2000);

};

exports.scanForAllDevices = function scanForAllDevices(checkCb, cb) {
    exports.scanForDevices(checkCb, function (result) {
        exports.scanForMiLightDevices(checkCb, function (result2) {
            if (cb) {
                cb(result.concat(result2));
            }
        });
    });
};
