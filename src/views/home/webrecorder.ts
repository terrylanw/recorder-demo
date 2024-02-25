import './lib/recorder.wav.min'

let write32 = function (bytes: any, pos: any, int32: any) {
	bytes[pos] = int32 & 0xff
	bytes[pos + 1] = (int32 >> 8) & 0xff
	bytes[pos + 2] = (int32 >> 16) & 0xff
	bytes[pos + 3] = (int32 >> 24) & 0xff
}

let readWavInfo = function (bytes: any) {
	//读取wav文件头，统一成44字节的头
	if (bytes.byteLength < 44) {
		return null
	}
	let wavView = bytes
	let eq = function (p: any, s: any) {
		for (let i = 0; i < s.length; i++) {
			if (wavView[p + i] != s.charCodeAt(i)) {
				return false
			}
		}
		return true
	}
	if (eq(0, 'RIFF') && eq(8, 'WAVEfmt ')) {
		let numCh = wavView[22]
		if (wavView[20] == 1 && (numCh == 1 || numCh == 2)) {
			//raw pcm 单或双声道
			let sampleRate = wavView[24] + (wavView[25] << 8) + (wavView[26] << 16) + (wavView[27] << 24)
			let bitRate = wavView[34] + (wavView[35] << 8)
			let heads = [wavView.subarray(0, 12)],
				headSize = 12 //head只保留必要的块
			//搜索data块的位置
			let dataPos = 0 // 44 或有更多块
			for (let i = 12, iL = wavView.length - 8; i < iL; ) {
				if (wavView[i] == 100 && wavView[i + 1] == 97 && wavView[i + 2] == 116 && wavView[i + 3] == 97) {
					//eq(i,"data")
					heads.push(wavView.subarray(i, i + 8))
					headSize += 8
					dataPos = i + 8
					break
				}
				let i0 = i
				i += 4
				i += 4 + wavView[i] + (wavView[i + 1] << 8) + (wavView[i + 2] << 16) + (wavView[i + 3] << 24)
				if (i0 == 12) {
					//fmt
					heads.push(wavView.subarray(i0, i))
					headSize += i - i0
				}
			}
			if (dataPos) {
				let wavHead = new Uint8Array(headSize)
				for (let i = 0, n = 0; i < heads.length; i++) {
					wavHead.set(heads[i], n)
					n += heads[i].length
				}
				return {
					sampleRate: sampleRate,
					bitRate: bitRate,
					numChannels: numCh,
					wavHead44: wavHead,
					dataPos: dataPos,
				}
			}
		}
	}
	return null
}

window.Recorder.WavMerge = function (fileBytesList: any, True: any, False: any) {
	//计算所有文件的长度、校验wav头
	let size = 0,
		baseInfo,
		wavHead44,
		dataIdxs = []
	let info: any

	for (let i = 0; i < fileBytesList.length; i++) {
		let file = fileBytesList[i]
		info = readWavInfo(file)
		if (!info) {
			False && False('第' + (i + 1) + '个文件不是单或双声道wav raw pcm格式音频，无法合并')
			return
		}
		dataIdxs.push(info.dataPos)
		wavHead44 || (wavHead44 = info.wavHead44)
		baseInfo || (baseInfo = info)
		if (
			baseInfo.sampleRate != info.sampleRate ||
			baseInfo.bitRate != info.bitRate ||
			baseInfo.numChannels != info.numChannels
		) {
			False && False('第' + (i + 1) + '个文件位数或采样率或声道数不一致')
			return
		}

		size += file.byteLength - info.dataPos
	}
	if (size > 50 * 1024 * 1024) {
		False && False('文件大小超过限制')
		return
	}

	//去掉wav头后全部拼接到一起
	let fileBytes = new Uint8Array(44 + size)
	let pos = 44
	for (let i = 0; i < fileBytesList.length; i++) {
		let pcm = new Uint8Array(fileBytesList[i].buffer.slice(dataIdxs[i]))
		fileBytes.set(pcm, pos)
		pos += pcm.byteLength
	}

	//添加新的wav头，直接修改第一个的头就ok了
	write32(wavHead44, 4, 36 + size)
	write32(wavHead44, 40, size)
	fileBytes.set(wavHead44 as any, 0)

	//计算合并后的总时长
	let duration = Math.round(((size / info.sampleRate) * 1000) / (info.bitRate == 16 ? 2 : 1))

	True(fileBytes, duration, baseInfo)
}

export class WebRecorder {
	testOutputWavLog: boolean
	testSampleRate: number
	testBitRate: number

	sendInterval: number

	realTimeSendTryType: string
	realTimeSendTryEncBusy: number
	realTimeSendTryTime: number
	realTimeSendTryNumber: number
	transferUploadNumberMax: number
	realTimeSendTryChunk: any

	rec: any
	wavBlobDataList: any[]

	constructor() {
		this.testOutputWavLog = false
		this.testSampleRate = 16000
		this.testBitRate = 16

		this.sendInterval = 300

		this.realTimeSendTryType = 'wav'
		this.realTimeSendTryEncBusy = 0
		this.realTimeSendTryTime = 0
		this.realTimeSendTryNumber = 0
		this.transferUploadNumberMax = 0
		this.realTimeSendTryChunk = null

		this.rec = null
		this.wavBlobDataList = []
	}

