# Speartip Energy

A wall display for the house. It shows what the solar panels, home battery, grid connection and car are doing right now. The backend behind it also runs the AC units as heaters when electricity is cheap.

It's a React page served by a small Bun backend. The backend talks to everything else (FoxESS Cloud for the inverter and battery, Easee for the car charger, Smartcar for the car's battery level, Home Assistant for the heating and weather) so the display only ever calls one API.

## What's on the screen

Six dials, laid out for a phone in landscape:

- Solar generation
- House usage
- Home battery level, with an arrow showing whether it's charging or discharging
- Car battery level, with an arrow for charger power while the car is plugged in
- Grid import/export
- A washing machine timer

The screen sits dimmed until someone taps it, then brightens for three minutes.

Swipe down and there's a third row. The weather dial shows outdoor temperature in the middle and fills with cloud cover. The heating dial shows the living room temperature, with an orange flame when the gas boiler is firing and a heat pump icon when one of the ACs is heating. The plug dial shows where the electricity we've used today came from: green for grid import on the cheap overnight rate, blue for our own solar, red for grid import at the normal rate. The whole arc is today's usage, so it always fills; the colours show the split and the middle shows the total. Anything that went through the home battery counts as whatever charged it, so the battery filling up overnight and running the house all day shows as green, which is the point of having it. Whatever was already in the battery at midnight is assumed to be cheap import. FoxCloud only reports usage by the hour, so the hours the cheap rate starts and ends in (05:00 and 23:00) are split half and half. When the screen dims again it scrolls itself back to the top.

The washing machine timer is purely local. Tap it to start a 3.5 hour countdown, tap again to knock off 30 minutes, and it blinks when it's done.

### Approving car charging

The Easee charger is set to require authorisation, so a car that's plugged in sits waiting until someone approves it. Intelligent Octopus Go can't start a charge on its own while that's the case. When the charger is waiting, the car dial blinks "Approve". Tap it, confirm, and the backend tells Easee to start.

The display has to have the charging key before this works. Open the page once as `/#chargeKey=<CHARGE_START_KEY>` on the device. It stores the key in local storage and strips it from the address bar. The backend also refuses cross-site requests and rate-limits attempts to one every 30 seconds.

## The heating job

Every half hour (on the :00 and :30) the backend checks whether to heat the house with the AC units instead of gas:

- On the overnight rate (23:30 to 05:30 UK time) it heats the lounge and guest bedroom to 19°C
- During the day it heats all three once the home battery is at 90% or more and the panels are producing over 0.5 kW. It carries on until the battery drops below 80%, so a cloudy afternoon doesn't flip the units on and off every half hour.
- Outside those windows it turns off the units it switched on.

It only takes over a unit that's off. If someone changes a unit by hand while the job has it, the job leaves that unit alone until the current heating period ends. So if you switch the lounge off at 1am because it's too warm, it stays off until morning instead of coming back on at 1:30.

Its state lives in `~/.config/speartip-energy/heating-state.json`. The job is disabled entirely if `HA_URL` and `HA_TOKEN` aren't set.

## Running it

You need [Bun](https://bun.sh).

```bash
bun install
```

There are three ways to run it locally, depending on what you've changed.

| Command | What it does |
|---|---|
| `bun run dev` | Just the UI on http://localhost:9000, proxying `/api` to a backend you've started yourself on `127.0.0.1:29999`. |
| `bun run dev:remote` | The UI against the real backend, through an SSH tunnel over Tailscale. Use this when only the frontend has changed. |
| `bun run dev:mock` | The UI plus this checkout's backend (restarting on edits), with fake FoxCloud, Easee and Home Assistant. Use this when the backend has changed too. |

`dev:remote` is the real system. Approving charging from it really does start the charger.

In `dev:mock` you can change what the fakes report while it runs:

```bash
curl localhost:29990/_mock -d '{"chargerMode": 7}'          # car waiting for approval
curl localhost:29990/_mock -d '{"soc": 95, "solar": 3.1}'   # full battery, sunny
curl localhost:29990/_mock -d '{"gasHeating": false, "weather": "sunny", "cloudCover": 10}'
curl localhost:29990/_mock -d '{"todayCheapImport": 3, "todaySolar": 6, "todayPeakImport": 1}'   # plug dial
curl localhost:29990/_mock                                  # show the current fake state
```

The fake Home Assistant applies the heating job's commands, so you can watch the ACs come on. Open http://localhost:9000/#chargeKey=dev once to be able to approve charging. Mock mode sets every secret itself, so it can't reach a real service even if `server/.env` is present. The fields you can change are listed at the top of `server/dev/mock-upstreams.ts`.

## Configuration

The backend reads `server/.env`. Copy it from the server rather than recreating it:

```bash
scp hetzner:workspace/speartip-energy/server/.env server/.env
```

| Variable | Used for |
|---|---|
| `FOXCLOUD_API_KEY`, `FOXCLOUD_SN` | Inverter and battery readings |
| `EASEE_CHARGER_ID` | Which charger to read and control |
| `CHARGE_START_KEY` | Shared secret the display sends to approve charging. Unset disables approval. |
| `SMARTCAR_WEBHOOK_ID`, `SMART_CAR_MANAGEMENT_KEY` | Checking and verifying Smartcar's webhooks |
| `HA_URL`, `HA_TOKEN` | Home Assistant, for the heating job and the weather/heating dials |
| `SMART_CAR_CLIENT_ID`, `SMART_CAR_CLIENT_SECRET`, `OCTOPUS_API_KEY` | Nothing in the code reads these yet |

Easee doesn't use an API key. Log in once with your Easee account and the backend keeps the tokens fresh from then on:

```bash
bun server/easee/login.ts <email>
```

The password isn't stored. The tokens go in `~/.config/speartip-energy/easee-tokens.json`. Easee expires the refresh token if it goes unused for somewhere between 8 and 33 hours (it's never been pinned down), so if the server has been off overnight, expect to log in again.

The car's battery level arrives by webhook from Smartcar, at `/webhook/smartcar/battery`. The last reading is saved to `~/.config/speartip-energy/smartcar-state.json`, so a restart doesn't blank the car dial.

## Deploying

It runs on the `hetzner` box as the systemd service in `octofox-api.service`. The backend listens on `127.0.0.1:29999` and serves both the API and the built UI from `dist/`. nginx sits in front of it with a Certbot certificate, which is how Smartcar's webhooks get in.

On the server:

```bash
cd ~/workspace/speartip-energy
git pull
bun install
bun run build
sudo systemctl restart octofox-api
```

Logs are in `journalctl -u octofox-api`.

`docker-compose.yml` is left over from the template this started from. It points at Dockerfiles that don't exist and isn't used.

## Tests

```bash
bun run test             # server tests (bun test) and frontend component tests (vitest, real Chromium)
bun run test:visual      # screenshots of the whole dashboard on an emulated Pixel 7 in landscape
bun run lint
bun run tsc
```

The visual tests compare against committed screenshots in `visual/__screenshots__` and fail on a single changed pixel. After a deliberate UI change, regenerate them with `bun run test:visual:update` and look at the new images before committing them.

None of the tests touch real services. `server/test/setup.ts` points every state file at a temp folder and makes any unmocked network call fail, so a test can't spend the real Easee refresh token.
