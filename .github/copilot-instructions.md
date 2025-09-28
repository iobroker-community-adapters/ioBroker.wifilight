# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.0
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

## WiFi Light Adapter Context

This is the **ioBroker.wifilight** adapter, which enables control of WiFi-based lighting devices through the ioBroker platform. 

**Key Features:**
- Support for LW12, LD382, and LD382A WiFi light controllers
- Mi-Light/LimitlessLED RGBW compatibility
- RGB color control, brightness adjustment, and saturation settings
- Network discovery of WiFi light devices
- Command state support with multiple identifiers (red, r, green, g, blue, b, bri, sat, transition, on, off)
- JSON and assignment-based command formats

**Hardware Integration:**
- Communicates directly with WiFi light controllers over TCP/UDP
- Handles network discovery and device connectivity
- Manages color space conversions (RGB, HSV) 
- Controls brightness (0-100) and color values (0-255)
- Supports transitions and scene management

**Unique Requirements:**
- Network communication reliability (handle EHOSTUNREACH errors)
- Color accuracy and conversion between formats
- Device state synchronization
- Multiple controller protocol support
- TCP/UDP socket management for different device types

## Testing

### Unit Testing
- Use Jest as the primary testing framework for ioBroker adapters
- Create tests for all adapter main functions and helper methods
- Test error handling scenarios and edge cases
- Mock external API calls and hardware dependencies
- For adapters connecting to APIs/devices not reachable by internet, provide example data files to allow testing of functionality without live connections
- Example test structure:
  ```javascript
  describe('AdapterName', () => {
    let adapter;
    
    beforeEach(() => {
      // Setup test adapter instance
    });
    
    test('should initialize correctly', () => {
      // Test adapter initialization
    });
  });
  ```

### Integration Testing

**IMPORTANT**: Use the official `@iobroker/testing` framework for all integration tests. This is the ONLY correct way to test ioBroker adapters.

**Official Documentation**: https://github.com/ioBroker/testing

#### Framework Structure
Integration tests MUST follow this exact pattern:

```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

// Define test coordinates or configuration
const TEST_COORDINATES = '52.520008,13.404954'; // Berlin
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Use tests.integration() with defineAdditionalTests
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test adapter with specific configuration', (getHarness) => {
            let harness;

            before(() => {
                harness = getHarness();
            });

            it('should configure and start adapter', function () {
                return new Promise(async (resolve, reject) => {
                    try {
                        harness = getHarness();
                        
                        // Configure adapter with test data
                        await harness.changeAdapterConfig('adapterName', {
                            enabled: true,
                            // Add specific test configuration
                        });

                        // Start adapter and wait
                        await harness.startAdapterAndWait();
                        
                        // Your test assertions here
                        await wait(2000);
                        
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        });
    }
});
```

#### Key Testing Patterns
- **Always use** `tests.integration()` with `defineAdditionalTests`
- **Never use** direct adapter instantiation or manual setup
- Use `getHarness()` to get the test harness instance
- Configure adapter with `harness.changeAdapterConfig()`
- Start adapter with `harness.startAdapterAndWait()`
- Add appropriate wait times for async operations
- Test state changes with `harness.getState()` and `harness.setState()`

### WiFi Light Specific Testing

For the WiFi Light adapter, ensure testing covers:

```javascript
// Test color command parsing
it('should parse color commands correctly', async function() {
    // Test JSON format: {"red": 255, "green": 128, "blue": 0}
    // Test assignment format: red=255,green=128,blue=0
    // Test abbreviated format: r=255,g=128,b=0
});

// Test network communication (with mocks)
it('should handle network connectivity issues', async function() {
    // Mock EHOSTUNREACH errors
    // Test reconnection logic
    // Verify state synchronization
});

// Test device discovery
it('should discover WiFi light devices', async function() {
    // Mock network scanning responses
    // Test device identification (LW12, LD382, LD382A)
    // Verify device registration
});
```

### Legacy Testing Support
The adapter includes legacy testing patterns for backwards compatibility. When working with existing test files:

```javascript
// Legacy pattern - maintain compatibility but prefer new @iobroker/testing
const harness = require('./lib/harness');

describe('Legacy test compatibility', () => {
    // Existing test patterns remain valid
});
```

## Error Handling

### Network Connectivity
WiFi Light adapters must handle various network scenarios:

