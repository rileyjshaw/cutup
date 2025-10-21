import ShaderPad from 'shaderpad';
import handleTouch from './handleTouch';
import fragmentShaderSrc from './fragmentShader.glsl';

const MIN_STRIP_LENGTH = 2;
const MAX_N_PASSES = 8;

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
	let nPasses = 1;
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

	shader.initializeUniform('u_nPasses', 'int', nPasses);
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
				stripLength += 2;
				shader.updateUniforms({ u_stripLength: stripLength });
				break;
			case 'ArrowDown':
				stripLength = Math.max(MIN_STRIP_LENGTH, stripLength - 2);
				shader.updateUniforms({ u_stripLength: stripLength });
				break;
			case 'ArrowRight':
				nPasses = Math.min(MAX_N_PASSES, nPasses + 1);
				shader.updateUniforms({ u_nPasses: nPasses });
				break;
			case 'ArrowLeft':
				nPasses = Math.max(1, nPasses - 1);
				shader.updateUniforms({ u_nPasses: nPasses });
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
		if (direction === 'x') {
			nPasses = Math.max(1, Math.min(8, nPasses + Math.sign(diff) / 16));
			shader.updateUniforms({ u_nPasses: nPasses });
		} else {
			stripLength = Math.max(MIN_STRIP_LENGTH, stripLength - Math.sign(diff) * 2);
			shader.updateUniforms({ u_stripLength: stripLength });
		}
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
