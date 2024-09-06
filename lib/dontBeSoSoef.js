/**
 Modified version of https://github.com/soef/soef
 Copyright (c) 2016 - 2020 soef <soef@gmx.net>
 All rights reserved.
 **/
let adapter = null;

function hasProp(obj, propString) {
    if (!obj) {
        return false;
    }
    const ar = propString.split('.');
    const len = ar.length;
    for (let i = 0; i < len; i++) {
        obj = obj[ar[i]];
        if (obj === undefined) {
            return false;
        }
    }
    return true;
}

const TR = {
    '\u00e4': 'ae',
    '\u00fc': 'ue',
    '\u00f6': 'oe',
    '\u00c4': 'Ae',
    '\u00d6': 'Oe',
    '\u00dc': 'Ue',
    '\u00df': 'ss',
    ' ': '_',
    '.': '_',
};

function normalizedName(name) {
    return name.replace(/[\u00e4\u00fc\u00f6\u00c4\u00d6\u00dc\u00df .]/g, $0 => TR[$0]);
}

function idWithoutNamespace(id) {
    return id.substr(adapter.namespace.length + 1);
}

function valType(val) {
    switch (val) {
        //fastest way for most states
        case true:
            return true;
        case false:
            return false;
        case 'true':
            return true;
        case 'false':
            return false;
        case '0':
            return 0;
        case '1':
            return 1;
        case '2':
            return 2;
        case '3':
            return 3;
        case '4':
            return 4;
        case '5':
            return 5;
        case '6':
            return 6;
        case '7':
            return 7;
        case '8':
            return 8;
        case '9':
            return 9;
    }
    const number = parseInt(val);
    if (number.toString() === val) {
        return number;
    }
    const float = parseFloat(val);
    if (float.toString() === val) {
        return float;
    }
    return val;
}

function _fullExtend(dest, from) {
    const props = Object.getOwnPropertyNames(from);
    let destination;

    props.forEach(name => {
        if (typeof from[name] === 'object') {
            if (typeof dest[name] !== 'object') {
                dest[name] = {};
            }
            _fullExtend(dest[name],from[name]);
        } else {
            destination = Object.getOwnPropertyDescriptor(from, name);
            Object.defineProperty(dest, name, destination);
        }
    });
}

function fullExtend(dest, from) {
    _fullExtend(dest, from);
    return dest;
}

function clone(from) {
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
            _fullExtend(dest[name],from[name]);
        } else {
            destination = Object.getOwnPropertyDescriptor(from, name);
            Object.defineProperty(dest, name, destination);
        }
    });
    return dest;
}

function arrayToHex(ar, len) {
    const s = [];
    if (len === undefined) {
        len = ar.length;
    }
    for (let i = 0; i < len; i++) {
        s.push(ar[i].toString(16).padStart(2, '0'));
    }
    return s.join(' ');
}

function forEachObjSync(_objects, step, func, readyCallback) {
    if (typeof step === 'function') {
        readyCallback = func;
        func = step;
        step = 1;
    }
    let objs = [];
    if (!(_objects instanceof Array)) {
        for (const i in _objects) {
            objs.push(i);
        }
    } else {
        objs = _objects;
    }
    const pop = step === -1 ? objs.pop : objs.shift;

    function doit(ret) {
        if (objs.length <= 0) {
            if (typeof readyCallback === 'function') {
                readyCallback(ret);
            }
        } else {
            func(pop.call(objs), doit);
        }
    }

    doit(-1);
}

function dcs(deviceName, channelName, stateName) {
    if (stateName === undefined) {
        stateName = channelName;
        channelName = '';
    }
    if (stateName[0] === '.') {
        return stateName.substr(1);
    }
    let ret = '';
    const ar = [deviceName, channelName, stateName];
    for (let i = 0; i < ar.length; i++) {
        const s = ar[i];
        if (!ret) {
            ret = s;
        } else if (s) {
            ret += `.${s}`;
        }
    }
    return ret;
}

