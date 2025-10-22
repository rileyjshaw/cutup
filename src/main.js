import ShaderPad from 'shaderpad';
import handleTouch from './handleTouch';
import fragmentShaderSrc from './fragmentShader.glsl';

const MIN_STRIP_LENGTH = 2;
const MAX_N_PASSES = 8;
const MAX_EXPORT_DIMENSION = 6000;

async function getWebcamStream(facingMode = 'user') {
	const video = document.createElement('video');
	video.autoplay = video.playsInline = video.muted = true;

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

	const app = document.getElementById('app');
	const shutter = document.querySelector('#shutter button');
	app.classList.add('ready');

	document.body.appendChild(video); // HACK: Desktop Safari won’t update the shader otherwise.

	const displayCanvas = document.createElement('canvas');
	displayCanvas.classList.add('display');
	displayCanvas.width = video.videoWidth * Math.pow(2, nPasses);
	displayCanvas.height = video.videoHeight * Math.pow(2, nPasses);
	document.body.appendChild(displayCanvas);
	const exportCanvas = document.createElement('canvas');
	const [displayShader, exportShader] = [displayCanvas, exportCanvas].map(canvas => {
		const shader = new ShaderPad(fragmentShaderSrc, { canvas });
		shader.initializeUniform('u_nPasses', 'int', nPasses);
		shader.initializeUniform('u_stripLength', 'float', stripLength);
		shader.initializeTexture('u_webcam', video);
		return shader;
	});

	function exportHighRes() {
		const baseWidth = video.videoWidth;
		const baseHeight = video.videoHeight;
		const scaleFactor = Math.pow(2, nPasses);

		let exportWidth = baseWidth * scaleFactor;
		let exportHeight = baseHeight * scaleFactor;

		if (exportWidth > MAX_EXPORT_DIMENSION || exportHeight > MAX_EXPORT_DIMENSION) {
			const aspectRatio = baseWidth / baseHeight;
			if (exportWidth > exportHeight) {
				exportWidth = MAX_EXPORT_DIMENSION;
				exportHeight = Math.round(MAX_EXPORT_DIMENSION / aspectRatio);
			} else {
				exportHeight = MAX_EXPORT_DIMENSION;
				exportWidth = Math.round(MAX_EXPORT_DIMENSION * aspectRatio);
			}
		}

		exportCanvas.width = exportWidth;
		exportCanvas.height = exportHeight;

		exportShader.updateUniforms({ u_nPasses: nPasses, u_stripLength: stripLength });
		exportShader.updateTextures({ u_webcam: video });
		document.body.appendChild(exportCanvas);
		setTimeout(() => {
			exportShader.step(0);
			exportShader.save('cutup');
			document.body.removeChild(exportCanvas);
		}, 8);
	}

	async function switchCamera() {
		if (video.srcObject) {
			video.srcObject.getTracks().forEach(track => track.stop());
		}

		const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
		try {
			video = await getWebcamStream(newFacingMode);
			displayShader.updateTextures({ u_webcam: video });
			currentFacingMode = newFacingMode;
			displayCanvas.style.transform = newFacingMode === 'environment' ? 'scaleX(-1)' : '';
		} catch (error) {
			console.error('Failed to switch camera:', error);
		}
	}

	document.addEventListener('keydown', e => {
		switch (e.key) {
			case 'ArrowUp':
				stripLength += 2;
				displayShader.updateUniforms({ u_stripLength: stripLength });
				break;
			case 'ArrowDown':
				stripLength = Math.max(MIN_STRIP_LENGTH, stripLength - 2);
				displayShader.updateUniforms({ u_stripLength: stripLength });
				break;
			case 'ArrowRight':
				nPasses = Math.min(MAX_N_PASSES, nPasses + 1);
				displayShader.updateUniforms({ u_nPasses: nPasses });
				break;
			case 'ArrowLeft':
				nPasses = Math.max(1, nPasses - 1);
				displayShader.updateUniforms({ u_nPasses: nPasses });
				break;
			case ' ':
				isPlaying = !isPlaying;
				isPlaying ? play() : displayShader.pause();
				break;
			case 's':
				exportHighRes();
				break;
		}
	});

	shutter.addEventListener('click', () => {
		exportHighRes();
	});

	handleTouch(document.body, (direction, diff) => {
		if (diff > 16) lastTapTime = 0;
		if (direction === 'x') {
			nPasses = Math.max(1, Math.min(8, nPasses + Math.sign(diff) / 8));
			displayShader.updateUniforms({ u_nPasses: nPasses });
		} else {
			stripLength = Math.max(MIN_STRIP_LENGTH, stripLength - Math.sign(diff) * 2);
			displayShader.updateUniforms({ u_stripLength: stripLength });
		}
	});

	// Double-tap to switch camera.
	let lastTapTime = 0;
	document.body.addEventListener('touchend', e => {
		const currentTime = Date.now();
		if (currentTime - lastTapTime < 300) {
			switchCamera();
		}
		lastTapTime = currentTime;
	});

	function play() {
		displayShader.play(() => {
			displayShader.updateTextures({ u_webcam: video });
		});
	}
	play();
}

document.addEventListener('DOMContentLoaded', main);