	realTimeSendTryReset(type: string) {
		this.realTimeSendTryType = type
		this.realTimeSendTryTime = 0
	}

	realTimeSendTry(buffers: any, bufferSampleRate: number, isClose: boolean) {
		const t1 = Date.now()
		if (this.realTimeSendTryTime === 0) {
			this.realTimeSendTryTime = t1
			this.realTimeSendTryEncBusy = 0
			this.realTimeSendTryNumber = 0
			this.transferUploadNumberMax = 0
			this.realTimeSendTryChunk = null
		}
		if (!isClose && t1 - this.realTimeSendTryTime < this.sendInterval) {
			return //控制缓冲达到指定间隔才进行传输
		}
		this.realTimeSendTryTime = t1

		const number = ++this.realTimeSendTryNumber
		let pcm = []
		let pcmSampleRate = 0

		if (buffers.length > 0) {
			//借用SampleData函数进行数据的连续处理，采样率转换是顺带的，得到新的pcm数据
			const chunk = window.Recorder.SampleData(
				buffers,
				bufferSampleRate,
				this.testSampleRate,
				this.realTimeSendTryChunk,
				{
					frameType: isClose ? '' : this.realTimeSendTryType,
				}
			)

			//清理已处理完的缓冲数据，释放内存以支持长时间录音，最后完成录音时不能调用stop，因为数据已经被清掉了
			// for (let i = this.realTimeSendTryChunk ? this.realTimeSendTryChunk.index : 0; i < chunk.index; i++) {
			// 	buffers[i] = null
			// }

			this.realTimeSendTryChunk = chunk //此时的chunk.data就是原始的音频16位pcm数据（小端LE），直接保存即为16位pcm文件、加个wav头即为wav文件、丢给mp3编码器转一下码即为mp3文件

			pcm = chunk.data
			pcmSampleRate = chunk.sampleRate
		}

		//没有新数据，或结束时的数据量太小，不能进行mock转码
		if (pcm.length == 0 || (isClose && pcm.length < 2000)) {
			this.transformBase64String(number, null, 0, null, isClose)
			return
		}

		//实时编码队列阻塞处理
		if (!isClose) {
			if (this.realTimeSendTryEncBusy >= 2) {
				console.log('编码队列阻塞，已丢弃一帧')
				return
			}
		}
		this.realTimeSendTryEncBusy++

		//通过mock方法实时转码成mp3、wav；16位pcm格式可以不经过此操作，直接发送new Blob([pcm.buffer],{type:"audio/pcm"}) 要8位的就必须转码
		const encStartTime = Date.now()
		const recMock = window.Recorder({
			type: this.realTimeSendTryType,
			sampleRate: this.testSampleRate, //采样率
			bitRate: this.testBitRate, //比特率
		})
		recMock.mock(pcm, pcmSampleRate)
		recMock.stop(
			(blob: any, duration: number) => {
				this.realTimeSendTryEncBusy && this.realTimeSendTryEncBusy--
				blob.encTime = Date.now() - encStartTime

				//转码好就推入传输
				this.transformBase64String(number, blob, duration, recMock, isClose)
			},
			(msg: string) => {
				this.realTimeSendTryEncBusy && this.realTimeSendTryEncBusy--

				//转码错误？没想到什么时候会产生错误！
				console.log('转码失败：' + msg)
			}
		)
	}

	transformBase64String(number: number, blobOrNull: any, duration: number, blobRec: any, isClose: boolean) {
		if (blobOrNull) {
			const blob = blobOrNull
			this.wavBlobDataList.push(blob)

			//*********发送方式一：Base64文本发送***************
			const reader = new FileReader()
			reader.onloadend = () => {
				this.transferUpload(reader.result as string, isClose, null, this.rec.buffers)
			}
			reader.readAsDataURL(blob)
		} else {
			this.transferUpload('', isClose, this.wavBlobDataList, this.rec.buffers)
		}
	}

	start() {
		if (this.rec) {
			this.rec.close()
		}

		this.rec = window.Recorder({
			type: 'unknown',
			onProcess: (buffers: any, powerLevel: any, bufferDuration: any, bufferSampleRate: number) => {
				//推入实时处理，因为是unknown格式，buffers和rec.buffers是完全相同的（此时采样率为浏览器采集音频的原始采样率），只需清理buffers就能释放内存，其他格式不一定有此特性。
				this.realTimeSendTry(buffers, bufferSampleRate, false)
			},
		})

		this.rec.open(
			() => {
				this.rec.start() //开始录音

				this.realTimeSendTryReset('wav') //重置环境，开始录音时必须调用一次
			},
			(msg: string) => {
				console.log('录音失败：', msg)
			}
		)
	}

	stop() {
		this.rec.close() //直接close掉即可，这个例子不需要获得最终的音频文件

		// this.rec.stop(
		// 	(blob: any) => {
		// 		console.log('成功')
		// 		console.log(blob)
		// 	},
		// 	(err: any) => {
		// 		console.log('错误')
		// 		console.log(err)
		// 	},
		// 	true
		// )

		// setTimeout(() => {
		// 	this.rec.close()
		// }, 2000)

		this.realTimeSendTry([], 0, true) //最后一次发送
	}

	transferUpload(base64String: string, isClose: boolean, blob: any, buffers: any) {}
}
