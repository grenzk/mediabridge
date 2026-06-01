import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import Button from 'primevue/button'
import Tooltip from 'primevue/tooltip'
import App from './App.vue'
import LogConsole from './LogConsole.vue'
import './styles.css'

const params = new URLSearchParams(window.location.search)
const rootComponent = params.get('view') === 'logs' ? LogConsole : App
const app = createApp(rootComponent)

app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.app-dark',
    },
  },
})

app.component('Button', Button)
app.directive('tooltip', Tooltip)
app.mount('#app')
