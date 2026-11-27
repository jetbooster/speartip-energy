import BatteryChargingFull from '@mui/icons-material/BatteryChargingFull';
import Bolt from '@mui/icons-material/Bolt';
import ElectricCar from '@mui/icons-material/ElectricCar';
import SolarPower from '@mui/icons-material/SolarPower';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogTitle from '@mui/material/DialogTitle';
import Snackbar from '@mui/material/Snackbar';
import Grid from '@mui/material/Grid2';
import { useEffect, useRef, useState } from 'react';
import { ElectricMeter } from './assets/icons';
import { getChargeKey } from './chargeKey';
import Gauge from './components/Gauge';
import type { ValuesResponse } from './types/types';
import WashingMachineTimer from './components/WashingMachineTimer';
import EnergySourcesDial from './components/EnergySourcesDial';
import HeatingDial from './components/HeatingDial';
import Item from './components/Item';
import WeatherDial from './components/WeatherDial';
import { authoriseCharging } from './fetch';
import useBlink from './hooks/useBlink';

interface DisplayGridProps {
  onClick: () => void;
  // A swipe counts as activity too, so the display doesn't scroll back while someone is reading the lower row.
  onActivity: () => void;
  values: ValuesResponse;
  active: boolean;
  onChargeStarted: () => void;
}

// Explanations for the refusals the server can give. Anything else gets a generic message.
const CHARGE_ERRORS: Record<number, string> = {
  403: 'This display\'s charging key was rejected',
  404: 'Charging authorisation is not enabled on the server',
  409: 'The car is no longer waiting for authorisation',
  429: 'A request was just sent. Wait a moment and try again',
};

export default function DisplayGrid({ onClick, onActivity, values, active, onChargeStarted }: DisplayGridProps) {
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);

  // A car left waiting here never charges, because the charger blocks it whatever IOG asks for.
  const carNeedsAuthorising = values.charger?.carAwaitingAuthorization ?? false;
  const carBlink = useBlink(carNeedsAuthorising);

  // The page scrolls inside this box rather than the body, which can't scroll once it's fullscreen.
  const scroller = useRef<HTMLDivElement>(null);

  // Back to the main two rows whenever the display goes idle.
  useEffect(() => {
    if (!active) {
      scroller.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [active]);

  // Only a car that is actually waiting can be authorised. The server checks this again.
  const onCarTap = () => {
    if (carNeedsAuthorising) {
      setConfirming(true);
    }
  };

  const startCharging = async () => {
    setConfirming(false);
    const key = getChargeKey();
    if (!key) {
      setNotice({ severity: 'error', message: 'This display has no charging key set' });
      return;
    }
    setSending(true);
    try {
      const status = await authoriseCharging(key);
      if (status === 200) {
        setNotice({ severity: 'success', message: 'Charging authorised' });
        onChargeStarted();
      }
      else {
        setNotice({ severity: 'error', message: CHARGE_ERRORS[status] ?? 'Could not start charging' });
      }
    }
    catch {
      setNotice({ severity: 'error', message: 'Could not reach the server' });
    }
    finally {
      setSending(false);
    }
  };

  return (
    <>
      <Box
        ref={scroller}
        onClick={onClick}
        onTouchMove={onActivity}
        onWheel={onActivity}
        sx={{ height: '100vh', width: '100vw', overflowY: 'auto', scrollbarWidth: 'none' }}
      >
        <Grid
          container
          spacing={0}
          columns={{ xs: 4, sm: 12, md: 12 }}
          sx={{ height: '100vh', width: '100%' }}
          padding={1}
        >
          <Grid size={{ xs: 2, sm: 4, md: 4 }}>
            <Item>
              <Gauge
                val={Number(values.solar.toPrecision(2))}
                max={5.4}
                icon={<SolarPower />}
                colour="#166"
                units={{ normal: 'kW', milli: 'W' }}
                active={active}
              />
            </Item>
          </Grid>
          <Grid size={{ xs: 2, sm: 4, md: 4 }}>
            <Item>
              <Gauge
                val={Number(values.usage.toPrecision(2))}
                exponential
                max={10}
                icon={<Bolt />}
                colour="#661"
                units={{ normal: 'kW', milli: 'W' }}
                active={active}
              />
            </Item>
          </Grid>
          <Grid size={{ xs: 2, sm: 4, md: 4 }}>
            <Item>
              <Gauge
                val={values.batteryCharge}
                max={100}
                icon={<BatteryChargingFull />}
                colour="#066006"
                units={{ normal: '%', noSpace: true }}
                active={active}
                diff={values.batteryPower}
              />
            </Item>
          </Grid>
          <Grid size={{ xs: 2, sm: 4, md: 4 }}>
            <Item onClick={onCarTap}>
              <Gauge
                val={values.carChargeLevel ?? 0}
                max={100}
                icon={<ElectricCar />}
                colour="#036"
                units={{ normal: '%', noSpace: true }}
                // While waiting, the centre alternates between the charge level and a prompt to tap.
                text={carBlink ? 'Approve' : (values.carChargeLevel === null ? '—' : undefined)}
                textScale={carBlink ? 0.7 : 1}
                active={active || (carNeedsAuthorising && !carBlink)}
                // Charger power only shows as a flow while a car is plugged in.
                diff={values.charger?.carConnected ? (values.charger.totalPower ?? 0) : undefined}
              />
            </Item>
          </Grid>
          <Grid size={{ xs: 2, sm: 4, md: 4 }}>
            <Item>
              <Gauge
                val={Number(values.grid.toPrecision(2))}
                exponential
                max={10}
                icon={<ElectricMeter />}
                active={active}
                colour="#666"
                units={{ normal: 'kW', milli: 'W' }}
                startAngle={-90}
              />
            </Item>
          </Grid>
          <Grid size={{ xs: 2, sm: 4, md: 4 }}>
            <WashingMachineTimer active={active} />
          </Grid>

        </Grid>
        {/* Below the fold. Rows above are half of (100vh - padding), so 50vh less the bottom padding matches them. */}
        <Grid
          container
          spacing={0}
          columns={{ xs: 4, sm: 12, md: 12 }}
          sx={{ height: { sm: '50vh' }, width: '100%' }}
          paddingX={1}
          paddingBottom={1}
        >
          <Grid size={{ xs: 2, sm: 4, md: 4 }}>
            <WeatherDial weather={values.weather} active={active} />
          </Grid>
          <Grid size={{ xs: 2, sm: 4, md: 4 }}>
            <HeatingDial heating={values.heating} active={active} />
          </Grid>
          <Grid size={{ xs: 2, sm: 4, md: 4 }}>
            <EnergySourcesDial sources={values.energySources} active={active} />
          </Grid>
        </Grid>
      </Box>

      <Dialog open={confirming} onClose={() => setConfirming(false)}>
        <DialogTitle>Approve charging?</DialogTitle>
        <DialogActions>
          <Button size="large" onClick={() => setConfirming(false)}>Cancel</Button>
          <Button size="large" variant="contained" onClick={startCharging} disabled={sending}>
            Approve charging
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={notice !== null}
        autoHideDuration={6000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={notice?.severity ?? 'error'} variant="filled" onClose={() => setNotice(null)}>
          {notice?.message}
        </Alert>
      </Snackbar>
    </>
  );
}
