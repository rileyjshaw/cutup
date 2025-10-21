#version 300 es
precision highp float;

in vec2 v_uv;
uniform vec2 u_resolution;
uniform sampler2D u_webcam;
uniform int u_nPasses;
uniform float u_stripLength;

out vec4 fragColor;

// Imagine cutting the image into stripLength strips along the x-axis. Then rearrange the strips so we take the first
// strip, then the last strip, then the second strip, then the second last strip, etc.
vec2 rearrangeStrips(vec2 uv, vec2 stripLength) {
    vec2 scaledUv = uv * stripLength;
    vec2 stripUv = floor(scaledUv);
    vec2 localUv = fract(scaledUv);
    vec2 isOdd = mod(stripUv, 2.0);

    if (isOdd.x == 0.0) {
        uv.x = (stripUv.x / 2.0 + localUv.x) / stripLength.x;
    } else {
        uv.x = (stripLength.x - (stripUv.x + 1.0) / 2.0 + localUv.x) / stripLength.x;
    }

    return uv;
}

vec2 rearrangeStripsY(vec2 uv, vec2 stripLength) {
    vec2 scaledUv = uv * stripLength;
    vec2 stripUv = floor(scaledUv);
    vec2 localUv = fract(scaledUv);
    vec2 isOdd = mod(stripUv, 2.0);

    if (isOdd.y == 0.0) {
        uv.y = (stripUv.y / 2.0 + localUv.y) / stripLength.y;
    } else {
        uv.y = (stripLength.y - (stripUv.y + 1.0) / 2.0 + localUv.y) / stripLength.y;
    }

    return uv;
}

vec2 mirror(vec2 uv, float gridLength) {
    // Divide the input into a grid of alternating mirrored images.
    vec2 scaledUv = uv * gridLength;
    vec2 gridUv = floor(scaledUv);
    vec2 localUv = fract(scaledUv);
    vec2 isOdd = mod(gridUv, 2.0);
    return mix(1.0 - localUv, localUv, isOdd);
}

// Crop the texture to preserve its aspect ratio (object-fit: contain).
vec2 correctAspectRatio(vec2 uv, vec2 resolution, vec2 textureSize) {
    float canvasAspect = resolution.x / resolution.y;
    float textureAspect = textureSize.x / textureSize.y;
    vec2 scale = vec2(min(canvasAspect / textureAspect, 1.0), min(textureAspect / canvasAspect, 1.0));
    return (uv - 0.5) * scale + 0.5;
}

void main() {
    vec2 uv = v_uv;
    
    // Thinking in terms of the image, you’d want to start by correcting the aspect ratio, then mirroring the image,
    // then rearranging the strips. But since we’re operating in UV space, we need to work backwards.
    uv = vec2(uv.x, 1.0 - uv.y);
    for (int i = 0; i < u_nPasses; ++i) {
        uv = rearrangeStripsY(uv, vec2(1.0, u_stripLength));
        uv = rearrangeStrips(uv, vec2(u_stripLength, 1.0));
    }
    uv = mirror(uv, pow(2.0, float(u_nPasses)));
    uv = correctAspectRatio(uv, u_resolution, vec2(textureSize(u_webcam, 0)));

    fragColor = texture(u_webcam, uv);
}
