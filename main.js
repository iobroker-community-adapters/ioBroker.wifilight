const net = require('node:net');
const discovery = require('./lib/discovery');
const { rgb2hsv, roundRGB, ct2rgb, hsv2rgb } = require('./lib/colors');
const soef = require('./lib/dontBeSoSoef');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const wifi = {};
const debug = false;

function _fullExtendEx(dest, from) {
    const props = Object.getOwnPropertyNames(from);
    let destination;

    props.forEach(name => {
        if (typeof from[name] === 'object') {
            if (typeof dest[name] !== 'object') {
                dest[name] = {};
            }
            _fullExtendEx(dest[name],from[name]);
        } else {
            destination = Object.getOwnPropertyDescriptor(from, name);
            Object.defineProperty(dest, name, destination);
        }
    });
}

function fullExtendEx(dest, from) {
    _fullExtendEx(dest, from);
    return dest;
}

function cloneEx(from) {
    const props = Object.getOwnPropertyNames(from);
    let destination;
    const dest = {};

    props.forEach(function (name) {
        if (from[name] instanceof Array) {
            //dest[name] = new Array(from[name]);
            dest[name] = [].concat(from[name]);
        } else if (typeof from[name] === 'object') {
            if (typeof dest[name] !== 'object') {
                dest[name] = {};
            }
            _fullExtendEx(dest[name],from[name]);
        } else {
            destination = Object.getOwnPropertyDescriptor(from, name);
            Object.defineProperty(dest, name, destination);
        }
    });
    return dest;
}

function arrayToHexEx(ar, len) {
    const s = [];
    if (len === undefined) {
        len = ar.length;
    }
    for (let i = 0; i < len; i++) {
        s.push(ar[i].toString(16).padStart(2, '0'));
    }
    return s.join(' ');
}

soef.extendAll();

const adapter = soef.Adapter(
    main,
    onStateChange,
    onMessage,
    onUnload,
    { name: 'wifilight' },
);

