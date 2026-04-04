# AWS IoT Greengrass Integration for DeepRacer Cars

## Goal

Add AWS IoT Greengrass to DREM-managed DeepRacer cars for device provisioning, health monitoring, real-time telemetry during races, and future edge compute capabilities. Retain existing SSM integration for fleet management and model deployment.

## Architecture

```
DeepRacer Car (Greengrass Core)
├── SSM Agent (existing — fleet management, model push)
├── Greengrass Nucleus
├── drem.CloudWatchAgent (system + custom metrics)
├── drem.CarStatus (ROS2 health + race readiness)
└── drem.TelemetryPublisher (ROS2 → MQTT, race-time only)
        │
        ├── Path A (default): MQTT → IoT Core → IoT Rule → Lambda → AppSync → Frontend
        └── Path C (optional): Local MQTT → RPi Timer relay → WebSocket → Frontend

DREM Backend (CDK)
├── IoT Core
│   ├── Fleet Provisioning Template
│   ├── IoT Rules (telemetry → Lambda)
│   └── Thing Groups (per DREM fleet)
├── Lambda — telemetry ingestion → AppSync
├── AppSync — CarTelemetry type + subscription
└── CloudWatch — DREM/Cars namespace

DREM Frontend
├── Devices page — summary health indicators
├── Car detail dashboard — full metrics + history
└── Race telemetry overlay (Phase 4)
```

## Device Provisioning

### Fleet Provisioning
Cars self-register using a shared claim certificate created at CDK deploy time. The claim cert is valid for the lifetime of the DREM installation — no expiry. Each car gets its own unique device certificate on first activation.

- **Thing name**: car hostname (human-friendly identifier)
- **Chassis serial**: read from `/sys/class/dmi/id/chassis_serial` (DeepRacer) or `/proc/cpuinfo` serial (RPi), stored as a Thing attribute. This is the car's true persistent identity — survives hostname changes and reflashes.
- **Thing Group**: maps to DREM fleet. Components deploy to Thing Groups, so adding a car to a fleet auto-deploys all Greengrass components.
- **Re-activation**: same hostname → existing Thing gets fresh certs, old ones revoked. Clean re-registration without orphan devices.