```javascript
// Proper error handling for network operations
try {
    await this.connectToDevice(deviceIP);
} catch (error) {
    if (error.code === 'EHOSTUNREACH') {
        this.log.warn(`Device unreachable, scheduling retry: ${deviceIP}`);
        this.scheduleReconnect(deviceIP);
    } else {
        this.log.error(`Connection failed: ${error.message}`);
    }
}
```

### Color Value Validation
Always validate color inputs and handle edge cases:

```javascript
// Color value validation
validateColorValue(value, component) {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0 || numValue > 255) {
        this.log.warn(`Invalid ${component} value: ${value}, using 0`);
        return 0;
    }
    return numValue;
}
```

## State Management

### WiFi Light State Structure
Follow consistent state naming conventions:

```javascript
// Device states - use consistent naming
await this.setObjectNotExistsAsync(`devices.${deviceId}.red`, {
    type: 'state',
    common: {
        name: 'Red color component',
        type: 'number',
        role: 'level.color.red',
        read: true,
        write: true,
        min: 0,
        max: 255
    },
    native: {}
});

// Command state for complex operations
await this.setObjectNotExistsAsync(`devices.${deviceId}.command`, {
    type: 'state',
    common: {
        name: 'Color command (JSON or assignment format)',
        type: 'string',
        role: 'state',
        read: true,
        write: true
    },
    native: {}
});
```

### State Change Handling
Implement proper state change responses:

```javascript
async onStateChange(id, state) {
    if (!state || state.ack) return;
    
    const parts = id.split('.');
    const deviceId = parts[2];
    const command = parts[3];
    
    try {
        if (command === 'command') {
            await this.parseAndExecuteCommand(deviceId, state.val);
        } else if (['red', 'green', 'blue', 'brightness'].includes(command)) {
            await this.updateColorComponent(deviceId, command, state.val);
        }
        
        // Acknowledge the state change
        await this.setStateAsync(id, state.val, true);
    } catch (error) {
        this.log.error(`Failed to process state change ${id}: ${error.message}`);
    }
}
```

## Device Communication

### Protocol Handling
Support multiple WiFi light controller protocols:

```javascript
// Protocol abstraction for different device types
class DeviceProtocol {
    constructor(type, adapter) {
        this.type = type; // 'LW12', 'LD382', 'LD382A', 'MILIGHT'
        this.adapter = adapter;
    }
    
    async sendColorCommand(deviceIP, colors) {
        switch (this.type) {
            case 'LW12':
                return await this.sendLW12Command(deviceIP, colors);
            case 'LD382':
                return await this.sendLD382Command(deviceIP, colors);
            case 'MILIGHT':
                return await this.sendMiLightCommand(deviceIP, colors);
            default:
                throw new Error(`Unsupported device type: ${this.type}`);
        }
    }
}
```

### Discovery Implementation
Network device discovery patterns:

```javascript
async discoverDevices() {
    const discoveries = [];
    
    // UDP broadcast for device discovery
    const socket = dgram.createSocket('udp4');
    socket.bind(() => {
        socket.setBroadcast(true);
        
        // Send discovery packets for each supported protocol
        this.sendDiscoveryPacket(socket, 'LW12');
        this.sendDiscoveryPacket(socket, 'LD382');
    });
    
    socket.on('message', (msg, rinfo) => {
        const device = this.parseDiscoveryResponse(msg, rinfo);
        if (device) {
            discoveries.push(device);
            this.log.info(`Discovered ${device.type} device at ${device.ip}`);
        }
    });
}
```

## Configuration Management

### JSON Config Integration
The adapter uses JSON-based configuration. Handle config validation:

```javascript
// Configuration validation
validateConfig(config) {
    const errors = [];
    
    if (!config.devices || !Array.isArray(config.devices)) {
        errors.push('devices must be an array');
    }
    
    config.devices?.forEach((device, index) => {
        if (!device.ip || !this.isValidIP(device.ip)) {
            errors.push(`Device ${index}: Invalid IP address`);
        }
        if (!device.type || !['LW12', 'LD382', 'LD382A', 'MILIGHT'].includes(device.type)) {
            errors.push(`Device ${index}: Invalid device type`);
        }
    });
    
    return errors;
}
```

## Color Space Management

### RGB/HSV Conversions
Implement accurate color space conversions:

```javascript
// RGB to HSV conversion
rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;
    const d = max - min;
    
    s = max === 0 ? 0 : d / max;
    
    if (max === min) {
        h = 0;
    } else {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    
    return [Math.round(h * 360), Math.round(s * 100), Math.round(v * 100)];
}
```

