import { createTheme } from '@mui/material/styles';

// A custom theme for this app
const theme = createTheme({
  cssVariables: true,
  palette: {
    primary: {
      main: '#fff',
      light: '#fff',
      dark: '#fff',
    },
    secondary: {
      main: '#fff',
      light: '#fff',
      dark: '#fff',
    },
    background: {
      default: '#000',
      paper: '#000',
    },

  },
  typography: {
    allVariants: {
      color: '#eee',
      fill: '#eee',
    },
  },
});

export default theme;
