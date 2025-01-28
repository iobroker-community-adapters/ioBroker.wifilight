const expect = require('chai').expect;
const setup = require('@iobroker/legacy-testing');
const { startServer, stopServer } = require('./simulate');

let objects = null;
let states  = null;
let onStateChanged = null;

const adapterShortName = setup.adapterName.substring(setup.adapterName.indexOf('.') + 1);

function checkConnectionOfAdapter(cb, counter) {
    counter = counter || 0;
    console.log(`Try check #${counter}`);
    if (counter > 30) {
        return cb && cb('Cannot check connection');
    }

    states.getState(`system.adapter.${adapterShortName}.0.alive`, (err, state) => {
        if (err) console.error(err);
        if (state && state.val) {
            cb && cb();
        } else {
            setTimeout(() => checkConnectionOfAdapter(cb, counter + 1), 1000);
        }
    });
}

function checkValueOfState(id, value, cb, counter) {
    counter = counter || 0;
    if (counter > 20) {
        return cb && cb(`Cannot check value Of State ${id}`);
    }

    states.getState(id, (err, state) => {
        err && console.error(err);
        if (value === null && !state) {
            cb && cb();
        } else if (state && (value === undefined || state.val === value)) {
            cb && cb();
        } else {
            setTimeout(() => checkValueOfState(id, value, cb, counter + 1), 500);
        }
    });
}

function checkValueOfStateAsync(id, value) {
    return new Promise((resolve, reject) =>
        checkValueOfState(id, value, error =>
            error ? reject(error) : resolve()));
}

function checkValueOfStateAcknowledged(id, value, cb, counter) {
    counter = counter || 0;
    if (counter > 20) {
        return cb && cb(`Cannot check value Of State ${id}`);
    }

    states.getState(id, (err, state) => {
        err && console.error(err);
        if (value === null && !state) {
            cb && cb();
        } else if (state && state.ack && (value === undefined || state.val === value)) {
            cb && cb();
        } else {
            setTimeout(() => checkValueOfState(id, value, cb, counter + 1), 500);
        }
    });
}

function checkValueOfStateAcknowledgedAsync(id, value) {
    return new Promise((resolve, reject) =>
        checkValueOfStateAcknowledged(id, value, error =>
            error ? reject(error) : resolve()));
}

const deviceState = { r: 10, g: 20, b: 30, w: 50, progOn: false, on: true };

describe(`Test ${adapterShortName} adapter`, function () {
    before(`Test ${adapterShortName} adapter: Start js-controller`, function (_done) {
        this.timeout(600000); // because of first install from npm

        setup.setupController(async () => {
            const config = await setup.getAdapterConfig();
            // enable adapter
            config.common.enabled  = true;
            config.common.loglevel = 'debug';

            config.native.devices   = [
                {
                    type: 'LD382A',
                    ip: '127.0.0.1',
                    port: 5577,
                    name: 'LD382A',
                    pollIntervall: 10,
                },
            ];

            await setup.setAdapterConfig(config.common, config.native);

            // start wifilight device with predefined values
            startServer(deviceState)
                .then(() => {
                    setup.startController(
                        true,
                        (/* id, obj */) => {},
                        (id, state) => onStateChanged && onStateChanged(id, state),
                        (_objects, _states) => {
                            objects = _objects;
                            states  = _states;
                            _done();
                        });
                });
        });
    });

    it(`Test ${adapterShortName} adapter: Check if adapter started`, function (done) {
        checkConnectionOfAdapter(res => {
            res && console.log(res);
            expect(res).not.to.be.equal('Cannot check connection');
            done();
        });
    }).timeout(60000);

    it(`Test ${adapterShortName} adapter: Check predefined states`, async () => {
        await checkValueOfStateAsync(`${adapterShortName}.0.127_0_0_1.r`, deviceState.r);
        await checkValueOfStateAsync(`${adapterShortName}.0.127_0_0_1.g`, deviceState.g);
        await checkValueOfStateAsync(`${adapterShortName}.0.127_0_0_1.b`, deviceState.b);
        await checkValueOfStateAsync(`${adapterShortName}.0.127_0_0_1.w`, deviceState.w);
        await checkValueOfStateAsync(`${adapterShortName}.0.127_0_0_1.progOn`, deviceState.progOn);
        await checkValueOfStateAsync(`${adapterShortName}.0.127_0_0_1.on`, deviceState.on);
        await checkValueOfStateAsync(`${adapterShortName}.0.127_0_0_1.reachable`, true);
    }).timeout(30000);

    it(`Test ${adapterShortName} adapter: test control`, async () => {
        deviceState.r = 80;
        states.setState(`${adapterShortName}.0.127_0_0_1.r`, deviceState.r, true);
        await checkValueOfStateAcknowledgedAsync(`${adapterShortName}.0.127_0_0_1.r`, deviceState.r);
        await checkValueOfStateAcknowledgedAsync(
            `${adapterShortName}.0.127_0_0_1.rgb`,
            `#${deviceState.r.toString(16).padStart(2, '0')}${deviceState.g.toString(16).padStart(2, '0')}${deviceState.b.toString(16).padStart(2, '0')}${deviceState.w.toString(16).padStart(2, '0')}`,
        );
    }).timeout(30000);

    it(`Test ${adapterShortName} adapter: test reachable`, async () => {
        await stopServer();
        checkValueOfStateAcknowledged(`${adapterShortName}.0.127_0_0_1.reachable`, false);
    }).timeout(30000);

    after(`Test ${adapterShortName} adapter: Stop js-controller`, function (done) {
        this.timeout(30000);

        setup.stopController(normalTerminated => {
            console.log(`Adapter normal terminated: ${normalTerminated}`);
            done();
        });
    });
});
