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

async function getWebcamStream(facingMode = 'user') {
	const video = document.createElement('video');
	video.autoplay = video.playsInline = true;

	try {
		const constraints = {
			video: {
				facingMode,
				width: 3840,
			},
		};
		const stream = await navigator.mediaDevices.getUserMedia(constraints);
		video.srcObject = stream;
		await new Promise(resolve => (video.onloadedmetadata = resolve));
	} catch (error) {
		console.error('Error accessing webcam:', error);
		throw error;
	}

	return video;
}

async function main() {
	// State.
	let currentFacingMode = 'user'; // Selfie camera.
	let video = await getWebcamStream(currentFacingMode);
	let stripLength = 32;
	let isPlaying = true;

	document.body.appendChild(video); // HACK: Desktop Safari won’t update the shader otherwise.

	const outputCanvas = document.createElement('canvas');
	outputCanvas.width = video.videoWidth;
	outputCanvas.height = video.videoHeight;
	outputCanvas.style.position = 'fixed';
	outputCanvas.style.inset = '0';
	outputCanvas.style.width = '100dvw';
	outputCanvas.style.height = '100dvh';
	document.body.appendChild(outputCanvas);

	const shader = new ShaderPad(fragmentShaderSrc, { canvas: outputCanvas });

	shader.initializeUniform('u_gridLength', 'float', 2);
	shader.initializeUniform('u_stripLength', 'float', stripLength);
	shader.initializeTexture('u_webcam', video);

	async function switchCamera() {
		if (video.srcObject) {
			video.srcObject.getTracks().forEach(track => track.stop());
		}

		const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
		try {
			video = await getWebcamStream(newFacingMode);
			shader.updateTextures({ u_webcam: video });
			currentFacingMode = newFacingMode;
			outputCanvas.style.transform = newFacingMode === 'environment' ? 'scaleX(-1)' : '';
		} catch (error) {
			console.error('Failed to switch camera:', error);
		}
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
}

document.addEventListener('DOMContentLoaded', main);