## Performance Considerations

### Connection Pooling
Manage device connections efficiently:

```javascript
class ConnectionManager {
    constructor() {
        this.connections = new Map();
        this.reconnectTimers = new Map();
    }
    
    async getConnection(deviceIP) {
        if (this.connections.has(deviceIP)) {
            return this.connections.get(deviceIP);
        }
        
        const connection = await this.createConnection(deviceIP);
        this.connections.set(deviceIP, connection);
        return connection;
    }
    
    scheduleReconnect(deviceIP, delay = 30000) {
        if (this.reconnectTimers.has(deviceIP)) {
            clearTimeout(this.reconnectTimers.get(deviceIP));
        }
        
        const timer = setTimeout(async () => {
            try {
                await this.reconnectDevice(deviceIP);
            } catch (error) {
                this.scheduleReconnect(deviceIP, Math.min(delay * 2, 300000));
            }
        }, delay);
        
        this.reconnectTimers.set(deviceIP, timer);
    }
}
```

### Resource Cleanup
Ensure proper cleanup in the unload method:

```javascript
async onUnload(callback) {
    try {
        // Close all device connections
        for (const connection of this.connections.values()) {
            if (connection && connection.destroy) {
                connection.destroy();
            }
        }
        this.connections.clear();
        
        // Clear all reconnection timers
        for (const timer of this.reconnectTimers.values()) {
            clearTimeout(timer);
        }
        this.reconnectTimers.clear();
        
        // Clear discovery intervals
        if (this.discoveryInterval) {
            clearInterval(this.discoveryInterval);
        }
        
        this.log.info('WiFi Light adapter stopped');
        callback();
    } catch (error) {
        this.log.error(`Error during unload: ${error.message}`);
        callback();
    }
}
```

## Logging Best Practices

Use appropriate log levels for different scenarios:

```javascript
// Device discovery
this.log.info(`Discovered ${deviceType} device at ${deviceIP}`);

// Configuration issues
this.log.warn(`Invalid color value ${value} for ${component}, using default`);

// Network errors (non-critical)
this.log.warn(`Device ${deviceIP} unreachable, will retry`);

// Critical errors
this.log.error(`Failed to initialize device ${deviceIP}: ${error.message}`);

// Debug information (only in debug mode)
this.log.debug(`Sending color command: ${JSON.stringify(colorData)}`);
```

## Development Workflow

### Code Formatting
The project uses ESLint and Prettier. Always run before committing:

```bash
npm run lint       # Check for linting issues
npm run check      # TypeScript checking without emit
npm test          # Run all tests
```

### Release Process
The adapter uses automated release management:

```bash
npm run release   # Automated release with @alcalzone/release-script
```

Follow semantic versioning:
- `patch`: Bug fixes, performance improvements
- `minor`: New features, device support additions  
- `major`: Breaking changes, major refactoring

## Common Development Patterns

### Command Parsing
Handle various command formats consistently:

```javascript
parseCommand(commandString) {
    let command;
    
    // Try JSON format first
    try {
        command = JSON.parse(commandString);
        return this.validateCommand(command);
    } catch (e) {
        // Not JSON, try assignment format
    }
    
    // Parse assignment format: red=255,green=128,blue=0
    const assignments = commandString.split(',');
    command = {};
    
    assignments.forEach(assignment => {
        const [key, value] = assignment.split('=').map(s => s.trim());
        if (key && value !== undefined) {
            command[this.normalizeKey(key)] = parseInt(value, 10);
        }
    });
    
    return this.validateCommand(command);
}

normalizeKey(key) {
    const keyMap = {
        'r': 'red', 'g': 'green', 'b': 'blue',
        'bri': 'brightness', 'sat': 'saturation'
    };
    return keyMap[key.toLowerCase()] || key.toLowerCase();
}
```

### Async State Updates
Always handle state updates asynchronously:

```javascript
async updateDeviceState(deviceId, newState) {
    const statePromises = [];
    
    Object.entries(newState).forEach(([key, value]) => {
        const stateId = `devices.${deviceId}.${key}`;
        statePromises.push(
            this.setStateAsync(stateId, value, true)
        );
    });
    
    await Promise.all(statePromises);
}
```

This configuration provides GitHub Copilot with comprehensive context about the WiFi Light adapter's architecture, testing patterns, and development best practices specific to both ioBroker adapters and WiFi lighting device control.