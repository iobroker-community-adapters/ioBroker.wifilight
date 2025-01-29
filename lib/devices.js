const VARS = {
    red: -1,
    green: -2,
    blue: -3,
    prog: -4,
    speed: -5,
    white: -6,
    bright: -7,
    separator: -8,
    sepNoDelay: -9,
};

const programNames = {
    97: 'none',
    37: 'Seven Colors Cross Fade',
    38: 'Red Gradual Change',
    39: 'Green Gradual Change',
    40: 'Blue Gradual Change',
    41: 'Yellow Gradual Change',
    42: 'Cyan Gradual Change',
    43: 'Purple Gradual Change',
    44: 'White Gradual Change',
    45: 'Red,Green Cross Fade',
    46: 'Red, Blue Cross Fade',
    47: 'Green, Blue Cross Fade',
    48: 'Seven Colors Strobe Flash',
    49: 'Red Strobe Flash',
    50: 'Green Strobe Flash',
    51: 'Blue Strobe Flash',
    52: 'Yellow Strobe Flash',
    53: 'Cyan Strobe Flash',
    54: 'Purple Strobe Flash',
    55: 'White Strobe Flash',
    56: 'Seven Colors Jumping Change',
};

const knownDeviceNames = {
    'HF-LPB100-ZJ200': { type: 'LD382A' /*, port: 5577*/ },
    'HF-LPB100-ZJ002': { type: 'LD382' },
    'HF-A11-ZJ002': { type: 'LW12' },
    'Mi-Light': { type: 'MiLight', port: 8899 },
    'AK001-ZJ100': { type: 'LD382A' /*, magichome port: 5577*/ },
    'AK001-ZJ200': { type: 'LD686' /*, magichome port: 5577*/ },
};

const LW12 = {
    useCheckSum: false,
    port: 5577,
    vmax: 255,
    delay: 10,
    responseLen: 11,
    responseLen2: 11,
    on: [0xcc, 0x23, 0x33],
    off: [0xcc, 0x24, 0x33],
    progOn: [0xcc, 0x21, 0x33],
    progOff: [0xcc, 0x20, 0x33],
    statusRequest: [0xef, 0x01, 0x77],
    programNames,
    progNo: [0xbb, VARS.prog, VARS.speed, 0x44],
    rgb: [0x56, VARS.red, VARS.green, VARS.blue, 0xaa],
    decodeResponse: data => {
        if (data[0] !== 0x66 || data[1] !== 0x01) {
            return [11, null];
        }
        const result = {
            //power: ((data[2] === 0x23) ? true : false),
            on: data[2] === 0x23,
            progNo: data[3], //mode
            progOn: data[4] === 33, //modeRun
            rogSpeed: data[5], //modeSpeed
            red: data[6],
            green: data[7],
            blue: data[8],
        };
        if (data[9] === 1 && data[10] === 0x99) {
            // ignore it
        }
        return [11, result];
    },
};

const LD382A = {
    useCheckSum: true,
    port: 5577,
    // onlyConnectOnWrite: true,

    delay: 10,
    responseLen: 14,
    responseLen2: 4,
    on: [0x71, 0x23, 0x0f],
    off: [0x71, 0x24, 0x0f],
    progOn: [0x71, 0x21, 0x0f],
    progOff: [0x71, 0x20, 0x0f],
    statusRequest: [0x81, 0x8a, 0x8b],
    programNames,
    progNo: [97, VARS.prog, VARS.speed, 0x0f],
    rgbw: [0x31, VARS.red, VARS.green, VARS.blue, VARS.white, 0x00, 0x0f],
    rgb: [0x31, VARS.red, VARS.green, VARS.blue, 0xff /*VARS.white*/, 0x00, 0x0f],

    decodeResponse: data => {
        // If power on / off request, the result is 4 bytes long and the second byte is 0x71
        if (data[1] === 0x71) {
            return [4, null];
        } // ignore it
        if (data[0] !== 129 /* = 0x81 */) {
            return [0, null];
        }
        //[129, 4, 35, 97, 33, 9, 11, 22, 33, 255, 3, 0, 0, 119]
        return [
            14,
            {
                // power: ((data[2] === 0x23) ? true : false),
                on: data[2] === 0x23,
                // power: ((data[13] & 0x01) ? true : false),
                // power: ((data[13] & 0x01) ? false : true),
                progNo: data[3], // mode
                progOn: data[4] === 33, // modeRun
                progSpeed: data[5], // modeSpeed
                red: data[6],
                green: data[7],
                blue: data[8],
                white: data[9],
            },
        ];
    },
};