### Chassis Serial — Captured for ALL Activations
The chassis serial is read and stored during **every** activation, not just Greengrass activations. For SSM-only activations, it is stored as a tag on the SSM managed instance (`ChassisSerial`). This ensures:
- Every car has a persistent identity from day one, regardless of activation type
- If a car is later upgraded to Greengrass, its history is already linked by serial
- Duplicate SSM entries for the same physical car can be detected and avoided
- Relates to upstream issue [#17](https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/issues/17)

### Claim Certificate Storage
Created at CDK deploy time, stored in SSM Parameter Store. The admin UI surfaces the IoT endpoint and claim cert in the activation command generator (same pattern as SSM activation code today).

## CDK Infrastructure

### New construct: `GreengrassProvisioning`
- IoT Fleet Provisioning Template (hostname as Thing name, chassis serial as attribute)
- Claim certificate + private key (stored in SSM Parameter Store)
- IoT Thing Group per DREM fleet
- IoT Policy (connect, publish `drem/{fleetId}/{carName}/*`, subscribe to command topics)
- Token Exchange Role for Greengrass Nucleus
- IAM role for IoT Rule → Lambda

### New construct: `TelemetryIngestion`
- IoT Rule: routes `drem/+/+/telemetry` to Lambda
- Lambda: publishes to AppSync `updateCarTelemetry` mutation
- AppSync schema additions:
  - `CarTelemetry` type: `carName`, `fleetId`, `steering`, `throttle`, `speed`, `inferenceAction`, `inferenceConfidence`, `cpuPercent`, `memPercent`, `cpuTemp`, `wifiSignal`, `batteryLevel`, `rosNodeStatus`, `modelLoaded`, `raceReady`, `timestamp`
  - `updateCarTelemetry` mutation (IAM auth for Lambda, none data source pass-through)
  - `onCarTelemetry` subscription (Cognito auth for frontend, filtered by `carName`)
- `getCarMetrics` Lambda: reads CloudWatch `GetMetricData` for the car dashboard

## Car-Side Components

### Greengrass Nucleus
Installed by `car_activation.sh`. Configured with IoT endpoint, claim cert, Thing name = hostname, Thing Group = fleet.

### Component: `drem.CloudWatchAgent`
Standard CloudWatch agent with custom config:
- **System metrics**: CPU %, memory %, disk %, CPU temperature
- **Custom metrics** (via helper script):
  - WiFi signal strength (`iwconfig` / `nmcli`)
  - Battery voltage (graceful skip if hardware doesn't support)
  - Network latency to DREM endpoint
- CloudWatch namespace: `DREM/Cars`, dimensions: `CarName`, `FleetId`

### Component: `drem.CarStatus`
- Polls ROS2 node health (all required nodes running?)
- Checks model loaded status
- Publishes race readiness summary to IoT Device Shadow
- DREM reads shadow for Devices page health indicators

### Component: `drem.TelemetryPublisher`
- Subscribes to ROS2 topics:
  - `/ctrl_pkg/servo_msg` → steering angle + throttle
  - `/inference_pkg/rl_results` → action, confidence
  - `/sensor_fusion_pkg/imu` → accelerometer/gyro
  - `/camera_pkg/video_mjpeg` → optional, toggled via IoT shadow
- Aggregates at 5 Hz (configurable)
- Publishes to MQTT: `drem/{fleetId}/{carName}/telemetry`
- Only active during a race (controlled via IoT shadow race status)

## Activation Script

### New flags for `car_activation.sh`
- `-g` — enable Greengrass installation
- `-e IOT_ENDPOINT` — IoT Core endpoint
- `-t THING_GROUP` — Thing Group (fleet) to join

### Activation flow
```
1. Existing steps (hostname, password, WiFi, tweaks) — unchanged
2. Read chassis serial from /sys/class/dmi/id/chassis_serial
   (fall back to /proc/cpuinfo serial for RPi, or generate persistent UUID)
3. SSM install + activate + tag instance with ChassisSerial
4. If -g flag:
   a. Install Greengrass Nucleus (download from AWS)
   b. Write claim cert + key to /greengrass/v2/claim-certs/
   c. Run fleet provisioning (Thing name = hostname, chassis serial as attribute)
   d. Join Thing Group
   e. Start Greengrass systemd service
   f. Components auto-deploy from Thing Group deployment
5. Log chassis serial to stdout for operator reference
6. Reboot
```

### Re-activation (reflash)
- Same hostname → Thing re-registers with fresh certs
- Greengrass re-installs clean
- Components re-deploy from Thing Group
- Car history preserved via chassis serial linkage

## Admin UI

### Car activation page changes
- New toggle: "Enable Greengrass" (default: on)
- IoT endpoint auto-populated from DREM stack config
- Claim certificate auto-populated from SSM Parameter Store
- Fleet selector determines Thing Group
- Generated activation command includes `-g -e <endpoint> -t <thingGroup>`

### Devices page enhancements
- Existing columns remain (car name, SSM status, fleet, IP)
- New columns:
  - Health indicator (green/amber/red dot)
  - CPU temperature
  - WiFi signal strength
  - Race readiness status
- Health indicator logic:
  - **Green**: all services running, model loaded, WiFi strong, temps normal
  - **Amber**: degraded (high CPU, weak WiFi, no model loaded)
  - **Red**: offline, critical temp, key services down
- Click row → navigate to car detail dashboard

### Car detail dashboard (new page)
- Header: car name, chassis serial, fleet, current status
- **System panel**: CPU %, memory %, disk %, CPU temp (sparklines, last 30 min)
- **Network panel**: WiFi signal strength, connection type, latency
- **DeepRacer panel**: ROS2 node status, loaded model, inference engine
- **Race readiness**: checklist (WiFi ✓, model ✓, services ✓, battery ✓)
- **Car history**: events participated in (linked by chassis serial), per-event stats
- Data from CloudWatch `GetMetricData` via Lambda

## Telemetry Paths

### Path A: Cloud (default)
Car → Greengrass MQTT → IoT Core → IoT Rule → Lambda → AppSync mutation → Frontend subscription

Suitable for all deployments. ~1-2 second latency. No local infrastructure required beyond WiFi.

### Path C: Local relay (optional, RPi 4/5 timer only)
Car → Greengrass MQTT → IoT Core → RPi timer (Greengrass core) → WebSocket relay → Frontend

Lower latency (~100ms). Requires RPi 4 or 5 as timer (Zero doesn't have headroom).

The RPi timer is itself a Greengrass core device, provisioned via the same fleet provisioning mechanism but into a `drem-timers` Thing Group. A `drem.TelemetryRelay` component is deployed to the timer's Thing Group — it subscribes to car telemetry topics on IoT Core and bridges them to the existing WebSocket server in `timer.js`.

**Timer activation**: `timer_activation.sh` gets the same `-g` Greengrass flag as `car_activation.sh`. Operators who want Path C enable Greengrass on their timer during activation. The relay component auto-deploys via the Thing Group.

**Hardware note**: RPi Zero may not have sufficient resources to run Greengrass Nucleus alongside the timer service (512MB RAM, single-core). Greengrass on the timer is recommended for RPi 4/5 only. The timer script should detect the hardware and warn/skip if running on a Zero. Needs testing to confirm — the Zero is fine for timer-only duties but Greengrass + MQTT relay may push it too far.

Path selection is a DREM configuration option, not a per-car setting.

## Implementation Phases

### Phase 1: CDK Infrastructure + Activation Script
- `GreengrassProvisioning` construct (IoT, fleet provisioning, claim cert, Thing Groups)
- `car_activation.sh` Greengrass install + provisioning + chassis serial
- Admin UI: IoT endpoint + claim cert fields, Greengrass toggle
- **Deliverable**: cars register as Greengrass core devices

### Phase 2: Car Health Metrics
- `drem.CloudWatchAgent` component + `drem.CarStatus` component
- Devices page health indicators (green/amber/red)
- Car detail dashboard with CloudWatch data
- Chassis serial tracking + car history view
- **Deliverable**: operators see car health, drill into per-car details

### Phase 3: Live Telemetry Pipeline
- `drem.TelemetryPublisher` component (ROS2 → MQTT)
- `TelemetryIngestion` construct (IoT Rule → Lambda → AppSync)
- Frontend telemetry display on car dashboard
- Optional: RPi timer local relay (Path C)
- **Deliverable**: live car data visible in DREM during races

### Phase 4: Race Telemetry Overlay
- Integrate telemetry into streaming overlays
- Steering/throttle gauges, inference confidence visualisation
- Ties into task #29 (overlay redesign)
- **Deliverable**: spectator-facing telemetry during broadcasts

Phases 1 is the foundation. Phases 2 and 3 are independent once Phase 1 is deployed. Phase 4 depends on Phase 3.
