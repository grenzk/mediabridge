import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import Button from 'primevue/button'
import Tooltip from 'primevue/tooltip'
import App from './App.vue'
import Hub from './Hub.vue'
import LogConsole from './LogConsole.vue'
import './styles.css'

const params = new URLSearchParams(window.location.search)
const views = {
  hub: {
    component: Hub,
    title: 'KnowledgeWorks',
  },
  logs: {
    component: LogConsole,
    title: 'KnowledgeWorks Logs',
  },
  mediabridge: {
    component: App,
    title: 'MediaBridge',
  },
}
const currentView = views[params.get('view')] ?? views.mediabridge
const rootComponent = currentView.component
const app = createApp(rootComponent)

document.title = currentView.title

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
