import { type App } from 'vue'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import Home from '@/views/home/home.vue'

const routes: RouteRecordRaw[] = [
	{
		path: '/',
		name: 'Root',
		meta: {
			rank: 1001,
			title: '',
		},
		redirect: '/home',
		children: [
			{
				path: '/home',
				name: 'Home',
				meta: {
					rank: 1001,
					title: 'Home',
				},
				component: Home,
			},
		],
	},
]

const router = createRouter({
	history: createWebHistory(),
	routes,
	strict: true,
	scrollBehavior(_to, from, savedPosition) {
		return new Promise(resolve => {
			if (savedPosition) {
				return savedPosition
			} else {
				if (from.meta.saveScrollTop) {
					const top: number = document.documentElement.scrollTop || document.body.scrollTop
					resolve({ left: 0, top })
				}
			}
		})
	},
})

export async function setupRouter(app: App) {
	app.use(router)

	await router.isReady()
}
