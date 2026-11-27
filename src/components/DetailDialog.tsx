import { Close } from '@mui/icons-material';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import type { ReactNode } from 'react';

interface DetailDialogProps {
  open: boolean;
  onClose: () => void;
  // Names the panel for screen readers. Shown at the top only when showTitle is set.
  title: string;
  showTitle?: boolean;
  children: ReactNode;
  // CSS width of the panel. Content with a natural width, like a short bar chart, can ask for less.
  width?: string;
}

// A panel over the dashboard for the detail behind a dial, such as a chart. Black like the dashboard, with a faint
// edge so it stands out from the dimmed dials behind. Tap the cross or outside the panel to close it.
export default function DetailDialog({
  open,
  onClose,
  title,
  showTitle = false,
  children,
  width = '90vw',
}: DetailDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      slotProps={{
        // The dialog role is on the panel, so its name goes here too.
        paper: {
          'aria-label': title,
          'sx': {
            width,
            height: '90vh',
            maxWidth: 'none',
            maxHeight: 'none',
            margin: 0,
            borderRadius: '16px',
            border: '1px solid #222',
            backgroundColor: '#000',
            backgroundImage: 'none',
          },
        },
      }}
    >
      <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', padding: 1 }}>
        {showTitle && (
          <Box
            component="h2"
            sx={{ margin: 0, paddingLeft: 1, paddingRight: 6, fontSize: '1.1rem', fontWeight: 500, color: '#bbb' }}
          >
            {title}
          </Box>
        )}
        {/* In the corner over the content, so it costs the content no space. */}
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: 'absolute', top: 4, right: 4, zIndex: 1, color: '#bbb' }}
        >
          <Close />
        </IconButton>
        <Box sx={{ flex: 1, minHeight: 0 }}>
          {children}
        </Box>
      </Box>
    </Dialog>
  );
}
