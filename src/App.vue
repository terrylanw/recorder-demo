<script setup lang="ts"></script>

<template>
	<div>
		<RouterView v-slot="{ Component }">
			<Component :is="Component" />
		</RouterView>
	</div>
</template>
