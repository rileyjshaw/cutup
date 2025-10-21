import ShaderPad from 'shaderpad';
import handleTouch from './handleTouch';
import fragmentShaderSrc from './fragmentShader.glsl';

const MIN_STRIP_LENGTH = 8;

async function getAvailableCameras() {
	try {
		const devices = await navigator.mediaDevices.enumerateDevices();
		return devices.filter(device => device.kind === 'videoinput');
	} catch (error) {
		console.error('Error enumerating devices:', error);
		return [];
	}
}

async function getWebcamStream(deviceId = null) {
	const video = document.createElement('video');
	video.autoplay = video.playsInline = true;

	try {
		const constraints = {
			video: deviceId ? { deviceId: { exact: deviceId } } : true,
		};
		const stream = await navigator.mediaDevices.getUserMedia(constraints);
		video.srcObject = stream;
		await new Promise(resolve => (video.onloadedmetadata = resolve));
		document.body.appendChild(video);
	} catch (error) {
		console.error('Error accessing webcam:', error);
		throw error;
	}

	return video;
}

async function main() {
	const cameras = await getAvailableCameras();

	// State.
	let currentCameraIndex = 0;
	let video = await getWebcamStream();
	let stripLength = 32;
	let isPlaying = true;

	const outputCanvas = document.createElement('canvas');
	outputCanvas.width = video.videoWidth;
	outputCanvas.height = video.videoHeight;
	outputCanvas.style.position = 'fixed';
	outputCanvas.style.inset = '0';
	outputCanvas.style.width = '100vw';
	outputCanvas.style.height = '100vh';
	document.body.appendChild(outputCanvas);

	const shader = new ShaderPad(fragmentShaderSrc, { canvas: outputCanvas });

	shader.initializeUniform('u_gridLength', 'float', 2);
	shader.initializeUniform('u_stripLength', 'float', stripLength);
	shader.initializeTexture('u_webcam', video);

	async function switchCamera() {
		if (cameras.length <= 1) return;

		if (video.srcObject) {
			video.srcObject.getTracks().forEach(track => track.stop());
		}

		currentCameraIndex = (currentCameraIndex + 1) % cameras.length;
		video = await getWebcamStream(cameras[currentCameraIndex].deviceId);
		outputCanvas.width = video.videoWidth;
		outputCanvas.height = video.videoHeight;
		shader.updateTextures({ u_webcam: video });
	}

	document.addEventListener('keydown', e => {
		switch (e.key) {
			case 'ArrowUp':
			case 'ArrowRight':
				stripLength += 2;
				shader.updateUniforms({ u_stripLength: stripLength });
				break;
			case 'ArrowDown':
			case 'ArrowLeft':
				stripLength = Math.max(MIN_STRIP_LENGTH, stripLength - 2);
				shader.updateUniforms({ u_stripLength: stripLength });
				break;
			case ' ':
				isPlaying = !isPlaying;
				isPlaying ? play() : shader.pause();
				break;
			case 's':
				shader.save('cutup');
				break;
			case 'c':
				switchCamera();
				break;
		}
	});

	handleTouch(document.body, (direction, diff) => {
		stripLength = Math.max(MIN_STRIP_LENGTH, stripLength + Math.sign(diff) * 2 * (direction === 'x' ? 1 : -1));
		shader.updateUniforms({ u_stripLength: stripLength });
	});

	// Double-tap to switch camera (300ms threshold).
	let lastTapTime = 0;
	document.body.addEventListener('touchend', e => {
		const currentTime = Date.now();
		if (currentTime - lastTapTime < 300) {
			switchCamera();
		}
		lastTapTime = currentTime;
	});

	function play() {
		shader.play(() => {
			shader.updateTextures({ u_webcam: video });
		});
	}
	play();

	shader.onResize = shader.reset;
}

document.addEventListener('DOMContentLoaded', main);
