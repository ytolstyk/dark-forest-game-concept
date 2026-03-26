import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider, createTheme, Button } from '@mantine/core'
import '@mantine/core/styles.css'
import './index.css'
import App from './App.tsx'

const theme = createTheme({
  primaryColor: 'green',
  components: {
    Button: Button.extend({
      defaultProps: { variant: 'outline' },
      styles: {
        root: {
          fontFamily: "'Courier New', monospace",
          letterSpacing: '3px',
          textTransform: 'uppercase',
        },
      },
    }),
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <App />
    </MantineProvider>
  </StrictMode>,
)
