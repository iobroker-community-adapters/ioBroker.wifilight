/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */
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
                    ip: '127.0.0.1',
                    port: 5577,
                    name: 'LD382A',
                    pollIntervall: 10,
                },
            ];

            await setup.setAdapterConfig(config.common, config.native);

            startServer({ r: 10, g: 20, b: 30, w: 50, progOn: false, on: true })
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
        this.timeout(60000);
        checkConnectionOfAdapter(res => {
            res && console.log(res);
            expect(res).not.to.be.equal('Cannot check connection');
            objects.setObject('system.adapter.test.0', {
                common: {

                },
                type: 'instance'
            },
            () => {
                states.subscribeMessage('system.adapter.test.0');
                done();
            });
        });
    });

    it(`Test ${adapterShortName} adapter: Check predefined states`, function (done) {
        this.timeout(10000);
        checkValueOfState(`${adapterShortName}.0.127_0_0_1.0.r`, 10, () => {
            checkValueOfState(`${adapterShortName}.0.127_0_0_1.0.g`, 20, () => {
                checkValueOfState(`${adapterShortName}.0.127_0_0_1.0.b`, 30, () => {
                    checkValueOfState(`${adapterShortName}.0.127_0_0_1.0.w`, 50, () => {
                        checkValueOfState(`${adapterShortName}.0.127_0_0_1.0.progOn`, false, () => {
                            checkValueOfState(`${adapterShortName}.0.127_0_0_1.0.on`, true, () => {
                                done();
                            });
                        });
                    });
                });
            });
        });
    });

    it(`Test ${adapterShortName} adapter: test control`, function (done) {
        this.timeout(10000);
        onStateChanged = (id, state) => {
            if (id === `${adapterShortName}.0.127_0_0_1.0.r`) {
                expect(state.val).to.be.equal(20);
                done();
            }
        };
        states.setState(`${adapterShortName}.0.127_0_0_1.0.r`, 20, true);
    });

    after(`Test ${adapterShortName} adapter: Stop js-controller`, function (done) {
        this.timeout(10000);

        setup.stopController(normalTerminated => {
            stopServer()
                .then(() => {
                    console.log(`Adapter normal terminated: ${normalTerminated}`);
                    done();
                });
        });
    });
});
