import BatteryChargingFull from '@mui/icons-material/BatteryChargingFull';
import Bolt from '@mui/icons-material/Bolt';
import ElectricCar from '@mui/icons-material/ElectricCar';
import SolarPower from '@mui/icons-material/SolarPower';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Snackbar from '@mui/material/Snackbar';
import Grid from '@mui/material/Grid2';
import { useState } from 'react';
import { ElectricMeter } from './assets/icons';
import { getChargeKey } from './chargeKey';
import Gauge from './components/Gauge';
import type { ValuesResponse } from './types/types';
import WashingMachineTimer from './components/WashingMachineTimer';
import Item from './components/Item';
import { authoriseCharging } from './fetch';

interface DisplayGridProps {
  onClick: () => void;
  values: ValuesResponse;
  active: boolean;
  onChargeStarted: () => void;
}

const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

// Explanations for the refusals the server can give. Anything else gets a generic message.
const CHARGE_ERRORS: Record<number, string> = {
  403: 'This display\'s charging key was rejected',
  404: 'Charging authorisation is not enabled on the server',
  409: 'The car is no longer waiting for authorisation',
  429: 'A request was just sent. Wait a moment and try again',
};

// Status shown under the car dial. Plugged-in state takes priority over the age of the reading.
const carSubLabel = (values: ValuesResponse): string | undefined => {
  if (!values.charger) {
    return 'No charger data';
  }
  if (!values.charger.carConnected) {
    return 'Unplugged';
  }
  if (values.charger.carAwaitingAuthorization) {
    return 'Awaiting authorisation';
  }
  if (values.carChargeLevelUpdatedAt && Date.now() - Date.parse(values.carChargeLevelUpdatedAt) > STALE_AFTER_MS) {
    const hours = Math.floor((Date.now() - Date.parse(values.carChargeLevelUpdatedAt)) / (60 * 60 * 1000));
    return `Updated ${hours}h ago`;
  }
  return undefined;
};

export default function DisplayGrid({ onClick, values, active, onChargeStarted }: DisplayGridProps) {
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);

  const price = Number(values.price.toPrecision(2));

  // Only a car that is actually waiting can be authorised. The server checks this again.
  const onCarTap = () => {
    if (values.charger?.carAwaitingAuthorization) {
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
      <Grid
        onClick={onClick}
        container
        spacing={0}
        columns={{ xs: 4, sm: 12, md: 12 }}
        sx={{ height: '100vh', width: '100vw' }}
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
              text={values.carChargeLevel === null ? '—' : undefined}
              active={active}
              // Charger power only shows as a flow while a car is plugged in.
              diff={values.charger?.carConnected ? (values.charger.totalPower ?? 0) : undefined}
              subLabel={carSubLabel(values)}
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
              subLabel={`${price}p`}
            />
          </Item>
        </Grid>
        <Grid size={{ xs: 2, sm: 4, md: 4 }}>
          <WashingMachineTimer active={active} />
        </Grid>

      </Grid>

      <Dialog open={confirming} onClose={() => setConfirming(false)}>
        <DialogTitle>Start charging?</DialogTitle>
        <DialogContent>
          <DialogContentText>{`Electricity is currently ${price}p/kWh.`}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button size="large" onClick={() => setConfirming(false)}>Cancel</Button>
          <Button size="large" variant="contained" onClick={startCharging} disabled={sending}>
            Start charging
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
