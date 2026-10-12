import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/main.css'

const app = createApp(App)

/** Global error catcher to ensure stability during game execution. */
app.config.errorHandler = (err, instance, info) => {
  console.error('[The Grand Audit Error]:', err, info)
}

app.use(createPinia())
app.mount('#app')