const LD686 = {
    useCheckSum: true,
    port: 5577,
    //onlyConnectOnWrite: true,

    delay: 10,
    responseLen: 14,
    responseLen2: 14,
    on: [0x71, 0x23, 0x0f],
    off: [0x71, 0x24, 0x0f],
    // additional HEX field for RGBW. 0xF0 = RGB only; 0x0F WW only; 0xFF RGBW
    rgb: [0x31, VARS.red, VARS.green, VARS.blue, 0x00 /*VARS.white*/, 0x00, 0xf0, 0x0f],
    rgbw: [0x31, VARS.red, VARS.green, VARS.blue, VARS.white, 0x00, 0xff, 0x0f],
    progOn: [0x71, 0x21, 0x0f],
    progOff: [0x71, 0x20, 0x0f],
    progNo: [97, VARS.prog, VARS.speed, 0x0f],
    statusRequest: [0x81, 0x8a, 0x8b],
    programNames,

    decodeResponse: data => {
        if (data[0] !== 129) {
            return [0, null];
        }
        // [129, 4, 35, 97, 33, 9, 11, 22, 33, 255, 3, 0, 0, 119]
        return [
            14,
            {
                // power: ((data[2] === 0x23) ? true : false),
                on: data[2] === 0x23,
                // power: ((data[13] & 0x01) ? true : false),
                // power: ((data[13] & 0x01) ? false : true),
                progNo: data[3], // mode
                progOn: data[4] === 33, // modeRun
                progSpeed: data[5], // modeSpeed
                red: data[6],
                green: data[7],
                blue: data[8],
                white: data[9],
            },
        ];
    },
};

const LD382 = Object.assign({}, LD382A, {
    // not tested
});

const UFO = Object.assign({}, LD382A, {
    // not tested
    on: [0x71, 0x23],
    off: [0x71, 0x24],
    progOn: [0x71, 0x21],
    progOff: [0x71, 0x20],
    progNo: [0x61, VARS.prog, VARS.speed],
    rgbw: [0x31, VARS.red, VARS.green, VARS.blue, VARS.white, 0x00],
    rgb: [0x31, VARS.red, VARS.green, VARS.blue, 0x00, 0x00, 0x00],
    statusRequest: [0x81, 0x8a, 0x8b],
});

