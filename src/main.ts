import { createApp } from 'vue'
import { setupRouter } from './router'
import App from './App.vue'

async function bootstrap() {
	const app = createApp(App)

	await setupRouter(app)

	// 添加meta标签，用于处理使用 Naive UI 和 Tailwind CSS 时的样式覆盖问题
	const meta = document.createElement('meta')
	meta.name = 'naive-ui-style'
	document.head.appendChild(meta)

	app.mount('#app')
}

bootstrap()