function _setObjectName(o, name) {
    if (!o.common) {
        o.common = { name };
    } else {
        o.common.name = name;
    }
}

function val2obj(valOrObj, name) {
    let obj;
    if (valOrObj && typeof valOrObj === 'object') {
        obj = valOrObj || {};
    } else {
        obj = {};
        if (valOrObj !== null && valOrObj !== undefined) {
            obj.val = valType(valOrObj);
        } else {
            obj.val = null;
        }
    }
    if (name && !obj?.common?.name) {
        _setObjectName(obj, name);
    }
    return obj;
}

////////////////////////////////////////////////////////////////////////////////////

function CDevice(_name, _devices) {
    let deviceName = '';
    let channelName = '';
    this.devices = _devices;
    this.list = this.devices.list;

    this.push = function (obj) {
        for (let i = 0; i < this.list.length; i++) {
            if (this.list[i]._id === obj._id) {
                return fullExtend(this.list[i], obj);
            }
        }
        this.list.push(obj);
        return obj;
    };

    this.setDevice = function (name, options) {
        channelName = '';
        if (!name) {
            return;
        }
        deviceName = normalizedName(name);
        const obj = { type: 'device', _id: deviceName };
        if (options) {
            Object.assign(obj, options);
        }
        return this.push(obj);
    };

    this.setDevice(_name);

    this.setChannel = function (name, showNameOrObject) {
        if (name === undefined) {
            channelName = '';
        } else {
            channelName = name;
            const id = dcs(deviceName, channelName);
            if (!this.devices.has(id)) {
                let obj;
                if (typeof showNameOrObject == 'object') {
                    obj = { type: 'channel', _id: id, common: { name } };
                    if (showNameOrObject.common) {
                        obj.common = showNameOrObject.common;
                    }
                    if (showNameOrObject.native) {
                        obj.native = showNameOrObject.native;
                    }
                } else {
                    obj = { type: 'channel', _id: id, common: { name: showNameOrObject || name }};
                }
                return this.push(obj);
            }
        }
    };

    this.split = function (id, valOrObj) {
        const ar = (id && id[0] === '.' ? id.substr(1) : dcs(deviceName, channelName, id))
            .split('.');

        const dName = deviceName, cName = channelName;
        if (ar.length === 3) {
            this.setDevice(ar.shift());
            this.setChannel(ar.shift());
            const ret = this.addEx(ar[0], valOrObj);
            deviceName = dName;
            channelName = cName;
            return ret;
        }
        if (ar.length === 2) {
            this.setChannel(ar.shift());
            const ret = this.addEx(ar[0], valOrObj);
            deviceName = dName;
            channelName = cName;
            return ret;
        }

        const ret = this.addEx(ar[0], valOrObj);
        deviceName = dName;
        channelName = cName;
        return ret;
    };

    this.addEx = function (name, valOrObj) {
        if (valOrObj === null) {
            return;
        }
        if (name.includes('.')) {
            return this.split(name, valOrObj);
        }
        const obj = val2obj(valOrObj, name);
        obj._id = dcs(deviceName, channelName, name);
        obj.type = 'state';
        return this.push(obj);
    };

    this.set = function (id, newObj) {
        const _id = dcs(deviceName, channelName, id);
        if (!this.devices.objects[_id]) {
            return this.addEx(id, newObj);
        }

        const val = newObj !== null && newObj.val !== undefined ? newObj.val : newObj;

        if (this.devices.objects[_id].val !== val) {
            this.devices.setState(_id, val, true);
            return true;
        }
        return false; // objects[_id];
    };

    this.getObjectEx = function (id) {
        id = dcs(deviceName, channelName, id);
        return this.devices.getObjectEx(id);
    };

    this.getFullId = function (id) {
        return dcs(deviceName, channelName, id);
    };

    this.get = function(channel, id) {
        if (!id) {
            id = dcs(deviceName, channelName, channel);
        } else {
            id = dcs(deviceName, channel, id);
        }
        return this.devices.objects[id];
    };

    this.createNew = function (id, newObj) {
        if (this.get(id)) {
            return;
        }
        this.set(id, newObj);
    };

    this.update = function (callback) {
        if (this.list.length) {
            this.devices.update(this.list, callback);
        } else if (typeof callback === 'function') {
            callback();
        }
    };
}

