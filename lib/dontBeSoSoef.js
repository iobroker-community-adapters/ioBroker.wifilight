/**
 Modified version of https://github.com/soef/soef
 Copyright (c) 2016 - 2020 soef <soef@gmx.net>
 All rights reserved.
 **/
let adapter = null;

function idWithoutNamespace(id) {
    return id.substr(adapter.namespace.length + 1);
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

    this.setObjectNotExists = function (_adapter, id, newObj, callback) {
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

function changeAdapterConfig(_adapter, changeCallback, doneCallback) {
    _adapter.getForeignObject(`system.adapter.${_adapter.namespace}`, (err, obj) => {
        if (!err && obj && !obj.native) {
            obj.native = {};
        }
        if (!err && obj && changeCallback(obj.native) !== false) {
            _adapter.setForeignObject(obj._id, obj, {}, err => {
                _adapter.log.info('soef.changeAdapterConfig: changed');
                if (doneCallback) {
                    doneCallback(err, obj);
                }
            });
        }
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function Timer(func, timeout, v1) {
    let timer = null;
    this.inhibit = false;
    this.enable = function (bo) {
        this.inhibit = bo === false;
    };
    this.set = function (func, timeout, v1) {
        if (timer) clearTimeout(timer);
        if (this.inhibit) {
            return;
        }
        timer = setTimeout(function () {
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

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function forEachInSystemObjectView(type, id, readyCallback, callback) {
    adapter.getObjectView('system', type, {startkey: `${id}.`, endkey: `${id}.\u9999`}, null, function (err, res) {
        if (err || !res || !res.rows) return readyCallback && readyCallback();
        let i = 0;
        function doIt() {
            if (i >= res.rows.length) {
                return readyCallback && readyCallback();
            }
            const o = res.rows[i++];
            if (o) {
                callback(o, doIt, type);
            } else {
                doIt();
            }
        }
        doIt();
    });
}

function delObjectAndState(id, options, callback) {
    if (typeof options == 'function') {
        callback = options;
        options = null;
    }
    adapter.delState(id, () =>
        adapter.delObject(id, options, () =>
            callback && callback()));
}

// collect first all states, then all devices and then all channels
function forEachObjectChild(id, options, readyCallback, callback) {
    if (typeof options === 'function') {
        callback = readyCallback;
        readyCallback = options;
        options = null;
    }
    if (!callback) {
        callback = readyCallback;
        readyCallback = null;
    }

    if (!adapter._namespaceRegExp.test(id)) {
        id = adapter.namespace + (id ? `.${id}` : '');
    }

    function doChannels() {
        forEachInSystemObjectView('channel', id, readyCallback, callback);
    }
    function doDevices() {
        forEachInSystemObjectView('device', id, doChannels, (o, next, type) =>
            callback(o, () => next(), type));
    }
    forEachInSystemObjectView('state', id, doDevices, callback);
}

function delObjectWithStates(id, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = undefined;
    }

    if (!id.startsWith(`${adapter.namespace}.`)) {
        id = `${adapter.namespace}.${id}`;
    }

    delObjectAndState(id, options, () => {
        forEachObjectChild(id, callback, (o, next) => {
            delObjectAndState(o.id, options, next);
            devices.remove(idWithoutNamespace(o.id));
        });
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
};
