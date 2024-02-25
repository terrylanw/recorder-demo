Recorder.WavMerge = function (fileBytesList, True, False) {
	//计算所有文件的长度、校验wav头
	let size = 0,
		baseInfo,
		wavHead44,
		dataIdxs = []
	for (let i = 0; i < fileBytesList.length; i++) {
		let file = fileBytesList[i]
		let info = readWavInfo(file)
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
	fileBytes.set(wavHead44, 0)

	//计算合并后的总时长
	let duration = Math.round(((size / info.sampleRate) * 1000) / (info.bitRate == 16 ? 2 : 1))

	True(fileBytes, duration, baseInfo)
}
let write32 = function (bytes, pos, int32) {
	bytes[pos] = int32 & 0xff
	bytes[pos + 1] = (int32 >> 8) & 0xff
	bytes[pos + 2] = (int32 >> 16) & 0xff
	bytes[pos + 3] = (int32 >> 24) & 0xff
}
let readWavInfo = function (bytes) {
	//读取wav文件头，统一成44字节的头
	if (bytes.byteLength < 44) {
		return null
	}
	let wavView = bytes
	let eq = function (p, s) {
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

//合并测试
var test = function () {
	var audios = Runtime.LogAudios

	var idx = -1 + 1,
		files = [],
		exclude = 0


	var read = function () {
		idx++
		if (idx >= audios.length) {
			if (!files.length) {
				Runtime.Log('至少需要录1段wav' + (exclude ? '，已排除' + exclude + '个非wav文件' : ''), 1)
				return
			}
			Recorder.WavMerge(
				files,
				function (file, duration, info) {
					Runtime.Log('合并' + files.length + '个成功' + (exclude ? '，排除' + exclude + '个非wav文件' : ''), 2)
					console.log(info)
					info.type = 'wav'
					Runtime.LogAudio(new Blob([file.buffer], { type: 'audio/wav' }), duration, { set: info })
				},
				function (msg) {
					Runtime.Log(msg + '，请清除日志后重试', 1)
				}
			)
			return
		}
		if (!/wav/.test(audios[idx].blob.type)) {
			exclude++
			read()
			return
		}
		var reader = new FileReader()
		reader.onloadend = function () {
			files.push(new Uint8Array(reader.result))
			read()
		}
		reader.readAsArrayBuffer(audios[idx].blob)
	}
  
	read()
}