////////////////////////////////////////////////////////////////////////////////////

function Devices() {
    this.adapter = null;
    this.list = [];
    this.objects = {};

    this.setAdapter = function (_adapter) {
        this.adapter = _adapter;
        adapter = _adapter;
    };

    this.has = function (id, prop) {
        const b = Object.prototype.hasOwnProperty.call(this.objects, id);
        if (prop === undefined) {
            return b;
        }
        return b && this.objects[id] !== null && Object.prototype.hasOwnProperty.call(this.objects[id], prop);
    };

    this.get = function (id) {
        return this.objects[id];
    };

    this.remove = function (id) {
        delete this.objects[id];
    };
    this.removeWithoutNameSpace = function (id) {
        delete this.objects[idWithoutNamespace(id)];
    };

    this.setRaw = function (id, obj) {
        this.objects[id] = obj;
    };

    this.getObjectEx = function (id) {
        const obj = this.get(id);
        if (obj || !this.adapter || !this.adapter.namespace) {
            return obj;
        }
        id = id.substr(this.adapter.namespace.length+1);
        return this.objects[id];
    };

    this._getObjectEx = function(id) {
        return this.getObjectEx(id) || { val: undefined };
    };

    this.invalidate = function (id) {
        this._getObjectEx(id).val = undefined;
    };

    this.setObjectNotExists = function (id, newObj, callback) {
        this.adapter.getObject(id, (err, o) =>  {
            if (!o) {
                this.adapter.setObject(id, newObj, {}, callback);
            } else if (typeof callback === 'function') {
                callback('exists', o);
            }
        });
    };

    this.createObjectNotExists = function (id, obj, callback) {
        let val;
        const newobj = {
            type: 'state',
            common: {
                name: id,
                type: 'string',
                role: obj.type || 'state',
                // enumerable: true
                // writable: false
            },
            native: { }
        };
        _fullExtend(newobj, obj);

        if (obj['val'] !== undefined) {
            newobj.common.type = typeof obj.val;
            val = obj.val;
            delete newobj.val;
        }
        this.setObjectNotExists(id, newobj, (err, o) => {
            if (!err) {
                this.objects[newobj._id] = newobj;
                if (val !== undefined) {
                    this.setState(newobj._id, val, true);
                }
            }
            if (typeof callback === 'function') {
                callback(err, o);
            }
        });
    };

    this.setState = function (id, val, ack) {
        if (val !== undefined) {
            this.objects[id].val = val;
        } else {
            val = this.objects[id].val;
        }
        this.adapter.setState(id, val, ack === undefined ? true : ack);
    };

    this.setStateEx = function (id, newObj, ack, callback) {
        if (typeof ack === 'function') {
            callback = ack;
            ack = true;
        }
        if (typeof newObj !== 'object') {
            newObj = { val: newObj };
        }
        if (ack === undefined) {
            ack = true;
        }
        if (!this.has(id)) {
            this.createObjectNotExists(id, newObj, callback);
        } else {
            if (this.objects[id].val !== newObj.val) {
                this.setState(id, newObj.val, ack);
            }
            if (typeof callback === 'function') {
                callback(0);
            }
        }
    };

    this.update = function (list, callback) {
        if (typeof list === 'function') {
            callback = list;
            list = null;
        }
        if (!list || this.list === list) {
            list = this.list.slice();
            this.list.length = 0;
        }
        if (!list?.length) {
            if (typeof callback === 'function') {
                callback(-1);
            }
            return;
        }

        forEachObjSync(
            list,
            (obj, doit) => this.setStateEx(obj._id, obj, true, doit),
            callback,
        );
    };

    this.readAllExistingObjects = function (callback) {
        this.adapter.getForeignStates(`${this.adapter.namespace}.*`, {}, (err, states) => {
            if (err || !states) {
                return callback(-1);
            }
            const namespaceLen = this.adapter.namespace.length + 1;
            for (const fullId in states) {
                const id = fullId.substr(namespaceLen);
                const as = id.split('.');
                let s = as[0];
                for (let i = 1; i < as.length; i++) {
                    if (!this.has(s)) {
                        this.setRaw(s, {});
                    }
                    s += `.${as[i]}`;
                }
                this.setRaw(id, { val: states[fullId] ? states[fullId].val : null });
            }

            const _objects = this.objects;

            function doIt(list) {
                for (let i = 0; i < list.length; i++) {
                    const id = list[i]._id.substr(namespaceLen);
                    const o = { common: { name: list[i].common.name } };
                    _objects[id] = _objects[id] || {};
                    if (list[i].native !== undefined) {
                        o['native'] = list[i].native;
                    }
                    fullExtend(_objects[id], o);
                }
            }

            this.adapter.getDevices((err, _devices) => {
                !err && _devices && doIt(_devices);
                this.adapter.getChannels('', (err, channels) => {
                    !err && channels && doIt(channels);
                    if (typeof callback === 'function') {
                        callback(0);
                    }
                });
            });
        });
    };

    this.init = function (_adapter, callback) {
        this.setAdapter(_adapter);
        this.readAllExistingObjects(callback);
    };

    return this;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const devices = new Devices();

async function changeAdapterConfig(_adapter, changeCallback) {
    const obj = await _adapter.getForeignObjectAsync(`system.adapter.${_adapter.namespace}`);
    if (obj && !obj.native) {
        obj.native = {};
    }
    if (obj && changeCallback(obj.native) !== false) {
        await _adapter.setForeignObject(obj._id, obj);
        _adapter.log.info('soef.changeAdapterConfig: changed');
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function Timer(func, timeout, v1) {
    let timer = null;
    this.inhibit = false;
    this.enable = function (bo) {
        this.inhibit = bo === false;
    };
    this.set = function (func, timeout, v1) {
        if (timer) {
            clearTimeout(timer);
        }
        if (this.inhibit) {
            return;
        }
        timer = setTimeout(() => {
            timer = null;
            func(v1);
        }, timeout);
    };

    this.clear = function () {
        if (timer) {
            clearTimeout(timer);
            timer = null;
            return true;
        }
        return false;
    };

    if (func) {
        this.set(func, timeout, v1);
    }
}

function compareArrays(arr1, arr2) {
    if (arr1.length !== arr2.length) {
        return false;
    }
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) {
            return false;
        }
    }
    return true;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function forEachInSystemObjectView(type, id, callback) {
    const res = await adapter.getObjectViewAsync('system', type, { startkey: `${id}.`, endkey: `${id}.\u9999` });
    for (let j = 0; j < res.rows.length; j++) {
        await callback(res.rows[j], type);
    }
}

async function delObjectAndState(id) {
    await adapter.delStateAsync(id);
    await adapter.delObject(id);
}

// collect first all states, then all devices and then all channels
async function forEachObjectChild(id, callback) {
    if (!adapter._namespaceRegExp.test(id)) {
        id = adapter.namespace + (id ? `.${id}` : '');
    }

    await forEachInSystemObjectView('state', id, callback);
    await forEachInSystemObjectView('device', id, callback);
    await forEachInSystemObjectView('channel', id, callback);
}

async function delObjectWithStates(id) {
    if (!id.startsWith(`${adapter.namespace}.`)) {
        id = `${adapter.namespace}.${id}`;
    }

    await adapter.delStateAsync(id);
    await adapter.delObject(id);

    await forEachObjectChild(id, async o => {
        devices.remove(idWithoutNamespace(o.id));
        await delObjectAndState(o.id);
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
module.exports = {
    Timer,
    arrayToHex,
    changeAdapterConfig,
    clone,
    delObjectWithStates,
    devices,
    fullExtend,
    CDevice,
    compareArrays,
};