function fromDeviceName(name) {
    return cmds.knownDeviceNames[name] || cmds.knownDeviceNames[name.toUpperCase()];
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function onMessage(obj) {
    if (!obj) {
        return;
    }
    switch (obj.command) {
        case 'discovery':
            discovery.scanForAllDevices(
                entry => {
                    const ret = !adapter.config.devices.some(e => e.ip === entry.ip);
                    if (ret) {
                        const dev = fromDeviceName(entry.name);
                        entry.type = dev ? dev.type : '';
                        entry.port = dev?.port ? dev.port : 5577;
                        entry.pollIntervall = 30;
                    }
                    return ret;
                },
                result => {
                    if (obj.callback) {
                        adapter.sendTo(obj.from, obj.command, JSON.stringify(result), obj.callback);
                    }
                }
            );
            return true;

        default:
            adapter.log.warn(`Unknown command: ${obj.command}`);
            break;
    }
    if (obj.callback) {
        adapter.sendTo(obj.from, obj.command, obj.message, obj.callback);
    }
    return true;
}

function onUnload(callback) {
    Object.keys(wifi).forEach(v => {
        wifi[v].close();
        delete wifi[v];
        adapter.log.debug(`unload: ${v}`);
    });
    callback && callback();
}

// process.on('exit', function() {
//     if (adapter &&adapter.log) adapter.log.info('on process exit');
//     console.log('on process exit');
// });

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const cmds = require('./lib/devices');

const usedStateNames = {
    online:      { n: 'reachable', g: 1, val: false, common: { write: false, type: 'boolean', role: 'indicator.reachable' }},
    on:          { n: 'on',        g: 3, val: false, common: { type: 'boolean', role: 'switch' }},
    bri:         { n: 'bri',       g: 3, val: 100,   common: { type: 'number', min: 0, max: 100, unit: '%', desc: '0..100%', role: 'level.dimmer' }},
    ct:          { n: 'ct',        g: 1, val: 0,     common: { type: 'number', min: 0, max: 5000, unit: '°K', desc: 'temperature in °Kelvin 0..5000', role: 'level.color.temperature' }},
    red:         { n: 'r',         g: 3, val: 0,     common: { type: 'number', min: 0, max: 255, desc: '0..255 or #rrggbb[ww] (hex)', role: 'level.color.red' }},
    green:       { n: 'g',         g: 3, val: 0,     common: { type: 'number', min: 0, max: 255, desc: '0..255 or #rrggbb[ww] (hex)', role: 'level.color.green' }},
    blue:        { n: 'b',         g: 3, val: 0,     common: { type: 'number', min: 0, max: 255, desc: '0..255 or #rrggbb[ww] (hex)', role: 'level.color.blue' }},
    white:       { n: 'w',         g: 3, val: 0,     common: { type: 'number', min: 0, max: 255, desc: '0..255 or #rrggbb[ww] (hex)', role: 'level.color.white' }},
    disco:       { n: 'disco',     g: 2, val: 1,     common: { type: 'number', min: 1, max: 9, desc: '1..9' }},
    progNo:      { n: 'progNo',    g: 1, val: 38,    common: { type: 'number', min: 35, max: 56, desc: '37..56, 97=none' }},
    progOn:      { n: 'progOn',    g: 1, val: false, common: { type: 'boolean',  desc: 'program on/off' }},
    progSpeed:   { n: 'progSpeed', g: 3, val: 10,    common: { type: 'number', min: 0, max: 255 }, desc: 'speed for program'},
    refresh:     { n: 'refresh',   g: 1, val: false, common: { type: 'boolean',  desc: 'read states from device' }},
    transition:  { n: 'trans',     g: 1, val: 30,    common: { type: 'number', unit: '\u2152 s', desc: 'in 10th seconds'} },
    command:     { n: 'command',   g: 3, val: 'r:0, g:0, b:0, on:true, transition:30', desc: 'r:0, g:0, b:0, on:true, transition:2' },
    rgb:         { n: 'rgb',       g: 3, val: '',    common: { type: 'text', desc: '000000..ffffff' , role: 'level.color.rgb' }},
    onTime:      { n: 'onTime',    g: 3, val: '',    common: {} },
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function parseHexColors(val) {
    val = val.toString();
    const ar = val.split('.');
    if (ar && ar.length > 1) val = ar[0];
    if (val[0] === '#') {
        val = val.substr(1);
    }
    const co = {
        r: parseInt(val.substr(0, 2), 16),
        g: parseInt(val.substr(2, 2), 16) || 0,
        b: parseInt(val.substr(4, 2), 16) || 0 //,
    };
    if (val.length > 7) {
        co.w = parseInt(val.substr(6, 2), 16);
    }
    if (ar && ar.length > 1) {
        const m = Number(`.${ar[1]}`);
        for (const i in co) {
            co[i] *= m;
        }
        roundRGB(co);
    }
    return co;
}

function onStateChange(id, state) {
    const ar = id.split('.');
    // const dcs = adapter.idToDCS(id);
    let deviceName = ar[2];
    let channelName = '';
    if (ar.length > 4) {
        channelName = ar.splice(3, 1)[0];
        deviceName += `.${channelName}`;
    }
    const stateName = ar[3];
    const device = wifi[deviceName];
    if (device === undefined || !device.isOnline || !state || state.val === null || state.ack) {
        return;
    }
    if (device.cmds.decodeResponse) {
        devices.invalidate(id);
    }
    device.stopRunningProgram();
    device.onStateChange(channelName, stateName, state.val);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
class WifiLight {
    constructor(config) {
        if (!config) {
            throw new Error('no configuration');
        }
        this.config = config;
        this.isOnline = false;
        this.cmds = cmds[config.type];
        this.prgTimer = soef.Timer();
    }

    run(cb) {
        if (!this.cmds) {
            adapter.log.error(`wrong device type. ${this.config.type} not yet supported!`);
            if (cb) {
                cb(-1);
            }
            return null;
        }
        if (this.cmds.vmax === undefined) {
            this.cmds.vmax = 255;
        }
        this.cmds.g = this.cmds.g || 1;

        this.createDevice((/* err */) => {
            this.setOnline(false);

            if (this.cmds.onlyConnectOnWrite) {
                this.USE_SOCKET_ONCE = true;
                this.setOnline('on demand');
            }
            this.queue = [];
            this.dataBuffer = new Uint8Array(200);
            this.dataBuffer.pos = 0;
            this.states = { red: 0, green: 0, blue: 0 };
            this.start(cb);
        });

        return this;
    }

    log(msg) {
        adapter.log.debug(`[${this.config.ip}] ${msg}`);
    }

    createDevice(cb) {
        this.dev = new devices.CDevice(0, '');
        this.dev.setDevice(this.config.ip, {
            common: {
                name: this.config.name,
                role: 'device',
            },
            native: {
                type: this.config.type,
                intervall: this.config.pollIntervall,
            },
        });
        if (this.zone !== undefined) {
            this.dev.setChannel(this.zone.toString(), ['All Zones', 'Zone 1', 'Zone 2', 'Zone 3', 'Zone 4'][this.zone]);
        }

        wifi[this.dev.getFullId()] = this;

        for (const j in usedStateNames) {
            if (j === 'white' && this.cmds.rgbw === undefined) {
                continue;
            }
            const st = Object.assign({}, usedStateNames[j]);
            if ((j === 'progNo' || j === 'disco') && this.cmds.programNames) {
                st.common.states = this.cmds.programNames;
            }
            // eslint-ignore-next-line
            if (st.g & this.cmds.g) {
                this.dev.createNew(st.n, st);
            }
        }
        devices.update(cb);
    }

    onStateChange(channel, stateName, val) {
        let transitionTime = this.getval(channel, usedStateNames.transition.n, 0);
        this.clearQueue();
        let co;
        switch (stateName) {
            case usedStateNames.transition.n:
                this.dev.setraw(usedStateNames.transition.n, val);
                break;
            case 'onTime':
                this.onTime(channel, val);
                break;
            case 'on':
                this.on_off(channel, !!(val >> 0));
                break;
            case 'rgbw':
            case 'rgb':
                co = parseHexColors(val);
                this.color(channel, co);
                break;
            case 'r':
            case 'g':
            case 'b':
            case 'w':
            case 'sat':
                if (typeof val === 'string' && val[0] === '#') {
                    co = parseHexColors(val);
                } else {
                    co = this.getRGBStates(channel);
                    co[stateName] = val >> 0;
                }
                this.color(channel, co);
                break;
            case usedStateNames.refresh.n:
                this.refresh();
                this.dev.set(usedStateNames.refresh.n, false);
                this.dev.update();
                break;
            case usedStateNames.bri.n:
                this.bri(channel, val >> 0, transitionTime);
                break;
            case usedStateNames.ct.n:
                this.ct(channel, val >> 0, transitionTime);
                break;
            case usedStateNames.progSpeed.n: {
                const progNo = this.get(channel, usedStateNames.progNo.n).val;
                this.addToQueue(channel, this.cmds.progNo, progNo, val);
                break;
            }
            case usedStateNames.progNo.n: {
                let speed;
                if (typeof val === 'string') {
                    let ar = val.split(' ');
                    if (!ar || ar.lengt < 2) {
                        ar = val.split(',');
                    }
                    if (ar && ar.length >= 2) {
                        speed = parseInt(ar[1]);
                        val = parseInt(ar[0]);
                    }
                } else {
                    speed = this.getval(channel, usedStateNames.progSpeed.n, 30);
                }
                // if (this.cmds._setProgNo) _setProgNo(this, channel, val >> 0); else
                this.addToQueue(channel, this.cmds.progNo, val >> 0, speed);
                break;
            }
            case usedStateNames.progOn.n:
                this.addToQueue(channel, val ? this.cmds.progOn : this.cmds.progOff);
                break;
            case usedStateNames.command.n: {
                let v = val.replace(/(^on$|red|green|blue|transition|bri|off)/g, match => {
                    return {
                        '#': '#',
                        off: 'off:1',
                        on: 'on:1',
                        red: 'r',
                        green: 'g',
                        blue: 'b',
                        white: 'w',
                        transition: 'x',
                        bri: 'l',
                        //, off: 'on:0'
                    }[match];
                });

                v = v
                    .replace(/\s|"|;$|,$/g, '')
                    .replace(/=/g, ':')
                    .replace(/;/g, ',')
                    .replace(/true/g, 1)
                    .replace(/((on|off),{1})/g, '$2:1,')
                    .replace(/#((\d|[a-f]|[A-F]|[.])*)/g, 'h:"$1"')
                    .replace(/(r|g|b|w|x|l|sat|off|on|ct|h|p)/g, '"$1"')
                    .replace(/^\{?(.*?)}?$/, '{$1}');
                let colors;
                try {
                    colors = JSON.parse(v);
                } catch (e) {
                    adapter.log.error(`on Command: ${e.message}: state.val="${val}"`);
                    return;
                }
                if (colors.p) {
                    setTimeout(this.runJsonProgram.bind(this), 10, channel, colors.p);
                    return;
                }
                if (colors.h) {
                    Object.assign(colors, parseHexColors(colors.h));
                    delete colors.h;
                }
                if (!colors || typeof colors !== 'object') {
                    return;
                }
                if (colors.off !== undefined) {
                    this.color(channel, { r: 0, g: 0, b: 0, w: colors.w !== undefined ? 0 : undefined });
                    this.states.red = 0;
                    this.states.green = 0;
                    this.states.blue = 0;
                    if (this.states.white !== undefined) {
                        this.states.white = 0;
                    }
                }
                const o = fullExtendEx(this.getRGBStates(channel), colors);
                adapter.log.debug(JSON.stringify(o));
                if (o.x !== undefined) {
                    transitionTime = o.x >> 0;
                }
                if (o['on'] !== undefined) {
                    this.on_off(channel, !!(o.on >> 0));
                }
                if (colors.r !== undefined || colors.g !== undefined || colors.b !== undefined || colors.w !== undefined || colors.sat !== undefined) {
                    this.fade(channel, o, transitionTime);
                }
                if (o['ct'] !== undefined) {
                    this.ct(channel, o.ct >> 0, transitionTime);
                }
                if (o['l'] !== undefined) {
                    this.bri(channel, o.l >> 0, transitionTime);
                }
                break;
            }
            default:
                return;
        }
    }

    stopRunningProgram() {
        this.prgTimer.clear();
        this.refreshPaused = 0;
        this.clearQueue();
    }

    runJsonProgram(channel, cmds) {
        let i = -1;
        const self = this;
        const lastCo = {red: self.states.red, green: self.states.green, blue: self.states.blue};
        this.prgTimer.clear();
        self.clearQueue();

        function doIt() {
            if (self.queue.length > 0) {
                setTimeout(doIt, self.queue.length * 2);
                return;
            }
            if (++i >= cmds.length) {
                i = 0;
            }
            const cmd = cmds[i];
            if (cmd.x === undefined) {
                cmd.x = 0;
            }
            const delay = Math.abs(cmd.x);

            if (cmd.r !== undefined) {
                Object.assign(self.states, lastCo);
                self.fade(channel, cmd, delay);
                lastCo.red = cmd.r;
                lastCo.green = cmd.g;
                lastCo.blue = cmd.b;
            }
            if (cmd.x < 0) {
                return;
            }
            self.prgTimer.set(doIt, 10 + delay * 10);
        }

        if (cmds.length > 0) {
            this.refreshPaused = true;
            doIt();
        } else {
            this.stopRunningProgram();
        }
    }

    reconnect(cb, timeout) {
        if (cb && typeof cb != 'function') {
            timeout = cb;
            cb = undefined;
        }
        if (this.client) {
            this.destroyClient();
            setTimeout(() => this.start(cb), timeout === undefined ? 5000 : timeout);
        }
    }

    _write(data, cb) {
        if (this.USE_SOCKET_ONCE) {
            this.writeOnce(data, cb);
        } else {
            this.client.write(data, cb);
        }
    }

    start(cb) {
        this.destroyClient();
        if (debug) {
            this.ts = Date.now();
        }
        this.client = new net.Socket();
        this.client.on('data', data => this.onData(data));
        this.client.on('close', hasError => {
            this.setOnline(false);
            const ts = debug ? `(${Math.round((Date.now() - this.ts) / 1000)} sec) ` : '';
            this.log(`onClose ${ts}hasError=${hasError} client=${this.client}`);
        });
        this.client.on('error', error => {
            const ts = debug ? `(${Math.round((Date.now() - this.ts) / 1000)} sec) ` : '';
            this.log(`onError: ${ts}${error.code !== undefined ? error.code : ''} ${error.message}`);
            switch (error.errno) { //error.code
                case 'ECONNRESET':
                case 'ETIMEDOUT':
                case 'EPIPE':
                    this.reconnect(5000);
                    break;
            }
            this.setOnline(false);
        });
        this.client.connect(this.config.port, this.config.ip, () => {
            this.log(`${this.config.ip} connected`);
            this.setOnline(true);
            this.runUpdateTimer();
            adapter.log.debug('self.client.connect: connected');
            if (typeof cb == 'function') {
                cb();
            }
        });
    }

    destroyClient() {
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }
        if (this.client) {
            this.client.destroy();
            this.client = null;
        }
    }

    writeOnce(data, cb) {
        if (this.client) {
            this.client.write(data, cb);
            return;
        }
        this.client = new net.Socket();

        this.client.on('data', data => {
            this.onData(data);
            this.client.end();
            this.client = null;
        });
        this.client.on('error', (/* error */) => this.destroyClient());

        this.client.connect(this.config.port, this.config.ip, () =>
            this.client.write(data, cb));
    }

    get(channel, state) {
        return this.dev.get(channel, state);
    }

    getval(channel, state, def) {
        const o = this.dev.get(channel, state);
        if (o && o.val !== undefined) {
            return o.val;
        }
        return def;
    }

    close() {
        this.clearQueue();
        this.destroyClient();
        if (this.writeTimeout) {
            clearTimeout(this.writeTimeout);
            this.writeTimeout = null;
        }
        if (this.onTimerObject) {
            clearTimeout(this.onTimerObject);
            this.onTimerObject = null;
        }
        this.prgTimer.clear();
    }

    runUpdateTimer() {
        if (!this.cmds.decodeResponse) {
            return;
        }

        this.refresh();

        if (this.config.pollIntervall > 0) {
            this.updateTimer = setTimeout(() => this.runUpdateTimer(),
                this.config.pollIntervall * 1000);
        }
    }

    setOnline(val) {
        this.isOnline = val;
        if ((this.cmds.g & usedStateNames.online.g) === 0) {
            return;
        }
        this.dev.set(usedStateNames.online.n, val);
        devices.update();
    }

    directRefresh(channel) {
        if (!this.cmds.statusRequest || this.refreshPaused) {
            return;
        }
        this.log('sending refresh...');
        this.write(channel, this.cmds.statusRequest);
    }

    refresh(channel, ctrl) {
        if (!this.cmds.statusRequest || this.refreshPaused) {
            return;
        }
        this.addToQueue(channel, this.cmds.statusRequest, { ctrl: ctrl === undefined ? true : ctrl });
    }

    write(channel, cmd, cb) {
        let buf;
        if (this.cmds.useCheckSum) {
            buf = Buffer.alloc(cmd.length + 1);
            let sum = 0;
            for (let i = 0; i < cmd.length; i++) {
                buf[i] = cmd[i];
                sum += buf[i];
            }
            buf[buf.length - 1] = sum & 0xFF;
        } else {
            buf = Buffer.from(cmd);
        }
        //const s = buf.inspect();
        //this.log('writing: ' + buf.toString('hex').match(/.{2}/g).join(' '));
        this.log(`write: ${arrayToHexEx(buf)}`);
        if (!this.isOnline /*&& !this.USE_SOCKET_ONCE*/) {
            this.reconnect(() => this._write(buf, cb), 0);
            return;
        }
        this._write(buf, cb);
    }

    clearQueue() {
        this.queue.length = 0;
    }

    addToQueue(...args) {
        let channel = '';
        let idx = 0;
        let cmd = [];
        if (!(args[0] instanceof Array)) {
            channel = args[0];
            idx = 1;
        }
        if (!(args[idx] instanceof Array)) {
            return;
        }

        let j = idx + 1;
        if (args.length > j) {
            for (let i = 0; i < args[idx].length; i++) {
                cmd[i] = args[idx][i] < 0 && args[idx][i] !== cmds.VARS.separator && args[idx][i] !== cmds.VARS.sepNoDelay ? args[j++] : args[idx][i];
            }
        } else {
            cmd = args[idx];
        }
        let opt;
        if (args.length >= j && typeof args[j] == 'object') {
            opt = args[j];
        }

        let _cmd = [];
        const last = cmd.length - 1;
        cmd.forEach((c, i) => {
            let sep = 0;
            switch (c) {
                case cmds.VARS.separator:
                    sep = 1;
                    break;
                case cmds.VARS.sepNoDelay:
                    sep = 2;
                    break;
                default:
                    _cmd.push(c);
            }
            if (sep || i === last) {
                this.queue.push({
                    cmd: _cmd,
                    ctrl: !!opt?.ctrl,
                    channel: channel,
                    delay: sep & 2 ? 0 : opt && opt.delay !== undefined ? opt.delay : this.cmds.delay !== undefined ? this.cmds.delay : 10,
                    ts: 0,
                    inProcess: 0,
                });
                _cmd = [];
            }
        });

        if (this.queue.length && this.queue[0].inProcess === 1) {
            return;
        }

        this.exec();
    }

    exec() {
        let akt;
        do {
            if (this.queue.length <= 0) {
                return;
            }
            akt = this.queue[0];
            if (!(akt.inProcess || (!akt.ctrl && akt.ts && akt.ts < Date.now()))) {
                break;
            }
            if (this.queue.length <= 1 && !akt.cmd.eq(this.cmds.statusRequest)) {
                this.directRefresh(akt.channel);
            }
            this.queue.shift();
        } while(this.queue.length);

        this.write(akt.channel, akt.cmd, () =>
            this.writeTimeout = setTimeout(() => this.exec(), akt.delay));

        akt.inProcess = 1;
    }

    on_off(channel, state) {
        this.addToQueue(channel, state ? this.cmds.on : this.cmds.off);
    }

    fade(channel, rgbw, transitionTime) {
        if (!transitionTime) {
            this.color(channel, rgbw);
            return;
        }

        const co = {
            r: this.states.red,
            g: this.states.green,
            b: this.states.blue,
            w: this.states.white,
        };
        const dif = {
            r: rgbw.r - co.r,
            g: rgbw.g - co.g,
            b: rgbw.b - co.b,
        };

        dif.w = rgbw.w !== undefined && co.w !== undefined ? rgbw.w - co.w : 0;

        let maxSteps = Math.max(Math.abs(dif.r), Math.abs(dif.g), Math.abs(dif.b), Math.abs(dif.w), 1);

        maxSteps = Math.min((transitionTime * 100) / this.cmds.delay, maxSteps);

        dif.r /= maxSteps;
        dif.g /= maxSteps;
        dif.b /= maxSteps;
        dif.w /= maxSteps;

        const steps = maxSteps;
        const delay = parseInt(transitionTime * 100 / maxSteps);

        for (let i = 0; i < steps; i++) {
            co.r += dif.r;
            co.g += dif.g;
            co.b += dif.b;
            if (co.w !== undefined) {
                co.w += dif.w;
            }
            this.color(channel, roundRGB(co, true), { delay });
        }
    }

    color(channel, rgbw, opt) {
        rgbw.w === undefined ?
            this.addToQueue(channel, this.cmds.rgb, rgbw.r, rgbw.g, rgbw.b, opt) :
            this.addToQueue(channel, this.cmds.rgbw, rgbw.r, rgbw.g, rgbw.b, rgbw.w, opt);
    }

    ct(channel, temp, transitionTime) {
        let co = ct2rgb(temp);
        const hsv = rgb2hsv(co);
        // hsv.v = this.get(channel, 'bri').val;
        const v = this.get(channel, 'bri').val;
        if (v) {
            hsv.v = v;
        }
        co = hsv2rgb(hsv);
        this.fade(channel, co, transitionTime);
    }

    temperature(channel, temp, transitionTime) {
        return this.ct(channel, temp, transitionTime);
    }

    getRGBStates(/* channel */) {
        return {
            r: this.states.red,
            g: this.states.green,
            b: this.states.blue,
            w: this.states.white,
        };
    }

    bri(channel, bri, transitionTime) {
        let co = this.getRGBStates(channel);
        const hsv = rgb2hsv(co);
        hsv.v = Math.max(Math.min(bri, 100), 0);
        co = hsv2rgb(hsv);
        this.fade(channel, co, transitionTime);
    }

    onTime(channel, val) {
        if (this.onTimerObject) {
            clearTimeout(this.onTimerObject);
            this.onTimerObject = null;
        }
        let timeout = val >> 0;
        let cmd = '#00000000;x10';
        if (typeof val == 'string') {
            const ar = val.split(';');
            timeout = parseInt(ar.shift());
            cmd = ar.join(';');
        }
        if (timeout && timeout > 0) {
            this.onTimerObject = setTimeout(this.onStateChange.bind(this), timeout * 100, channel, 'command', cmd);
        }
    }

    onData(data) {
        if (adapter.common.loglevel === 'debug') {
            adapter.log.debug(`raw data length: ${data.length}`);
            adapter.log.debug(`raw data: ${arrayToHexEx(data)}`);
        }
        const newPos = this.dataBuffer.pos + data.length;
        if (newPos > this.dataBuffer.length) {
            const b = new Uint8Array(newPos + 200);
            //const b = new Buffer(newPos + 200);
            for (let i = 0; i < this.dataBuffer.pos; i++) {
                b [i] = this.dataBuffer[i];
            }
            b.pos = this.dataBuffer.pos;
            this.dataBuffer = b;
        }

        this.dataBuffer.set(data, this.dataBuffer.pos);
        this.dataBuffer.pos += data.length;

        while (this.dataBuffer.pos >= this.cmds.responseLen || this.dataBuffer.pos >= this.cmds.responseLen2) {
            const [lengthRead, states] = this.cmds.decodeResponse(this.dataBuffer);
            this.log(`onData: raw: ${arrayToHexEx(this.dataBuffer, lengthRead)}`);
            this.dataBuffer.copyWithin(0, lengthRead, this.dataBuffer.pos);
            this.dataBuffer.pos -= lengthRead;
            if (!states) {
                break;
            }
            this.states = states;
            this.log(`onData: ${JSON.stringify(this.states)}`);
            if (this.states) {
                //set(usedStateNames.status.n, this.states.power);
                this.dev.set(usedStateNames.on.n, this.states.on);
                this.dev.set(usedStateNames.red.n, this.states.red);
                this.dev.set(usedStateNames.green.n, this.states.green);
                this.dev.set(usedStateNames.blue.n, this.states.blue);
                this.dev.set(usedStateNames.progNo.n, this.states.progNo);
                this.dev.set(usedStateNames.progOn.n, this.states.progOn);
                this.dev.set(usedStateNames.progSpeed.n, this.states.progSpeed);
                this.dev.set(usedStateNames.white.n, this.states.white);
                let rgb = `#${this.states.red.toHex()}${this.states.green.toHex()}${this.states.blue.toHex()}`;
                if (this.states.white !== undefined) {
                    rgb += this.states.white.toHex();
                }
                this.dev.set(usedStateNames.rgb.n, rgb);
                devices.update();
            }
        }
        return this.states;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
class MiLight extends WifiLight {
    constructor(config, zone) {
        super(config);
        if (!this.cmds) {
            return;
        }
        this.zone = zone;
        this.cmds = cloneEx(this.cmds);
        this.cmds.setZone(this.zone);
        this.states = { on: 0, red: 0, green: 0, blue: 0, white: 0 };
        this.writeTimer = soef.Timer();
        this.isOnline = 'on demand';
    }

    // writeUdp
    _write(data, cb) {
        if (!this.client) {
            const dgram = require('node:dgram');
            this.client = dgram.createSocket('udp4');
            this.client.on('listening', (error) => {
                if (error) {
                    return cb && cb(error);
                }
                if (this.config.ip === '255.255.255.255') {
                    this.client.setBroadcast(true);
                }
            });
            this.client.on('message', (/* data, rinfo */) => {});
            this.client.on('error', (/* error */) => {});
            this.client.on('close', (/* error */) => {
                this.client = null;
                adapter.log.debug('UDP socked closed');
            });
        }

        this.client.send(data, 0, data.length, this.config.port, this.config.ip, (/* error, bytes */) => {
            this.writeTimer.set(() => this?.client?.close(), 2000);
            cb && cb();
        });
    }

    bri(channel, bri /* , transitionTime */) {
        this.addToQueue(channel, this.cmds._bri(bri));
    }

    color(channel, rgbw /* , opt */) {
        if (rgbw.w !== undefined) {
            this.addToQueue(channel, this.cmds._white((rgbw.w * 100 / 255) >> 0));
            return;
        }
        const hsv = rgb2hsv(rgbw);
        if (hsv.h === 0 && hsv.v === 0) {
            this.on_off(channel, false);
            return;
        }
        const color = (256 + 176 - Math.floor(Number(hsv.h) / 360.0 * 255.0)) % 256;

        this.addToQueue(channel, this.cmds.on);
        this.addToQueue(channel, this.cmds._color(color));
        this.addToQueue(channel, this.cmds._bri(hsv.v));
    }

    pair(channel) {
        for (let i = 0; i < 3; i++) {
            this.addToQueue(channel, this.pair, { delay: 1000 });
        }
    }

    unPair(channel) {
        for (let i = 0; i < 15; i++) {
            this.addToQueue(channel, this.unPair, { delay: 200 });
        }
    }

    onStateChange(channel, stateName, val) {
        switch (stateName) {
            case 'disco': {
                val = val >> 0;
                if (val === 0) {
                    this.addToQueue(channel, this.cmds.off);
                    return;
                }
                // const bri = this.getval(channel, 'bri');
                let cmd = this.cmds._white(10).cc(this.cmds.on);
                while (val--) {
                    cmd = cmd.cc(this.cmds.discoMode);
                }
                this.addToQueue(channel, cmd /*, {delay: 50}*/);
                break;
            }
            default:
                WifiLight.prototype.onStateChange.call(this, channel, stateName, val);
                break;
        }
    }
}

function checkDeletedDevices(cb) {
    adapter.getDevices((err, res) => {
        if (err || !res || res.length <= 0) {
            return cb && cb();
        }
        const reIp = /[^0-9]/g;
        const toDelete = [];
        res.forEach(obj => {
            const ar = obj._id.split('.');
            const ip = ar[2].replace(reIp, '.');
            const found = adapter.config.devices.find(v => v.ip === ip); // xxxx
            if (!found) {
                toDelete.push(obj._id);
            }
        });

        toDelete.forEachCallback((next, id) => dcs.del(id, next), cb);
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function normalizeConfig(config) {
    let changed = false;
    const types = [];
    config.devices.forEach(d => {
        const old = Object.assign({}, d);
        const dev = fromDeviceName(d.name);

        if (d.type === undefined) {
            d.type = dev ? dev.type : '';
        }
        const c = cmds[d.type];
        if (!c) {
            let err = `config.device.type "${d.type}" (${d.name}) is not a known device type. Skipping this device!`;
            if (!types.length) Object.keys(cmds).forEach(n => {
                if (typeof cmds[n] === 'object' && cmds[n].on) {
                    types.push(n);
                }
            });
            err += `\nKnown types are: ${types.join(', ')}`;
            adapter.log.error(err);
            return;
        }

        if (d.pollIntervall === undefined) {
            d.pollIntervall = 30;
        }

        d.pollIntervall = parseInt(d.pollIntervall, 10) || 0;

        if (d.pollIntervall && d.pollIntervall < 5) {
            d.pollIntervall = 5;
        }

        d.port = parseInt(d.port) || (c && c.port ? c.port : dev && dev.port ? dev.port : 5577);
        Object.keys(d).forEach(key => {
            changed = changed || d[key] !== old[key];
        });
    });
    if (changed) {
        soef.changeAdapterConfig(adapter, conf => conf.devices = config.devices);
    }
}

function main() {
    if (!adapter.config.devices) {
        return;
    }
    checkDeletedDevices((/* err */) => {});
    normalizeConfig(adapter.config);

    const miLight = [];

    for (let i = 0; i < adapter.config.devices.length; i++) {
        if (adapter.config.devices[i].type === 'MiLight') {
            for (let zone = 0; zone <= 4; zone++) {
                miLight[zone] = new MiLight(adapter.config.devices[i], zone);
                miLight[zone].run(() => {
                });
            }
        } else {
            const wifiLight = new WifiLight(adapter.config.devices[i]);
            wifiLight.run(() => {});
        }
    }

    devices.update();
    adapter.subscribeStates('*');
}
