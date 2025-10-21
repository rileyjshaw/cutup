import ShaderPad from 'shaderpad';
import handleTouch from './handleTouch';
import fragmentShaderSrc from './fragmentShader.glsl';

async function getWebcamStream() {
	const video = document.createElement('video');
	video.autoplay = video.playsInline = true;

	try {
		const stream = await navigator.mediaDevices.getUserMedia({ video: true });
		video.srcObject = stream;
		await new Promise(resolve => (video.onloadedmetadata = resolve));
	} catch (error) {
		console.error('Error accessing webcam:', error);
		throw error;
	}

	return video;
}

async function main() {
	const video = await getWebcamStream();

	const outputCanvas = document.createElement('canvas');
	outputCanvas.width = video.videoWidth;
	outputCanvas.height = video.videoHeight;
	outputCanvas.style.position = 'fixed';
	outputCanvas.style.inset = '0';
	outputCanvas.style.width = '100vw';
	outputCanvas.style.height = '100vh';
	document.body.appendChild(outputCanvas);

	const shader = new ShaderPad(fragmentShaderSrc, { canvas: outputCanvas });

	// State.
	let gridLength = 2;
	let stripLength = 100;
	let isPlaying = true;

	shader.initializeUniform('u_gridLength', 'float', gridLength);
	shader.initializeUniform('u_stripLength', 'float', stripLength);
	shader.initializeTexture('u_webcam', video);

	document.addEventListener('keydown', e => {
		switch (e.key) {
			case 'ArrowUp':
				++gridLength;
				shader.updateUniforms({ u_gridLength: gridLength });
				break;
			case 'ArrowDown':
				gridLength = Math.max(2, gridLength - 1);
				shader.updateUniforms({ u_gridLength: gridLength });
				break;
			case 'ArrowRight':
				stripLength += 2;
				shader.updateUniforms({ u_stripLength: stripLength });
				break;
			case 'ArrowLeft':
				stripLength = Math.max(8, stripLength - 2);
				shader.updateUniforms({ u_stripLength: stripLength });
				break;
			case ' ':
				isPlaying = !isPlaying;
				isPlaying ? play() : shader.pause();
				break;
			case 's':
				shader.save('cuts');
				break;
		}
	});

	handleTouch(document.body, (direction, diff) => {
		if (direction === 'x') {
			stripLength = Math.max(4, stripLength + Math.sign(diff));
			shader.updateUniforms({ u_stripLength: stripLength });
		} else {
			gridLength = Math.max(2, gridLength - Math.sign(diff));
			shader.updateUniforms({ u_gridLength: gridLength });
		}
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
