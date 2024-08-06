# This is a fork, to share a small fix for MagicHome LED Pixel controller (LD382A)

My wifi controller returns after power on / off 4 bytes of data, like an acknowledgement. The logic of the adapter cannot parse these additional 4 bytes, so all calls after it were not parsed anymore and so the ioBroker objects are not updated. The fix includes a way to ignore these 4 bytes. Maybe there is a better way, to do it? I would also recommend to remove the buffer and parse data array directly in onData method. Don't know, why we need a buffer there.

My issue was here (after debug log enabled):

```
write: 81 8a 8b 96 <-- Write "Refresh command"
raw data length: 14
raw data: 81 a1 24 00 61 64 ff ff ff 02 03 01 68 76 <-- Receive data, starts every time with 0x81, when there is a refresh before (contains colors r,g,b,w, power on/off, progOn, ...)
onData: raw: 81 a1 24 00 61 64 ff ff ff 02 03 01 68 76
onData: {"on":false,"progNo":0,"progOn":false,"preogSpeed":100,"red":255,"green":255,"blue":255,"white":2} <-- Refresh works, can be parsed - okay
write: 71 23 0f a3 <-- Send Power On or off command
raw data length: 4 <-- The controller returns 4 bytes like an acknowledgement. These are ignored by the fix.
raw data: 0f 71 23 a3
raw data length: 14 <-- this is a normal refresh response
raw data: 81 a1 23 00 61 64 ff ff ff 02 03 01 68 75
onData: raw: 0f 71 23 a3 81 a1 23 00 61 64 ff ff ff 02 <-- The buffer now has 4 bytes ack + 14 bytes response = not parsable anymore
raw data length: 14
raw data: 81 a1 23 00 61 64 ff ff ff 02 03 01 68 75
onData: raw: 03 01 68 75 81 a1 23 00 61 64 ff ff ff 02
raw data length: 14
raw data: 81 a1 23 00 61 64 ff ff ff 02 03 01 68 75
onData: raw: 03 01 68 75 81 a1 23 00 61 64 ff ff ff 02
write: 81 8a 8b 96 <-- manual refresh also don't work, because the buffer has 4 bytes ack in it
raw data length: 14
raw data: 81 a1 23 00 61 64 ff ff ff 02 03 01 68 75
onData: raw: 03 01 68 75 81 a1 23 00 61 64 ff ff ff 02
```

![Logo](admin/wifilight.png)
# ioBroker.wifilight 

![Number of Installations](http://iobroker.live/badges/wifilight-installed.svg)
![Number of Installations](http://iobroker.live/badges/wifilight-stable.svg)
[![NPM version](http://img.shields.io/npm/v/iobroker.wifilight.svg)](https://www.npmjs.com/package/iobroker.wifilight)

![Test and Release](https://github.com/iobroker-community-adapters/iobroker.wifilight/workflows/Test%20and%20Release/badge.svg)
[![Translation status](https://weblate.iobroker.net/widgets/adapters/-/wifilight/svg-badge.svg)](https://weblate.iobroker.net/engage/adapters/?utm_source=widget)
[![Downloads](https://img.shields.io/npm/dm/iobroker.wifilight.svg)](https://www.npmjs.com/package/iobroker.wifilight)

**This adapter uses Sentry libraries to automatically report exceptions and code errors to the developers.** For more details and for information how to disable the error reporting see [Sentry-Plugin Documentation](https://github.com/ioBroker/plugin-sentry#plugin-sentry)! Sentry reporting is used starting with js-controller 3.0.

## Description

ioBroker Adapter for WiFi Light

## Info
Supports LW12, LD382 and LD382A.
Support for Mi-Light/LimitlessLED RGBW added.

## Initial Creation
This adapter was initialy created by @soef at https://github.com/soef/ioBroker.wifilight but not maintained any more, so we moved it to iobroker-community so that bugs could be fixed. thanks @soef for his work.

### How to use the command state:
+ Possible identifiers are: ``red, r, green, g, blue, b, bri, sat, transition, on, off``
+ The string can be a JSON with or without parentheses. 
+ You can also assign a value by =
+ Range of colors: ```0..255``` 
+ Range of bri: ``0..100`` 

Some Examples:
```
r = 100; g = 250, b = 100
r: 0, g: 0, b = 255
red: 200, green: 0, blue: 0
{r:100, b: 200, transition: 20}
off
on
{on:0}
```
To change the color you do not have to use all three vallues.
For example, ``` red = 0 ```, blue and green will stay unchanged.

### r, g, b, w States:
+ Values 0..255
+ \#rrggbb[ww]

## Installation
Use the Adapter panel in iobroker to add an instance.

If not exists execute the following command in the iobroker root directory (e.g. in /opt/iobroker).
```
npm install iobroker.wifilight 
```

### Error fixing
In case of not working try to install the soef npm package
```
cd /opt/iobroker/node_modules/iobroker.wifilight 
sudo npm install soef 
```

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->
### 1.2.2 (2024-04-15)
* (mcm1957) Fix js-controller dependency

### 1.2.1 (2024-04-13)
* (mcm1957) Dependencies have been updated

### 1.2.0 (2024-04-13)
* (mcm1957) Adapter requires node.js 18 and js-controller >= 5 now
* (mcm1957) Dependencies have been updated

### 1.1.4 (2022-06-17)
* (Apollon77) Prevent crash case reported by sentry

### 1.1.3 (2022-04-27)
* (Apollon77) Prevent crash case reported by sentry

### 1.1.2 (2022-04-19)
* (Apollon77) Prevent crashes when states are controlled with null as value

### 1.1.1 (2022-04-17)
* (Apollon77) Prevent error logs with js-controller 3+
* (Apollon77) Added sentry for error reporting

### 1.1.0 (2020-04-09)
* (foxriver76) compatibility for js-c 3

### 1.0.0 (2019-10-18)
* (ldittmar) first version for the community

## License
The MIT License (MIT)

Copyright (c) 2024 iobroker-community-adapters <iobroker-community-adapters@gmx.de>
Copyright (c) 2020-2022 ioBroker Community Developers, 2019-2020 soef <soef@gmx.net>, 

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