//LimitlessLED
const MiLight = {
    //http://www.limitlessled.com/dev/
    port: 8899,
    udp: true,
    onlyConnectOnWrite: true,
    broadcastIP: '255.255.255.255',
    g: 2,
    dimSteps: 25,
    colorSteps: 255,
    delay: 100,

    // this function cannot be lambda (=>) because it is used with "this"
    setZone: function (zone) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        if (zone > 4) {
            zone = 0;
        }
        self.on[0] = [0x42, 0x45, 0x47, 0x49, 0x4b][zone];
        self.off[0] = [0x41, 0x46, 0x48, 0x4a, 0x4c][zone];
        self.whiteMode[0] = [0xc2, 0xc5, 0xc7, 0xc9, 0xcb][zone];
        self.nightMode[0] = [0xc1, 0xc6, 0xc8, 0xca, 0xcc][zone];
        self.maxBright[0] = [0xb5, 0xb8, 0xbd, 0xb7, 0xb2][zone];

        self.wtOn[0] = [0x35, 0x38, 0x3d, 0x37, 0x32][zone];
        self.wtOff[0] = [0x39, 0x3b, 0x33, 0x3a, 0x36][zone];
        self.wtNightMode[0] = [0xb9, 0xbb, 0xb3, 0xba, 0xb6][zone];
        self.wtmaxBright[0] = [0xb5, 0xb8, 0xbd, 0xb7, 0xb2][zone];

        function _cc(self, sep) {
            return function (...args) {
                let isArr = true;
                let ret = self;
                for (let i = 0; i < args.length; i++) {
                    const _isArr = args[i] instanceof Array;
                    if (_isArr || _isArr !== isArr) {
                        ret = ret.concat(sep);
                    }
                    isArr = _isArr;
                    ret = ret.concat(args[i]);
                }
                ret.cc = _cc(ret, VARS.separator);
                ret.ccn = _cc(ret, VARS.sepNoDelay);
                return ret;
            };
        }
        const noSuffix = false;
        for (const p in self) {
            if (self[p] instanceof Array && self[p].length === 3) {
                if (self[p][1] < 0) {
                    self[p].f = function (val) {
                        const ret = this.slice();
                        ret[1] = val;
                        return ret;
                    };
                }
                if (noSuffix && self[p][2] === 0x55) {
                    self[p].length -= 1;
                }
                self[p].cc = _cc(self[p], VARS.separator);
                self[p].ccn = _cc(self[p], VARS.sepNoDelay);
            }
        }
    },
    on: [0x42, 0x00, 0x55],
    off: [0x41, 0x00, 0x55],
    whiteMode: [0xc2, 0x00, 0x55],
    nightMode: [0xc1, 0x00, 0x55],
    maxBright: [0xb5, 0x00, 0x55],

    discoMode: [0x4d, 0x00, 0x55],
    discoSpeedSlower: [0x43, 0x00, 0x55],
    discoSpeedFaster: [0x44, 0x00, 0x55],

    wtOn: [0x35, 0x00, 0x55],
    wtOff: [0x39, 0x00, 0x55],
    wtNightMode: [0xb9, 0x00, 0x55],
    wtmaxBright: [0xb5, 0x00, 0x55],
    wtBrightUp: [0x3c, 0x00, 0x55],
    wtBrightDown: [0x34, 0x00, 0x55],
    wtWarmer: [0x3e, 0x00, 0x55],
    wtCooler: [0x3f, 0x00, 0x55],

    progNo: [0x4d, 0x00, 0x55],

    pair: [0x25, 0x00, 0x55], // send 3 x with 1 sec delay
    unPair: [0x25, 0x00, 0x55], // send 15 x with 200 ms delay

    //////////////////////////////////////////////////////////////////////////////

    rgb: [0x00],
    rgbw: [0x00],
    bri: [0x4e, VARS.bright, 0x55],
    hue: [0x40, VARS.red, 0x55],

    programNames: {
        0: '[Off]',
        1: 'Regenbogen',
        2: 'Weiß Blinken',
        3: 'Farbverlauf',
        4: 'Farbwechsel',
        5: 'Flash (alle Farben)',
        6: 'Fade - Blinken (rot)',
        7: 'Fade - Blinken (grün)',
        8: 'Fade - Blinken (blau)',
        9: 'Disco',
        10: '10',
        11: '11',
        12: '12',
        13: '13',
        14: '14',
        15: '15',
        16: '16',
        17: '17',
        18: '18',
        19: '19',
        20: '20',
    },

    __bri: function __bri(percent) {
        return this.bri.f(Math.floor(2 + ((percent || 0) / 100) * 25));
    },
    _white: function (percent) {
        if (percent === 0) {
            return this.off;
        }
        return this.whiteMode.ccn(this.__bri(percent));
    },
    _color: function (hue) {
        return this.on.cc(this.hue.f(hue));
    },
    _bri: function (percent) {
        return this.on.cc(this.__bri(percent));
    },
};

const MiLightRGB = Object.assign({}, MiLight, {
    g: 2,
    dimSteps: 9,
    colorSteps: 255,

    on: [0x22, 0x00, 0x55],
    off: [0x21, 0x00, 0x55],
    discoModeUp: [0x27, 0x00, 0x55],
    discoModeDown: [0x28, 0x00, 0x55],
    discoSpeedSlower: [0x26, 0x00, 0x55],
    discoSpeedFaster: [0x25, 0x00, 0x55],

    briDown: [0x24, 0x00, 0x55],
    briUp: [0x23, 0x00, 0x55],

    _bri: percent => {
        const bri = Math.floor(2 + ((percent || 0) / 100) * this.dimSteps);
        const cmd = [].concat(this.on);
        for (let i = 0; i < bri; i++) {
            cmd.push(this.briUp);
        }
    },
});

const MiLightW = Object.assign({}, MiLight, {
    g: 2,
    dimSteps: 11,
    colorSteps: 11,
});

module.exports = {
    VARS,
    knownDeviceNames,

    MiLightW,
    LW12,
    LD382A,
    LD686,
    LD382,
    UFO,
    MiLight,
    MiLightRGB,
};
