<script setup lang="ts">
import { WebRecorder } from './webrecorder'

const webRecorder = new WebRecorder()

let sourceArrayBufferList: ArrayBuffer[] = []

const audioCtl = new Audio()

function base64ToArrayBuffer(base64: string) {
	const binaryString = window.atob(base64)
	const len = binaryString.length
	const bytes = new Uint8Array(len)

	for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i)

	return bytes.buffer
}

webRecorder.transferUpload = (base64String: string, isClose: boolean, blobList: any, buffers: any) => {
	// console.log('---------base64String-----------')

	// console.log(base64String)
	// console.log(isClose)
	// console.log(buffers)

	// console.log(base64String)

	if (base64String) {
		sourceArrayBufferList.push(base64ToArrayBuffer(base64String.replace(/^data:audio\/\w+;base64,/, '')))
	}

	// console.log(sourceArrayBufferList)
	// console.log(isClose)

	if (blobList) {
		const files: any = []

		blobList.forEach((item: any) => {
			if (item) {
				const reader = new FileReader()
				reader.onloadend = function () {
					files.push(new Uint8Array(reader.result as ArrayBuffer))
				}
				reader.readAsArrayBuffer(item)
			}
		})

		setTimeout(() => {
			if (files.length > 0) {
				window.Recorder.WavMerge(
					files,
					(file: any, duration: any, info: any) => {
						info.type = 'wav'
						console.log('----------------------blob---------------------')
						console.log(duration)

						const audioCtl = new Audio()
						audioCtl.src = window.URL.createObjectURL(new Blob([file.buffer], { type: 'audio/wav' }))
						audioCtl.play()
					},
					(msg: string) => {
						console.log(msg)
					}
				)
			}
		}, 3000)
	}

	if (isClose) {
		// audioMerge(buffers)

		setTimeout(() => {
			const blobData = new Blob(sourceArrayBufferList, { type: 'audio/wav' })

			audioCtl.src = window.URL.createObjectURL(blobData)
		}, 2000)
		// const reader = new FileReader()
		// reader.onloadend = () => {
		// 	console.log('--------base64String---------')

		// 	console.log(reader.result)
		// }
		// reader.readAsDataURL(blobData)
	}
}

/* function audioMerge(buffers: any) {
	// let concatenatedArray = buffers.reduce((prev: any, current: any) => {
	// 	let concatenated = new Int16Array(prev.length + current.length)
	// 	concatenated.set(prev, 0)
	// 	concatenated.set(current, prev.length)

	// 	return concatenated
	// }, new Int16Array(0))

	// 通过mock方法实时转码成mp3、wav；16位pcm格式可以不经过此操作，直接发送new Blob([pcm.buffer],{type:"audio/pcm"}) 要8位的就必须转码
	// const encStartTime = Date.now()
	const recMock = window.Recorder({
		type: 'wav',
		sampleRate: 16000, //采样率
		bitRate: 16, //比特率
	})
	recMock.mock(buffers[2], 16000)
	recMock.stop(
		(blob: any) => {
			// blob.encTime = Date.now() - encStartTime

			//转码好就推入传输
			console.log('-----------合并数据------------------------')
			console.log(blob)

			const reader = new FileReader()
			reader.onloadend = () => {
				console.log(reader.result)
			}
			reader.readAsDataURL(blob)
		},
		(msg: string) => {
			//转码错误？没想到什么时候会产生错误！
			console.log('转码失败：' + msg)
		}
	)
} */

function handleStartRecorder() {
	webRecorder.start()
}

function handleCancelRecorder() {
	webRecorder.stop()
}
</script>

<template>
	<div>
		<NButton type="primary" @click="handleStartRecorder">开始录音</NButton>
		<NButton type="error" @click="handleCancelRecorder">停止录音</NButton>
	</div>
</template>

<style lang="scss" scoped></style>
